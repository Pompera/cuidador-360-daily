import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Check, X, Trash2, Bell, BellRing, Clock } from "lucide-react";
import { medicamentosRepo, horariosRepo, tomasRepo } from "@/lib/repos/medicamentos";
import { usaModoOffline } from "@/lib/plataforma";
import { pedirPermisoLocal, permisoLocalConcedido, reprogramarRecordatorios, cancelarRecordatorios } from "@/lib/notificaciones/locales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { calcularAdherencia, type Toma } from "@/lib/clinical/medicamentos";
import { fechaHoy } from "@/lib/utils";
import { activarNotificaciones, pushSoportado } from "@/lib/push/client";

export const Route = createFileRoute("/_app/paciente/$id/medicamentos")({
  component: Medicamentos,
});

interface Med { id: string; nombre: string; dosis: string | null; frecuencia: string | null; fecha_inicio: string | null; activo: boolean }
interface Horario { id: string; medicamento_id: string; hora: string; activo: boolean }

function Medicamentos() {
  const { id } = Route.useParams();
  const [meds, setMeds] = useState<Med[]>([]);
  const [tomas, setTomas] = useState<Toma[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ nombre: "", dosis: "", frecuencia: "", fecha_inicio: "" });
  const [nuevosHorarios, setNuevosHorarios] = useState<string[]>([]);
  const [nuevaHora, setNuevaHora] = useState<Record<string, string>>({});
  const [permiso, setPermiso] = useState<NotificationPermission | "no-soportado">("default");
  const hoy = fechaHoy();

  useEffect(() => {
    if (usaModoOffline()) {
      permisoLocalConcedido().then((ok) => setPermiso(ok ? "granted" : "default"));
      return;
    }
    setPermiso(pushSoportado() ? Notification.permission : "no-soportado");
  }, []);

  async function cargar() {
    const m = await medicamentosRepo.activos(id);
    setMeds(m as unknown as Med[]);
    setTomas((await tomasRepo.recientes(id, 30)) as unknown as Toma[]);
    const h = await horariosRepo.porPaciente(id);
    setHorarios(h as unknown as Horario[]);
    setLoading(false);
    // En el APK los recordatorios los dispara el propio teléfono.
    void reprogramarRecordatorios(m, h);
  }

  useEffect(() => { cargar(); }, [id]);

  async function activarPush() {
    if (usaModoOffline()) {
      const ok = await pedirPermisoLocal();
      setPermiso(ok ? "granted" : "default");
      if (ok) { toast.success("Recordatorios activados en este dispositivo"); cargar(); }
      else toast.error("Debes permitir las notificaciones");
      return;
    }
    const r = await activarNotificaciones(true);
    setPermiso(pushSoportado() ? Notification.permission : "no-soportado");
    if (r === "ok") toast.success("Recordatorios activados en este dispositivo");
    else if (r === "sin-permiso") toast.error("Debes permitir las notificaciones en el navegador");
    else if (r === "no-soportado") toast.error("Este navegador no admite notificaciones");
    else toast.error("No se pudieron activar los recordatorios");
  }

  async function agregar() {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    let creado: { id: string };
    try {
      creado = await medicamentosRepo.crear({
        patient_id: id, nombre: form.nombre.trim(),
        dosis: form.dosis.trim() || null, frecuencia: form.frecuencia.trim() || null,
        fecha_inicio: form.fecha_inicio || null, activo: true,
      });
    } catch { toast.error("No se pudo guardar"); return; }

    for (const hora of nuevosHorarios.filter(Boolean)) {
      await horariosRepo.crear({ patient_id: id, medicamento_id: creado.id, hora, activo: true });
    }
    setForm({ nombre: "", dosis: "", frecuencia: "", fecha_inicio: "" });
    setNuevosHorarios([]);
    setAdding(false);
    toast.success("Medicamento agregado");
    cargar();
  }

  async function agregarHorario(medId: string) {
    const hora = nuevaHora[medId];
    if (!hora) { toast.error("Elige una hora"); return; }
    try {
      await horariosRepo.crear({ patient_id: id, medicamento_id: medId, hora, activo: true });
    } catch { toast.error("No se pudo guardar el horario"); return; }
    setNuevaHora({ ...nuevaHora, [medId]: "" });
    toast.success("Horario agregado");
    cargar();
  }

  async function alternarHorario(h: Horario) {
    await horariosRepo.actualizar(h.id, { activo: !h.activo });
    cargar();
  }

  async function borrarHorario(hId: string) {
    const h = horarios.find((x) => x.id === hId);
    if (h) await cancelarRecordatorios([h as never]);
    await horariosRepo.eliminar(hId);
    cargar();
  }

  async function registrar(medId: string, estado: "tomado" | "omitido") {
    try {
      await tomasRepo.registrar({ patient_id: id, medicamento_id: medId, fecha: hoy, estado });
    } catch { toast.error("No se pudo registrar"); return; }
    toast.success(estado === "tomado" ? "Marcado como tomado" : "Marcado como omitido");
    cargar();
  }

  async function suspender(medId: string) {
    if (!confirm("¿Suspender este medicamento?")) return;
    await medicamentosRepo.suspender(medId);
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
        <section className="rounded-3xl bg-card border border-border/60 p-5">
          <div className="flex items-start gap-3">
            <div className="size-11 rounded-2xl bg-secondary grid place-items-center shrink-0">
              {permiso === "granted" ? <BellRing className="size-5 text-primary" /> : <Bell className="size-5" />}
            </div>
            <div className="flex-1">
              <p className="font-semibold">Recordatorios</p>
              <p className="text-sm text-muted-foreground">
                {permiso === "granted"
                  ? "Activados en este dispositivo. Recibirás un aviso en cada horario configurado."
                  : permiso === "no-soportado"
                    ? "Este navegador no admite notificaciones."
                    : "Activa las notificaciones para recibir avisos a la hora de cada medicamento."}
              </p>
              {permiso !== "granted" && permiso !== "no-soportado" && (
                <Button onClick={activarPush} variant="outline" className="mt-3">
                  <Bell /> Activar notificaciones
                </Button>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                En iPhone y iPad los avisos solo funcionan si agregas la app a la pantalla de inicio
                (Compartir → Agregar a inicio).
              </p>
            </div>
          </div>
        </section>

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
            const hs = horarios.filter((h) => h.medicamento_id === m.id);
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

                <div className="mt-4 rounded-2xl bg-secondary/50 p-3">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Clock className="size-3.5" /> Horarios de recordatorio
                  </p>
                  {hs.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">Sin horarios configurados.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {hs.map((h) => (
                        <li key={h.id} className="flex items-center gap-2">
                          <button
                            onClick={() => alternarHorario(h)}
                            className={`h-9 min-w-20 rounded-xl px-3 text-sm font-semibold ${h.activo ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground border border-border"}`}
                          >
                            {h.hora}
                          </button>
                          <span className="text-xs text-muted-foreground flex-1">
                            {h.activo ? "Activo" : "Pausado"}
                          </span>
                          <button
                            onClick={() => borrarHorario(h.id)}
                            className="size-9 rounded-xl text-muted-foreground hover:text-destructive grid place-items-center"
                            aria-label="Eliminar horario"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex gap-2">
                    <Input
                      type="time"
                      value={nuevaHora[m.id] ?? ""}
                      onChange={(e) => setNuevaHora({ ...nuevaHora, [m.id]: e.target.value })}
                      className="flex-1"
                      aria-label="Nueva hora"
                    />
                    <Button variant="outline" onClick={() => agregarHorario(m.id)}>
                      <Plus /> Añadir
                    </Button>
                  </div>
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
            <div>
              <Label>Horarios de recordatorio (opcional)</Label>
              <div className="space-y-2 mt-1">
                {nuevosHorarios.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      type="time"
                      value={h}
                      onChange={(e) => setNuevosHorarios(nuevosHorarios.map((x, j) => (j === i ? e.target.value : x)))}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => setNuevosHorarios(nuevosHorarios.filter((_, j) => j !== i))}
                      aria-label="Quitar horario"
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setNuevosHorarios([...nuevosHorarios, ""])}>
                  <Plus /> Añadir horario
                </Button>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={agregar} className="flex-1">Guardar</Button>
              <Button variant="outline" onClick={() => { setAdding(false); setNuevosHorarios([]); }}>Cancelar</Button>
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
