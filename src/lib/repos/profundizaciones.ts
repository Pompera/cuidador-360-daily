/** Repositorio de profundizaciones clínicas. */
import { crearRepositorio } from "./base";

export interface Profundizacion extends Record<string, unknown> {
  id: string;
  patient_id: string;
  fecha: string;
  dominio_principal: string | null;
  nivel_deterioro: string | null;
}

const base = crearRepositorio<Profundizacion>("profundizaciones_clinicas");

export const profundizacionesRepo = {
  ...base,
  ultima: (patientId: string) =>
    base.listar({
      filtros: { patient_id: patientId },
      ordenar: { campo: "fecha", ascendente: false },
      limite: 1,
    }),
};
