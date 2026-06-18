import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardCheck, FileDown, TrendingUp, AlertCircle, BookOpen, ListChecks, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { detectarAlertas, labelDominio, type Dominio } from "@/lib/clinical/alertas";

export const Route = createFileRoute("/_app/paciente/$id/")({
  component: PatientHub,
});

interface Patient {
  id: string; nombre: string; edad: number | null; sexo: string | null;
  barthel_total: number | null; lawton_total: number | null; cfs_nivel: number | null;
  comorbilidades: unknown; objetivos: unknown; movilidad: string | null;
}

interface Chequeo { id: string; fecha: string; ieg: number; color: string; respuestas?: Record<string, string | string[]> }
interface Profundizacion { fecha: string; dominio_principal: string | null; nivel_deterioro: string | null }

const colorBg: Record<string, string> = {
  verde: "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.1_155)]",
  amarillo: "bg-[oklch(0.93_0.08_85)] text-[oklch(0.4_0.12_70)]",
  naranja: "bg-[oklch(0.88_0.1_55)] text-[oklch(0.4_0.14_45)]",
  rojo: "bg-[oklch(0.88_0.1_25)] text-[oklch(0.4_0.18_25)]",
};

function PatientHub() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [p, setP] = useState<Patient | null>(null);
  const [chequeos, setChequeos] = useState<Chequeo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: pat } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
      setP(pat as Patient | null);
      const { data: c } = await supabase
        .from("chequeos_diarios")
        .select("id, fecha, ieg, color")
        .eq("patient_id", id)
        .order("fecha", { ascending: false })
        .limit(30);
      setChequeos((c ?? []) as Chequeo[]);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="container-app pt-12 text-muted-foreground">Cargando…</div>;
  if (!p) return <div className="container-app pt-12">Paciente no encontrado.</div>;

  const ultimo = chequeos[0];
  const hoy = new Date().toISOString().slice(0, 10);
  const yaHoy = chequeos[0]?.fecha === hoy;

  const comorb = (Array.isArray(p.comorbilidades) ? p.comorbilidades : []) as string[];
  const obj = (Array.isArray(p.objetivos) ? p.objetivos : []) as string[];

  async function eliminar() {
    if (!confirm(`¿Eliminar a ${p?.nombre}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("patients").delete().eq("id", id);
    if (error) { toast.error("No se pudo eliminar"); return; }
    toast.success("Eliminado");
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pt-6 pb-4 flex items-center gap-3">
        <Link to="/app" className="size-11 rounded-2xl bg-secondary grid place-items-center" aria-label="Atrás">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold leading-tight">{p.nombre}</h1>
          <p className="text-muted-foreground">{p.edad ?? "—"} años · {p.sexo ?? "—"}</p>
        </div>
      </header>

      <main className="container-app pb-12 space-y-5">
        {/* Estado */}
        <section className="rounded-3xl bg-card border border-border/60 p-5 shadow-[var(--shadow-card)]">
          {ultimo ? (
            <>
              <p className="text-sm text-muted-foreground">Estado al {ultimo.fecha}</p>
              <div className="flex items-baseline gap-3 mt-1">
                <p className="font-display text-5xl font-semibold">{ultimo.ieg}</p>
                <p className="text-muted-foreground">/100 IEG</p>
              </div>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-semibold ${colorBg[ultimo.color]}`}>
                {etiquetaColor(ultimo.color)}
              </span>
            </>
          ) : (
            <div className="text-muted-foreground">
              <p>Aún no hay chequeos.</p>
              <p className="mt-1 text-sm">Comienza hoy mismo el seguimiento diario.</p>
            </div>
          )}
        </section>

        {/* Acción principal */}
        <Button asChild size="xl" disabled={yaHoy} variant={yaHoy ? "outline" : "default"}>
          <Link to="/paciente/$id/chequeo" params={{ id }}>
            <ClipboardCheck /> {yaHoy ? "Chequeo de hoy completado" : "Hacer chequeo de hoy"}
          </Link>
        </Button>

        <Button asChild size="xl" variant="outline">
          <Link to="/paciente/$id/bitacoras" params={{ id }}>
            <BookOpen /> Bitácoras
          </Link>
        </Button>

        <Button asChild size="xl" variant="outline">
          <Link to="/paciente/$id/escalas" params={{ id }}>
            <ListChecks /> Escalas mensuales
          </Link>
        </Button>

        <Button asChild size="xl" variant="outline">
          <Link to="/paciente/$id/reporte" params={{ id }}>
            <FileDown /> Generar reporte para el médico
          </Link>
        </Button>

        {/* Tendencia */}
        {chequeos.length > 0 && (
          <section className="rounded-3xl bg-card border border-border/60 p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="size-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">Tendencia ({chequeos.length} días)</h2>
            </div>
            <Sparkline data={[...chequeos].reverse()} />
          </section>
        )}

        {/* Basal */}
        <section className="rounded-3xl bg-card border border-border/60 p-5">
          <h2 className="font-display text-lg font-semibold mb-3">Valoración basal</h2>
          <dl className="space-y-2 text-base">
            <Row k="Barthel" v={p.barthel_total != null ? `${p.barthel_total}/100` : "—"} />
            <Row k="Lawton" v={p.lawton_total != null ? `${p.lawton_total}/8` : "—"} />
            <Row k="Fragilidad" v={p.cfs_nivel != null ? `${p.cfs_nivel}/9` : "—"} />
            <Row k="Movilidad" v={p.movilidad ?? "—"} />
            {comorb.length > 0 && <Row k="Diagnósticos" v={comorb.join(", ")} />}
            {obj.length > 0 && <Row k="Objetivos" v={obj.join(", ")} />}
          </dl>
        </section>

        {/* Disclaimer alertas */}
        <section className="rounded-3xl border-2 border-accent/40 bg-accent/10 p-5">
          <div className="flex gap-3">
            <AlertCircle className="size-5 text-accent-foreground shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Cuándo buscar atención urgente</p>
              <ul className="mt-2 text-sm space-y-1 text-foreground/80">
                <li>• Confusión nueva o somnolencia marcada</li>
                <li>• Falta de aire o dolor torácico</li>
                <li>• Desmayo o caída con golpe</li>
                <li>• Vómitos persistentes o no tolera líquidos</li>
                <li>• Debilidad extrema</li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground italic">
                La aplicación no sustituye una valoración médica.
              </p>
            </div>
          </div>
        </section>

        <button onClick={eliminar} className="w-full text-center text-sm text-muted-foreground py-4 hover:text-destructive">
          Eliminar este paciente
        </button>
      </main>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function etiquetaColor(c: string) {
  return ({ verde: "Estable", amarillo: "Vigilancia", naranja: "Deterioro", rojo: "Alto riesgo" } as Record<string, string>)[c] ?? c;
}

const colorFill: Record<string, string> = {
  verde: "fill-[oklch(0.58_0.12_155)]",
  amarillo: "fill-[oklch(0.78_0.14_80)]",
  naranja: "fill-[oklch(0.7_0.16_55)]",
  rojo: "fill-[oklch(0.58_0.2_28)]",
};

function Sparkline({ data }: { data: Chequeo[] }) {
  const W = 320, H = 80;
  const bw = data.length > 0 ? W / data.length : 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
      {data.map((d, i) => {
        const h = (d.ieg / 100) * H;
        return (
          <rect key={d.id} x={i * bw + 2} y={H - h} width={Math.max(2, bw - 4)} height={h} rx={2} className={colorFill[d.color] ?? "fill-primary"} />
        );
      })}
    </svg>
  );
}
