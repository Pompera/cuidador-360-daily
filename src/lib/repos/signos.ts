/** Repositorio de signos vitales. */
import { crearRepositorio } from "./base";

export interface SignoVital extends Record<string, unknown> {
  id: string;
  patient_id: string;
  fecha: string;
  ta_sistolica: number | null;
  ta_diastolica: number | null;
  fc: number | null;
  temperatura: number | null;
  saturacion: number | null;
  glucosa: number | null;
}

const base = crearRepositorio<SignoVital>("signos_vitales");

export const signosRepo = {
  ...base,
  /** Últimos registros del paciente, del más reciente al más antiguo. */
  recientes: (patientId: string, limite = 30) =>
    base.listar({
      filtros: { patient_id: patientId },
      ordenar: { campo: "fecha", ascendente: false },
      limite,
    }),
};
