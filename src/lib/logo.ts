/**
 * URL del logotipo tolerante a la falta de Internet.
 *
 * En web el logo vive en el CDN de assets. Dentro del APK no hay red
 * garantizada, así que se usa la copia empaquetada en `public/`.
 */
import logoC360 from "@/assets/logo-c360.png.asset.json";
import { usaModoOffline } from "@/lib/plataforma";

export function logoUrl(): string {
  return usaModoOffline() ? "/logo-c360.png" : logoC360.url;
}
