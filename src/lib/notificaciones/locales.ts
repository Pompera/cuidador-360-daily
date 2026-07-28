/**
 * Recordatorios de medicamentos con notificaciones locales del teléfono.
 *
 * En el APK no dependemos de Web Push (que necesita servidor e Internet):
 * el propio teléfono dispara la notificación cada día a la hora configurada.
 * En navegador esta capa no hace nada y siguen usándose las notificaciones web.
 */
import { usaModoOffline } from "@/lib/plataforma";
import type { Horario, Medicamento } from "@/lib/repos/medicamentos";

/** Convierte un id (uuid) en un entero estable para el sistema de notificaciones. */
function idNumerico(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

async function plugin() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

/** Pide permiso de notificaciones al usuario. Devuelve true si quedó concedido. */
export async function pedirPermisoLocal(): Promise<boolean> {
  if (!usaModoOffline()) return false;
  try {
    const ln = await plugin();
    const actual = await ln.checkPermissions();
    if (actual.display === "granted") return true;
    const pedido = await ln.requestPermissions();
    return pedido.display === "granted";
  } catch {
    return false;
  }
}

/** Indica si ya hay permiso concedido para notificaciones locales. */
export async function permisoLocalConcedido(): Promise<boolean> {
  if (!usaModoOffline()) return false;
  try {
    const ln = await plugin();
    return (await ln.checkPermissions()).display === "granted";
  } catch {
    return false;
  }
}

/**
 * Reprograma todas las notificaciones diarias del paciente a partir de sus
 * horarios activos. Se llama después de cualquier cambio en medicamentos u
 * horarios; es idempotente (cancela y vuelve a programar).
 */
export async function reprogramarRecordatorios(
  medicamentos: Medicamento[],
  horarios: Horario[],
): Promise<void> {
  if (!usaModoOffline()) return;
  try {
    const ln = await plugin();
    if ((await ln.checkPermissions()).display !== "granted") return;

    const activos = new Map(medicamentos.filter((m) => m.activo !== false).map((m) => [m.id, m]));
    const previas = await ln.getPending();
    const mios = previas.notifications.filter((n) =>
      horarios.some((h) => idNumerico(h.id) === n.id),
    );
    if (mios.length) await ln.cancel({ notifications: mios.map((n) => ({ id: n.id })) });

    const aProgramar = horarios
      .filter((h) => h.activo !== false && activos.has(h.medicamento_id))
      .map((h) => {
        const [hh, mm] = String(h.hora).slice(0, 5).split(":").map(Number);
        const med = activos.get(h.medicamento_id)!;
        return {
          id: idNumerico(h.id),
          title: "Hora del medicamento",
          body: [med.nombre, med.dosis].filter(Boolean).join(" - "),
          schedule: { on: { hour: hh, minute: mm }, allowWhileIdle: true },
        };
      });

    if (aProgramar.length) await ln.schedule({ notifications: aProgramar });
  } catch {
    /* silencioso: los recordatorios nunca deben romper la pantalla */
  }
}

/** Cancela todos los recordatorios de una lista de horarios. */
export async function cancelarRecordatorios(horarios: Horario[]): Promise<void> {
  if (!usaModoOffline() || !horarios.length) return;
  try {
    const ln = await plugin();
    await ln.cancel({ notifications: horarios.map((h) => ({ id: idNumerico(h.id) })) });
  } catch {
    /* silencioso */
  }
}
