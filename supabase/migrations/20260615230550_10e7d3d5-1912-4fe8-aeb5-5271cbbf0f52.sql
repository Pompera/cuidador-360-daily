-- medicamentos
CREATE TABLE public.medicamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  dosis text,
  frecuencia text,
  fecha_inicio date,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicamentos TO authenticated;
GRANT ALL ON public.medicamentos TO service_role;
ALTER TABLE public.medicamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own medicamentos" ON public.medicamentos FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX medicamentos_patient_idx ON public.medicamentos(patient_id);
CREATE TRIGGER medicamentos_updated_at BEFORE UPDATE ON public.medicamentos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- medicamento_tomas
CREATE TABLE public.medicamento_tomas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  medicamento_id uuid NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  estado text NOT NULL CHECK (estado IN ('tomado','omitido')),
  nota text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicamento_tomas TO authenticated;
GRANT ALL ON public.medicamento_tomas TO service_role;
ALTER TABLE public.medicamento_tomas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tomas" ON public.medicamento_tomas FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE UNIQUE INDEX medicamento_tomas_unique ON public.medicamento_tomas(medicamento_id, fecha);
CREATE INDEX medicamento_tomas_patient_fecha_idx ON public.medicamento_tomas(patient_id, fecha);

-- signos_vitales
CREATE TABLE public.signos_vitales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  fecha timestamptz NOT NULL DEFAULT now(),
  ta_sistolica numeric,
  ta_diastolica numeric,
  fc numeric,
  temperatura numeric,
  saturacion numeric,
  glucosa numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signos_vitales TO authenticated;
GRANT ALL ON public.signos_vitales TO service_role;
ALTER TABLE public.signos_vitales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own signos" ON public.signos_vitales FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX signos_patient_fecha_idx ON public.signos_vitales(patient_id, fecha DESC);

-- caidas
CREATE TABLE public.caidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  lugar text,
  circunstancia text,
  lesion text,
  golpe_craneal boolean NOT NULL DEFAULT false,
  hospitalizacion boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caidas TO authenticated;
GRANT ALL ON public.caidas TO service_role;
ALTER TABLE public.caidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own caidas" ON public.caidas FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX caidas_patient_fecha_idx ON public.caidas(patient_id, fecha DESC);