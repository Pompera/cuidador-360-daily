
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Patients
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  edad INT,
  sexo TEXT,
  escolaridad TEXT,
  peso NUMERIC,
  talla NUMERIC,
  vive_solo BOOLEAN,
  tipo_cuidador TEXT,
  horas_acompanado INT,
  comorbilidades JSONB DEFAULT '[]'::jsonb,
  movilidad TEXT,
  caidas_12m BOOLEAN,
  miedo_caer BOOLEAN,
  cognicion_basal JSONB DEFAULT '{}'::jsonb,
  sueno_horas NUMERIC,
  sueno_despertares INT,
  sueno_hipnoticos BOOLEAN,
  objetivos JSONB DEFAULT '[]'::jsonb,
  barthel_total INT,
  lawton_total INT,
  cfs_nivel INT,
  valoracion_completa BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own patients" ON public.patients FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Daily checks
CREATE TABLE public.chequeos_diarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  respuestas JSONB NOT NULL DEFAULT '{}'::jsonb,
  ieg INT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chequeos_patient_fecha_idx ON public.chequeos_diarios(patient_id, fecha DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chequeos_diarios TO authenticated;
GRANT ALL ON public.chequeos_diarios TO service_role;
ALTER TABLE public.chequeos_diarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chequeos" ON public.chequeos_diarios FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER patients_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
