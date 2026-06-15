import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pill, Activity, TriangleAlert, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/paciente/$id/bitacoras")({
  component: BitacorasHub,
});

function BitacorasHub() {
  const { id } = Route.useParams();
  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pt-6 pb-4 flex items-center gap-3">
        <Link to="/paciente/$id" params={{ id }} className="size-11 rounded-2xl bg-secondary grid place-items-center" aria-label="Atrás">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold leading-tight">Bitácoras</h1>
          <p className="text-muted-foreground">Registros del paciente</p>
        </div>
      </header>

      <main className="container-app pb-12 space-y-3">
        <Card to="/paciente/$id/medicamentos" id={id} icon={<Pill className="size-6" />} title="Medicamentos" desc="Lista, dosis y adherencia diaria" />
        <Card to="/paciente/$id/signos" id={id} icon={<Activity className="size-6" />} title="Signos vitales" desc="Presión, FC, temperatura, saturación, glucosa" />
        <Card to="/paciente/$id/caidas" id={id} icon={<TriangleAlert className="size-6" />} title="Caídas" desc="Registro de eventos con lesión u hospitalización" />
      </main>
    </div>
  );
}

function Card({ to, id, icon, title, desc }: { to: "/paciente/$id/medicamentos" | "/paciente/$id/signos" | "/paciente/$id/caidas"; id: string; icon: React.ReactNode; title: string; desc: string }) {
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
