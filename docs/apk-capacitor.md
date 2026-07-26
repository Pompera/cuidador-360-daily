# Generar el APK de Cuidador 360 con Capacitor

El proyecto ya está configurado. En tu PC solo necesitas ejecutar los comandos.

## Requisitos previos

- Node.js 20 o superior
- Android Studio (incluye el SDK de Android)
- JDK 17

## Pasos

```bash
# 1. Exportar el proyecto a GitHub y clonarlo en tu PC
git clone <tu-repo>
cd <tu-repo>

# 2. Instalar dependencias
npm install

# 3. Crear el proyecto nativo de Android (solo la primera vez)
npx cap add android

# 4. Compilar la web y sincronizar con Android
npm run build
npx cap sync

# 5. Abrir en Android Studio
npx cap open android
```

En Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
El archivo queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

## Cómo funciona este APK

La app usa renderizado en servidor y funciones de servidor, así que el APK
**no** empaqueta la web como archivos estáticos: es un contenedor nativo que
carga la app publicada (`server.url` en `capacitor.config.ts`).

Ventaja: cada cambio que publiques desde Lovable llega a la app sin recompilar
el APK. Solo hay que recompilar si cambias configuración nativa o plugins.

### Al publicar

Cuando tengas la URL definitiva (o dominio propio), edita `capacitor.config.ts`:

```ts
server: { url: "https://tu-dominio.com" }
```

y vuelve a ejecutar `npx cap sync`.

## Firmar para Google Play

1. Android Studio: **Build > Generate Signed Bundle / APK**.
2. Crea una keystore (guárdala, sin ella no podrás actualizar la app).
3. Genera un **Android App Bundle (.aab)** para subir a Play Console.

## Notificaciones de medicamentos

Los recordatorios actuales usan **Web Push**, que funciona en el navegador y en
la PWA instalada. Dentro del APK, Android puede no entregar esas notificaciones
en segundo plano de forma fiable. Si los recordatorios son críticos en el APK,
el siguiente paso es migrar a `@capacitor/push-notifications` con Firebase (FCM).
