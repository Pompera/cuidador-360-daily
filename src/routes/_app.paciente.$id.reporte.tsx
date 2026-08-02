import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, FileDown } from "lucide-react";
import { pacientesRepo } from "@/lib/repos/pacientes";
import { chequeosRepo } from "@/lib/repos/chequeos";
import { medicamentosRepo, tomasRepo } from "@/lib/repos/medicamentos";
import { signosRepo } from "@/lib/repos/signos";
import { caidasRepo } from "@/lib/repos/caidas";
import { escalasRepo } from "@/lib/repos/escalas";
import { profundizacionesRepo } from "@/lib/repos/profundizaciones";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  generarReportePDF,
  type ReporteChequeo,
  type ReportePaciente,
  type ReporteExtras,
  type PeriodoReporte,
  type ReporteMeta,
} from "@/lib/pdf";
import type { Toma } from "@/lib/clinical/medicamentos";
import { fechaHoy } from "@/lib/utils";
import { logoUrl } from "@/lib/logo";

async function cargarLogoDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result as string);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

export const Route = createFileRoute("/_app/paciente/$id/reporte")({
  component: ReportePage,
});

function rangoMes(anio: number, mes: number) {
  const ini = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const finMes = mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, "0")}-01`;
  return { ini, finMes };
}

function mesesEntre(desde: string, hasta: string): string[] {
  const d = new Date(desde.slice(0, 10) + "T00:00:00");
  const h = new Date(hasta.slice(0, 10) + "T00:00:00");
  const out: string[] = [];
  let y = h.getFullYear(), m = h.getMonth() + 1;
  const yMin = d.getFullYear(), mMin = d.getMonth() + 1;
  while (y > yMin || (y === yMin && m >= mMin)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

function ReportePage() {
  const { id } = Route.useParams();
  const [p, setP] = useState<ReportePaciente | null>(null);
  const [chequeos, setChequeos] = useState<ReporteChequeo[]>([]);
  const [extras, setExtras] = useState<ReporteExtras>({
    medicamentos: [], tomas: [], signos: [], caidas: [], evaluaciones: [], profundizaciones: [],
  });
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<PeriodoReporte>({ tipo: "global" });
  const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([]);
  const [basal, setBasal] = useState<ReporteChequeo | null>(null);

  // Carga inicial: paciente + basal + rango de meses
  useEffect(() => {
    (async () => {
      const pat = (await pacientesRepo.obtener(id)) as Record<string, any> | null;
      if (pat) {
        setP({
          nombre: pat.nombre,
          edad: pat.edad ?? null,
          sexo: pat.sexo ?? null,
          comorbilidades: (Array.isArray(pat.comorbilidades) ? pat.comorbilidades : []) as string[],
          barthel_total: pat.barthel_total ?? null,
          lawton_total: pat.lawton_total ?? null,
          cfs_nivel: pat.cfs_nivel ?? null,
          movilidad: pat.movilidad ?? null,
          objetivos: (Array.isArray(pat.objetivos) ? pat.objetivos : []) as string[],
          jenkins_basal: pat.jenkins_basal ?? null,
          zarit_basal: pat.zarit_basal ?? null,
        });
      }

      const todos = (await chequeosRepo.historial(id, 1000)) as any[];
      const orden = [...todos].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
      const primero = orden.find((r) => r.ieg != null);
      const basalRow: ReporteChequeo | null = primero
        ? { fecha: primero.fecha, ieg: primero.ieg as number, color: primero.color as any, respuestas: (primero.respuestas ?? {}) as any }
        : null;
      setBasal(basalRow);

      const ultimo = orden[orden.length - 1];
      if (basalRow && ultimo) setMesesDisponibles(mesesEntre(basalRow.fecha, ultimo.fecha));
    })();
  }, [id]);

  // Carga filtrada por periodo
  useEffect(() => {
    (async () => {
      setLoading(true);
      const filtro = periodo.tipo === "mes" ? rangoMes(periodo.anio, periodo.mes) : null;
      const enPeriodo = (fecha: unknown) => {
        if (!filtro) return true;
        const f = String(fecha ?? "").slice(0, 10);
        return f >= filtro.ini && f < filtro.finMes;
      };
      const desc = (a: any, b: any) => String(b.fecha).localeCompare(String(a.fecha));

      const [c, meds, tomas, signos, caidas, evals, profs] = await Promise.all([
        chequeosRepo.historial(id, 1000),
        medicamentosRepo.activos(id),
        tomasRepo.listar({ filtros: { patient_id: id } }),
        signosRepo.recientes(id, 1000),
        caidasRepo.porPaciente(id),
        escalasRepo.porPaciente(id),
        profundizacionesRepo.listar({
          filtros: { patient_id: id },
          ordenar: { campo: "fecha", ascendente: false },
        }),
      ]);

      setChequeos(
        (c as any[])
          .filter((r) => enPeriodo(r.fecha))
          .sort(desc)
          .map((r) => ({ fecha: r.fecha, ieg: r.ieg, color: r.color, respuestas: r.respuestas ?? {} })),
      );
      setExtras({
        medicamentos: meds as any,
        tomas: (tomas as any[]).filter((t) => enPeriodo(t.fecha)) as Toma[],
        signos: (signos as any[]).filter((s) => enPeriodo(s.fecha)).sort(desc) as any,
        caidas: (caidas as any[]).filter((r) => enPeriodo(r.fecha)).sort(desc) as any,
        evaluaciones: (evals as any[]).filter((r) => enPeriodo(r.fecha)).sort(desc) as any,
        profundizaciones: (profs as any[]).filter((r) => enPeriodo(r.fecha)).sort(desc) as any,
      });

      setLoading(false);
    })();
  }, [id, periodo]);

  function periodoLabel(per: PeriodoReporte) {
    return per.tipo === "global"
      ? "Global (desde el origen)"
      : new Date(per.anio, per.mes - 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  }

  async function descargar() {
    if (!p) return;
    try {
      const logoDataUrl = await cargarLogoDataUrl(logoUrl());
      const meta: ReporteMeta = { periodo, periodoLabel: periodoLabel(periodo), basal, logoDataUrl };
      const doc = generarReportePDF(p, chequeos, extras, meta);
      const nombre = p.nombre.replace(/\s+/g, "_");
      const sufijo = periodo.tipo === "global" ? "global" : `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}`;
      doc.save(`Cuidador360_${nombre}_${sufijo}_${fechaHoy()}.pdf`);
      toast.success("PDF descargado");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo generar el PDF");
    }
  }

  if (loading && !p) return <div className="container-app pt-12 text-muted-foreground">Preparando…</div>;
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

        <section className="rounded-3xl bg-card border border-border/60 p-5 space-y-2">
          <label className="text-sm font-medium">Periodo del reporte</label>
          <select
            className="w-full h-11 rounded-xl border border-border bg-background px-3"
            value={periodo.tipo === "global" ? "global" : `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}`}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "global") setPeriodo({ tipo: "global" });
              else {
                const [a, m] = v.split("-").map(Number);
                setPeriodo({ tipo: "mes", anio: a, mes: m });
              }
            }}
          >
            <option value="global">Global (desde el origen)</option>
            {mesesDisponibles.map((ym) => {
              const [a, m] = ym.split("-").map(Number);
              const label = new Date(a, m - 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
              return <option key={ym} value={ym}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>;
            })}
          </select>
          {basal && (
            <p className="text-xs text-muted-foreground">
              IEG basal: {basal.ieg}/100 — {basal.fecha}
            </p>
          )}
        </section>

        <section className="rounded-3xl bg-card border border-border/60 p-5">
          <p className="font-semibold mb-2">El PDF incluye:</p>
          <ul className="space-y-1.5 text-foreground/85">
            <li>• Encabezado con datos del paciente y periodo</li>
            <li>• IEG actual, basal y cambio acumulado</li>
            <li>• Valoración basal (Barthel, Lawton, CFS)</li>
            <li>• Tendencia visual del periodo seleccionado</li>
            <li>• Medicamentos, signos vitales, caídas y escalas</li>
            <li>• Recordatorio: la app no sustituye valoración médica</li>
          </ul>
        </section>

        <Button size="xl" onClick={descargar} disabled={loading}>
          <FileDown /> Descargar PDF
        </Button>

        {chequeos.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No hay chequeos en el periodo seleccionado.
          </p>
        )}
      </main>
    </div>
  );
}
