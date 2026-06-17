// Clinical Frailty Scale — 1-9
export const CFS_LEVELS: { value: number; label: string; desc: string }[] = [
  { value: 1, label: "Muy en forma", desc: "Robusto, activo, energético." },
  { value: 2, label: "Bien", desc: "Sin enfermedad activa, activo ocasionalmente." },
  { value: 3, label: "Control de enfermedades", desc: "Enfermedades bien controladas; activo." },
  { value: 4, label: "Vulnerable", desc: "Síntomas limitan la actividad; no dependiente." },
  { value: 5, label: "Fragilidad leve", desc: "Requiere ayuda en actividades elaboradas (telefono, compras, dinero, aseo, medicamentos, preparar alimentos)." },
  { value: 6, label: "Fragilidad moderada", desc: "Necesita ayuda con todas las actividades fuera y para el baño." },
  { value: 7, label: "Fragilidad severa", desc: "Completamente dependiente para cuidado personal." },
  { value: 8, label: "Muy severa", desc: "Dependiente total para todo" },
  { value: 9, label: "Enfermedad terminal", desc: "Esperanza de vida < 6 meses." },
];
