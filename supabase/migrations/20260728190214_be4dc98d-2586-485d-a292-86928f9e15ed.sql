REVOKE ALL ON FUNCTION public.tg_recordatorio_envios_owner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_recordatorio_envios_owner() TO service_role;