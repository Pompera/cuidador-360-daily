/**
 * Esquema de la base de datos local (SQLite).
 *
 * Estrategia: cada tabla local replica su equivalente en la nube pero guarda
 * los campos propios de la entidad dentro de una columna JSON (`data`). Solo
 * se promueven a columnas reales los campos que se usan para filtrar u
 * ordenar (owner_id, patient_id, fecha, created_at, updated_at). Así el
 * esquema local no se rompe cuando la nube gana campos nuevos.
 *
 * Campos de control de sincronización presentes en TODAS las tablas:
 *  - sync_status : pending | synced | updated | deleted | failed
 *  - last_modified: marca de tiempo (ISO) para resolver conflictos
 *  - deleted_at  : borrado lógico (nunca se pierde información)
 *  - sync_error  : último motivo de fallo de sincronización
 */

/** Estados posibles de sincronización de un registro. */
export type SyncStatus = "pending" | "synced" | "updated" | "deleted" | "failed";

/** Tablas locales que replican la nube. */
export const TABLAS_SINCRONIZADAS = [
  "profiles",
  "patients",
  "chequeos_diarios",
  "profundizaciones_clinicas",
  "medicamentos",
  "medicamento_horarios",
  "medicamento_tomas",
  "signos_vitales",
  "caidas",
  "evaluaciones_escala",
] as const;

export type TablaSincronizada = (typeof TABLAS_SINCRONIZADAS)[number];

const COLUMNAS_CONTROL = `
  sync_status   TEXT NOT NULL DEFAULT 'pending',
  last_modified TEXT NOT NULL,
  deleted_at    TEXT,
  sync_error    TEXT
`;

/**
 * Genera el CREATE TABLE de una tabla sincronizada.
 * `extras` son columnas promovidas específicas de la entidad.
 */
function tabla(nombre: string, extras: string[]): string {
  const cols = extras.length ? extras.join(",\n  ") + "," : "";
  return `CREATE TABLE IF NOT EXISTS ${nombre} (
  id          TEXT PRIMARY KEY NOT NULL,
  owner_id    TEXT,
  ${cols}
  data        TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT,
  updated_at  TEXT,
  ${COLUMNAS_CONTROL}
);`;
}

const CON_PACIENTE = ["patient_id TEXT", "fecha TEXT"];

/** Versión 1 del esquema local. Cada cambio futuro se añade como nueva versión. */
export const MIGRACIONES: { version: number; sentencias: string[] }[] = [
  {
    version: 1,
    sentencias: [
      tabla("profiles", []),
      tabla("patients", []),
      tabla("chequeos_diarios", CON_PACIENTE),
      tabla("profundizaciones_clinicas", CON_PACIENTE),
      tabla("medicamentos", ["patient_id TEXT"]),
      tabla("medicamento_horarios", ["patient_id TEXT", "medicamento_id TEXT"]),
      tabla("medicamento_tomas", ["patient_id TEXT", "medicamento_id TEXT", "fecha TEXT"]),
      tabla("signos_vitales", CON_PACIENTE),
      tabla("caidas", CON_PACIENTE),
      tabla("evaluaciones_escala", ["patient_id TEXT", "fecha TEXT", "tipo TEXT"]),

      // Índices para que las listas y el historial carguen rápido.
      "CREATE INDEX IF NOT EXISTS idx_patients_owner ON patients(owner_id, sync_status);",
      "CREATE INDEX IF NOT EXISTS idx_chequeos_pac ON chequeos_diarios(patient_id, fecha);",
      "CREATE INDEX IF NOT EXISTS idx_prof_pac ON profundizaciones_clinicas(patient_id, fecha);",
      "CREATE INDEX IF NOT EXISTS idx_med_pac ON medicamentos(patient_id);",
      "CREATE INDEX IF NOT EXISTS idx_medhor_med ON medicamento_horarios(medicamento_id);",
      "CREATE INDEX IF NOT EXISTS idx_medtom_pac ON medicamento_tomas(patient_id, fecha);",
      "CREATE INDEX IF NOT EXISTS idx_signos_pac ON signos_vitales(patient_id, fecha);",
      "CREATE INDEX IF NOT EXISTS idx_caidas_pac ON caidas(patient_id, fecha);",
      "CREATE INDEX IF NOT EXISTS idx_escalas_pac ON evaluaciones_escala(patient_id, tipo, fecha);",

      // Metadatos locales (marcas de última sincronización, banderas de migración).
      `CREATE TABLE IF NOT EXISTS sync_meta (
        clave TEXT PRIMARY KEY NOT NULL,
        valor TEXT
      );`,
    ],
  },
];

/** Última versión del esquema local. */
export const VERSION_ESQUEMA = MIGRACIONES[MIGRACIONES.length - 1].version;
