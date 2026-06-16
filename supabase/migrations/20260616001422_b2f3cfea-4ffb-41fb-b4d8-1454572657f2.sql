
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS jenkins_basal integer,
  ADD COLUMN IF NOT EXISTS zarit_basal integer;

CREATE TABLE IF NOT EXISTS public.evaluaciones_escala (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('jenkins','zarit')),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  puntaje integer NOT NULL,
  respuestas jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eval_escala_patient_tipo_fecha
  ON public.evaluaciones_escala (patient_id, tipo, fecha DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluaciones_escala TO authenticated;
GRANT ALL ON public.evaluaciones_escala TO service_role;

ALTER TABLE public.evaluaciones_escala ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages evaluaciones_escala"
  ON public.evaluaciones_escala
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_eval_escala_updated_at
  BEFORE UPDATE ON public.evaluaciones_escala
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
