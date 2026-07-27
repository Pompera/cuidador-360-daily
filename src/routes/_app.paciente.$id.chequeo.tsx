import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { chequeosRepo } from "@/lib/repos/chequeos";
import { usuarioActual } from "@/lib/auth/sesion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PREGUNTAS, calcularIEG, COLOR_BG } from "@/lib/clinical/chequeo";
import { detectarAlertas } from "@/lib/clinical/alertas";
import { fechaHoy } from "@/lib/utils";

export const Route = createFileRoute("/_app/paciente/$id/chequeo")({
  component: ChequeoDiario,
});


function ChequeoDiario() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, string | string[]>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<null | ReturnType<typeof calcularIEG>>(null);
  const [dominiosAlerta, setDominiosAlerta] = useState<string[]>([]);

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
      const usuario = await usuarioActual();
      if (!usuario) throw new Error("Sesión expirada");
      const hoy = fechaHoy();
      await chequeosRepo.guardarDelDia({
        patient_id: id,
        owner_id: usuario.id,
        fecha: hoy,
        respuestas: currentResp,
        ieg: resultado.ieg,
        color: resultado.color,
      });
      // Detectar alertas con el chequeo de hoy + los previos
      const previos = (await chequeosRepo.historial(id, 7)).filter((c) => c.fecha !== hoy).slice(0, 6);
      const hist = [
        { fecha: hoy, respuestas: currentResp as Record<string, string | string[]> },
        ...previos.map((c) => ({ fecha: c.fecha, respuestas: (c.respuestas ?? {}) as Record<string, string | string[]> })),
      ];
      const det = detectarAlertas(hist);
      setDominiosAlerta(det.dominios);
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
            <span className={`inline-block mt-3 px-3 py-1 rounded-full font-semibold ${COLOR_BG[done.color]}`}>
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
          {dominiosAlerta.length > 0 && (
            <div className="mt-5 rounded-3xl border-2 border-primary/40 bg-primary/5 p-5 text-left">
              <p className="font-semibold mb-1">Se detectaron cambios</p>
              <p className="text-sm text-muted-foreground mb-3">
                Te recomendamos responder unas preguntas rápidas para entender mejor lo que está pasando.
              </p>
              <Button asChild size="xl" className="w-full">
                <Link
                  to="/paciente/$id/profundizacion"
                  params={{ id }}
                  search={{ dominios: dominiosAlerta.join(",") }}
                >
                  Profundizar evaluación
                </Link>
              </Button>
            </div>
          )}
          <Button asChild size="xl" variant={dominiosAlerta.length > 0 ? "outline" : "default"} className="mt-5">
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
