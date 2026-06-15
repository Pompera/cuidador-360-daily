export interface SignosInput {
  ta_sistolica?: number | null;
  ta_diastolica?: number | null;
  fc?: number | null;
  temperatura?: number | null;
  saturacion?: number | null;
  glucosa?: number | null;
}

export interface Alerta {
  nivel: "amarillo" | "rojo";
  texto: string;
}

export function evaluarSignos(s: SignosInput): Alerta[] {
  const a: Alerta[] = [];
  const { ta_sistolica: sis, ta_diastolica: dia, fc, temperatura: t, saturacion: sat, glucosa: g } = s;

  if (sis != null) {
    if (sis < 90) a.push({ nivel: "rojo", texto: `TA sistólica baja (${sis})` });
    else if (sis > 180) a.push({ nivel: "rojo", texto: `TA sistólica muy alta (${sis})` });
    else if (sis > 140) a.push({ nivel: "amarillo", texto: `TA sistólica elevada (${sis})` });
  }
  if (dia != null) {
    if (dia < 60) a.push({ nivel: "rojo", texto: `TA diastólica baja (${dia})` });
    else if (dia > 110) a.push({ nivel: "rojo", texto: `TA diastólica muy alta (${dia})` });
    else if (dia > 90) a.push({ nivel: "amarillo", texto: `TA diastólica elevada (${dia})` });
  }
  if (fc != null) {
    if (fc < 50) a.push({ nivel: "rojo", texto: `FC baja (${fc})` });
    else if (fc > 110) a.push({ nivel: "amarillo", texto: `FC elevada (${fc})` });
  }
  if (t != null && t >= 38) a.push({ nivel: "rojo", texto: `Fiebre (${t}°C)` });
  if (sat != null && sat < 92) a.push({ nivel: "rojo", texto: `Saturación baja (${sat}%)` });
  if (g != null) {
    if (g < 70) a.push({ nivel: "rojo", texto: `Glucosa baja (${g})` });
    else if (g > 250) a.push({ nivel: "rojo", texto: `Glucosa muy alta (${g})` });
  }
  return a;
}
