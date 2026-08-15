/**
 * Inicio de sesión con Google.
 *
 * En la WEB el flujo funciona tal cual: el SDK de Lovable llama a la ruta
 * relativa `/~oauth/initiate` del propio sitio.
 *
 * En el APK NO existe ningún servidor: la app se sirve desde archivos locales
 * (https://localhost), así que esa ruta relativa devuelve "error 404". Para que
 * funcione hace falta un sitio publicado que actúe de intermediario; su URL se
 * declara en `VITE_SITE_URL` al compilar el APK. Si no está declarada, el botón
 * de Google se oculta y el usuario entra con correo y contraseña.
 */
import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { supabase } from "@/integrations/supabase/client";
import { usaModoOffline } from "@/lib/plataforma";

/** URL del sitio publicado (sin barra final). Opcional. */
export const SITIO_WEB = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? "")
  .trim()
  .replace(/\/+$/, "");

/** true cuando el botón de Google puede funcionar en esta plataforma. */
export function googleDisponible(): boolean {
  return !usaModoOffline() || SITIO_WEB.length > 0;
}

/** Base para enlaces que deben abrirse fuera de la app (correos de confirmación). */
export function baseEnlacesWeb(): string {
  if (usaModoOffline()) return SITIO_WEB;
  return window.location.origin;
}

export async function entrarConGoogle(): Promise<{ error: Error | null; redirected?: boolean }> {
  const nativo = usaModoOffline();
  const auth = createLovableAuth(
    nativo && SITIO_WEB ? { oauthBrokerUrl: `${SITIO_WEB}/~oauth/initiate` } : {},
  );
  const result = await auth.signInWithOAuth("google", {
    redirect_uri: nativo && SITIO_WEB ? `${SITIO_WEB}/auth` : window.location.origin + "/app",
  });
  if (result.error) return { error: result.error };
  if (result.redirected) return { error: null, redirected: true };
  try {
    await supabase.auth.setSession(result.tokens!);
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
  return { error: null };
}
