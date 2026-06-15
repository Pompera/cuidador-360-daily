import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PREGUNTAS, calcularIEG } from "@/lib/clinical/chequeo";

export const Route = createFileRoute("/_app/paciente/$id/chequeo")({
  component: ChequeoDiario,
});

const colorBg: Record<string, string> = {
  verde: "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.1_155)]",
  amarillo: "bg-[oklch(0.93_0.08_85)] text-[oklch(0.4_0.12_70)]",
  naranja: "bg-[oklch(0.88_0.1_55)] text-[oklch(0.4_0.14_45)]",
  rojo: "bg-[oklch(0.88_0.1_25)] text-[oklch(0.4_0.18_25)]",
};

function ChequeoDiario() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, string | string[]>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<null | ReturnType<typeof calcularIEG>>(null);

  const p = PREGUNTAS[i];
  const total = PREGUNTAS.length;
  const progress = Math.round(((i + 1) / total) * 100);

  function set(value: string) {
    if (p.tipo === "multi") {
      const current = (respuestas[p.key] as string[]) ?? [];
      let next: string[];
      if (value === "ninguno") next = ["ninguno"];
      else next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current.filter((v) => v !== "ninguno"), value];
      setRespuestas({ ...respuestas, [p.key]: next });
    } else {
      setRespuestas({ ...respuestas, [p.key]: value });
      setTimeout(() => avanzar({ ...respuestas, [p.key]: value }), 200);
    }
  }

  function avanzar(currentResp = respuestas) {
    if (i < total - 1) setI(i + 1);
    else finalizar(currentResp);
  }

  async function finalizar(currentResp: Record<string, string | string[]>) {
    setSaving(true);
    const resultado = calcularIEG(currentResp);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sesión expirada");
      const hoy = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("chequeos_diarios").upsert(
        {
          patient_id: id, owner_id: u.user.id, fecha: hoy,
          respuestas: currentResp, ieg: resultado.ieg, color: resultado.color,
        },
        { onConflict: "patient_id,fecha" },
      );
      // upsert needs unique constraint; if missing, fallback to insert
      if (error) {
        const { error: e2 } = await supabase.from("chequeos_diarios").insert({
          patient_id: id, owner_id: u.user.id, fecha: hoy,
          respuestas: currentResp, ieg: resultado.ieg, color: resultado.color,
        });
        if (e2) throw e2;
      }
      setDone(resultado);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container-app pt-12 pb-10 text-center">
          <div className="mx-auto size-20 rounded-full bg-secondary text-primary grid place-items-center">
            <Check className="size-10" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-semibold">Chequeo guardado</h1>
          <div className="mt-8 rounded-3xl bg-card border border-border/60 p-6">
            <p className="text-muted-foreground">Índice de Estabilidad Geriátrica</p>
            <p className="font-display text-6xl font-semibold mt-1">{done.ieg}<span className="text-2xl text-muted-foreground">/100</span></p>
            <span className={`inline-block mt-3 px-3 py-1 rounded-full font-semibold ${colorBg[done.color]}`}>
              {done.interpretacion}
            </span>
          </div>
          {done.alertas.length > 0 && (
            <div className="mt-5 rounded-3xl border-2 border-accent/40 bg-accent/10 p-5 text-left">
              <p className="font-semibold mb-2">Atender hoy:</p>
              <ul className="space-y-1 text-sm">
                {done.alertas.map((a) => <li key={a}>• {a}</li>)}
              </ul>
            </div>
          )}
          <Button asChild size="xl" className="mt-8">
            <Link to="/paciente/$id" params={{ id }}>Volver al perfil</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="container-app pt-6 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => i === 0 ? navigate({ to: "/paciente/$id", params: { id } }) : setI(i - 1)} className="size-11 rounded-2xl bg-secondary grid place-items-center" aria-label="Atrás">
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Chequeo diario · {i + 1} de {total}</p>
            <p className="font-display text-base font-semibold capitalize">{areaLabel(p.area)}</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="container-app flex-1 pt-8 pb-8">
        <h2 className="font-display text-2xl font-semibold leading-tight">{p.pregunta}</h2>
        {p.tipo === "multi" && (
          <p className="mt-2 text-muted-foreground">Puedes marcar varios.</p>
        )}
        <div className="mt-6 space-y-3">
          {p.opciones.map((op) => {
            const isMulti = p.tipo === "multi";
            const selected = isMulti
              ? ((respuestas[p.key] as string[]) ?? []).includes(op.value)
              : respuestas[p.key] === op.value;
            return (
              <button
                key={op.value}
                onClick={() => set(op.value)}
                className={`w-full text-left rounded-2xl border-2 px-5 py-5 text-lg font-medium transition ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40"}`}
              >
                {op.label}
              </button>
            );
          })}
        </div>
      </main>

      {p.tipo === "multi" && (
        <footer className="container-app pb-8 pt-2 sticky bottom-0 bg-background/95 backdrop-blur">
          <Button size="xl" onClick={() => avanzar()} disabled={saving || !respuestas[p.key]}>
            {i === total - 1 ? "Terminar" : "Continuar"} <ArrowRight />
          </Button>
        </footer>
      )}
    </div>
  );
}

function areaLabel(a: string) {
  return ({ cognicion: "Cognición", funcion: "Función", nutricion: "Nutrición", sintomas: "Síntomas", seguridad: "Seguridad", global: "Resumen" } as Record<string, string>)[a] ?? a;
}
