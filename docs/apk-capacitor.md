# Generar el APK de Cuidador 360 (modo 100% offline)

El APK empaqueta la app como archivos estáticos y **no descarga nada de
Internet al arrancar**. Abre y opera sin red usando la base de datos local
(SQLite) y sincroniza con la nube cuando vuelve la conexión.

La versión web sigue igual: SSR y hablando directamente con la nube.

## Requisitos previos

- Node.js 20 o superior
- Un archivo `.env` en la raíz con las credenciales del backend (ya viene en el
  proyecto exportado desde Lovable):

  ```
  VITE_SUPABASE_URL="https://<tu-proyecto>.supabase.co"
  VITE_SUPABASE_PUBLISHABLE_KEY="<clave publicable>"
  ```

  Estas variables se incrustan en el bundle al compilar. Si faltan,
  `npm run build:apk` se detiene con un mensaje claro en vez de generar un APK
  que no puede iniciar sesión.
- Android Studio (SDK de Android + Gradle)
- JDK 17

> La compilación final del APK necesita el toolchain de Android, que no existe
> dentro de Lovable: ese paso se hace en tu PC.

## Pasos

```bash
# 1. Exportar el proyecto a GitHub y clonarlo
git clone <tu-repo> && cd <tu-repo>

# 2. Dependencias
npm install

# 3. Build estático (SPA) para el APK -> carpeta apk-www/
npm run build:apk

# 4. Proyecto nativo de Android (solo la primera vez)
npx cap add android

# 5. Copiar el build al proyecto nativo
npx cap sync android

# 6. Abrir en Android Studio
npx cap open android
```

En Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
El archivo queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

Cada vez que cambies la app: `npm run build:apk && npx cap sync android`.

## Cómo funciona el build

- `npm run build` → build normal de la web (SSR + Nitro). No cambia.
- `npm run build:apk` → corre Vite con `APK_BUILD=1`, que activa el modo SPA de
  TanStack Start (shell `index.html` prerenderizado) y desactiva Nitro. El
  script copia **exactamente** `dist/client/` (el HTML junto con sus assets de
  cliente) a `apk-www/`, duplica `index.html` como `404.html` para el fallback
  de rutas dentro del WebView y verifica que cada `/assets/*.js|css` que el HTML
  referencia exista en la carpeta. Si el bundle JS no viaja, la pantalla se ve
  pero no reacciona a los toques: por eso el build falla en ese caso.
- Las rutas de assets son absolutas (`/assets/...`) y Capacitor sirve `apk-www`
  desde `https://localhost/`, así que se resuelven sin `base` especial.
- `capacitor.config.ts` apunta a `webDir: "apk-www"` y **no** tiene bloque
  `server.url`.

Las pantallas de la app usan `ssr: false` donde corresponde (`/auth`, `/_app/*`),
así que el shell SPA basta para renderizarlas en el teléfono.

## Qué NO viaja dentro del APK

Los endpoints de servidor de `src/routes/api/**` (entre ellos el de Web Push
`api/public/hooks/enviar-recordatorios.ts`) viven solo en la web publicada.

En el APK los recordatorios de medicamentos se programan en el propio teléfono
con `@capacitor/local-notifications` (ver `src/lib/notificaciones/locales.ts`),
por lo que funcionan sin Internet y sin depender de Web Push.

## Iconos nativos

La web ya usa el logo como favicon e icono de PWA (`public/icon-192.png`,
`public/icon-512.png`, `public/apple-touch-icon.png`, `public/logo-c360.png`).
Para el icono del lanzador de Android, tras `npx cap add android`:

```bash
mkdir -p resources
cp public/icon-512.png resources/icon.png
npx @capacitor/assets generate --android
npx cap sync android
```

## Prueba de humo offline

1. Instala el APK y **inicia sesión una vez con Internet** (el primer login sí
   requiere red; la sesión queda guardada en el dispositivo).
2. Activa **modo avión** y cierra la app por completo.
3. Ábrela: debe entrar directo a la lista de adultos mayores, sin pantalla de
   "No se pudo conectar".
4. Crea un adulto mayor y registra un chequeo diario. Debe guardar y mostrarse
   al instante.
5. Cierra la app todavía sin red y vuelve a abrirla: los datos siguen ahí.
6. Desactiva el modo avión y espera unos segundos con la app abierta: el
   SyncManager sube lo pendiente (creados, editados, borrados) y baja lo nuevo.
7. Abre la web con la misma cuenta: el paciente y el chequeo aparecen una sola
   vez (el upsert por `id` evita duplicados).

## Firmar para Google Play

1. Android Studio: **Build > Generate Signed Bundle / APK**.
2. Crea una keystore y guárdala (sin ella no podrás actualizar la app).
3. Genera un **Android App Bundle (.aab)** para Play Console.

## Diagnóstico del WebView (paso estándar tras compilar)

Si la app abre pero los botones o enlaces no responden, casi siempre es que el
bundle de cliente no se cargó (404 de un chunk) o que hubo una excepción al
hidratar. Para verlo:

1. Conecta el teléfono por USB con **Depuración USB** activada e instala el APK.
2. En Chrome de escritorio abre `chrome://inspect#devices`.
3. Bajo el dispositivo aparece `Cuidador 360` (WebView). Pulsa **inspect**.
4. En **Console**: busca excepciones rojas al arrancar.
5. En **Network**: recarga y confirma que `index.html`, `/assets/*.css` y todos
   los `/assets/*.js` devuelvan 200 (no 404).
6. Comprueba también que `apk-www/assets/` exista tras `npm run build:apk` y que
   corriste `npx cap sync android` después del build.

## Inicio de sesión en el APK

El APK no tiene servidor propio: se sirve desde archivos locales (`https://localhost`).
Por eso el flujo de Google del SDK de Lovable, que llama a la ruta **relativa**
`/~oauth/initiate`, devuelve **error 404** dentro del WebView.

- **Correo y contraseña**: funciona siempre (habla directo con el backend).
- **Google**: solo aparece si al compilar el APK defines la URL del sitio publicado:

```bash
VITE_SITE_URL="https://<tu-sitio>.lovable.app" npm run build:apk
```

Sin `VITE_SITE_URL` el botón de Google se oculta en el APK (en la web sigue igual).
Esa misma URL se usa como destino de los correos de confirmación de cuenta, ya que
un enlace a `https://localhost/app` no abriría en el teléfono.
