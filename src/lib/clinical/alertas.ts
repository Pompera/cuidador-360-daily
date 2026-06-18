// Capa 1: detección de alertas a partir del historial de chequeos diarios.
// No modifica el cuestionario — sólo analiza lo ya respondido.

export type Dominio = "cognicion" | "funcion" | "nutricion" | "seguridad" | "sintomas";

export interface ChequeoHist {
  fecha: string; // YYYY-MM-DD, más reciente primero
  respuestas: Record<string, string | string[]>;
}

export interface AlertasDetectadas {
  dominios: Dominio[];
  detalles: Record<Dominio, string[]>;
}

const DOM_LABEL: Record<Dominio, string> = {
  cognicion: "Cognición",
  funcion: "Función",
  nutricion: "Nutrición",
  seguridad: "Seguridad",
  sintomas: "Síntomas",
};

export function labelDominio(d: Dominio): string {
  return DOM_LABEL[d];
}

/** historial: chequeos ordenados por fecha DESC (más reciente primero). */
export function detectarAlertas(historial: ChequeoHist[]): AlertasDetectadas {
  const det: Record<Dominio, string[]> = {
    cognicion: [], funcion: [], nutricion: [], seguridad: [], sintomas: [],
  };
  if (historial.length === 0) return { dominios: [], detalles: det };
  const hoy = historial[0];
  const ayer = historial[1];
  const r = hoy.respuestas;

  // COGNICIÓN
  if (r.confuso === "mucho") {
    det.cognicion.push("Hoy: mucho más confundido que lo habitual.");
  } else if (r.confuso === "poco" && ayer?.respuestas.confuso === "poco") {
    det.cognicion.push("Confusión leve por 2 días seguidos.");
  }
  if (r.dormido === "mucho") {
    det.cognicion.push("Hoy: mucho más dormido o menos atento.");
  }

  // FUNCIÓN
  if (r.ayuda === "si") det.funcion.push("Necesitó más ayuda hoy.");
  if (r.camino === "poco") det.funcion.push("Caminó un poco menos que lo habitual.");
  if (r.camino === "mucho") det.funcion.push("Caminó mucho menos que lo habitual.");

  // NUTRICIÓN
  if (r.comio === "si" && ayer?.respuestas.comio === "si") {
    det.nutricion.push("Comió menos por 2 días seguidos.");
  }
  if (r.liquidos === "si" && ayer?.respuestas.liquidos === "si") {
    det.nutricion.push("Tomó menos líquidos por 2 días seguidos.");
  }

  // SEGURIDAD
  if (r.caida === "casi") det.seguridad.push("Casi caída hoy.");
  if (r.caida === "caida") det.seguridad.push("Caída registrada hoy.");

  // SÍNTOMAS
  const s = Array.isArray(r.sintomas) ? (r.sintomas as string[]) : [];
  if (s.includes("disnea")) det.sintomas.push("Falta de aire.");
  if (s.includes("dolor")) det.sintomas.push("Dolor importante.");
  if (s.includes("fiebre")) det.sintomas.push("Fiebre.");

  const dominios = (Object.keys(det) as Dominio[]).filter((d) => det[d].length > 0);
  return { dominios, detalles: det };
}
