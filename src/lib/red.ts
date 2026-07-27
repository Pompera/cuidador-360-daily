/**
 * Estado de conexión. Nunca se muestra al usuario: solo sirve para decidir
 * cuándo intentar sincronizar en segundo plano.
 */
import { usaModoOffline } from "@/lib/plataforma";

type Escucha = (enLinea: boolean) => void;

const escuchas = new Set<Escucha>();
let enLinea = true;
let iniciado = false;

/** Devuelve si hay conexión (optimista si no se puede determinar). */
export function hayConexion(): boolean {
  return enLinea;
}

/** Arranca la vigilancia de red una sola vez. */
export async function iniciarVigilanciaRed(): Promise<void> {
  if (iniciado) return;
  iniciado = true;

  if (usaModoOffline()) {
    try {
      const { Network } = await import("@capacitor/network");
      const estado = await Network.getStatus();
      enLinea = estado.connected;
      await Network.addListener("networkStatusChange", (s) => {
        enLinea = s.connected;
        escuchas.forEach((fn) => fn(enLinea));
      });
      return;
    } catch {
      enLinea = true;
      return;
    }
  }

  if (typeof window !== "undefined") {
    enLinea = navigator.onLine;
    window.addEventListener("online", () => {
      enLinea = true;
      escuchas.forEach((fn) => fn(true));
    });
    window.addEventListener("offline", () => {
      enLinea = false;
      escuchas.forEach((fn) => fn(false));
    });
  }
}

/** Notifica cambios de conectividad. Devuelve la función para cancelar. */
export function alCambiarConexion(fn: Escucha): () => void {
  escuchas.add(fn);
  return () => escuchas.delete(fn);
}
