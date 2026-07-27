/**
 * Detección de plataforma.
 *
 * La arquitectura offline-first (SQLite nativo) solo se activa dentro del APK
 * de Android. En el navegador la app sigue funcionando exactamente igual que
 * antes, hablando directamente con la nube.
 */
import { Capacitor } from "@capacitor/core";

/** true cuando la app corre dentro del contenedor nativo (APK). */
export function esNativo(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** true cuando debemos usar la base de datos local como fuente de verdad. */
export function usaModoOffline(): boolean {
  return esNativo();
}
