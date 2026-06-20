import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Check, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { calcularAdherencia, type Toma } from "@/lib/clinical/medicamentos";
import { fechaHoy } from "@/lib/utils";

export const Route = createFileRoute("/_app/paciente/$id/medicamentos")({
  component: Medicamentos,
});

interface Med { id: string; nombre: string; dosis: string | null; frecuencia: string | null; fecha_inicio: string | null; activo: boolean }

function Medicamentos() {
  const { id } = Route.useParams();
  const [meds, setMeds] = useState<Med[]>([]);
  const [tomas, setTomas] = useState<Toma[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ nombre: "", dosis: "", frecuencia: "", fecha_inicio: "" });
  const hoy = fechaHoy();

  async function cargar() {
    const { data: m } = await supabase.from("medicamentos").select("*").eq("patient_id", id).eq("activo", true).order("created_at");
    setMeds((m ?? []) as Med[]);
    const desde = new Date(); desde.setDate(desde.getDate() - 30);
    const { data: t } = await supabase.from("medicamento_tomas").select("medicamento_id, fecha, estado").eq("patient_id", id).gte("fecha", desde.toISOString().slice(0, 10));
    setTomas((t ?? []) as Toma[]);
    setLoading(false);
  }

  useEffect(() => { cargar(); }, [id]);

  async function agregar() {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("medicamentos").insert({
      owner_id: u.user.id, patient_id: id, nombre: form.nombre.trim(),
      dosis: form.dosis.trim() || null, frecuencia: form.frecuencia.trim() || null,
      fecha_inicio: form.fecha_inicio || null,
    });
    if (error) { toast.error("No se pudo guardar"); return; }
    setForm({ nombre: "", dosis: "", frecuencia: "", fecha_inicio: "" });
    setAdding(false);
    toast.success("Medicamento agregado");
    cargar();
  }

  async function registrar(medId: string, estado: "tomado" | "omitido") {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("medicamento_tomas").upsert(
      { owner_id: u.user.id, patient_id: id, medicamento_id: medId, fecha: hoy, estado },
      { onConflict: "medicamento_id,fecha" },
    );
    if (error) { toast.error("No se pudo registrar"); return; }
    toast.success(estado === "tomado" ? "Marcado como tomado" : "Marcado como omitido");
    cargar();
  }

  async function suspender(medId: string) {
    if (!confirm("¿Suspender este medicamento?")) return;
    await supabase.from("medicamentos").update({ activo: false }).eq("id", medId);
    cargar();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pt-6 pb-4 flex items-center gap-3">
        <Link to="/paciente/$id/bitacoras" params={{ id }} className="size-11 rounded-2xl bg-secondary grid place-items-center" aria-label="Atrás">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold leading-tight">Medicamentos</h1>
          <p className="text-muted-foreground">Adherencia diaria</p>
        </div>
      </header>

      <main className="container-app pb-12 space-y-4">
        {loading ? (
          <p className="text-muted-foreground">Cargando…</p>
        ) : meds.length === 0 && !adding ? (
          <div className="rounded-3xl bg-card border border-border/60 p-6 text-center">
            <p className="text-muted-foreground">Aún no hay medicamentos.</p>
          </div>
        ) : (
          meds.map((m) => {
            const tomasMed = tomas.filter((t) => t.medicamento_id === m.id);
            const adh = calcularAdherencia(tomasMed, 7);
            const hoyToma = tomasMed.find((t) => t.fecha === hoy);
            return (
              <section key={m.id} className="rounded-3xl bg-card border border-border/60 p-5 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-display text-lg font-semibold">{m.nombre}</p>
                    <p className="text-sm text-muted-foreground">
                      {[m.dosis, m.frecuencia].filter(Boolean).join(" · ") || "Sin detalles"}
                    </p>
                  </div>
                  <button onClick={() => suspender(m.id)} className="size-9 rounded-xl text-muted-foreground hover:text-destructive grid place-items-center" aria-label="Suspender">
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => registrar(m.id, "tomado")}
                    variant={hoyToma?.estado === "tomado" ? "default" : "outline"}
                    size="lg"
                  >
                    <Check /> Tomado
                  </Button>
                  <Button
                    onClick={() => registrar(m.id, "omitido")}
                    variant={hoyToma?.estado === "omitido" ? "default" : "outline"}
                    size="lg"
                  >
                    <X /> Omitido
                  </Button>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Adherencia 7 días</span>
                    <span>{adh.tomados}/{adh.total} · {adh.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${adh.pct}%` }} />
                  </div>
                </div>
              </section>
            );
          })
        )}

        {adding ? (
          <section className="rounded-3xl bg-card border border-border/60 p-5 space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Losartán" />
            </div>
            <div>
              <Label>Dosis</Label>
              <Input value={form.dosis} onChange={(e) => setForm({ ...form, dosis: e.target.value })} placeholder="Ej. 50 mg" />
            </div>
            <div>
              <Label>Frecuencia</Label>
              <Input value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })} placeholder="Ej. cada 12 h" />
            </div>
            <div>
              <Label>Fecha de inicio (opcional)</Label>
              <Input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={agregar} className="flex-1">Guardar</Button>
              <Button variant="outline" onClick={() => setAdding(false)}>Cancelar</Button>
            </div>
          </section>
        ) : (
          <Button onClick={() => setAdding(true)} size="xl" variant="outline">
            <Plus /> Agregar medicamento
          </Button>
        )}
      </main>
    </div>
  );
}
