# Recordatorios de medicamentos (Web Push)

Los recordatorios son **solo avisos**. No modifican el registro de tomas: el cuidador
sigue marcando "Tomado / Omitido" manualmente.

## Piezas

| Pieza | Ubicación |
| --- | --- |
| Horarios por medicamento | tabla `medicamento_horarios` + UI en `/paciente/$id/medicamentos` |
| Suscripciones del navegador | tabla `push_subscriptions` |
| Anti-duplicado de envíos | tabla `recordatorio_envios` (solo backend) |
| Envío | `src/routes/api/public/hooks/enviar-recordatorios.ts` |
| Cifrado VAPID / aes128gcm | `src/lib/push/webpush.server.ts` |
| Registro en el navegador | `src/lib/push/client.ts` + `public/sw.js` |
| Disparador | job de `pg_cron` cada 5 minutos |

La ventana de envío es de ±5 minutos sobre la hora configurada, calculada en
`America/Mexico_City`.

## Claves VAPID

- Pública: en `src/lib/push/client.ts` (no es secreta) y en el secreto `VAPID_PUBLIC_KEY`.
- Privada: secreto `VAPID_PRIVATE_KEY` (nunca en el cliente).
- Contacto: secreto `VAPID_SUBJECT` (por ejemplo `mailto:soporte@cuidador360.app`).

Para regenerar el par:

```bash
node -e "
const {webcrypto}=require('crypto');
(async()=>{
  const kp=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const pub=Buffer.from(await webcrypto.subtle.exportKey('raw',kp.publicKey));
  const jwk=await webcrypto.subtle.exportKey('jwk',kp.privateKey);
  const b64=b=>b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  console.log('VAPID_PUBLIC_KEY=',b64(pub));
  console.log('VAPID_PRIVATE_KEY=',jwk.d);
})()"
```

Si se regeneran, hay que actualizar los tres secretos, cambiar la constante
`VAPID_PUBLIC_KEY` del cliente y **vaciar `push_subscriptions`** (las suscripciones
viejas quedan inválidas).

## Cómo probar

1. Abrir la app en Chrome/Edge/Android, entrar a Medicamentos y pulsar
   "Activar notificaciones". Debe aparecer una fila nueva en `push_subscriptions`.
2. Añadir a un medicamento un horario con la hora actual (zona de México).
3. Llamar el endpoint manualmente:

   ```bash
   curl -X POST https://<dominio>/api/public/hooks/enviar-recordatorios \
     -H "x-cron-secret: <valor del secreto CRON_SECRET>" -H "content-type: application/json" -d '{}'
   ```

   Responde `{ ok: true, horarios, enviados, omitidos }`. Una segunda llamada en la
   misma ventana devuelve `omitidos > 0` y no reenvía (gracias a `recordatorio_envios`).
4. En iPhone/iPad hay que instalar la app en la pantalla de inicio
   (Compartir → Agregar a inicio) para que las notificaciones funcionen.

## Notas

- **Autorización:** el endpoint solo acepta llamadas con la cabecera `x-cron-secret`
  (o `Authorization: Bearer …`) igual al secreto `CRON_SECRET`, que vive únicamente en el
  servidor. La clave pública del proyecto ya NO sirve para llamarlo. Si cambias
  `CRON_SECRET`, actualiza también la cabecera del job de `pg_cron`.


- El cron apunta al dominio de producción; hasta publicar la app, los envíos
  automáticos no se disparan (la prueba manual sí funciona en la vista previa).
- Si un push devuelve 404/410, la suscripción se elimina automáticamente.
