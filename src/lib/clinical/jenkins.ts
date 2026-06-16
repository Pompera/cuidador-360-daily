// Escala de Sueño de Jenkins (JSS-4)
// 4 ítems, frecuencia en el último mes. Cada uno 0-5. Total 0-20.
// A mayor puntaje, peor calidad de sueño.

export const JENKINS_ITEMS: { key: string; label: string }[] = [
  { key: "conciliar", label: "Dificultad para conciliar el sueño" },
  { key: "despertar_noche", label: "Despertarse varias veces durante la noche" },
  { key: "mantener", label: "Dificultad para mantenerse dormido (incluye despertar temprano)" },
  { key: "cansancio", label: "Despertarse cansado o agotado tras dormir lo habitual" },
];

export const JENKINS_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Ningún día" },
  { value: 1, label: "1 a 3 días" },
  { value: 2, label: "4 a 7 días" },
  { value: 3, label: "8 a 14 días" },
  { value: 4, label: "15 a 21 días" },
  { value: 5, label: "22 a 31 días" },
];

export function interpretJenkins(total: number): string {
  if (total <= 4) return "Sueño adecuado";
  if (total <= 9) return "Alteración leve del sueño";
  if (total <= 14) return "Alteración moderada del sueño";
  return "Alteración severa del sueño";
}

export function deltaJenkins(actual: number, basal: number | null): string {
  if (basal == null) return "Sin basal";
  const d = actual - basal;
  if (d === 0) return "Igual que el basal";
  if (d > 0) return `Empeoró ${d} pts vs basal`;
  return `Mejoró ${Math.abs(d)} pts vs basal`;
}
