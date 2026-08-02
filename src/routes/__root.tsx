import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { pushSoportado, registrarServiceWorker, activarNotificaciones } from "@/lib/push/client";
import { usaModoOffline } from "@/lib/plataforma";
import { abrirDB } from "@/lib/db";
import { guardarSesionLocal, restaurarSesionNube } from "@/lib/auth/sesion";
import { iniciarSync } from "@/lib/sync/sync-manager";



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página no encontrada</h2>
        <p className="mt-2 text-muted-foreground">Esa pantalla no existe.</p>
        <Link
          to="/"
          className="mt-6 inline-flex h-12 items-center rounded-2xl bg-primary px-6 font-semibold text-primary-foreground"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Esta pantalla no cargó</h1>
        <p className="mt-2 text-muted-foreground">Algo salió mal. Inténtalo de nuevo.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex h-12 items-center rounded-2xl bg-primary px-6 font-semibold text-primary-foreground"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#fbf6ec" },
      { title: "Cuidador 360 — Seguimiento geriátrico" },
      { name: "description", content: "Bitácora geriátrica diaria para cuidadores: detecta cambios, registra y comparte un resumen claro con el médico." },
      { property: "og:title", content: "Cuidador 360" },
      { property: "og:description", content: "Bitácora geriátrica diaria para cuidadores." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },

      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    let sub: { subscription: { unsubscribe: () => void } } | null = null;
    try {
      sub = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") {
        queryClient.invalidateQueries();
        // Guarda la sesión en el dispositivo para poder entrar sin Internet.
        void guardarSesionLocal();
      }
      }).data;
    } catch {
      // Sin conexión / sin cliente: el arranque se apoya en la sesión local.
    }
    return () => sub?.subscription.unsubscribe();
  }, [router, queryClient]);

  // Modo offline (APK): abre la base local, restaura la sesión guardada
  // y arranca la sincronización en segundo plano.
  useEffect(() => {
    if (!usaModoOffline()) return;
    void (async () => {
      await abrirDB();
      await restaurarSesionNube();
      await iniciarSync();
    })();
  }, []);


  useEffect(() => {
    if (!pushSoportado()) return;
    let cancelado = false;
    (async () => {
      await registrarServiceWorker();
      if (cancelado || Notification.permission !== "granted") return;
      // Permiso ya concedido: refresca/repara la suscripción sin molestar al usuario.
      await activarNotificaciones(false);
    })();
    return () => {
      cancelado = true;
    };
  }, []);


  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
