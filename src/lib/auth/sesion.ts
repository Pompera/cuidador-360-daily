/**
 * Sesión offline.
 *
 * Tras un inicio de sesión exitoso guardamos la sesión en el almacenamiento
 * del dispositivo (Capacitor Preferences). Así, al abrir la app sin Internet,
 * el usuario entra directo sin que se le pida iniciar sesión otra vez.
 */
import { supabase } from "@/integrations/supabase/client";
import { usaModoOffline } from "@/lib/plataforma";

const CLAVE = "cuidador360.sesion";

export interface UsuarioLocal {
  id: string;
  email: string | null;
  nombre: string | null;
}

interface SesionGuardada {
  access_token: string;
  refresh_token: string;
  usuario: UsuarioLocal;
  guardada_en: string;
}

let cache: SesionGuardada | null = null;

async function preferences() {
  const { Preferences } = await import("@capacitor/preferences");
  return Preferences;
}

/** Persiste la sesión actual para poder abrir la app sin conexión. */
export async function guardarSesionLocal(): Promise<void> {
  if (!usaModoOffline()) return;
  const { data } = await supabase.auth.getSession();
  const sesion = data.session;
  if (!sesion?.user) return;

  const guardada: SesionGuardada = {
    access_token: sesion.access_token,
    refresh_token: sesion.refresh_token,
    usuario: {
      id: sesion.user.id,
      email: sesion.user.email ?? null,
      nombre: (sesion.user.user_metadata?.full_name as string | undefined) ?? null,
    },
    guardada_en: new Date().toISOString(),
  };
  cache = guardada;
  const P = await preferences();
  await P.set({ key: CLAVE, value: JSON.stringify(guardada) });
}

/** Recupera la sesión guardada (si existe). */
export async function leerSesionLocal(): Promise<SesionGuardada | null> {
  if (!usaModoOffline()) return null;
  if (cache) return cache;
  try {
    const P = await preferences();
    const { value } = await P.get({ key: CLAVE });
    cache = value ? (JSON.parse(value) as SesionGuardada) : null;
    return cache;
  } catch {
    return null;
  }
}

/** Borra la sesión guardada (cierre de sesión). */
export async function borrarSesionLocal(): Promise<void> {
  cache = null;
  if (!usaModoOffline()) return;
  try {
    const P = await preferences();
    await P.remove({ key: CLAVE });
  } catch {
    /* sin efecto */
  }
}

/**
 * Usuario actual, tolerante a la falta de Internet.
 *
 * 1. Intenta la sesión viva de la nube (y la vuelve a guardar).
 * 2. Si falla o no hay red, usa la sesión guardada en el dispositivo.
 */
export async function usuarioActual(): Promise<UsuarioLocal | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const u = data.session.user;
      void guardarSesionLocal();
      return {
        id: u.id,
        email: u.email ?? null,
        nombre: (u.user_metadata?.full_name as string | undefined) ?? null,
      };
    }
  } catch {
    /* sin conexión: seguimos con la sesión guardada */
  }
  const guardada = await leerSesionLocal();
  return guardada?.usuario ?? null;
}

/**
 * Intenta restaurar la sesión de la nube a partir de los tokens guardados.
 * Solo tiene sentido cuando hay Internet; si falla, no pasa nada.
 */
export async function restaurarSesionNube(): Promise<void> {
  if (!usaModoOffline()) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const guardada = await leerSesionLocal();
  if (!guardada) return;
  try {
    await supabase.auth.setSession({
      access_token: guardada.access_token,
      refresh_token: guardada.refresh_token,
    });
  } catch {
    /* seguimos en modo offline con la sesión guardada */
  }
}
