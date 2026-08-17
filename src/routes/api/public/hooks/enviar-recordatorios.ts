import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

// Endpoint llamado por el cron cada 5 minutos. Envía los recordatorios de
// medicamentos cuya hora cae en la ventana actual. NUNCA toca medicamento_tomas.

const TZ = "America/Mexico_City";
const VENTANA_MIN = 5;

function ahoraEnMexico() {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const s = fmt.format(new Date()); // "2026-07-25 08:03"
  const [fecha, hm] = s.split(" ");
  const [h, m] = hm.split(":").map(Number);
  return { fecha, minutos: h * 60 + m };
}

function hhmm(min: number) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export const Route = createFileRoute("/api/public/hooks/enviar-recordatorios")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Autorización: secreto exclusivo del servidor (nunca viaja al cliente).
        const expected = process.env.CRON_SECRET;
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected) {
          return new Response("Not configured", { status: 500 });
        }
        // Comparación a prueba de ataques de tiempo (constant-time).
        const esValido =
          !!provided &&
          provided.length === expected.length &&
          timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
        if (!esValido) {
          return new Response("Unauthorized", { status: 401 });
        }


        const vapid = {
          publicKey: process.env.VAPID_PUBLIC_KEY!,
          privateKey: process.env.VAPID_PRIVATE_KEY!,
          subject: process.env.VAPID_SUBJECT ?? "mailto:soporte@cuidador360.app",
        };
        if (!vapid.publicKey || !vapid.privateKey) {
          return Response.json({ error: "VAPID no configurado" }, { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendWebPush } = await import("@/lib/push/webpush.server");

        const { fecha, minutos } = ahoraEnMexico();
        const desde = hhmm(minutos - VENTANA_MIN);
        const hasta = hhmm(minutos + VENTANA_MIN);

        let query = supabaseAdmin
          .from("medicamento_horarios")
          .select("id, owner_id, patient_id, hora, medicamentos(nombre, dosis, activo)")
          .eq("activo", true);
        // La ventana puede cruzar la medianoche.
        query =
          desde <= hasta
            ? query.gte("hora", desde).lte("hora", hasta)
            : query.or(`hora.gte.${desde},hora.lte.${hasta}`);

        const { data: horarios, error } = await query;
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let enviados = 0;
        let omitidos = 0;

        for (const h of horarios ?? []) {
          const med = h.medicamentos as unknown as
            | { nombre: string; dosis: string | null; activo: boolean }
            | null;
          if (!med || med.activo === false) continue;

          const hora = String(h.hora).slice(0, 5);

          // Anti-duplicado: si ya existe la fila, otro tick ya lo envió.
          const { error: dupErr } = await supabaseAdmin
            .from("recordatorio_envios")
            .insert({ horario_id: h.id, owner_id: h.owner_id, fecha, hora });
          if (dupErr) {
            omitidos++;
            continue;
          }

          const { data: subs } = await supabaseAdmin
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .eq("owner_id", h.owner_id);

          const payload = {
            title: "Recordatorio de medicamento",
            body: `${med.nombre}${med.dosis ? ` — ${med.dosis}` : ""} · ${hora}`,
            tag: `${h.id}-${fecha}-${hora}`,
            url: `/paciente/${h.patient_id}/medicamentos`,
          };

          for (const s of subs ?? []) {
            try {
              const status = await sendWebPush(
                { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
                payload,
                vapid,
              );
              if (status === 404 || status === 410) {
                await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
              } else if (status < 300) {
                enviados++;
              }
            } catch (e) {
              console.error("[recordatorios] fallo al enviar push", e);
            }
          }
        }

        return Response.json({
          ok: true,
          fecha,
          ventana: [desde, hasta],
          horarios: horarios?.length ?? 0,
          enviados,
          omitidos,
        });
      },
    },
  },
});
