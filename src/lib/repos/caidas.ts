/** Repositorio de caídas. */
import { crearRepositorio } from "./base";

export interface Caida extends Record<string, unknown> {
  id: string;
  patient_id: string;
  fecha: string;
  lugar: string | null;
  circunstancia: string | null;
  lesion: string | null;
  golpe_craneal: boolean;
  hospitalizacion: boolean;
}

const base = crearRepositorio<Caida>("caidas");

export const caidasRepo = {
  ...base,
  /** Historial de caídas del paciente, de la más reciente a la más antigua. */
  porPaciente: (patientId: string) =>
    base.listar({
      filtros: { patient_id: patientId },
      ordenar: { campo: "fecha", ascendente: false },
    }),
};
