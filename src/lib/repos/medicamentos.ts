/** Repositorios de la bitácora de medicamentos (medicamentos, horarios y tomas). */
import { crearRepositorio } from "./base";

export interface Medicamento extends Record<string, unknown> {
  id: string;
  patient_id: string;
  nombre: string;
  dosis: string | null;
  frecuencia: string | null;
  fecha_inicio: string | null;
  activo: boolean;
}

export interface Horario extends Record<string, unknown> {
  id: string;
  patient_id: string;
  medicamento_id: string;
  hora: string;
  activo: boolean;
}

export interface TomaRegistro extends Record<string, unknown> {
  id: string;
  patient_id: string;
  medicamento_id: string;
  fecha: string;
  estado: string;
}

const meds = crearRepositorio<Medicamento>("medicamentos");
const hors = crearRepositorio<Horario>("medicamento_horarios");
const toms = crearRepositorio<TomaRegistro>("medicamento_tomas");

export const medicamentosRepo = {
  ...meds,
  /** Medicamentos activos del paciente, en orden de alta. */
  async activos(patientId: string): Promise<Medicamento[]> {
    const filas = await meds.listar({
      filtros: { patient_id: patientId },
      ordenar: { campo: "created_at", ascendente: true },
    });
    return filas.filter((m) => m.activo !== false);
  },
  /** Suspende un medicamento (deja de mostrarse, no se borra el historial). */
  suspender: (id: string) => meds.actualizar(id, { activo: false }),
};

export const horariosRepo = {
  ...hors,
  /** Horarios de recordatorio del paciente, ordenados por hora. */
  async porPaciente(patientId: string): Promise<Horario[]> {
    const filas = await hors.listar({
      filtros: { patient_id: patientId },
      ordenar: { campo: "hora", ascendente: true },
    });
    return filas
      .map((h) => ({ ...h, hora: String(h.hora).slice(0, 5) }))
      .sort((a, b) => a.hora.localeCompare(b.hora));
  },
  alternar: (h: Horario) => hors.actualizar(h.id, { activo: !h.activo }),
};

export const tomasRepo = {
  ...toms,
  /** Tomas de los últimos `dias` días para calcular adherencia. */
  async recientes(patientId: string, dias = 30): Promise<TomaRegistro[]> {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    const limite = desde.toISOString().slice(0, 10);
    const filas = await toms.listar({ filtros: { patient_id: patientId } });
    return filas.filter((t) => String(t.fecha) >= limite);
  },
  /** Registra la toma del día (una por medicamento y fecha). */
  async registrar(datos: {
    owner_id?: string;
    patient_id: string;
    medicamento_id: string;
    fecha: string;
    estado: "tomado" | "omitido";
  }): Promise<void> {
    const existentes = await toms.listar({
      filtros: { medicamento_id: datos.medicamento_id, fecha: datos.fecha },
      limite: 1,
    });
    if (existentes[0]) await toms.actualizar(existentes[0].id, { estado: datos.estado });
    else await toms.crear(datos);
  },
};
