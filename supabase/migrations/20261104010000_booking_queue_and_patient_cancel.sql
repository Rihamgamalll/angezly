-- Angezly: assign immutable daily queue numbers at booking time.
-- REVIEW and BACK UP production DB before applying. No historical appointments are deleted.
BEGIN;

-- Serialize assignments for the same doctor/day, including concurrent bookings.
CREATE OR REPLACE FUNCTION public.assign_clinic_queue_on_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_day date; v_number integer;
BEGIN
  IF NEW.status <> 'booked' THEN RETURN NEW; END IF;
  v_day := (NEW.slot_start AT TIME ZONE 'Africa/Cairo')::date;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.doctor_id::text || v_day::text, 0));
  IF EXISTS (SELECT 1 FROM public.clinic_queue WHERE appointment_id = NEW.id) THEN RETURN NEW; END IF;
  SELECT COALESCE(MAX(queue_number), 0) + 1 INTO v_number
  FROM public.clinic_queue WHERE doctor_id = NEW.doctor_id AND queue_date = v_day;
  INSERT INTO public.clinic_queue(appointment_id, doctor_id, queue_date, queue_number, status)
  VALUES (NEW.id, NEW.doctor_id, v_day, v_number, 'waiting');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_clinic_queue_on_booking() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_assign_clinic_queue_on_booking ON public.appointments;
CREATE TRIGGER trg_assign_clinic_queue_on_booking
AFTER INSERT ON public.appointments FOR EACH ROW
EXECUTE FUNCTION public.assign_clinic_queue_on_booking();

-- Existing future bookings: allocate a number without disturbing existing numbers.
-- Historical rows intentionally untouched; cancelled rows never receive a new number.
DO $$
DECLARE v_appt record; v_day date; v_number integer;
BEGIN
  FOR v_appt IN
    SELECT a.id, a.doctor_id, a.slot_start FROM public.appointments a
    WHERE a.status = 'booked' AND a.slot_start >= now()
      AND NOT EXISTS (SELECT 1 FROM public.clinic_queue q WHERE q.appointment_id = a.id)
    ORDER BY a.doctor_id, a.slot_start, a.created_at, a.id
  LOOP
    v_day := (v_appt.slot_start AT TIME ZONE 'Africa/Cairo')::date;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_appt.doctor_id::text || v_day::text, 0));
    SELECT COALESCE(MAX(queue_number),0)+1 INTO v_number FROM public.clinic_queue
    WHERE doctor_id=v_appt.doctor_id AND queue_date=v_day;
    INSERT INTO public.clinic_queue(appointment_id,doctor_id,queue_date,queue_number,status)
    VALUES(v_appt.id,v_appt.doctor_id,v_day,v_number,'waiting') ON CONFLICT(appointment_id) DO NOTHING;
  END LOOP;
END $$;

-- Patient with their high-entropy tracking link can cancel even if the anonymous
-- session was lost. Do not expose this function through GET URLs or logs.
CREATE OR REPLACE FUNCTION public.cancel_appointment_with_tracking_token(p_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_appt_id uuid; v_status text;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'INVALID_TRACKING_LINK'; END IF;
  SELECT l.appointment_id INTO v_appt_id
  FROM public.appointment_tracking_links l
  WHERE l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    AND l.expires_at > now();
  IF v_appt_id IS NULL THEN RAISE EXCEPTION 'INVALID_TRACKING_LINK'; END IF;
  SELECT status INTO v_status FROM public.appointments WHERE id=v_appt_id FOR UPDATE;
  IF v_status <> 'booked' THEN RAISE EXCEPTION 'NOT_CANCELLABLE'; END IF;
  UPDATE public.appointments SET status='cancelled' WHERE id=v_appt_id;
  -- Existing status sync trigger marks this queue entry inactive.
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_appointment_with_tracking_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_with_tracking_token(text) TO anon, authenticated;
COMMIT;
