import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { detectarAlertas, labelDominio, type Dominio } from "@/lib/clinical/alertas";
import {
  preguntasPara,
  evaluarProfundizacion,
  ajusteIEG,
  colorPorIEG,
  type ResultadoProf,
} from "@/lib/clinical/profundizacion";

const searchSchema = z.object({
  dominios: z.string().optional(),
});

export const Route = createFileRoute("/_app/paciente/$id/profundizacion")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ProfundizacionPage,
});

const DOMINIOS_VALIDOS: Dominio[] = ["cognicion", "funcion", "nutricion", "seguridad", "sintomas"];

const colorBg: Record<string, string> = {
  leve: "bg-[oklch(0.93_0.08_85)] text-[oklch(0.4_0.12_70)]",
  moderado: "bg-[oklch(0.88_0.1_55)] text-[oklch(0.4_0.14_45)]",
  severo: "bg-[oklch(0.88_0.1_25)] text-[oklch(0.4_0.18_25)]",
};

function ProfundizacionPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [dominios, setDominios] = useState<Dominio[]>([]);
  const [alertasDet, setAlertasDet] = useState<Record<Dominio, string[]>>({
    cognicion: [], funcion: [], nutricion: [], seguridad: [], sintomas: [],
  });
  const [chequeoId, setChequeoId] = useState<string | null>(null);
  const [chequeoIegBasal, setChequeoIegBasal] = useState<number | null>(null);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [i, setI] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<ResultadoProf | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // 1) Dominios desde search o recalculados desde el historial.
      let doms: Dominio[] = [];
      if (search.dominios) {
        doms = search.dominios
          .split(",")
          .filter((d): d is Dominio => DOMINIOS_VALIDOS.includes(d as Dominio));
      }
      const { data: hist } = await supabase
        .from("chequeos_diarios")
        .select("id, fecha, ieg, respuestas")
        .eq("patient_id", id)
        .order("fecha", { ascending: false })
        .limit(7);
      const arr = (hist ?? []) as Array<{ id: string; fecha: string; ieg: number; respuestas: Record<string, string | string[]> }>;
      const det = detectarAlertas(arr);
      if (doms.length === 0) doms = det.dominios;
      setDominios(doms);
      setAlertasDet(det.detalles);
      if (arr[0]) {
        setChequeoId(arr[0].id);
        setChequeoIegBasal(arr[0].ieg);
      }
      setLoading(false);
    })();
  }, [id, search.dominios]);

  const preguntas = useMemo(() => preguntasPara(dominios), [dominios]);
  const p = preguntas[i];
  const total = preguntas.length;

  function set(value: string) {
    if (!p) return;
    const next = { ...respuestas, [p.key]: value };
    setRespuestas(next);
    setTimeout(() => avanzar(next), 200);
  }

  function avanzar(curr = respuestas) {
    if (i < total - 1) setI(i + 1);
    else finalizar(curr);
  }

  async function finalizar(curr: Record<string, string>) {
    if (dominios.length === 0) return;
    setSaving(true);
    try {
      const resultado = evaluarProfundizacion(dominios, curr, alertasDet);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sesión expirada");
      const hoy = new Date().toISOString().slice(0, 10);

      const { error } = await supabase.from("profundizaciones_clinicas").insert({
        patient_id: id,
        owner_id: u.user.id,
        fecha: hoy,
        chequeo_id: chequeoId,
        dominios,
        respuestas: curr,
        dominio_principal: resultado.dominio_principal,
        nivel_deterioro: resultado.nivel,
        resumen: resultado.resumen,
      });
      if (error) throw error;

      // Ajustar IEG del chequeo del día
      if (chequeoId && chequeoIegBasal != null) {
        const iegAj = Math.max(0, Math.min(100, chequeoIegBasal + ajusteIEG(resultado.nivel)));
        const nuevoColor = colorPorIEG(iegAj);
        await supabase
          .from("chequeos_diarios")
          .update({ ieg: iegAj, color: nuevoColor })
          .eq("id", chequeoId);
      }

      setDone(resultado);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="container-app pt-12 text-muted-foreground">Cargando…</div>;

  if (dominios.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="container-app pt-6 pb-4 flex items-center gap-3">
          <Link to="/paciente/$id" params={{ id }} className="size-11 rounded-2xl bg-secondary grid place-items-center" aria-label="Atrás">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="font-display text-2xl font-semibold">Profundización clínica</h1>
        </header>
        <main className="container-app pb-12">
          <div className="rounded-3xl bg-card border border-border/60 p-6 text-center">
            <p className="text-muted-foreground">
              No se detectaron cambios que requieran profundización hoy.
            </p>
            <Button asChild size="xl" className="mt-6">
              <Link to="/paciente/$id" params={{ id }}>Volver al perfil</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container-app pt-12 pb-10 text-center">
          <div className="mx-auto size-20 rounded-full bg-secondary text-primary grid place-items-center">
            <Check className="size-10" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-semibold">Profundización guardada</h1>
          <div className="mt-6 rounded-3xl bg-card border border-border/60 p-6 text-left">
            <p className="text-sm text-muted-foreground">Dominio principal</p>
            <p className="font-display text-2xl font-semibold capitalize">{labelDominio(done.dominio_principal)}</p>
            <span className={`inline-block mt-3 px-3 py-1 rounded-full font-semibold capitalize ${colorBg[done.nivel]}`}>
              Deterioro {done.nivel}
            </span>
            <p className="mt-4 text-foreground/90 leading-relaxed">{done.resumen}</p>
          </div>
          <Button asChild size="xl" className="mt-8">
            <Link to="/paciente/$id" params={{ id }}>Volver al perfil</Link>
          </Button>
        </main>
      </div>
    );
  }

  if (!p) return null;
  const progress = Math.round(((i + 1) / total) * 100);
  const selected = respuestas[p.key];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="container-app pt-6 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (i === 0 ? navigate({ to: "/paciente/$id", params: { id } }) : setI(i - 1))}
            className="size-11 rounded-2xl bg-secondary grid place-items-center"
            aria-label="Atrás"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Profundización · {i + 1} de {total}</p>
            <p className="font-display text-base font-semibold">{labelDominio(p.dominio)}</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="container-app flex-1 pt-8 pb-8">
        <h2 className="font-display text-2xl font-semibold leading-tight">{p.pregunta}</h2>
        <div className="mt-6 space-y-3">
          {p.opciones.map((op) => (
            <button
              key={op.value}
              onClick={() => set(op.value)}
              disabled={saving}
              className={`w-full text-left rounded-2xl border-2 px-5 py-5 text-lg font-medium transition ${
                selected === op.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
