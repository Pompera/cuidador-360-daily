# Empaquetar el APK en modo 100% offline

Hoy el APK descarga la app desde Internet en cada arranque (`server.url` en `capacitor.config.ts`) y `webDir` apunta a `mobile/`, que solo tiene una pantalla de error. Toda la capa offline ya programada nunca llega a usarse. El objetivo es generar un build estático que viaje dentro del teléfono, sin tocar la web (que sigue SSR contra la nube).

## Qué se va a hacer

### 1. Build estático para el APK
- Nuevo script `build:apk` que corre el build de Vite con una bandera de entorno propia (p. ej. `APK_BUILD=1`).
- `vite.config.ts` pasa a leer esa bandera: cuando está activa, activa el modo SPA de TanStack Start (shell `index.html` prerenderizado) y desactiva Nitro; cuando no, el build queda exactamente como hoy (SSR + Nitro para la web).
- El script copia la salida cliente a `apk-www/` (carpeta nueva, ignorada por git) y garantiza fallback SPA copiando `index.html` como `404.html` para el WebView.
- Revisión de rutas: `_app.tsx` y `auth.tsx` ya tienen `ssr: false`; se añade a `index.tsx` solo si el prerender falla, sin alterar el comportamiento web.

### 2. Configuración de Capacitor
- `webDir: "apk-www"`, se elimina por completo el bloque `server`, se mantiene `android.allowMixedContent: false`.
- Se reescribe el comentario de cabecera (hoy dice lo contrario) y se retira `mobile/index.html`, que ya no cumple ninguna función.

### 3. Assets de marca
- Ya existen `public/icon-192.png`, `public/icon-512.png`, `public/favicon.png` y `public/apple-touch-icon.png`, así que el manifest no tiene referencias roras y no hace falta generarlos de nuevo.
- Sí hay un punto pendiente: el logo de la interfaz y del PDF se carga desde una URL de CDN (`src/assets/logo-c360.png.asset.json`), que sin Internet no resuelve. Se añade una copia local del logo en `public/` y las pantallas la usan cuando `usaModoOffline()` es verdadero, dejando la web igual.

### 4. Limpieza del arranque sin red
- `src/routes/_app.app.tsx`: se quita el import de `supabase` si ya no se usa (se conserva si sigue haciendo `signOut`).
- Se verifica que `auth.tsx` y el `onAuthStateChange` de `__root.tsx` no bloqueen el arranque sin red: el listener se envuelve para tolerar fallo de creación de cliente y el gate de sesión sigue apoyado en `usuarioActual()` / `leerSesionLocal()`.

### 5. Documentación
- Se reescribe `docs/apk-capacitor.md`: cómo generar el build SPA, que los endpoints de `src/routes/api/**` (Web Push, `enviar-recordatorios.ts`) no forman parte del APK y que ahí los recordatorios los da `@capacitor/local-notifications`, los pasos `npx cap add android` / `npx cap sync android` / abrir en Android Studio, la aclaración de que la compilación final necesita SDK de Android + Gradle fuera de Lovable, y la prueba de humo en modo avión (crear paciente + chequeo, cerrar, reconectar, confirmar sincronización).

## Archivos que NO se tocan

`src/lib/plataforma.ts`, `src/lib/db/*`, `src/lib/repos/*`, `src/lib/sync/*`, `src/lib/auth/sesion.ts`, `src/lib/notificaciones/locales.ts`, `src/lib/red.ts`.

## Notas técnicas

- El build SSR de la web no cambia: la ruta SPA se activa solo por variable de entorno, y el default de `vite build` sigue produciendo la salida Nitro actual.
- Las rutas `src/routes/api/**` siguen existiendo en la web; simplemente no se prerenderizan ni se empaquetan en el APK.
- Verificación tras los cambios: `bun run build` (web SSR, debe seguir pasando) y `bun run build:apk` (debe producir `apk-www/index.html` + assets).
