/** Repositorio de adultos mayores (pacientes). */
import { crearRepositorio } from "./base";

export interface Paciente extends Record<string, unknown> {
  id: string;
  nombre: string;
  edad: number | null;
  valoracion_completa: boolean;
}

const base = crearRepositorio<Paciente>("patients");

export const pacientesRepo = {
  ...base,
  /** Lista los pacientes del cuidador, del más reciente al más antiguo. */
  listarMios: () => base.listar({ ordenar: { campo: "created_at", ascendente: false } }),
};
