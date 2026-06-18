CREATE TABLE public.profundizaciones_clinicas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  fecha date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  chequeo_id uuid REFERENCES public.chequeos_diarios(id) ON DELETE SET NULL,
  dominios jsonb NOT NULL DEFAULT '[]'::jsonb,
  respuestas jsonb NOT NULL DEFAULT '{}'::jsonb,
  dominio_principal text,
  nivel_deterioro text CHECK (nivel_deterioro IN ('leve','moderado','severo')),
  resumen text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profundizaciones_clinicas TO authenticated;
GRANT ALL ON public.profundizaciones_clinicas TO service_role;

ALTER TABLE public.profundizaciones_clinicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their profundizaciones"
  ON public.profundizaciones_clinicas
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_profundizaciones_patient_fecha
  ON public.profundizaciones_clinicas(patient_id, fecha DESC);

CREATE TRIGGER trg_profundizaciones_updated_at
  BEFORE UPDATE ON public.profundizaciones_clinicas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();