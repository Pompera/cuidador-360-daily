/**
 * Repositorio base.
 *
 * La interfaz habla SIEMPRE con un repositorio, nunca con la nube.
 * En el APK los datos salen de SQLite (y el SyncManager los sube después).
 * En navegador el repositorio delega en la nube, así la web sigue igual.
 */
import { supabase } from "@/integrations/supabase/client";
import { aRegistro, consultar, ejecutar, guardarLocal, nuevoId, type FilaLocal } from "@/lib/db";
import { usaModoOffline } from "@/lib/plataforma";
import { sincronizarEnSegundoPlano } from "@/lib/sync/sync-manager";
import { usuarioActual } from "@/lib/auth/sesion";

export interface OpcionesLista {
  /** Igualdades sobre columnas promovidas (owner_id, patient_id, fecha…). */
  filtros?: Record<string, string | number | boolean | null>;
  /** Columna de ordenamiento (debe ser una columna promovida). */
  ordenar?: { campo: string; ascendente?: boolean };
  limite?: number;
}

export function crearRepositorio<T extends Record<string, unknown>>(tabla: string) {
  /** Lista registros vivos (sin los borrados lógicamente). */
  async function listar(opciones: OpcionesLista = {}): Promise<T[]> {
    const { filtros = {}, ordenar, limite } = opciones;

    if (!usaModoOffline()) {
      let q = supabase.from(tabla as never).select("*");
      for (const [campo, valor] of Object.entries(filtros)) q = q.eq(campo, valor as never);
      if (ordenar) q = q.order(ordenar.campo, { ascending: ordenar.ascendente ?? true });
      if (limite) q = q.limit(limite);
      const { data } = await q;
      return (data ?? []) as unknown as T[];
    }

    const condiciones = ["deleted_at IS NULL"];
    const valores: unknown[] = [];
    for (const [campo, valor] of Object.entries(filtros)) {
      condiciones.push(`${campo} = ?`);
      valores.push(valor);
    }
    const orden = ordenar
      ? ` ORDER BY ${ordenar.campo} ${ordenar.ascendente ?? true ? "ASC" : "DESC"}`
      : "";
    const tope = limite ? ` LIMIT ${Number(limite)}` : "";
    const filas = await consultar<FilaLocal>(
      `SELECT * FROM ${tabla} WHERE ${condiciones.join(" AND ")}${orden}${tope};`,
      valores,
    );
    return filas.map((f) => aRegistro<T>(f));
  }

  /** Obtiene un registro por id (o null). */
  async function obtener(id: string): Promise<T | null> {
    if (!usaModoOffline()) {
      const { data } = await supabase.from(tabla as never).select("*").eq("id", id).maybeSingle();
      return (data as unknown as T) ?? null;
    }
    const filas = await consultar<FilaLocal>(
      `SELECT * FROM ${tabla} WHERE id = ? AND deleted_at IS NULL LIMIT 1;`,
      [id],
    );
    return filas[0] ? aRegistro<T>(filas[0]) : null;
  }

  /** Crea un registro. Funciona siempre, con o sin Internet. */
  async function crear(datos: Record<string, unknown>): Promise<T> {
    if (!usaModoOffline()) {
      const { data, error } = await supabase.from(tabla as never).insert(datos as never).select("*").single();
      if (error) throw error;
      return data as unknown as T;
    }

    const usuario = await usuarioActual();
    const ahora = new Date().toISOString();
    const registro = {
      id: (datos.id as string) ?? nuevoId(),
      owner_id: (datos.owner_id as string) ?? usuario?.id ?? null,
      created_at: (datos.created_at as string) ?? ahora,
      updated_at: ahora,
      ...datos,
    };
    await guardarLocal(tabla, registro, "pending", { lastModified: ahora });
    sincronizarEnSegundoPlano();
    return registro as unknown as T;
  }

  /** Actualiza un registro existente. */
  async function actualizar(id: string, cambios: Record<string, unknown>): Promise<T | null> {
    if (!usaModoOffline()) {
      const { data, error } = await supabase
        .from(tabla as never)
        .update(cambios as never)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as T) ?? null;
    }

    const actual = await obtener(id);
    if (!actual) return null;
    const ahora = new Date().toISOString();
    const registro = { ...actual, ...cambios, id, updated_at: ahora };
    // Si aún no se ha subido nunca, sigue siendo 'pending'; si ya estaba
    // sincronizado, pasa a 'updated'.
    const filas = await consultar<FilaLocal>(`SELECT sync_status FROM ${tabla} WHERE id = ? LIMIT 1;`, [id]);
    const estado = filas[0]?.sync_status === "pending" ? "pending" : "updated";
    await guardarLocal(tabla, registro, estado, { lastModified: ahora });
    sincronizarEnSegundoPlano();
    return registro as unknown as T;
  }

  /** Borra un registro (lógicamente en local; se confirma al sincronizar). */
  async function eliminar(id: string): Promise<void> {
    if (!usaModoOffline()) {
      const { error } = await supabase.from(tabla as never).delete().eq("id", id);
      if (error) throw error;
      return;
    }
    const ahora = new Date().toISOString();
    await ejecutar(
      `UPDATE ${tabla} SET sync_status = 'deleted', deleted_at = ?, last_modified = ? WHERE id = ?;`,
      [ahora, ahora, id],
    );
    sincronizarEnSegundoPlano();
  }

  return { tabla, listar, obtener, crear, actualizar, eliminar };
}
