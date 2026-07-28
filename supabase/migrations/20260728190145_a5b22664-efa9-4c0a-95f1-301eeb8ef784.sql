ALTER TABLE public.recordatorio_envios ADD COLUMN IF NOT EXISTS owner_id uuid;

UPDATE public.recordatorio_envios e
SET owner_id = h.owner_id
FROM public.medicamento_horarios h
WHERE h.id = e.horario_id AND e.owner_id IS NULL;

DELETE FROM public.recordatorio_envios WHERE owner_id IS NULL;

ALTER TABLE public.recordatorio_envios ALTER COLUMN owner_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_recordatorio_envios_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    SELECT h.owner_id INTO NEW.owner_id
    FROM public.medicamento_horarios h
    WHERE h.id = NEW.horario_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_recordatorio_envios_owner ON public.recordatorio_envios;
CREATE TRIGGER set_recordatorio_envios_owner
BEFORE INSERT ON public.recordatorio_envios
FOR EACH ROW EXECUTE FUNCTION public.tg_recordatorio_envios_owner();

ALTER TABLE public.recordatorio_envios ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.recordatorio_envios FROM anon, authenticated;
GRANT SELECT ON public.recordatorio_envios TO authenticated;
GRANT ALL ON public.recordatorio_envios TO service_role;

DROP POLICY IF EXISTS "Owners read their recordatorio_envios" ON public.recordatorio_envios;
CREATE POLICY "Owners read their recordatorio_envios"
ON public.recordatorio_envios
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);