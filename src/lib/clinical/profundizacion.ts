// Capa 2: profundización clínica — sólo cuando hay alertas.
import type { Dominio } from "./alertas";

export type Nivel = "leve" | "moderado" | "severo";

export interface PreguntaProf {
  key: string;
  dominio: Dominio;
  pregunta: string;
  opciones: { value: string; label: string; peso: number }[]; // 0..1
}

export const PREGUNTAS_PROF: PreguntaProf[] = [
  // COGNICIÓN
  { key: "cog_inicio", dominio: "cognicion", pregunta: "¿Desde cuándo nota el cambio?", opciones: [
    { value: "hoy", label: "Hoy", peso: 1 },
    { value: "2-3", label: "2 a 3 días", peso: 0.6 },
    { value: "semana", label: "Más de 1 semana", peso: 0.3 },
  ]},
  { key: "cog_reconoce", dominio: "cognicion", pregunta: "¿Reconoce a las personas?", opciones: [
    { value: "si", label: "Sí", peso: 0 },
    { value: "parcial", label: "Parcialmente", peso: 0.6 },
    { value: "no", label: "No", peso: 1 },
  ]},
  { key: "cog_fluctua", dominio: "cognicion", pregunta: "¿El estado mental cambia durante el día?", opciones: [
    { value: "si", label: "Sí, fluctúa", peso: 1 },
    { value: "no", label: "No", peso: 0 },
  ]},
  // FUNCIÓN
  { key: "fun_actividad", dominio: "funcion", pregunta: "¿Qué actividad dejó de realizar?", opciones: [
    { value: "caminar", label: "Caminar", peso: 0.8 },
    { value: "banarse", label: "Bañarse", peso: 0.5 },
    { value: "vestirse", label: "Vestirse", peso: 0.5 },
    { value: "comer", label: "Comer", peso: 0.8 },
    { value: "varias", label: "Varias", peso: 1 },
  ]},
  { key: "fun_curso", dominio: "funcion", pregunta: "¿El cambio fue repentino o progresivo?", opciones: [
    { value: "repentino", label: "Repentino", peso: 1 },
    { value: "progresivo", label: "Progresivo", peso: 0.5 },
  ]},
  // NUTRICIÓN
  { key: "nut_porcion", dominio: "nutricion", pregunta: "¿Deja comidas completas o sólo porciones?", opciones: [
    { value: "completas", label: "Completas", peso: 1 },
    { value: "parciales", label: "Parciales", peso: 0.5 },
  ]},
  { key: "nut_dias", dominio: "nutricion", pregunta: "¿Desde cuándo come menos?", opciones: [
    { value: "1-2", label: "1 a 2 días", peso: 0.4 },
    { value: "3-7", label: "3 a 7 días", peso: 0.7 },
    { value: "mas", label: "Más de una semana", peso: 1 },
  ]},
  // SEGURIDAD
  { key: "seg_golpe", dominio: "seguridad", pregunta: "En la caída, ¿hubo golpe en la cabeza?", opciones: [
    { value: "si", label: "Sí", peso: 1 },
    { value: "no", label: "No", peso: 0 },
  ]},
  { key: "seg_camina", dominio: "seguridad", pregunta: "¿Puede caminar después del evento?", opciones: [
    { value: "si", label: "Sí", peso: 0 },
    { value: "no", label: "No", peso: 1 },
  ]},
  // SÍNTOMAS
  { key: "sin_disnea", dominio: "sintomas", pregunta: "¿La falta de aire es en reposo o esfuerzo?", opciones: [
    { value: "reposo", label: "En reposo", peso: 1 },
    { value: "esfuerzo", label: "Con esfuerzo", peso: 0.5 },
    { value: "na", label: "No aplica", peso: 0 },
  ]},
  { key: "sin_dolor", dominio: "sintomas", pregunta: "¿El dolor es continuo o intermitente?", opciones: [
    { value: "continuo", label: "Continuo", peso: 1 },
    { value: "intermitente", label: "Intermitente", peso: 0.5 },
    { value: "na", label: "No aplica", peso: 0 },
  ]},
];

export function preguntasPara(dominios: Dominio[]): PreguntaProf[] {
  const set = new Set(dominios);
  return PREGUNTAS_PROF.filter((p) => set.has(p.dominio));
}

export interface ResultadoProf {
  dominio_principal: Dominio;
  nivel: Nivel;
  resumen: string;
}

