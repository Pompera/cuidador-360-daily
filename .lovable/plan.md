## Objetivo

Convertir Cuidador 360 en una app offline-first para el APK Android, sin cambiar la interfaz ni perder funciones. La app leerá y escribirá siempre en una base de datos local del teléfono; la nube pasa a ser solo servidor de sincronización.

## Hallazgos del análisis (verificados)

- `capacitor.config.ts` usa `server.url` apuntando a la web publicada: hoy el APK **descarga la app de Internet en cada arranque**. Sin este cambio, nada de offline funciona.
- 14 pantallas hablan directamente con la nube (`supabase.from` / `supabase.auth`): lista de pacientes, alta de paciente, chequeo diario, medicamentos, signos, caídas, escalas, profundización, reporte y login.
- La sesión se guarda en `localStorage` con refresco automático de token: sin Internet, el refresco falla y puede expulsar al usuario.
- Los recordatorios usan Web Push (requiere servidor); pasarán a notificaciones locales del teléfono.

## Cambio de empaquetado (base de todo)

- La app se compila en modo aplicación de una sola página y se empaqueta dentro del APK; se elimina `server.url`.
- Consecuencia acordada: los cambios futuros ya no llegan solos al teléfono; hay que recompilar el APK.
- El sitio web actual sigue funcionando igual (online). El modo offline es exclusivo del APK.

## Arquitectura

```text
Pantallas (UI, sin cambios visuales)
        ↓
Repositorios (pacientes, chequeos, ...)
        ↓
SQLite local (fuente de verdad)
        ↓
SyncManager (cola + reintentos)
        ↓
Nube (solo sincronización)
```

Ninguna pantalla vuelve a llamar a la nube directamente.

## Base de datos local

Cada tabla local replica la de la nube y añade cuatro campos de control:

- `sync_status`: `pending`, `synced`, `updated`, `deleted`, `failed`
- `last_modified`: marca de tiempo para resolver conflictos
- `deleted_at`: borrado lógico (nunca se pierde información)
- `sync_error`: último motivo de fallo

Los borrados son lógicos hasta confirmarse en la nube. Se crean índices por paciente y por fecha para que las listas y el historial carguen rápido.

## Sincronización (automática, sin botón)

1. Detecta conexión con el plugin de red de Capacitor y al volver la app al primer plano.
2. Sube los registros `pending` / `updated` / `deleted` en orden de dependencia (paciente antes que sus registros).
3. Descarga cambios de la nube desde la última marca de sincronización.
4. Conflictos: gana el `last_modified` más reciente.
5. Sin duplicados: cada registro se crea con su identificador definitivo en el teléfono, así subirlo dos veces no crea copias.
6. Reintentos con espera creciente; los fallos quedan como `failed` y se reintentan solos.
7. Todo en segundo plano y silencioso: nunca se muestran mensajes de "sin Internet" ni "error de conexión".

## Autenticación offline

- Tras un primer inicio de sesión exitoso, se guarda la sesión en el almacenamiento seguro del dispositivo (Preferences).
- Al abrir sin Internet: si existe sesión previa válida, entra directo. El refresco de token se intenta solo cuando hay red.
- El cierre de sesión sigue funcionando igual y limpia los datos locales de esa cuenta.

## Fase 1 (esta entrega, para probar en Android)

1. Empaquetado en el APK y configuración de Capacitor (SQLite, red, preferencias).
2. Capa de base de datos local: apertura, migraciones versionadas, utilidades comunes.
3. SyncManager completo (cola, reintentos, conflictos, marcas de estado).
4. Sesión offline.
5. Repositorios y conversión de: **perfil, lista de pacientes, alta de paciente (10 pasos) y chequeo diario** (incluye el cálculo del índice y la detección de alertas, que ya son locales).
6. Migración de datos: al primer arranque con sesión y red, se descarga todo lo existente de la nube al teléfono; no se borra nada.
7. Guía actualizada para compilar y probar el APK.

## Fases siguientes (tras tu prueba en Android)

- **Fase 2:** bitácoras — medicamentos (con notificaciones locales), signos vitales y caídas.
- **Fase 3:** escalas mensuales, profundización clínica y reporte PDF (el PDF ya se genera en el teléfono; solo cambia el origen de los datos).

## Detalles técnicos

- Nuevas dependencias: `@capacitor-community/sqlite`, `@capacitor/preferences`, `@capacitor/network`, y en Fase 2 `@capacitor/local-notifications`.
- Archivos nuevos: `src/lib/db/` (conexión, esquema, migraciones), `src/lib/repos/` (un repositorio por entidad), `src/lib/sync/` (SyncManager, cola, resolución de conflictos), `src/lib/auth/offline-session.ts`.
- Archivos modificados en Fase 1: `capacitor.config.ts`, `vite.config.ts`, `src/routes/__root.tsx`, `src/routes/_app.tsx`, `src/routes/auth.tsx`, `src/routes/_app.app.tsx`, `src/routes/_app.paciente.nuevo.tsx`, `src/routes/_app.paciente.$id.chequeo.tsx`, `src/routes/_app.paciente.$id.index.tsx`, `docs/apk-capacitor.md`.
- Sin cambios de esquema en la nube en Fase 1; las tablas ya tienen `updated_at`/`created_at`. Si en Fase 2 falta alguna marca de tiempo para conflictos, se propondrá una migración aparte.
- El navegador seguirá usando la nube directamente (los repositorios detectan plataforma), así el editor y la web publicada no se rompen.

## Requiere revisión manual tuya

- Compilar y probar el APK en tu PC al terminar cada fase (`npm install → npm run build → npx cap sync → npx cap open android`).
- Confirmar el comportamiento en modo avión: crear paciente, hacer chequeo, cerrar app, reconectar y ver que sube solo.
