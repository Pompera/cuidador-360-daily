/**
 * SyncManager: sincronización automática y silenciosa con la nube.
 *
 * Reglas:
 *  - La app nunca depende de la nube para funcionar; esto corre en segundo plano.
 *  - Los errores jamás se muestran al usuario: se marcan como `failed` y se reintentan.
 *  - Los conflictos se resuelven con la marca de tiempo más reciente.
 *  - No se duplican registros: el identificador se genera en el teléfono y la
 *    subida usa `upsert`, así reintentar es seguro.
 */
import { supabase } from "@/integrations/supabase/client";
import { consultar, ejecutar, escribirMeta, leerMeta, guardarLocal, aRegistro, type FilaLocal } from "@/lib/db";
import { usaModoOffline } from "@/lib/plataforma";
import { hayConexion, alCambiarConexion, iniciarVigilanciaRed } from "@/lib/red";
import { usuarioActual } from "@/lib/auth/sesion";
import { TABLAS, type ConfigTabla } from "./tablas";

const CLAVE_ULTIMA_SYNC = (tabla: string) => `ultima_sync.${tabla}`;
const CLAVE_MIGRACION = "migracion_inicial";
const ESPERA_BASE_MS = 15_000;
const ESPERA_MAX_MS = 5 * 60_000;

let sincronizando = false;
let intentosFallidos = 0;
let temporizador: ReturnType<typeof setTimeout> | null = null;
let arrancado = false;

/** Marca de tiempo de un registro remoto, para comparar conflictos. */
function marcaRemota(fila: Record<string, unknown>, cfg: ConfigTabla): string {
  return String(fila[cfg.columnaActualizacion] ?? fila.updated_at ?? fila.created_at ?? "");
}

/** Sube los registros locales pendientes de una tabla. */
async function subir(cfg: ConfigTabla): Promise<void> {
  const pendientes = await consultar<FilaLocal>(
    `SELECT * FROM ${cfg.nombre} WHERE sync_status IN ('pending','updated','deleted','failed');`,
  );
  if (!pendientes.length) return;

  for (const fila of pendientes) {
    try {
      if (fila.deleted_at) {
        const { error } = await supabase.from(cfg.nombre as never).delete().eq("id", fila.id);
        if (error) throw error;
        await ejecutar(`DELETE FROM ${cfg.nombre} WHERE id = ?;`, [fila.id]);
        continue;
      }

      const registro = aRegistro<Record<string, unknown>>(fila);
      const { error } = await supabase
        .from(cfg.nombre as never)
        .upsert(registro as never, { onConflict: "id" });
      if (error) throw error;

      await ejecutar(
        `UPDATE ${cfg.nombre} SET sync_status = 'synced', sync_error = NULL WHERE id = ? AND last_modified = ?;`,
        [fila.id, fila.last_modified],
      );
    } catch (err) {
      const motivo = err instanceof Error ? err.message : "error desconocido";
      await ejecutar(`UPDATE ${cfg.nombre} SET sync_status = 'failed', sync_error = ? WHERE id = ?;`, [
        motivo,
        fila.id,
      ]);
      throw err; // corta la tanda; se reintenta con espera creciente
    }
  }
}

/** Descarga de la nube los cambios posteriores a la última sincronización. */
async function bajar(cfg: ConfigTabla, ownerId: string, desdeCero = false): Promise<void> {
  const desde = desdeCero ? null : await leerMeta(CLAVE_ULTIMA_SYNC(cfg.nombre));
  let consulta = supabase.from(cfg.nombre as never).select("*");
  if (desde) consulta = consulta.gt(cfg.columnaActualizacion, desde);

  const { data, error } = await consulta;
  if (error) throw error;
  const filas = (data ?? []) as unknown as Record<string, unknown>[];

  let maxMarca = desde ?? "";
  for (const remoto of filas) {
    const id = String(remoto.id);
    const marca = marcaRemota(remoto, cfg);
    if (marca > maxMarca) maxMarca = marca;

    const locales = await consultar<FilaLocal>(`SELECT * FROM ${cfg.nombre} WHERE id = ? LIMIT 1;`, [id]);
    const local = locales[0];

    // Conflicto: si el cambio local es más reciente y aún no se ha subido, gana el local.
    if (local && local.sync_status !== "synced" && local.last_modified > marca) continue;

    await guardarLocal(cfg.nombre, remoto, "synced", { lastModified: marca || new Date().toISOString() });
  }

  // `profiles` no está filtrado por dueño en la nube (RLS ya limita), pero
  // guardamos la marca por tabla para pedir solo lo nuevo la próxima vez.
  void ownerId;
  if (maxMarca) await escribirMeta(CLAVE_ULTIMA_SYNC(cfg.nombre), maxMarca);
}

/**
 * Migración inicial: la primera vez que la app corre con sesión y red,
 * descarga todo lo que ya existe en la nube. No borra nada local.
 */
async function migracionInicial(ownerId: string): Promise<void> {
  if (await leerMeta(CLAVE_MIGRACION)) return;
  for (const cfg of TABLAS) await bajar(cfg, ownerId, true);
  await escribirMeta(CLAVE_MIGRACION, new Date().toISOString());
}

/** Ejecuta una tanda completa de sincronización. Nunca lanza hacia la interfaz. */
export async function sincronizar(): Promise<void> {
  if (!usaModoOffline() || sincronizando || !hayConexion()) return;
  sincronizando = true;
  try {
    const usuario = await usuarioActual();
    if (!usuario) return;

    await migracionInicial(usuario.id);
    for (const cfg of TABLAS) {
      await subir(cfg);
      await bajar(cfg, usuario.id);
    }
    intentosFallidos = 0;
  } catch {
    // Silencioso a propósito: se reintenta con espera creciente.
    intentosFallidos += 1;
    programarReintento();
  } finally {
    sincronizando = false;
  }
}

/** Reintento con espera creciente (15s, 30s, 60s… hasta 5 min). */
function programarReintento() {
  if (temporizador) clearTimeout(temporizador);
  const espera = Math.min(ESPERA_BASE_MS * 2 ** Math.max(0, intentosFallidos - 1), ESPERA_MAX_MS);
  temporizador = setTimeout(() => void sincronizar(), espera);
}

/** Pide una sincronización sin bloquear a quien la solicita. */
export function sincronizarEnSegundoPlano(): void {
  void sincronizar();
}

/**
 * Arranca el sincronizador: al iniciar, al recuperar conexión, al volver la
 * app al primer plano y cada 5 minutos como red de seguridad.
 */
export async function iniciarSync(): Promise<void> {
  if (!usaModoOffline() || arrancado) return;
  arrancado = true;

  await iniciarVigilanciaRed();
  alCambiarConexion((enLinea) => {
    if (enLinea) sincronizarEnSegundoPlano();
  });

  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) sincronizarEnSegundoPlano();
    });
  } catch {
    /* opcional */
  }

  setInterval(() => sincronizarEnSegundoPlano(), 5 * 60_000);
  sincronizarEnSegundoPlano();
}
