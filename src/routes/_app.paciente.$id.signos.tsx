import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { evaluarSignos, type Alerta } from "@/lib/clinical/signos";

export const Route = createFileRoute("/_app/paciente/$id/signos")({
  component: Signos,
});

interface Registro {
  id: string; fecha: string;
  ta_sistolica: number | null; ta_diastolica: number | null;
  fc: number | null; temperatura: number | null; saturacion: number | null; glucosa: number | null;
}

const empty = { ta_sistolica: "", ta_diastolica: "", fc: "", temperatura: "", saturacion: "", glucosa: "" };

function Signos() {
  const { id } = Route.useParams();
  const [regs, setRegs] = useState<Registro[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(empty);
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  async function cargar() {
    const { data } = await supabase.from("signos_vitales").select("*").eq("patient_id", id).order("fecha", { ascending: false }).limit(30);
    setRegs((data ?? []) as Registro[]);
  }
  useEffect(() => { cargar(); }, [id]);

  function num(v: string): number | null { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }

  async function guardar() {
    const payload = {
      ta_sistolica: num(form.ta_sistolica), ta_diastolica: num(form.ta_diastolica),
      fc: num(form.fc), temperatura: num(form.temperatura),
      saturacion: num(form.saturacion), glucosa: num(form.glucosa),
    };
    if (Object.values(payload).every((v) => v == null)) {
      toast.error("Captura al menos un valor"); return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("signos_vitales").insert({
      owner_id: u.user.id, patient_id: id, ...payload,
    });
    if (error) { toast.error("No se pudo guardar"); return; }
    const a = evaluarSignos(payload);
    setAlertas(a);
    setForm(empty);
    setAdding(false);
    toast.success("Registrado");
    cargar();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pt-6 pb-4 flex items-center gap-3">
        <Link to="/paciente/$id/bitacoras" params={{ id }} className="size-11 rounded-2xl bg-secondary grid place-items-center" aria-label="Atrás">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold leading-tight">Signos vitales</h1>
          <p className="text-muted-foreground">Opcional · solo lo que midas</p>
        </div>
      </header>

      <main className="container-app pb-12 space-y-4">
        {alertas.length > 0 && (
          <section className="rounded-3xl border-2 border-accent/40 bg-accent/10 p-5">
            <div className="flex gap-3">
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Atención</p>
                <ul className="space-y-1 text-sm">
                  {alertas.map((a, i) => <li key={i}>• {a.texto}</li>)}
                </ul>
              </div>
            </div>
          </section>
        )}

        {adding ? (
          <section className="rounded-3xl bg-card border border-border/60 p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="TA sistólica" unit="mmHg" value={form.ta_sistolica} onChange={(v) => setForm({ ...form, ta_sistolica: v })} />
              <Field label="TA diastólica" unit="mmHg" value={form.ta_diastolica} onChange={(v) => setForm({ ...form, ta_diastolica: v })} />
              <Field label="Frecuencia Cardiaca" unit="lpm" value={form.fc} onChange={(v) => setForm({ ...form, fc: v })} />
              <Field label="Temperatura" unit="°C" value={form.temperatura} onChange={(v) => setForm({ ...form, temperatura: v })} />
              <Field label="Saturación" unit="%" value={form.saturacion} onChange={(v) => setForm({ ...form, saturacion: v })} />
              <Field label="Glucosa" unit="mg/dL" value={form.glucosa} onChange={(v) => setForm({ ...form, glucosa: v })} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={guardar} className="flex-1">Guardar</Button>
              <Button variant="outline" onClick={() => { setAdding(false); setForm(empty); }}>Cancelar</Button>
            </div>
          </section>
        ) : (
          <Button onClick={() => { setAlertas([]); setAdding(true); }} size="xl">
            <Plus /> Registrar signos
          </Button>
        )}

        {regs.length > 0 && (
          <section className="rounded-3xl bg-card border border-border/60 p-5">
            <h2 className="font-display text-lg font-semibold mb-3">Tendencia</h2>
            <div className="grid grid-cols-2 gap-3">
              <Spark label="TA sis" data={regs.map((r) => r.ta_sistolica)} />
              <Spark label="TA dia" data={regs.map((r) => r.ta_diastolica)} />
              <Spark label="FC" data={regs.map((r) => r.fc)} />
              <Spark label="Temp" data={regs.map((r) => r.temperatura)} />
              <Spark label="SatO₂" data={regs.map((r) => r.saturacion)} />
              <Spark label="Glucosa" data={regs.map((r) => r.glucosa)} />
            </div>
          </section>
        )}

        {regs.length > 0 && (
          <section className="rounded-3xl bg-card border border-border/60 p-5">
            <h2 className="font-display text-lg font-semibold mb-3">Últimos registros</h2>
            <ul className="space-y-2">
              {regs.slice(0, 10).map((r) => (
                <li key={r.id} className="border-b border-border/40 last:border-0 pb-2 text-sm">
                  <p className="text-muted-foreground">{new Date(r.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</p>
                  <p className="mt-0.5">{resumen(r)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function Field({ label, unit, value, onChange }: { label: string; unit: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label} <span className="text-muted-foreground">({unit})</span></Label>
      <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function resumen(r: Registro) {
  const parts: string[] = [];
  if (r.ta_sistolica != null || r.ta_diastolica != null) parts.push(`TA ${r.ta_sistolica ?? "—"}/${r.ta_diastolica ?? "—"}`);
  if (r.fc != null) parts.push(`FC ${r.fc}`);
  if (r.temperatura != null) parts.push(`T ${r.temperatura}°`);
  if (r.saturacion != null) parts.push(`Sat ${r.saturacion}%`);
  if (r.glucosa != null) parts.push(`Glu ${r.glucosa}`);
  return parts.join(" · ");
}

function Spark({ label, data }: { label: string; data: (number | null)[] }) {
  const vals = data.filter((v): v is number => v != null).reverse();
  if (vals.length === 0) return (
    <div className="rounded-2xl bg-secondary/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-muted-foreground">—</p>
    </div>
  );
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const W = 100, H = 30;
  const step = vals.length > 1 ? W / (vals.length - 1) : 0;
  const pts = vals.map((v, i) => `${i * step},${H - ((v - min) / range) * H}`).join(" ");
  return (
    <div className="rounded-2xl bg-secondary/50 p-3">
      <div className="flex justify-between items-baseline">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{vals[vals.length - 1]}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-8 mt-1">
        <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-primary" />
      </svg>
    </div>
  );
}
