import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin + "/app",
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. ¡Bienvenido!");
        navigate({ to: "/app" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo continuar");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/app" });
    if (result.error) { toast.error("Error con Google"); setLoading(false); return; }
    if (result.redirected) return;
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="container-app">
        <div className="text-center">
          <div className="mx-auto size-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-display text-2xl font-bold">C</div>
          <h1 className="mt-4 font-display text-3xl font-semibold">
            {mode === "signin" ? "Bienvenido de vuelta" : "Crear tu cuenta"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {mode === "signin" ? "Continúa cuidando con claridad." : "Es gratis. Toma menos de un minuto."}
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
          <Button onClick={google} disabled={loading} variant="outline" size="xl" className="mb-4">
            <GoogleIcon /> Continuar con Google
          </Button>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">o</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name" className="text-base">Tu nombre</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-2" placeholder="María González" />
              </div>
            )}
            <div>
              <Label htmlFor="email" className="text-base">Correo</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-2" placeholder="tucorreo@ejemplo.com" />
            </div>
            <div>
              <Label htmlFor="password" className="text-base">Contraseña</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="mt-2" placeholder="Mínimo 8 caracteres" />
            </div>
            <Button type="submit" size="xl" disabled={loading}>
              {loading ? "Un momento…" : mode === "signin" ? "Entrar" : "Crear cuenta"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm">
            {mode === "signin" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-primary font-semibold underline-offset-4 hover:underline">
              {mode === "signin" ? "Crear una" : "Entrar"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1A6.97 6.97 0 0 1 5.47 12c0-.73.13-1.44.36-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.83z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.12 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.3 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
