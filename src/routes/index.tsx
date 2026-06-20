import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ShieldCheck, FileText, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoC360 from "@/assets/logo-c360.png.asset.json";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cuidador 360 — Bitácora geriátrica diaria" },
      { name: "description", content: "Aplicación para cuidadores: registra cambios diarios del adulto mayor y genera un resumen claro para el médico." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center font-display font-bold">C</div>
          <span className="font-display text-xl font-semibold">Cuidador 360</span>
        </div>
        <Link to="/auth" className="text-primary font-semibold">Entrar</Link>
      </header>

      <main className="container-app pt-6 pb-16">
        <h1 className="font-display text-[2.5rem] leading-[1.05] font-semibold tracking-tight">
          Un minuto al día. <span className="text-primary">Cuidado claro</span> toda la vida.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Registra los cambios diarios del adulto mayor y entrega al médico un resumen
          fácil de leer en la consulta. Pensado para cuidadores, no para expertos.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Button asChild size="xl"><Link to="/auth">Comenzar gratis</Link></Button>
          <p className="text-center text-sm text-muted-foreground">
            La aplicación no sustituye una valoración médica.
          </p>
        </div>

        <ul className="mt-12 grid gap-4">
          {[
            { Icon: Activity, title: "Chequeo diario de 1 minuto", desc: "Una pregunta por pantalla. Sin tecnicismos." },
            { Icon: Heart, title: "Define el estado basal", desc: "Responde preguntas sencillas para conocer a tu familiar." },
            { Icon: FileText, title: "Reporte PDF para el médico", desc: "Resumen de 1–2 páginas con tendencia y alertas." },
            { Icon: ShieldCheck, title: "Tus datos protegidos", desc: "Acceso privado por cuidador." },
          ].map(({ Icon, title, desc }) => (
            <li key={title} className="flex gap-4 rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="size-12 shrink-0 rounded-2xl bg-secondary text-primary grid place-items-center">
                <Icon className="size-6" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">{title}</h3>
                <p className="text-muted-foreground">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
