// Chequeo diario — preguntas y cálculo del IEG
export type Respuesta = string;

export interface PreguntaChequeo {
  key: string;
  area: "cognicion" | "funcion" | "nutricion" | "sintomas" | "seguridad" | "global";
  pregunta: string;
  tipo: "opciones" | "multi";
  opciones: { value: string; label: string; peso: number }[]; // peso 0 (normal) a 1 (peor)
}

export const PREGUNTAS: PreguntaChequeo[] = [
  { key: "confuso", area: "cognicion", pregunta: "¿Hoy está más confundido o desorientado que lo habitual?", tipo: "opciones",
    opciones: [
      { value: "no", label: "No", peso: 0 },
      { value: "poco", label: "Un poco más", peso: 0.5 },
      { value: "mucho", label: "Mucho más", peso: 1 },
    ]},
  { key: "dormido", area: "cognicion", pregunta: "¿Está más dormido o menos atento?", tipo: "opciones",
    opciones: [
      { value: "no", label: "No", peso: 0 },
      { value: "poco", label: "Un poco más", peso: 0.5 },
      { value: "mucho", label: "Mucho más", peso: 1 },
    ]},
  { key: "ayuda", area: "funcion", pregunta: "¿Necesitó más ayuda para sus actividades habituales?", tipo: "opciones",
    opciones: [
      { value: "no", label: "No", peso: 0 },
      { value: "si", label: "Sí", peso: 1 },
    ]},
  { key: "camino", area: "funcion", pregunta: "¿Caminó menos de lo habitual?", tipo: "opciones",
    opciones: [
      { value: "no", label: "No", peso: 0 },
      { value: "poco", label: "Un poco menos", peso: 0.5 },
      { value: "mucho", label: "Mucho menos", peso: 1 },
    ]},
  { key: "acostado", area: "funcion", pregunta: "¿Pasó más tiempo acostado o sentado?", tipo: "opciones",
    opciones: [
      { value: "no", label: "No", peso: 0 },
      { value: "si", label: "Sí", peso: 1 },
    ]},
  { key: "comio", area: "nutricion", pregunta: "¿Comió menos de lo habitual?", tipo: "opciones",
    opciones: [
      { value: "no", label: "No", peso: 0 },
      { value: "si", label: "Sí", peso: 1 },
    ]},
  { key: "liquidos", area: "nutricion", pregunta: "¿Tomó menos líquidos?", tipo: "opciones",
    opciones: [
      { value: "no", label: "No", peso: 0 },
      { value: "si", label: "Sí", peso: 1 },
    ]},
  { key: "sintomas", area: "sintomas", pregunta: "¿Presentó alguno de estos síntomas hoy?", tipo: "multi",
    opciones: [
      { value: "fiebre", label: "Fiebre", peso: 1 },
      { value: "tos", label: "Tos", peso: 0.5 },
      { value: "disnea", label: "Falta de aire", peso: 1 },
      { value: "dolor", label: "Dolor importante", peso: 0.8 },
      { value: "hinchazon", label: "Hinchazón", peso: 0.6 },
      { value: "ninguno", label: "Ninguno", peso: 0 },
    ]},
  { key: "caida", area: "seguridad", pregunta: "¿Tuvo caída o casi caída?", tipo: "opciones",
    opciones: [
      { value: "no", label: "No", peso: 0 },
      { value: "casi", label: "Casi caída", peso: 0.5 },
      { value: "caida", label: "Caída", peso: 1 },
    ]},
  { key: "mareo", area: "seguridad", pregunta: "¿Tuvo mareo?", tipo: "opciones",
    opciones: [
      { value: "no", label: "No", peso: 0 },
      { value: "si", label: "Sí", peso: 1 },
    ]},
  { key: "global", area: "global", pregunta: "Comparado con hace una semana, está:", tipo: "opciones",
    opciones: [
      { value: "mejor", label: "Mejor", peso: 0 },
      { value: "igual", label: "Igual", peso: 0 },
      { value: "peor", label: "Peor", peso: 0.6 },
      { value: "muchopeor", label: "Mucho peor", peso: 1 },
    ]},
];

const PESOS_AREA: Record<string, number> = {
  cognicion: 25,
  funcion: 25,
  sintomas: 15,
  nutricion: 10,
  seguridad: 10,
  global: 15,
};

