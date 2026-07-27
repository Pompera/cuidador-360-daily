/**
 * Configuración de sincronización por tabla.
 *
 * El orden del arreglo es también el orden de subida: primero los "padres"
 * (paciente, medicamento) y después los registros que dependen de ellos.
 */
export interface ConfigTabla {
  /** Nombre de la tabla (igual en local y en la nube). */
  nombre: string;
  /** Columna con la marca de tiempo de última modificación en la nube. */
  columnaActualizacion: "updated_at" | "created_at";
}

export const TABLAS: ConfigTabla[] = [
  { nombre: "profiles", columnaActualizacion: "created_at" },
  { nombre: "patients", columnaActualizacion: "updated_at" },
  { nombre: "medicamentos", columnaActualizacion: "updated_at" },
  { nombre: "medicamento_horarios", columnaActualizacion: "updated_at" },
  { nombre: "medicamento_tomas", columnaActualizacion: "created_at" },
  { nombre: "chequeos_diarios", columnaActualizacion: "created_at" },
  { nombre: "profundizaciones_clinicas", columnaActualizacion: "updated_at" },
  { nombre: "signos_vitales", columnaActualizacion: "created_at" },
  { nombre: "caidas", columnaActualizacion: "created_at" },
  { nombre: "evaluaciones_escala", columnaActualizacion: "updated_at" },
];
