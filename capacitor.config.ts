import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuración de Capacitor para generar el APK de Cuidador 360.
 *
 * El APK empaqueta la app como archivos estáticos (build SPA en `apk-www`)
 * y NO carga nada desde Internet al arrancar: la app abre y opera sin red
 * leyendo/escribiendo en la base de datos local (SQLite) y sincroniza con la
 * nube cuando vuelve la conexión.
 *
 * Genera la carpeta con: npm run build:apk
 */
const config: CapacitorConfig = {
  appId: "app.lovable.cuidador360",
  appName: "Cuidador 360",
  // Build estático (SPA) generado por scripts/build-apk.mjs.
  webDir: "apk-www",
  android: {
    allowMixedContent: false,
  },
};

export default config;
