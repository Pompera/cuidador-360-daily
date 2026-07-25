
# Recordatorios de medicamentos vía Web Push

Objetivo: avisar al cuidador a las horas configuradas de cada medicamento. Son **solo recordatorios**: no cambian el registro de tomas, ni `medicamento_tomas`, ni `registrar`, ni `calcularAdherencia`, ni el campo de frecuencia en texto libre.

## Ajuste importante respecto a tu especificación

Este proyecto es TanStack Start sobre Lovable Cloud, donde el backend propio de la app corre en el servidor de TanStack, no en Supabase Edge Functions (crear `supabase/functions/` aquí no se despliega). Implemento la misma lógica exacta en una **ruta de servidor pública** `/api/public/hooks/enviar-recordatorios`, llamada por el cron cada 5 minutos con la clave del proyecto en el header. Todo lo demás (tablas, RLS, cron, SW, UI, VAPID) se hace tal como pides. Tampoco toco `vite.config.ts`.

## 1. Base de datos (migración nueva y aditiva)

Tres tablas nuevas, siguiendo las convenciones existentes (RLS, policy `auth.uid() = owner_id`, GRANTs a `authenticated`/`service_role`, trigger `tg_set_updated_at`, `gen_random_uuid()`, FKs con `ON DELETE CASCADE`):

- `medicamento_horarios`: owner_id, patient_id, medicamento_id, hora (time), activo, timestamps, índice por medicamento_id.
- `push_subscriptions`: owner_id, endpoint (único), p256dh, auth, created_at.
- `recordatorio_envios`: horario_id, fecha, hora, created_at, `UNIQUE (horario_id, fecha, hora)`; RLS activo sin políticas para usuarios (solo service_role escribe).

Además: habilitar `pg_cron` y `pg_net`, y programar un job cada 5 minutos que haga POST a la ruta del hook. Si alguna extensión no puede habilitarse, el bloque queda comentado y documento la alternativa con un scheduler externo.

## 2. Endpoint de envío

`src/routes/api/public/hooks/enviar-recordatorios.ts`:

1. Calcula la hora actual en `America/Mexico_City` y una ventana de ±5 minutos.
2. Busca horarios activos dentro de la ventana.
3. Descarta los que ya tengan fila en `recordatorio_envios` para esa fecha+hora.
4. Carga las suscripciones push del dueño del horario.
5. Envía la notificación (título "Recordatorio de medicamento", cuerpo con nombre y dosis).
6. Inserta el registro anti-duplicado.
7. Borra suscripciones que respondan 404/410.

Nunca lee ni escribe `medicamento_tomas`. Usa el cliente administrador solo dentro del handler y valida la clave del llamante antes de actuar.

Detalle técnico: la librería `web-push` de Node no funciona en este runtime; el cifrado VAPID/aes128gcm se implementa con Web Crypto (o una librería compatible con edge), que es el mismo protocolo estándar.

## 3. Service worker

`public/sw.js` estático servido en la raíz (scope `/`), sin plugins de Vite:
- evento `push`: muestra la notificación con el payload JSON.
- evento `notificationclick`: abre o enfoca la app en la pantalla de medicamentos del paciente.

Este SW es solo de notificaciones: no cachea nada ni cambia el comportamiento offline.

## 4. Registro en el cliente

En el `useEffect` de `RootComponent` (`src/routes/__root.tsx`), junto al listener de sesión, con guards: `typeof window !== "undefined"`, `"serviceWorker" in navigator`, `"PushManager" in window`. Registra el SW; si hay sesión y el permiso está concedido, se suscribe con la clave pública VAPID y hace upsert por `endpoint` en `push_subscriptions`. No bloquea el render ni pide permiso de forma agresiva en el arranque.

## 5. UI de horarios

En `src/routes/_app.paciente.$id.medicamentos.tsx`:
- Al agregar un medicamento y desde cada tarjeta, se pueden añadir uno o varios horarios con `<input type="time">`.
- Lista de horarios por medicamento con interruptor de activo/inactivo y borrado.
- Botón para activar notificaciones (solicita permiso con un gesto del usuario, que es lo que exigen los navegadores).
- Aviso: en iPhone/iPad las notificaciones solo funcionan si se instala la app en la pantalla de inicio.
- Se conserva intacto el campo de frecuencia en texto libre y toda la lógica de tomas y adherencia.

## 6. Claves y secretos

- Genero el par VAPID. La clave pública (no sensible) va en el código del cliente; la privada y el asunto se guardan como secretos del backend (`VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`). La clave de servicio nunca llega al navegador.
- Dejo un `README` corto con el comando para regenerar las claves y los pasos para probar el flujo de punta a punta.

## Verificación

Llamada manual al endpoint con un horario de prueba, confirmando que se crea la fila anti-duplicado, que una segunda llamada en la misma ventana no reenvía, y revisión en el navegador de que el SW queda registrado y la suscripción se guarda.
