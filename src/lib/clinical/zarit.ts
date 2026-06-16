// Escala de Zarit abreviada (7 ítems). Cada ítem 0-4. Total 0-28.
// Punto de corte sugerido: >=17 sobrecarga intensa.

export const ZARIT_ITEMS: { key: string; label: string }[] = [
  { key: "tiempo", label: "¿Siente que su familiar solicita más ayuda de la que realmente necesita?" },
  { key: "sin_tiempo", label: "¿Siente que por cuidarlo no tiene suficiente tiempo para usted?" },
  { key: "estresado", label: "¿Se siente estresado al cuidar de su familiar y atender otras responsabilidades?" },
  { key: "vergonzoso", label: "¿Se siente avergonzado por la conducta de su familiar?" },
  { key: "enojado", label: "¿Se siente enojado cuando está cerca de su familiar?" },
  { key: "salud", label: "¿Cree que su salud se ha visto afectada por cuidar de su familiar?" },
  { key: "carga", label: "En general, ¿se siente muy sobrecargado al cuidar de su familiar?" },
];

export const ZARIT_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Nunca" },
  { value: 1, label: "Casi nunca" },
  { value: 2, label: "A veces" },
  { value: 3, label: "Frecuentemente" },
  { value: 4, label: "Casi siempre" },
];

export function interpretZarit(total: number): string {
  if (total <= 7) return "Sin sobrecarga";
  if (total <= 16) return "Sobrecarga leve";
  return "Sobrecarga intensa";
}

export function deltaZarit(actual: number, basal: number | null): string {
  if (basal == null) return "Sin basal";
  const d = actual - basal;
  if (d === 0) return "Igual que el basal";
  if (d > 0) return `Aumentó ${d} pts vs basal`;
  return `Disminuyó ${Math.abs(d)} pts vs basal`;
}
