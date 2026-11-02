/*
  Optional enhancement for an instant doctor-dashboard refresh.
  If skipped, the React dashboard still fetches database statistics every 12s
  and when the owner returns to the tab.
  Run once in the Supabase SQL Editor, AFTER the existing V9 migrations.

  Row-level security on public.appointments and public.clinic_queue must
  remain ENABLED. These subscriptions do not make patient records public.
*/
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication not found; dashboard will use polling';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'clinic_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clinic_queue;
  END IF;
END
$$;
