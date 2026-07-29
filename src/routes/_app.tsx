import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { usuarioActual } from "@/lib/auth/sesion";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    // Tolerante a la falta de Internet: si no hay sesión viva en la nube,
    // se usa la sesión guardada en el dispositivo (APK).
    const user = await usuarioActual();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});
