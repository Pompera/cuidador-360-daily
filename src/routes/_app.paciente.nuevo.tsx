import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BARTHEL_ITEMS, interpretBarthel } from "@/lib/clinical/barthel";
import { LAWTON_ITEMS, interpretLawton } from "@/lib/clinical/lawton";
import { CFS_LEVELS } from "@/lib/clinical/cfs";
import { JENKINS_ITEMS, JENKINS_OPTIONS, interpretJenkins } from "@/lib/clinical/jenkins";
import { ZARIT_ITEMS, ZARIT_OPTIONS, interpretZarit } from "@/lib/clinical/zarit";
import { COMORBILIDADES, OBJETIVOS, MOVILIDAD, TIPO_CUIDADOR, SEXO } from "@/lib/clinical/constants";

export const Route = createFileRoute("/_app/paciente/nuevo")({
  component: NuevoPaciente,
});

type Step =
  | "datos" | "apoyo" | "zarit" | "comorb" | "movilidad" | "cognicion"
  | "sueno" | "jenkins" | "objetivos" | "barthel" | "lawton" | "cfs" | "listo";

const STEPS: { key: Step; label: string }[] = [
  { key: "datos", label: "Datos generales" },
  { key: "apoyo", label: "Red de apoyo" },
  { key: "zarit", label: "Sobrecarga del cuidador" },
  { key: "comorb", label: "Comorbilidades" },
  { key: "movilidad", label: "Movilidad" },
  { key: "cognicion", label: "Cognición basal" },
  { key: "sueno", label: "Calidad del sueño" },
  { key: "jenkins", label: "Escala de sueño Jenkins (basal)" },
  { key: "objetivos", label: "Objetivos" },
  { key: "barthel", label: "Barthel" },
  { key: "lawton", label: "Lawton y Brody" },
  { key: "cfs", label: "Fragilidad (CFS)" },
];

