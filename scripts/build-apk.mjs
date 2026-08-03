/**
 * Build estático (SPA) para el APK de Cuidador 360.
 *
 * 1. Verifica que existan las variables de entorno del backend (van dentro del
 *    bundle del cliente: si faltan, el APK compila pero no puede iniciar sesión).
 * 2. Corre `vite build` con APK_BUILD=1 (modo SPA, sin Nitro).
 * 3. Copia EXACTAMENTE la salida de cliente (`dist/client`) a `apk-www/`, que es
 *    la carpeta que empaqueta Capacitor (`webDir` en capacitor.config.ts).
 * 4. Comprueba que apk-www/ tenga index.html + todos los assets JS/CSS que ese
 *    HTML referencia (un shell sin assets = pantalla que no reacciona a los toques).
 * 5. Duplica index.html como 404.html para el fallback tipo SPA del WebView.
 *
 * La web (navegador) no se ve afectada: `npm run build` sigue generando SSR.
 */
import { existsSync, rmSync, cpSync, copyFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const raiz = process.cwd();
const destino = join(raiz, "apk-www");
const salidaCliente = join(raiz, "dist", "client");

// --- 1. Variables de entorno requeridas ---------------------------------------
function leerEnvArchivo() {
  const valores = {};
  for (const archivo of [".env", ".env.local"]) {
    const ruta = join(raiz, archivo);
    if (!existsSync(ruta)) continue;
    for (const linea of readFileSync(ruta, "utf8").split("\n")) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m) valores[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return valores;
}

const envArchivo = leerEnvArchivo();
const requeridas = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
const faltantes = requeridas.filter((k) => !(process.env[k] || envArchivo[k]));
if (faltantes.length > 0) {
  console.error(
    `\n[build:apk] Faltan variables de entorno: ${faltantes.join(", ")}.\n` +
      "Estas variables se incrustan en el bundle del APK al compilar.\n" +
      "Crea un archivo .env en la raíz del proyecto con:\n" +
      '  VITE_SUPABASE_URL="https://<tu-proyecto>.supabase.co"\n' +
      '  VITE_SUPABASE_PUBLISHABLE_KEY="<clave publicable>"\n' +
      "(Se obtienen del proyecto exportado desde Lovable: el .env ya viene con ellas.)\n",
  );
  process.exit(1);
}

// --- 2. Build ------------------------------------------------------------------
rmSync(salidaCliente, { recursive: true, force: true });

const build = spawnSync("npx", ["vite", "build"], {
  stdio: "inherit",
  env: { ...process.env, APK_BUILD: "1" },
  shell: process.platform === "win32",
});
if (build.status !== 0) process.exit(build.status ?? 1);

// --- 3. Copia de la salida de cliente -----------------------------------------
const indexOrigen = join(salidaCliente, "index.html");
if (!existsSync(indexOrigen)) {
  console.error(
    "[build:apk] No se generó dist/client/index.html. El build SPA falló: revisa la salida de vite build.",
  );
  process.exit(1);
}

rmSync(destino, { recursive: true, force: true });
cpSync(salidaCliente, destino, { recursive: true });
copyFileSync(join(destino, "index.html"), join(destino, "404.html"));

// --- 4. Verificación: el HTML y sus assets viajan juntos ----------------------
const html = readFileSync(join(destino, "index.html"), "utf8");
const referencias = [...html.matchAll(/["'(](\/assets\/[^"')]+\.(?:js|css))["')]/g)].map(
  (m) => m[1],
);
const perdidos = [...new Set(referencias)].filter(
  (ruta) => !existsSync(join(destino, ruta.replace(/^\//, ""))),
);
if (referencias.length === 0) {
  console.error(
    "[build:apk] El index.html empaquetado no referencia ningún asset de cliente:\n" +
      "sin el bundle JS la pantalla se ve pero no responde a los toques.",
  );
  process.exit(1);
}
if (perdidos.length > 0) {
  console.error(`[build:apk] Faltan assets en apk-www: ${perdidos.join(", ")}`);
  process.exit(1);
}

console.log(
  `[build:apk] Listo. apk-www/ con index.html + ${referencias.length} assets de cliente ` +
    "(rutas absolutas /assets/..., servidas por Capacitor desde https://localhost/).",
);