export interface ResultadoChequeo {
  ieg: number; // 0-100
  color: "verde" | "amarillo" | "naranja" | "rojo";
  interpretacion: string;
  alertas: string[];
}

export function calcularIEG(respuestas: Record<string, Respuesta | string[]>): ResultadoChequeo {
  // Para cada área: promedio ponderado de pesos de respuestas
  const porArea: Record<string, { suma: number; n: number }> = {};
  for (const p of PREGUNTAS) {
    const r = respuestas[p.key];
    if (r === undefined) continue;
    let pesoMax = 0;
    if (p.tipo === "multi" && Array.isArray(r)) {
      // peor síntoma marcado
      pesoMax = r.reduce((mx, v) => {
        const op = p.opciones.find((o) => o.value === v);
        return Math.max(mx, op?.peso ?? 0);
      }, 0);
    } else if (typeof r === "string") {
      const op = p.opciones.find((o) => o.value === r);
      pesoMax = op?.peso ?? 0;
    }
    if (!porArea[p.area]) porArea[p.area] = { suma: 0, n: 0 };
    porArea[p.area].suma += pesoMax;
    porArea[p.area].n += 1;
  }
  let deficitTotal = 0;
  let pesoTotal = 0;
  for (const [area, peso] of Object.entries(PESOS_AREA)) {
    const a = porArea[area];
    if (!a || a.n === 0) continue;
    const promArea = a.suma / a.n; // 0..1
    deficitTotal += promArea * peso;
    pesoTotal += peso;
  }
  const ieg = pesoTotal > 0 ? Math.round(100 - (deficitTotal / pesoTotal) * 100) : 100;

  let color: ResultadoChequeo["color"] = "verde";
  let interpretacion = "Estable";
  if (ieg < 40) { color = "rojo"; interpretacion = "Alto riesgo — buscar valoración médica."; }
  else if (ieg < 60) { color = "naranja"; interpretacion = "Deterioro — vigilancia estrecha."; }
  else if (ieg < 80) { color = "amarillo"; interpretacion = "Vigilancia — observar evolución."; }

  // Alertas
  const alertas: string[] = [];
  if (respuestas["confuso"] === "mucho") alertas.push("Confusión nueva marcada");
  if (Array.isArray(respuestas["sintomas"])) {
    const s = respuestas["sintomas"] as string[];
    if (s.includes("disnea")) alertas.push("Falta de aire");
    if (s.includes("fiebre")) alertas.push("Fiebre");
    if (s.includes("dolor")) alertas.push("Dolor importante");
  }
  if (respuestas["caida"] === "caida") alertas.push("Caída registrada");
  if (respuestas["global"] === "muchopeor") alertas.push("Empeoramiento marcado vs semana previa");

  return { ieg, color, interpretacion, alertas };
}

export const COLOR_HEX: Record<ResultadoChequeo["color"], string> = {
  verde: "#3fa676",
  amarillo: "#e6b842",
  naranja: "#e8843a",
  rojo: "#d04a3a",
};

export const AREA_LABEL: Record<string, string> = {
  cognicion: "Cognición",
  funcion: "Función",
  nutricion: "Nutrición",
  sintomas: "Síntomas",
  seguridad: "Seguridad",
  global: "Global",
};

/** Devuelve el puntaje 0-100 por área (100 = sin déficit) para un set de respuestas. */
export function puntajePorArea(respuestas: Record<string, Respuesta | string[]>): Record<string, number> {
  const porArea: Record<string, { suma: number; n: number }> = {};
  for (const p of PREGUNTAS) {
    const r = respuestas[p.key];
    if (r === undefined) continue;
    let pesoMax = 0;
    if (p.tipo === "multi" && Array.isArray(r)) {
      pesoMax = r.reduce((mx, v) => {
        const op = p.opciones.find((o) => o.value === v);
        return Math.max(mx, op?.peso ?? 0);
      }, 0);
    } else if (typeof r === "string") {
      const op = p.opciones.find((o) => o.value === r);
      pesoMax = op?.peso ?? 0;
    }
    if (!porArea[p.area]) porArea[p.area] = { suma: 0, n: 0 };
    porArea[p.area].suma += pesoMax;
    porArea[p.area].n += 1;
  }
  const out: Record<string, number> = {};
  for (const area of Object.keys(PESOS_AREA)) {
    const a = porArea[area];
    if (!a || a.n === 0) continue;
    out[area] = Math.round(100 - (a.suma / a.n) * 100);
  }
  return out;
}