function NuevoPaciente() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("datos");
  const idx = STEPS.findIndex((s) => s.key === step);
  const [saving, setSaving] = useState(false);

  // Estado
  const [nombre, setNombre] = useState("");
  const [edad, setEdad] = useState("");
  const [sexo, setSexo] = useState("");
  const [escolaridad, setEscolaridad] = useState("");
  const [peso, setPeso] = useState("");
  const [talla, setTalla] = useState("");

  const [viveSolo, setViveSolo] = useState<boolean | null>(null);
  const [tipoCuidador, setTipoCuidador] = useState("");
  const [horas, setHoras] = useState("");

  const [comorb, setComorb] = useState<string[]>([]);

  const [movilidad, setMovilidad] = useState("");
  const [caidas, setCaidas] = useState<boolean | null>(null);
  const [miedoCaer, setMiedoCaer] = useState<boolean | null>(null);

  const [reconoce, setReconoce] = useState<boolean | null>(null);
  const [orienta, setOrienta] = useState<boolean | null>(null);
  const [coherente, setCoherente] = useState<boolean | null>(null);

  const [sHoras, setSHoras] = useState("");
  const [sDesp, setSDesp] = useState("");
  const [sHipn, setSHipn] = useState<boolean | null>(null);

  const [objetivos, setObjetivos] = useState<string[]>([]);

  const [barthel, setBarthel] = useState<Record<string, number>>({});
  const [lawton, setLawton] = useState<Record<string, number>>({});
  const [cfs, setCfs] = useState<number | null>(null);
  const [jenkins, setJenkins] = useState<Record<string, number>>({});
  const [zarit, setZarit] = useState<Record<string, number>>({});

  const barthelTotal = Object.values(barthel).reduce((s, v) => s + v, 0);
  const lawtonTotal = Object.values(lawton).reduce((s, v) => s + v, 0);
  const barthelDone = Object.keys(barthel).length === BARTHEL_ITEMS.length;
  const lawtonDone = Object.keys(lawton).length === LAWTON_ITEMS.length;
  const jenkinsTotal = Object.values(jenkins).reduce((s, v) => s + v, 0);
  const zaritTotal = Object.values(zarit).reduce((s, v) => s + v, 0);
  const jenkinsDone = Object.keys(jenkins).length === JENKINS_ITEMS.length;
  const zaritDone = Object.keys(zarit).length === ZARIT_ITEMS.length;

  function next() {
    const nextStep = STEPS[idx + 1];
    if (nextStep) setStep(nextStep.key);
    else setStep("listo");
  }
  function back() {
    if (idx > 0) setStep(STEPS[idx - 1].key);
    else navigate({ to: "/app" });
  }

  async function guardar() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sesión expirada");
      const { data, error } = await supabase.from("patients").insert({
        owner_id: u.user.id,
        nombre,
        edad: edad ? Number(edad) : null,
        sexo: sexo || null,
        escolaridad: escolaridad || null,
        peso: peso ? Number(peso) : null,
        talla: talla ? Number(talla) : null,
        vive_solo: viveSolo,
        tipo_cuidador: tipoCuidador || null,
        horas_acompanado: horas ? Number(horas) : null,
        comorbilidades: comorb,
        movilidad: movilidad || null,
        caidas_12m: caidas,
        miedo_caer: miedoCaer,
        cognicion_basal: { reconoce, orienta, coherente },
        sueno_horas: sHoras ? Number(sHoras) : null,
        sueno_despertares: sDesp ? Number(sDesp) : null,
        sueno_hipnoticos: sHipn,
        objetivos,
        barthel_total: barthelDone ? barthelTotal : null,
        lawton_total: lawtonDone ? lawtonTotal : null,
        cfs_nivel: cfs,
        jenkins_basal: jenkinsDone ? jenkinsTotal : null,
        zarit_basal: zaritDone ? zaritTotal : null,
        valoracion_completa: true,
      }).select("id").single();
      if (error) throw error;
      toast.success("Adulto mayor registrado");
      navigate({ to: "/paciente/$id", params: { id: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const progress = step === "listo" ? 100 : Math.round(((idx + 1) / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="container-app pt-6 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={back} className="size-11 rounded-2xl bg-secondary grid place-items-center" aria-label="Atrás">
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Paso {Math.min(idx + 1, STEPS.length)} de {STEPS.length}</p>
            <p className="font-display text-lg font-semibold">{step === "listo" ? "Todo listo" : STEPS[idx].label}</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="container-app flex-1 pb-8 pt-4">
        {step === "datos" && (
          <div className="space-y-4">
            <Field label="Nombre"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Doña Carmen Pérez" /></Field>
            <Field label="Edad"><Input type="number" inputMode="numeric" value={edad} onChange={(e) => setEdad(e.target.value)} placeholder="78" /></Field>
            <FieldChoice label="Sexo" value={sexo} onChange={setSexo} options={SEXO} />
            <Field label="Escolaridad (opcional)"><Input value={escolaridad} onChange={(e) => setEscolaridad(e.target.value)} placeholder="Primaria, Secundaria, etc." /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Peso (kg)"><Input type="number" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} /></Field>
              <Field label="Talla (cm)"><Input type="number" inputMode="decimal" value={talla} onChange={(e) => setTalla(e.target.value)} /></Field>
            </div>
          </div>
        )}

        {step === "apoyo" && (
          <div className="space-y-5">
            <YesNo label="¿Vive solo?" value={viveSolo} onChange={setViveSolo} />
            <FieldChoice label="Tipo de cuidador" value={tipoCuidador} onChange={setTipoCuidador} options={TIPO_CUIDADOR} />
            <Field label="Horas acompañado al día"><Input type="number" inputMode="numeric" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="0–24" /></Field>
          </div>
        )}

        {step === "comorb" && (
          <MultiChips
            label="Selecciona las que apliquen"
            options={COMORBILIDADES}
            value={comorb}
            onChange={setComorb}
          />
        )}

        {step === "movilidad" && (
          <div className="space-y-5">
            <FieldChoice label="Movilidad habitual" value={movilidad} onChange={setMovilidad} options={MOVILIDAD} />
            <YesNo label="¿Ha tenido caídas en los últimos 12 meses?" value={caidas} onChange={setCaidas} />
            <YesNo label="¿Tiene miedo a caer?" value={miedoCaer} onChange={setMiedoCaer} />
          </div>
        )}

        {step === "cognicion" && (
          <div className="space-y-5">
            <YesNo label="¿Reconoce a sus familiares?" value={reconoce} onChange={setReconoce} />
            <YesNo label="¿Se orienta en casa?" value={orienta} onChange={setOrienta} />
            <YesNo label="¿Sostiene una conversación coherente?" value={coherente} onChange={setCoherente} />
          </div>
        )}

        {step === "sueno" && (
          <div className="space-y-5">
            <Field label="Horas habituales de sueño"><Input type="number" inputMode="decimal" value={sHoras} onChange={(e) => setSHoras(e.target.value)} placeholder="Ej. 7" /></Field>
            <Field label="Despertares nocturnos"><Input type="number" inputMode="numeric" value={sDesp} onChange={(e) => setSDesp(e.target.value)} placeholder="Ej. 2" /></Field>
            <YesNo label="¿Usa hipnóticos para dormir?" value={sHipn} onChange={setSHipn} />
          </div>
        )}

        {step === "jenkins" && (
          <div className="space-y-5">
            <p className="text-muted-foreground">En el último mes, frecuencia de cada situación.</p>
            {JENKINS_ITEMS.map((it) => (
              <div key={it.key}>
                <p className="font-semibold mb-2">{it.label}</p>
                <div className="space-y-2">
                  {JENKINS_OPTIONS.map((op) => (
                    <ChoiceRow
                      key={op.value}
                      selected={jenkins[it.key] === op.value}
                      onClick={() => setJenkins({ ...jenkins, [it.key]: op.value })}
                      label={op.label}
                    />
                  ))}
                </div>
              </div>
            ))}
            {jenkinsDone && (
              <div className="rounded-2xl bg-secondary p-4">
                <p className="font-display text-lg">Total: <b>{jenkinsTotal}/20</b></p>
                <p className="text-muted-foreground">{interpretJenkins(jenkinsTotal)}</p>
              </div>
            )}
          </div>
        )}

        {step === "zarit" && (
          <div className="space-y-5">
            <p className="text-muted-foreground">Cómo se ha sentido el cuidador principal el último mes.</p>
            {ZARIT_ITEMS.map((it) => (
              <div key={it.key}>
                <p className="font-semibold mb-2">{it.label}</p>
                <div className="space-y-2">
                  {ZARIT_OPTIONS.map((op) => (
                    <ChoiceRow
                      key={op.value}
                      selected={zarit[it.key] === op.value}
                      onClick={() => setZarit({ ...zarit, [it.key]: op.value })}
                      label={op.label}
                    />
                  ))}
                </div>
              </div>
            ))}
            {zaritDone && (
              <div className="rounded-2xl bg-secondary p-4">
                <p className="font-display text-lg">Total: <b>{zaritTotal}/28</b></p>
                <p className="text-muted-foreground">{interpretZarit(zaritTotal)}</p>
              </div>
            )}
          </div>
        )}



        {step === "objetivos" && (
          <MultiChips
            label="Elige hasta 2"
            options={OBJETIVOS}
            value={objetivos}
            onChange={(v) => setObjetivos(v.slice(-2))}
            max={2}
          />
        )}

        {step === "barthel" && (
          <div className="space-y-5">
            <p className="text-muted-foreground">Marca la opción que mejor describe su nivel habitual.</p>
            {BARTHEL_ITEMS.map((it) => (
              <div key={it.key}>
                <p className="font-semibold mb-2">{it.label}</p>
                <div className="space-y-2">
                  {it.options.map((op) => (
                    <ChoiceRow
                      key={op.value}
                      selected={barthel[it.key] === op.value}
                      onClick={() => setBarthel({ ...barthel, [it.key]: op.value })}
                      label={`${op.label} · ${op.value} pts`}
                    />
                  ))}
                </div>
              </div>
            ))}
            {barthelDone && (
              <div className="rounded-2xl bg-secondary p-4">
                <p className="font-display text-lg">Total: <b>{barthelTotal}/100</b></p>
                <p className="text-muted-foreground">{interpretBarthel(barthelTotal)}</p>
              </div>
            )}
          </div>
        )}

        {step === "lawton" && (
          <div className="space-y-5">
            <p className="text-muted-foreground">Una marca por actividad.</p>
            {LAWTON_ITEMS.map((it) => (
              <div key={it.key}>
                <p className="font-semibold mb-2">{it.label}</p>
                <div className="space-y-2">
                  <ChoiceRow selected={lawton[it.key] === 1} onClick={() => setLawton({ ...lawton, [it.key]: 1 })} label={it.yesLabel + " · 1 pt"} />
                  <ChoiceRow selected={lawton[it.key] === 0} onClick={() => setLawton({ ...lawton, [it.key]: 0 })} label={it.noLabel + " · 0 pt"} />
                </div>
              </div>
            ))}
            {lawtonDone && (
              <div className="rounded-2xl bg-secondary p-4">
                <p className="font-display text-lg">Total: <b>{lawtonTotal}/8</b></p>
                <p className="text-muted-foreground">{interpretLawton(lawtonTotal)}</p>
              </div>
            )}
          </div>
        )}

        {step === "cfs" && (
          <div className="space-y-2">
            <p className="text-muted-foreground mb-3">Selecciona el nivel que mejor lo describe.</p>
            {CFS_LEVELS.map((l) => (
              <button
                key={l.value}
                onClick={() => setCfs(l.value)}
                className={`w-full text-left rounded-2xl border-2 p-4 transition ${cfs === l.value ? "border-primary bg-secondary" : "border-border bg-card"}`}
              >
                <p className="font-semibold">{l.value}. {l.label}</p>
                <p className="text-sm text-muted-foreground">{l.desc}</p>
              </button>
            ))}
          </div>
        )}

        {step === "listo" && (
          <div className="text-center py-10">
            <div className="mx-auto size-20 rounded-full bg-secondary text-primary grid place-items-center">
              <Check className="size-10" />
            </div>
            <h2 className="mt-6 font-display text-2xl font-semibold">Valoración completa</h2>
            <p className="mt-2 text-muted-foreground">A partir de hoy comenzarás los chequeos diarios para construir la línea basal.</p>
          </div>
        )}
      </main>

      <footer className="container-app pb-8 pt-2 sticky bottom-0 bg-background/95 backdrop-blur">
        {step === "listo" ? (
          <Button size="xl" onClick={guardar} disabled={saving}>
            {saving ? "Guardando…" : "Guardar y comenzar"}
          </Button>
        ) : (
          <Button size="xl" onClick={next} disabled={!canAdvance(step, { nombre, edad, sexo, viveSolo, tipoCuidador, horas, movilidad, caidas, miedoCaer, reconoce, orienta, coherente, sHoras, sDesp, sHipn, objetivos, barthelDone, lawtonDone, cfs, jenkinsDone, zaritDone })}>
            {idx === STEPS.length - 1 ? "Terminar" : "Continuar"} <ArrowRight />
          </Button>
        )}
      </footer>
    </div>
  );
}

function canAdvance(step: Step, s: any): boolean {
  switch (step) {
    case "datos": return !!s.nombre && !!s.edad && !!s.sexo;
    case "apoyo": return s.viveSolo !== null && !!s.tipoCuidador;
    case "comorb": return true;
    case "movilidad": return !!s.movilidad && s.caidas !== null && s.miedoCaer !== null;
    case "cognicion": return s.reconoce !== null && s.orienta !== null && s.coherente !== null;
    case "sueno": return !!s.sHoras && s.sHipn !== null;
    case "objetivos": return s.objetivos.length > 0;
    case "barthel": return s.barthelDone;
    case "lawton": return s.lawtonDone;
    case "cfs": return s.cfs != null;
    case "jenkins": return s.jenkinsDone;
    case "zarit": return s.zaritDone;
    default: return true;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-base font-semibold">{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function FieldChoice({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <Label className="text-base font-semibold">{label}</Label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {options.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => onChange(op)}
            className={`h-14 rounded-2xl border-2 px-3 font-semibold text-left transition ${value === op ? "border-primary bg-secondary text-primary" : "border-border bg-card"}`}
          >
            {op}
          </button>
        ))}
      </div>
    </div>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div>
      <Label className="text-base font-semibold">{label}</Label>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => onChange(true)} className={`h-14 rounded-2xl border-2 font-semibold transition ${value === true ? "border-primary bg-secondary text-primary" : "border-border bg-card"}`}>Sí</button>
        <button type="button" onClick={() => onChange(false)} className={`h-14 rounded-2xl border-2 font-semibold transition ${value === false ? "border-primary bg-secondary text-primary" : "border-border bg-card"}`}>No</button>
      </div>
    </div>
  );
}

function MultiChips({ label, options, value, onChange, max }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void; max?: number }) {
  function toggle(op: string) {
    if (value.includes(op)) onChange(value.filter((x) => x !== op));
    else if (max && value.length >= max) onChange([...value.slice(1), op]);
    else onChange([...value, op]);
  }
  return (
    <div>
      <Label className="text-base font-semibold">{label}</Label>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => toggle(op)}
            className={`px-4 py-3 rounded-2xl border-2 font-medium transition ${value.includes(op) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
          >
            {op}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChoiceRow({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border-2 px-4 py-3 transition ${selected ? "border-primary bg-secondary text-primary font-semibold" : "border-border bg-card"}`}
    >
      {label}
    </button>
  );
}
