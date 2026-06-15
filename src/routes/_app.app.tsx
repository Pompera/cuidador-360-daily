import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, ChevronRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/app")({
  component: HomePage,
});

interface Patient {
  id: string;
  nombre: string;
  edad: number | null;
  valoracion_completa: boolean;
}

interface UltimoChequeo {
  patient_id: string;
  ieg: number;
  color: string;
  fecha: string;
}

function HomePage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [ultimos, setUltimos] = useState<Record<string, UltimoChequeo>>({});
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.user.id).maybeSingle();
        setName(profile?.full_name?.split(" ")[0] ?? "");
      }
      const { data: p } = await supabase
        .from("patients")
        .select("id, nombre, edad, valoracion_completa")
        .order("created_at", { ascending: false });
      setPatients(p ?? []);
      if (p && p.length) {
        const { data: c } = await supabase
          .from("chequeos_diarios")
          .select("patient_id, ieg, color, fecha")
          .in("patient_id", p.map((x) => x.id))
          .order("fecha", { ascending: false });
        const map: Record<string, UltimoChequeo> = {};
        for (const row of c ?? []) if (!map[row.patient_id]) map[row.patient_id] = row;
        setUltimos(map);
      }
      setLoading(false);
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/auth" });
  }

  const colorBg: Record<string, string> = {
    verde: "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.1_155)]",
    amarillo: "bg-[oklch(0.93_0.08_85)] text-[oklch(0.4_0.12_70)]",
    naranja: "bg-[oklch(0.88_0.1_55)] text-[oklch(0.4_0.14_45)]",
    rojo: "bg-[oklch(0.88_0.1_25)] text-[oklch(0.4_0.18_25)]",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pt-8 pb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Hola{name ? "," : ""}</p>
          <h1 className="font-display text-2xl font-semibold">{name || "Cuidador 360"}</h1>
        </div>
        <button onClick={signOut} className="size-11 rounded-2xl bg-secondary grid place-items-center text-muted-foreground" aria-label="Salir">
          <LogOut className="size-5" />
        </button>
      </header>

      <main className="container-app pb-12">
        <h2 className="mt-2 font-display text-xl font-semibold">Tus adultos mayores</h2>
        {loading ? (
          <p className="mt-4 text-muted-foreground">Cargando…</p>
        ) : patients.length === 0 ? (
          <div className="mt-6 rounded-3xl border-2 border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-muted-foreground">Aún no has agregado a nadie.</p>
            <Button asChild size="xl" className="mt-5">
              <Link to="/_app/paciente/nuevo">
                <Plus /> Agregar adulto mayor
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="mt-4 space-y-3">
              {patients.map((p) => {
                const u = ultimos[p.id];
                return (
                  <li key={p.id}>
                    <Link
                      to="/_app/paciente/$id"
                      params={{ id: p.id }}
                      className="flex items-center gap-4 rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)] active:scale-[0.99] transition"
                    >
                      <div className="size-14 shrink-0 rounded-2xl bg-secondary text-primary grid place-items-center font-display text-xl font-semibold">
                        {p.nombre[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-lg font-semibold truncate">{p.nombre}</p>
                        {!p.valoracion_completa ? (
                          <span className="inline-flex items-center gap-1 text-sm text-accent-foreground bg-accent/30 px-2 py-0.5 rounded-full mt-1">
                            <AlertCircle className="size-3.5" /> Valoración pendiente
                          </span>
                        ) : u ? (
                          <span className={`inline-flex items-center text-sm font-semibold px-2.5 py-1 rounded-full mt-1 ${colorBg[u.color] ?? "bg-secondary"}`}>
                            IEG {u.ieg} · {u.fecha}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin chequeos aún</span>
                        )}
                      </div>
                      <ChevronRight className="size-5 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {patients.length < 3 && (
              <Button asChild size="xl" variant="outline" className="mt-6">
                <Link to="/_app/paciente/nuevo"><Plus /> Agregar otro</Link>
              </Button>
            )}
            {patients.length >= 3 && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Plan actual: hasta 3 adultos mayores por cuenta.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
