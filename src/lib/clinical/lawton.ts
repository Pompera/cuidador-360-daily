// Lawton y Brody — 8 ítems, 0-8
export type LawtonKey =
  | "telefono" | "compras" | "alimentos" | "casa"
  | "ropa" | "transporte" | "medicacion" | "finanzas";

export interface LawtonItem {
  key: LawtonKey;
  label: string;
  yesLabel: string;
  noLabel: string;
}

export const LAWTON_ITEMS: LawtonItem[] = [
  { key: "telefono", label: "Uso del teléfono", yesLabel: "Usa el teléfono por iniciativa propia", noLabel: "Necesita ayuda" },
  { key: "compras", label: "Compras", yesLabel: "Realiza compras solo", noLabel: "Necesita acompañamiento" },
  { key: "alimentos", label: "Preparación de alimentos", yesLabel: "Prepara alimentos", noLabel: "Necesita ayuda" },
  { key: "casa", label: "Cuidado de la casa", yesLabel: "Mantiene la casa", noLabel: "Necesita ayuda" },
  { key: "ropa", label: "Lavado de ropa", yesLabel: "Realiza el lavado", noLabel: "Necesita ayuda" },
  { key: "transporte", label: "Transporte", yesLabel: "Viaja de manera independiente", noLabel: "No puede hacerlo" },
  { key: "medicacion", label: "Medicación", yesLabel: "Controla sus medicamentos", noLabel: "Necesita supervisión" },
  { key: "finanzas", label: "Finanzas", yesLabel: "Administra dinero", noLabel: "Necesita ayuda" },
];

export function interpretLawton(score: number): string {
  if (score === 8) return "Independiente";
  if (score >= 5) return "Dependencia parcial";
  return "Dependencia importante";
}