export function evaluarProfundizacion(
  dominios: Dominio[],
  respuestas: Record<string, string>,
  alertasPrev: Record<Dominio, string[]>,
): ResultadoProf {
  const preguntas = preguntasPara(dominios);

  // peso promedio por dominio
  const porDom: Record<string, { suma: number; n: number; max: number }> = {};
  let pesoMaxGlobal = 0;
  for (const p of preguntas) {
    const v = respuestas[p.key];
    if (!v) continue;
    const op = p.opciones.find((o) => o.value === v);
    if (!op) continue;
    if (!porDom[p.dominio]) porDom[p.dominio] = { suma: 0, n: 0, max: 0 };
    porDom[p.dominio].suma += op.peso;
    porDom[p.dominio].n += 1;
    porDom[p.dominio].max = Math.max(porDom[p.dominio].max, op.peso);
    pesoMaxGlobal = Math.max(pesoMaxGlobal, op.peso);
  }

  // dominio principal: el de mayor promedio; empate → primero en `dominios`
  let principal: Dominio = dominios[0];
  let mejor = -1;
  for (const d of dominios) {
    const a = porDom[d];
    const prom = a && a.n > 0 ? a.suma / a.n : 0;
    if (prom > mejor) { mejor = prom; principal = d; }
  }

  // nivel: por bandera severa o promedio global
  const banderaSevera =
    respuestas.cog_reconoce === "no" ||
    respuestas.fun_curso === "repentino" ||
    respuestas.seg_golpe === "si" ||
    respuestas.seg_camina === "no" ||
    respuestas.sin_disnea === "reposo" ||
    respuestas.sin_dolor === "continuo";

  let nivel: Nivel;
  if (banderaSevera || pesoMaxGlobal >= 1) nivel = "severo";
  else if (mejor >= 0.5) nivel = "moderado";
  else nivel = "leve";

  const resumen = generarResumen(principal, dominios, respuestas, alertasPrev, nivel);
  return { dominio_principal: principal, nivel, resumen };
}

const LABEL: Record<Dominio, string> = {
  cognicion: "cognición", funcion: "función", nutricion: "nutrición",
  seguridad: "seguridad", sintomas: "síntomas",
};

function frase(dom: Dominio, r: Record<string, string>): string {
  switch (dom) {
    case "cognicion": {
      const partes: string[] = [];
      if (r.cog_inicio) partes.push(`cambios conductuales notados ${textInicio(r.cog_inicio)}`);
      if (r.cog_reconoce === "no") partes.push("no reconoce a las personas");
      else if (r.cog_reconoce === "parcial") partes.push("las reconoce sólo parcialmente");
      if (r.cog_fluctua === "si") partes.push("con fluctuación del estado mental durante el día");
      return partes.join(", ");
    }
    case "funcion": {
      const partes: string[] = [];
      if (r.fun_actividad) partes.push(`dejó de realizar: ${textActividad(r.fun_actividad)}`);
      if (r.fun_curso) partes.push(`de inicio ${r.fun_curso}`);
      return partes.join(", ");
    }
    case "nutricion": {
      const partes: string[] = [];
      if (r.nut_porcion === "completas") partes.push("deja comidas completas");
      else if (r.nut_porcion === "parciales") partes.push("come sólo porciones");
      if (r.nut_dias) partes.push(`desde hace ${textDias(r.nut_dias)}`);
      return partes.join(", ");
    }
    case "seguridad": {
      const partes: string[] = [];
      if (r.seg_golpe === "si") partes.push("caída con golpe en la cabeza");
      else if (r.seg_golpe === "no") partes.push("caída sin golpe craneal");
      if (r.seg_camina === "no") partes.push("no puede caminar después del evento");
      else if (r.seg_camina === "si") partes.push("conserva la marcha tras el evento");
      return partes.join(", ");
    }
    case "sintomas": {
      const partes: string[] = [];
      if (r.sin_disnea === "reposo") partes.push("falta de aire en reposo");
      else if (r.sin_disnea === "esfuerzo") partes.push("falta de aire con esfuerzo");
      if (r.sin_dolor === "continuo") partes.push("dolor continuo");
      else if (r.sin_dolor === "intermitente") partes.push("dolor intermitente");
      return partes.join(", ");
    }
  }
}

function textInicio(v: string) {
  return ({ hoy: "hoy", "2-3": "hace 2-3 días", semana: "hace más de una semana" } as Record<string, string>)[v] ?? v;
}
function textActividad(v: string) {
  return ({ caminar: "caminar", banarse: "bañarse", vestirse: "vestirse", comer: "comer", varias: "varias actividades" } as Record<string, string>)[v] ?? v;
}
function textDias(v: string) {
  return ({ "1-2": "1 a 2 días", "3-7": "3 a 7 días", mas: "más de una semana" } as Record<string, string>)[v] ?? v;
}

function generarResumen(
  principal: Dominio,
  dominios: Dominio[],
  respuestas: Record<string, string>,
  alertasPrev: Record<Dominio, string[]>,
  nivel: Nivel,
): string {
  const fPrincipal = frase(principal, respuestas);
  const otros = dominios.filter((d) => d !== principal);
  const otrosTxt = otros
    .map((d) => {
      const f = frase(d, respuestas);
      return f ? `${LABEL[d]} (${f})` : `${LABEL[d]} (${alertasPrev[d]?.join("; ") ?? "cambios"})`;
    })
    .filter(Boolean);

  let txt = `Se detectaron cambios clínicos a expensas de ${LABEL[principal]}`;
  if (fPrincipal) txt += `: ${fPrincipal}`;
  txt += ".";
  if (otrosTxt.length) txt += ` También: ${otrosTxt.join("; ")}.`;
  txt += ` Nivel estimado de deterioro: ${nivel}.`;
  return txt;
}

// Modificador de IEG según nivel de profundización (resta puntos al IEG basal del día).
export function ajusteIEG(nivel: Nivel): number {
  return nivel === "severo" ? -20 : nivel === "moderado" ? -10 : -5;
}

export function colorPorIEG(ieg: number): "verde" | "amarillo" | "naranja" | "rojo" {
  if (ieg < 40) return "rojo";
  if (ieg < 60) return "naranja";
  if (ieg < 80) return "amarillo";
  return "verde";
}
