import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuración de Capacitor para generar el APK de Cuidador 360.
 *
 * IMPORTANTE: la app usa renderizado en servidor (TanStack Start) y funciones
 * de servidor, por lo que el APK NO empaqueta la web como archivos estáticos:
 * carga la app publicada dentro del contenedor nativo (server.url).
 *
 * Cuando publiques la app, cambia `server.url` por tu dominio definitivo.
 */
const config: CapacitorConfig = {
  appId: "app.lovable.cuidador360",
  appName: "Cuidador 360",
  // Carpeta con un fallback estático (solo se usa si no hay conexión al arrancar).
  webDir: "mobile",
  server: {
    url: "https://id-preview--c055bc56-34ed-45f9-99ba-3430e85d55f2.lovable.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
