/**
 * Build estático (SPA) para el APK de Cuidador 360.
 *
 * 1. Corre `vite build` con APK_BUILD=1 (modo SPA, sin Nitro).
 * 2. Copia la salida cliente a `apk-www/`, que es la carpeta que empaqueta
 *    Capacitor (`webDir` en capacitor.config.ts).
 * 3. Duplica index.html como 404.html para el fallback tipo SPA del WebView.
 *
 * La web (navegador) no se ve afectada: `npm run build` sigue generando SSR.
 */
import { existsSync, rmSync, cpSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const raiz = process.cwd();
const destino = join(raiz, "apk-www");

const build = spawnSync("npx", ["vite", "build"], {
  stdio: "inherit",
  env: { ...process.env, APK_BUILD: "1" },
  shell: process.platform === "win32",
});
if (build.status !== 0) process.exit(build.status ?? 1);

const candidatos = [
  join(raiz, "dist", "client"),
  join(raiz, ".output", "public"),
  join(raiz, "dist"),
];
const origen = candidatos.find((p) => existsSync(join(p, "index.html")));
if (!origen) {
  console.error(
    "[build:apk] No se encontró index.html en dist/client, .output/public ni dist.",
  );
  process.exit(1);
}

rmSync(destino, { recursive: true, force: true });
cpSync(origen, destino, { recursive: true });
copyFileSync(join(destino, "index.html"), join(destino, "404.html"));

console.log(`[build:apk] Listo. Carpeta para Capacitor: apk-www (desde ${origen})`);
