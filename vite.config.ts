// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// APK_BUILD=1 -> salida estática (SPA) para empaquetar dentro del APK de Capacitor.
// Sin la bandera el build es exactamente el de siempre: SSR + Nitro para la web.
const esApk = process.env.APK_BUILD === "1";

export default defineConfig({
  // En el APK no hay servidor Node: no se genera salida Nitro.
  nitro: esApk ? false : undefined,
  tanstackStart: esApk
    ? {
        // Shell SPA prerenderizado: index.html + assets servibles desde el teléfono.
        spa: { enabled: true, prerender: { outputPath: "/index.html" } },
      }
    : {
        // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
        // nitro/vite builds from this
        server: { entry: "server" },
      },
});
