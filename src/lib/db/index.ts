/**
 * Conexión y acceso a la base de datos local SQLite.
 *
 * Solo se abre en el APK (plataforma nativa). En navegador estas funciones
 * lanzan un error controlado y los repositorios usan la nube directamente.
 */
import { MIGRACIONES, VERSION_ESQUEMA, type SyncStatus } from "./esquema";
import { usaModoOffline } from "@/lib/plataforma";

const NOMBRE_DB = "cuidador360";

/** Forma cruda de una fila local (columnas de control + JSON con el resto). */
export interface FilaLocal {
  id: string;
  owner_id: string | null;
  patient_id?: string | null;
  fecha?: string | null;
  data: string;
  created_at: string | null;
  updated_at: string | null;
  sync_status: SyncStatus;
  last_modified: string;
  deleted_at: string | null;
  sync_error: string | null;
}

/** Registro de aplicación: los campos JSON ya expandidos. */
export type Registro = Record<string, unknown> & { id: string };

type Conexion = {
  open: () => Promise<void>;
  execute: (sql: string) => Promise<unknown>;
  query: (sql: string, values?: unknown[]) => Promise<{ values?: unknown[] }>;
  run: (sql: string, values?: unknown[]) => Promise<unknown>;
};

let conexion: Conexion | null = null;
let abriendo: Promise<Conexion> | null = null;

/** Abre (una sola vez) la base local y aplica las migraciones pendientes. */
export async function abrirDB(): Promise<Conexion> {
  if (conexion) return conexion;
  if (!usaModoOffline()) throw new Error("SQLite solo está disponible en la app instalada");
  if (abriendo) return abriendo;

  abriendo = (async () => {
    const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite");
    const sqlite = new SQLiteConnection(CapacitorSQLite);

    // Reutiliza la conexión si ya existía (recargas de la vista web).
    const yaExiste = (await sqlite.isConnection(NOMBRE_DB, false)).result;
    const db = (yaExiste
      ? await sqlite.retrieveConnection(NOMBRE_DB, false)
      : await sqlite.createConnection(NOMBRE_DB, false, "no-encryption", 1, false)) as unknown as Conexion;

    await db.open();
    await aplicarMigraciones(db);
    conexion = db;
    return db;
  })();

  try {
    return await abriendo;
  } finally {
    abriendo = null;
  }
}

/** Aplica las migraciones de esquema que falten, en orden y una sola vez. */
async function aplicarMigraciones(db: Conexion) {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS esquema_version (version INTEGER PRIMARY KEY NOT NULL);`,
  );
  const res = await db.query("SELECT version FROM esquema_version LIMIT 1;");
  const actual = Number((res.values?.[0] as { version?: number } | undefined)?.version ?? 0);
  if (actual >= VERSION_ESQUEMA) return;

  for (const migracion of MIGRACIONES) {
    if (migracion.version <= actual) continue;
    for (const sentencia of migracion.sentencias) await db.execute(sentencia);
  }
  await db.run("DELETE FROM esquema_version;");
  await db.run("INSERT INTO esquema_version (version) VALUES (?);", [VERSION_ESQUEMA]);
}

/** Consulta que devuelve filas tipadas. */
export async function consultar<T = FilaLocal>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await abrirDB();
  const res = await db.query(sql, params);
  return (res.values ?? []) as T[];
}

/** Sentencia de escritura. */
export async function ejecutar(sql: string, params: unknown[] = []): Promise<void> {
  const db = await abrirDB();
  await db.run(sql, params);
}

/** Columnas promovidas por tabla (todo lo demás vive en `data`). */
export const COLUMNAS_PROMOVIDAS: Record<string, string[]> = {
  profiles: [],
  patients: [],
  chequeos_diarios: ["patient_id", "fecha"],
  profundizaciones_clinicas: ["patient_id", "fecha"],
  medicamentos: ["patient_id"],
  medicamento_horarios: ["patient_id", "medicamento_id"],
  medicamento_tomas: ["patient_id", "medicamento_id", "fecha"],
  signos_vitales: ["patient_id", "fecha"],
  caidas: ["patient_id", "fecha"],
  evaluaciones_escala: ["patient_id", "fecha", "tipo"],
};

const COLUMNAS_BASE = ["id", "owner_id", "created_at", "updated_at"];

/** Convierte una fila local en el objeto plano que consume la interfaz. */
export function aRegistro<T = Registro>(fila: FilaLocal): T {
  const extra = fila.data ? (JSON.parse(fila.data) as Record<string, unknown>) : {};
  const promovidas: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(fila)) {
    if (["data", "sync_status", "last_modified", "deleted_at", "sync_error"].includes(clave)) continue;
    if (valor !== null && valor !== undefined) promovidas[clave] = valor;
  }
  return { ...extra, ...promovidas } as T;
}

/**
 * Inserta o actualiza un registro en la tabla local.
 * `estado` indica cómo debe tratarlo el sincronizador.
 */
export async function guardarLocal(
  tabla: string,
  registro: Record<string, unknown>,
  estado: SyncStatus,
  opciones: { lastModified?: string } = {},
): Promise<void> {
  const promovidas = COLUMNAS_PROMOVIDAS[tabla] ?? [];
  const columnas = [...COLUMNAS_BASE, ...promovidas];
  const resto: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(registro)) {
    if (!columnas.includes(clave)) resto[clave] = valor;
  }

  const lastModified = opciones.lastModified ?? new Date().toISOString();
  const nombres = [...columnas, "data", "sync_status", "last_modified", "deleted_at", "sync_error"];
  const valores = [
    ...columnas.map((c) => (registro[c] === undefined ? null : (registro[c] as unknown))),
    JSON.stringify(resto),
    estado,
    lastModified,
    estado === "deleted" ? lastModified : null,
    null,
  ];

  await ejecutar(
    `INSERT OR REPLACE INTO ${tabla} (${nombres.join(", ")}) VALUES (${nombres.map(() => "?").join(", ")});`,
    valores,
  );
}

/** Lee un valor de metadatos locales. */
export async function leerMeta(clave: string): Promise<string | null> {
  const filas = await consultar<{ valor: string | null }>(
    "SELECT valor FROM sync_meta WHERE clave = ? LIMIT 1;",
    [clave],
  );
  return filas[0]?.valor ?? null;
}

/** Guarda un valor de metadatos locales. */
export async function escribirMeta(clave: string, valor: string): Promise<void> {
  await ejecutar("INSERT OR REPLACE INTO sync_meta (clave, valor) VALUES (?, ?);", [clave, valor]);
}

/** Genera un identificador definitivo en el teléfono (evita duplicados al subir). */
export function nuevoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
