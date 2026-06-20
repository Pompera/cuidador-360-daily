import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { fechaHoy } from "@/lib/utils";

export const Route = createFileRoute("/_app/paciente/$id/caidas")({
  component: Caidas,
});

interface Caida {
  id: string; fecha: string; lugar: string | null; circunstancia: string | null;
  lesion: string | null; golpe_craneal: boolean; hospitalizacion: boolean;
}

const empty = { fecha: fechaHoy(), lugar: "", circunstancia: "", lesion: "", golpe_craneal: false, hospitalizacion: false };

function Caidas() {
  const { id } = Route.useParams();
  const [items, setItems] = useState<Caida[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(empty);

  async function cargar() {
    const { data } = await supabase.from("caidas").select("*").eq("patient_id", id).order("fecha", { ascending: false });
    setItems((data ?? []) as Caida[]);
  }
  useEffect(() => { cargar(); }, [id]);

  async function guardar() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("caidas").insert({
      owner_id: u.user.id, patient_id: id,
      fecha: form.fecha, lugar: form.lugar.trim() || null,
      circunstancia: form.circunstancia.trim() || null, lesion: form.lesion.trim() || null,
      golpe_craneal: form.golpe_craneal, hospitalizacion: form.hospitalizacion,
    });
    if (error) { toast.error("No se pudo guardar"); return; }
    setForm(empty); setAdding(false);
    toast.success("Caída registrada");
    cargar();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pt-6 pb-4 flex items-center gap-3">
        <Link to="/paciente/$id/bitacoras" params={{ id }} className="size-11 rounded-2xl bg-secondary grid place-items-center" aria-label="Atrás">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold leading-tight">Caídas</h1>
          <p className="text-muted-foreground">{items.length} registro{items.length === 1 ? "" : "s"}</p>
        </div>
      </header>

      <main className="container-app pb-12 space-y-4">
        {adding ? (
          <section className="rounded-3xl bg-card border border-border/60 p-5 space-y-3">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div>
              <Label>Lugar</Label>
              <Input value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} placeholder="Ej. baño, escaleras" />
            </div>
            <div>
              <Label>Circunstancia</Label>
              <Textarea value={form.circunstancia} onChange={(e) => setForm({ ...form, circunstancia: e.target.value })} placeholder="¿Qué pasó? ¿Estaba haciendo algo?" rows={2} />
            </div>
            <div>
              <Label>Lesión</Label>
              <Input value={form.lesion} onChange={(e) => setForm({ ...form, lesion: e.target.value })} placeholder="Ej. moretón, fractura, ninguna" />
            </div>
            <Toggle label="Golpe en la cabeza" value={form.golpe_craneal} onChange={(v) => setForm({ ...form, golpe_craneal: v })} />
            <Toggle label="Requirió hospitalización" value={form.hospitalizacion} onChange={(v) => setForm({ ...form, hospitalizacion: v })} />
            <div className="flex gap-2 pt-1">
              <Button onClick={guardar} className="flex-1">Guardar</Button>
              <Button variant="outline" onClick={() => { setAdding(false); setForm(empty); }}>Cancelar</Button>
            </div>
          </section>
        ) : (
          <Button onClick={() => setAdding(true)} size="xl">
            <Plus /> Registrar caída
          </Button>
        )}

        {items.length === 0 && !adding ? (
          <div className="rounded-3xl bg-card border border-border/60 p-6 text-center">
            <p className="text-muted-foreground">Sin caídas registradas.</p>
          </div>
        ) : (
          items.map((c) => (
            <article key={c.id} className="rounded-3xl bg-card border border-border/60 p-5">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="font-display text-base font-semibold">{new Date(c.fecha).toLocaleDateString("es-MX", { dateStyle: "long" })}</p>
                  {c.lugar && <p className="text-sm text-muted-foreground mt-0.5">{c.lugar}</p>}
                </div>
                {(c.golpe_craneal || c.hospitalizacion) && (
                  <TriangleAlert className="size-5 text-[oklch(0.58_0.2_28)]" />
                )}
              </div>
              {c.circunstancia && <p className="mt-2 text-sm">{c.circunstancia}</p>}
              {c.lesion && <p className="mt-1 text-sm"><span className="text-muted-foreground">Lesión:</span> {c.lesion}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                {c.golpe_craneal && <Badge>Golpe craneal</Badge>}
                {c.hospitalizacion && <Badge>Hospitalización</Badge>}
              </div>
            </article>
          ))
        )}
      </main>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/50 px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-2">
        <button onClick={() => onChange(false)} className={`px-3 py-1 rounded-lg text-sm font-medium ${!value ? "bg-card border border-border" : "text-muted-foreground"}`}>No</button>
        <button onClick={() => onChange(true)} className={`px-3 py-1 rounded-lg text-sm font-medium ${value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Sí</button>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[oklch(0.88_0.1_25)] text-[oklch(0.4_0.18_25)]">{children}</span>;
}
