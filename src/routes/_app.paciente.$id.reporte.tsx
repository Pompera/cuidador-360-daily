import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  generarReportePDF,
  type ReporteChequeo,
  type ReportePaciente,
  type ReporteExtras,
} from "@/lib/pdf";
import type { Toma } from "@/lib/clinical/medicamentos";

export const Route = createFileRoute("/_app/paciente/$id/reporte")({
  component: ReportePage,
});

function ReportePage() {
  const { id } = Route.useParams();
  const [p, setP] = useState<ReportePaciente | null>(null);
  const [chequeos, setChequeos] = useState<ReporteChequeo[]>([]);
  const [extras, setExtras] = useState<ReporteExtras>({
    medicamentos: [], tomas: [], signos: [], caidas: [], evaluaciones: [], profundizaciones: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: pat } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
      if (pat) {
        setP({
          nombre: pat.nombre,
          edad: pat.edad,
          sexo: pat.sexo,
          comorbilidades: (Array.isArray(pat.comorbilidades) ? pat.comorbilidades : []) as string[],
          barthel_total: pat.barthel_total,
          lawton_total: pat.lawton_total,
          cfs_nivel: pat.cfs_nivel,
          movilidad: pat.movilidad,
          objetivos: (Array.isArray(pat.objetivos) ? pat.objetivos : []) as string[],
          jenkins_basal: (pat as any).jenkins_basal ?? null,
          zarit_basal: (pat as any).zarit_basal ?? null,
        });
      }
      const { data: c } = await supabase
        .from("chequeos_diarios")
        .select("fecha, ieg, color, respuestas")
        .eq("patient_id", id)
        .order("fecha", { ascending: false })
        .limit(60);
      setChequeos(((c ?? []) as any).map((r: any) => ({
        fecha: r.fecha, ieg: r.ieg, color: r.color, respuestas: r.respuestas ?? {},
      })));

      const [{ data: meds }, { data: tomas }, { data: signos }, { data: caidas }, { data: evals }, { data: profs }] = await Promise.all([
        supabase.from("medicamentos").select("id, nombre, dosis, frecuencia, fecha_inicio").eq("patient_id", id).eq("activo", true).order("created_at"),
        supabase.from("medicamento_tomas").select("medicamento_id, fecha, estado").eq("patient_id", id),
        supabase.from("signos_vitales").select("fecha, ta_sistolica, ta_diastolica, fc, temperatura, saturacion, glucosa").eq("patient_id", id).order("fecha", { ascending: false }).limit(30),
        supabase.from("caidas").select("fecha, lugar, circunstancia, lesion, golpe_craneal, hospitalizacion").eq("patient_id", id).order("fecha", { ascending: false }),
        supabase.from("evaluaciones_escala").select("tipo, fecha, puntaje").eq("patient_id", id).order("fecha", { ascending: false }),
        supabase.from("profundizaciones_clinicas").select("fecha, dominio_principal, nivel_deterioro, resumen").eq("patient_id", id).order("fecha", { ascending: false }).limit(20),
      ]);

      setExtras({
        medicamentos: (meds ?? []) as any,
        tomas: (tomas ?? []) as Toma[],
        signos: (signos ?? []) as any,
        caidas: (caidas ?? []) as any,
        evaluaciones: (evals ?? []) as any,
        profundizaciones: (profs ?? []) as any,
      });

      setLoading(false);
    })();
  }, [id]);

  function descargar() {
    if (!p) return;
    try {
      const doc = generarReportePDF(p, chequeos, extras);
      const nombre = p.nombre.replace(/\s+/g, "_");
      doc.save(`Cuidador360_${nombre}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF descargado");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo generar el PDF");
    }
  }


  if (loading) return <div className="container-app pt-12 text-muted-foreground">Preparando…</div>;
  if (!p) return <div className="container-app pt-12">Paciente no encontrado.</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pt-6 pb-4 flex items-center gap-3">
        <Link to="/paciente/$id" params={{ id }} className="size-11 rounded-2xl bg-secondary grid place-items-center" aria-label="Atrás">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-2xl font-semibold">Reporte para el médico</h1>
      </header>

      <main className="container-app pb-12 space-y-5">
        <section className="rounded-3xl bg-card border border-border/60 p-5">
          <p className="text-muted-foreground">Paciente</p>
          <p className="font-display text-xl font-semibold">{p.nombre}</p>
          <p className="text-muted-foreground mt-1">{p.edad ?? "—"} años · {p.sexo ?? "—"}</p>
        </section>

        <section className="rounded-3xl bg-card border border-border/60 p-5">
          <p className="font-semibold mb-2">El PDF incluye:</p>
          <ul className="space-y-1.5 text-foreground/85">
            <li>• Encabezado con datos del paciente y diagnósticos</li>
            <li>• IEG actual y color de riesgo</li>
            <li>• Valoración basal (Barthel, Lawton, CFS)</li>
            <li>• Tendencia visual de los últimos {Math.min(chequeos.length, 14)} días</li>
            <li>• Resumen clínico automático</li>
            <li>• Recordatorio: la app no sustituye valoración médica</li>
          </ul>
        </section>

        <Button size="xl" onClick={descargar}>
          <FileDown /> Descargar PDF
        </Button>

        {chequeos.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Aún sin chequeos diarios. El reporte tendrá solo la valoración basal.
          </p>
        )}
      </main>
    </div>
  );
}
