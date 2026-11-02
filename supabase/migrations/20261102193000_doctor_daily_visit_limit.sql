-- Apply this migration in Supabase before deploying the dashboard changes.
-- The doctor owns the setting. A database trigger enforces the limit even for guest bookings.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS max_daily_visits integer NOT NULL DEFAULT 30
  CHECK (max_daily_visits BETWEEN 1 AND 500);

GRANT UPDATE (max_daily_visits) ON public.doctors TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_doctor_daily_visit_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_limit integer;
  v_count integer;
  v_day date;
BEGIN
  IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
  -- Existing bookings may be completed or marked no-show without consuming a new place.
  IF TG_OP = 'UPDATE' AND OLD.status <> 'cancelled'
     AND OLD.doctor_id = NEW.doctor_id AND OLD.slot_start = NEW.slot_start THEN
    RETURN NEW;
  END IF;
  -- Serialize concurrent inserts for a given doctor, avoiding overbooking.
  SELECT max_daily_visits INTO v_limit FROM public.doctors
  WHERE id = NEW.doctor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCTOR_NOT_AVAILABLE'; END IF;
  v_day := (NEW.slot_start AT TIME ZONE 'Africa/Cairo')::date;
  SELECT count(*) INTO v_count FROM public.appointments a
  WHERE a.doctor_id = NEW.doctor_id
    AND a.status <> 'cancelled'
    AND (a.slot_start AT TIME ZONE 'Africa/Cairo')::date = v_day
    AND (TG_OP = 'INSERT' OR a.id <> NEW.id);
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'DAILY_VISIT_LIMIT_REACHED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS doctor_daily_visit_limit_guard ON public.appointments;
CREATE TRIGGER doctor_daily_visit_limit_guard
BEFORE INSERT OR UPDATE OF doctor_id, slot_start, status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_doctor_daily_visit_limit();
