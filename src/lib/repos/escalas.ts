/** Repositorio de escalas mensuales (Jenkins y Zarit). */
import { fechaHoy } from "@/lib/utils";
import { crearRepositorio } from "./base";

export interface Evaluacion extends Record<string, unknown> {
  id: string;
  patient_id: string;
  tipo: string;
  fecha: string;
  puntaje: number;
  respuestas?: Record<string, number>;
}

const base = crearRepositorio<Evaluacion>("evaluaciones_escala");

export const escalasRepo = {
  ...base,

  /** Historial de una escala concreta, de la más reciente a la más antigua. */
  historial: (patientId: string, tipo: string, limite = 12) =>
    base.listar({
      filtros: { patient_id: patientId, tipo },
      ordenar: { campo: "fecha", ascendente: false },
      limite,
    }),

  /** Todas las evaluaciones del paciente (para el reporte). */
  porPaciente: (patientId: string) =>
    base.listar({
      filtros: { patient_id: patientId },
      ordenar: { campo: "fecha", ascendente: false },
    }),

  /** Guarda una evaluación. Funciona igual con o sin Internet. */
  registrar: (datos: {
    patient_id: string;
    tipo: "jenkins" | "zarit";
    puntaje: number;
    respuestas: Record<string, number>;
  }) => base.crear({ ...datos, fecha: fechaHoy() }),
};
