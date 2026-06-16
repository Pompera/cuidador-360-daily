import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Moon, Users, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/paciente/$id/escalas/")({
  component: EscalasHub,
});

function EscalasHub() {
  const { id } = Route.useParams();
  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pt-6 pb-4 flex items-center gap-3">
        <Link to="/paciente/$id" params={{ id }} className="size-11 rounded-2xl bg-secondary grid place-items-center" aria-label="Atrás">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold leading-tight">Escalas mensuales</h1>
          <p className="text-muted-foreground">Sueño y sobrecarga del cuidador</p>
        </div>
      </header>

      <main className="container-app pb-12 space-y-3">
        <Card to="/paciente/$id/escalas/jenkins" id={id} icon={<Moon className="size-6" />} title="Escala de sueño (Jenkins)" desc="Aplicación mensual · 4 preguntas" />
        <Card to="/paciente/$id/escalas/zarit" id={id} icon={<Users className="size-6" />} title="Sobrecarga del cuidador (Zarit abreviada)" desc="Aplicación mensual · 7 preguntas" />
      </main>
    </div>
  );
}

function Card({ to, id, icon, title, desc }: { to: "/paciente/$id/escalas/jenkins" | "/paciente/$id/escalas/zarit"; id: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to} params={{ id }} className="flex items-center gap-4 rounded-3xl bg-card border border-border/60 p-5 shadow-[var(--shadow-card)] hover:border-primary/40 transition">
      <div className="size-12 rounded-2xl bg-secondary grid place-items-center text-primary">{icon}</div>
      <div className="flex-1">
        <p className="font-display text-lg font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <ChevronRight className="size-5 text-muted-foreground" />
    </Link>
  );
}
