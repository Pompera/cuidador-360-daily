/** Repositorio de chequeos diarios. */
import { supabase } from "@/integrations/supabase/client";
import { usaModoOffline } from "@/lib/plataforma";
import { crearRepositorio } from "./base";

export interface Chequeo extends Record<string, unknown> {
  id: string;
  patient_id: string;
  fecha: string;
  ieg: number | null;
  color: string | null;
  respuestas?: Record<string, string | string[]>;
}

const base = crearRepositorio<Chequeo>("chequeos_diarios");

export const chequeosRepo = {
  ...base,

  /** Historial de un paciente, del más reciente al más antiguo. */
  historial: (patientId: string, limite = 30) =>
    base.listar({
      filtros: { patient_id: patientId },
      ordenar: { campo: "fecha", ascendente: false },
      limite,
    }),

  /** Último chequeo de cada paciente de la lista. */
  async ultimosPorPaciente(ids: string[]): Promise<Record<string, Chequeo>> {
    if (!ids.length) return {};
    let filas: Chequeo[] = [];
    if (!usaModoOffline()) {
      const { data } = await supabase
        .from("chequeos_diarios")
        .select("patient_id, ieg, color, fecha")
        .in("patient_id", ids)
        .order("fecha", { ascending: false });
      filas = (data ?? []) as unknown as Chequeo[];
    } else {
      const porPaciente = await Promise.all(ids.map((id) => this.historial(id, 1)));
      filas = porPaciente.flat();
    }
    const mapa: Record<string, Chequeo> = {};
    for (const fila of filas) if (!mapa[fila.patient_id]) mapa[fila.patient_id] = fila;
    return mapa;
  },

  /**
   * Guarda el chequeo del día. Si ya existe uno para esa fecha, lo reemplaza
   * (un chequeo por paciente y día), igual que antes.
   */
  async guardarDelDia(datos: {
    patient_id: string;
    owner_id: string;
    fecha: string;
    respuestas: Record<string, string | string[]>;
    ieg: number;
    color: string;
  }): Promise<void> {
    if (!usaModoOffline()) {
      const { error } = await supabase
        .from("chequeos_diarios")
        .upsert(datos, { onConflict: "patient_id,fecha" });
      if (error) {
        const { error: e2 } = await supabase.from("chequeos_diarios").insert(datos);
        if (e2) throw e2;
      }
      return;
    }

    const existentes = await base.listar({
      filtros: { patient_id: datos.patient_id, fecha: datos.fecha },
      limite: 1,
    });
    if (existentes[0]) await base.actualizar(existentes[0].id, datos);
    else await base.crear(datos);
  },
};
