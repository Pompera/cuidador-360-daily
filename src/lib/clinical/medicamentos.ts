export interface Toma { medicamento_id: string; fecha: string; estado: "tomado" | "omitido" }

/** % de tomas registradas como 'tomado' sobre el total registrado en los últimos `dias`. */
export function calcularAdherencia(tomas: Toma[], dias = 7): { pct: number; tomados: number; total: number } {
  const limite = new Date();
  limite.setDate(limite.getDate() - dias + 1);
  const lim = limite.toISOString().slice(0, 10);
  const recientes = tomas.filter((t) => t.fecha >= lim);
  const total = recientes.length;
  const tomados = recientes.filter((t) => t.estado === "tomado").length;
  const pct = total === 0 ? 0 : Math.round((tomados / total) * 100);
  return { pct, tomados, total };
}
