CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.medicamento_horarios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  medicamento_id uuid NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  hora time NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicamento_horarios TO authenticated;
GRANT ALL ON public.medicamento_horarios TO service_role;

ALTER TABLE public.medicamento_horarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their medicamento_horarios"
  ON public.medicamento_horarios
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_medicamento_horarios_medicamento ON public.medicamento_horarios(medicamento_id);
CREATE INDEX idx_medicamento_horarios_hora ON public.medicamento_horarios(hora) WHERE activo;

CREATE TRIGGER trg_medicamento_horarios_updated_at
  BEFORE UPDATE ON public.medicamento_horarios
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their push_subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_push_subscriptions_owner ON public.push_subscriptions(owner_id);

CREATE TABLE public.recordatorio_envios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  horario_id uuid NOT NULL REFERENCES public.medicamento_horarios(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  hora time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (horario_id, fecha, hora)
);

GRANT ALL ON public.recordatorio_envios TO service_role;

ALTER TABLE public.recordatorio_envios ENABLE ROW LEVEL SECURITY;