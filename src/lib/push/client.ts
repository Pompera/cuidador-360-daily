import { supabase } from "@/integrations/supabase/client";

// Clave pública VAPID: NO es secreta (la privada vive solo en el servidor).
export const VAPID_PUBLIC_KEY =
  "BOIs0JxhcdTkW-U-2bVQILpjBxfubojAVCjvCmDhrZDaU-W3xsgteZoL27X8cWMVoki581UKFf4MAJ79amSVeLs";

export function pushSoportado() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function b64urlToUint8(base64: string) {
  const pad = base64.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function registrarServiceWorker() {
  if (!pushSoportado()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (e) {
    console.warn("[push] no se pudo registrar el service worker", e);
    return null;
  }
}

/** Suscribe el navegador y guarda la suscripción. `pedirPermiso` requiere un gesto del usuario. */
export async function activarNotificaciones(pedirPermiso = false): Promise<
  "ok" | "no-soportado" | "sin-permiso" | "sin-sesion" | "error"
> {
  if (!pushSoportado()) return "no-soportado";

  let permiso = Notification.permission;
  if (permiso === "default" && pedirPermiso) permiso = await Notification.requestPermission();
  if (permiso !== "granted") return "sin-permiso";

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return "sin-sesion";

  try {
    const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await registrarServiceWorker());
    if (!reg) return "error";
    await navigator.serviceWorker.ready;

    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64urlToUint8(VAPID_PUBLIC_KEY) as BufferSource,
      }));

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        owner_id: u.user.id,
        endpoint: sub.endpoint,
        p256dh: bufToB64url(sub.getKey("p256dh")),
        auth: bufToB64url(sub.getKey("auth")),
      },
      { onConflict: "endpoint" },
    );
    if (error) throw error;
    return "ok";
  } catch (e) {
    console.warn("[push] no se pudo activar", e);
    return "error";
  }
}
