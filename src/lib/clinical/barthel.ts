// Índice de Barthel — 10 ítems, 0-100
export type BarthelKey =
  | "alimentacion" | "bano" | "aseo" | "vestido" | "intestinal"
  | "vesical" | "sanitario" | "transferencias" | "movilidad" | "escaleras";

export interface BarthelItem {
  key: BarthelKey;
  label: string;
  options: { value: number; label: string }[];
}

export const BARTHEL_ITEMS: BarthelItem[] = [
  { key: "alimentacion", label: "Alimentación", options: [
    { value: 10, label: "Independiente" },
    { value: 5, label: "Necesita ayuda (cortar, untar)" },
    { value: 0, label: "Dependiente" },
  ]},
  { key: "bano", label: "Baño", options: [
    { value: 5, label: "Independiente" },
    { value: 0, label: "Dependiente" },
  ]},
  { key: "aseo", label: "Aseo personal", options: [
    { value: 5, label: "Realiza higiene personal" },
    { value: 0, label: "Necesita ayuda" },
  ]},
  { key: "vestido", label: "Vestido", options: [
    { value: 10, label: "Independiente" },
    { value: 5, label: "Necesita ayuda parcial" },
    { value: 0, label: "Dependiente" },
  ]},
  { key: "intestinal", label: "Control intestinal", options: [
    { value: 10, label: "Continente" },
    { value: 5, label: "Accidente ocasional" },
    { value: 0, label: "Incontinente" },
  ]},
  { key: "vesical", label: "Control vesical", options: [
    { value: 10, label: "Continente" },
    { value: 5, label: "Accidente ocasional" },
    { value: 0, label: "Incontinente" },
  ]},
  { key: "sanitario", label: "Uso del sanitario", options: [
    { value: 10, label: "Independiente" },
    { value: 5, label: "Necesita ayuda" },
    { value: 0, label: "Dependiente" },
  ]},
  { key: "transferencias", label: "Transferencias cama-sillón", options: [
    { value: 15, label: "Independiente" },
    { value: 10, label: "Mínima ayuda" },
    { value: 5, label: "Puede sentarse pero requiere ayuda" },
    { value: 0, label: "Dependiente" },
  ]},
  { key: "movilidad", label: "Movilidad", options: [
    { value: 15, label: "Camina independiente" },
    { value: 10, label: "Camina con ayuda" },
    { value: 5, label: "Silla de ruedas independiente" },
    { value: 0, label: "Dependiente" },
  ]},
  { key: "escaleras", label: "Escaleras", options: [
    { value: 10, label: "Independiente" },
    { value: 5, label: "Necesita ayuda" },
    { value: 0, label: "Dependiente" },
  ]},
];

export function interpretBarthel(score: number): string {
  if (score === 100) return "Independiente";
  if (score >= 60) return "Dependencia leve";
  if (score >= 40) return "Dependencia moderada";
  if (score >= 20) return "Dependencia severa";
  return "Dependencia total";
}
