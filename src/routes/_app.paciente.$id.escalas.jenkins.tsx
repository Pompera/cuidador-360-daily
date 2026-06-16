import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { JENKINS_ITEMS, JENKINS_OPTIONS, interpretJenkins, deltaJenkins } from "@/lib/clinical/jenkins";

export const Route = createFileRoute("/_app/paciente/$id/escalas/jenkins")({
  component: JenkinsPage,
});

interface Evaluacion { id: string; fecha: string; puntaje: number }

function JenkinsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [basal, setBasal] = useState<number | null>(null);
  const [historial, setHistorial] = useState<Evaluacion[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("patients").select("jenkins_basal").eq("id", id).maybeSingle();
      setBasal((p?.jenkins_basal as number | null) ?? null);
      const { data: ev } = await supabase
        .from("evaluaciones_escala")
        .select("id, fecha, puntaje")
        .eq("patient_id", id)
        .eq("tipo", "jenkins")
        .order("fecha", { ascending: false })
        .limit(12);
      setHistorial((ev ?? []) as Evaluacion[]);
      setLoading(false);
    })();
  }, [id]);

  const total = Object.values(respuestas).reduce((s, v) => s + v, 0);
  const done = Object.keys(respuestas).length === JENKINS_ITEMS.length;

  async function guardar() {
    if (!done) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sesión expirada");
      const { error } = await supabase.from("evaluaciones_escala").insert({
        owner_id: u.user.id,
        patient_id: id,
        tipo: "jenkins",
        puntaje: total,
        respuestas,
      });
      if (error) throw error;
      toast.success("Evaluación guardada");
      navigate({ to: "/paciente/$id/escalas", params: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="container-app pt-12 text-muted-foreground">Cargando…</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pt-6 pb-4 flex items-center gap-3">
        <Link to="/paciente/$id/escalas" params={{ id }} className="size-11 rounded-2xl bg-secondary grid place-items-center" aria-label="Atrás">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold leading-tight">Escala de sueño</h1>
          <p className="text-muted-foreground">Jenkins · último mes</p>
        </div>
      </header>

      <main className="container-app pb-32 space-y-6">
        <p className="text-muted-foreground">En el último mes, ¿con qué frecuencia presentó cada situación?</p>

        {JENKINS_ITEMS.map((it) => (
          <div key={it.key}>
            <p className="font-semibold mb-2">{it.label}</p>
            <div className="space-y-2">
              {JENKINS_OPTIONS.map((op) => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setRespuestas({ ...respuestas, [it.key]: op.value })}
                  className={`w-full text-left rounded-2xl border-2 px-4 py-3 transition ${respuestas[it.key] === op.value ? "border-primary bg-secondary text-primary font-semibold" : "border-border bg-card"}`}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {done && (
          <div className="rounded-2xl bg-secondary p-4">
            <p className="font-display text-lg">Puntaje: <b>{total}/20</b></p>
            <p className="text-muted-foreground">{interpretJenkins(total)}</p>
            <p className="text-sm text-muted-foreground mt-1">{deltaJenkins(total, basal)}</p>
          </div>
        )}

        {historial.length > 0 && (
          <section className="rounded-3xl bg-card border border-border/60 p-5">
            <h2 className="font-display text-lg font-semibold mb-3">Historial</h2>
            {basal != null && (
              <p className="text-sm text-muted-foreground mb-2">Basal: <b>{basal}/20</b></p>
            )}
            <ul className="space-y-1.5">
              {historial.map((e) => (
                <li key={e.id} className="flex justify-between text-sm border-b border-border/40 last:border-0 py-1.5">
                  <span className="text-muted-foreground">{e.fecha}</span>
                  <span className="font-medium">{e.puntaje}/20 · {interpretJenkins(e.puntaje)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="container-app pb-8 pt-2 sticky bottom-0 bg-background/95 backdrop-blur">
        <Button size="xl" onClick={guardar} disabled={!done || saving}>
          {saving ? "Guardando…" : "Guardar evaluación"}
        </Button>
      </footer>
    </div>
  );
}
