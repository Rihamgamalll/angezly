-- Apply to a backed-up STAGING database first. This introduces a NEW RPC;
-- it does not replace legacy time-slot booking or delete existing records.
BEGIN;
CREATE OR REPLACE FUNCTION public.book_appointment_day(
 p_doctor_id uuid, p_day date, p_patient_name text, p_patient_phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid uuid := auth.uid();
 v_doc public.doctors%ROWTYPE;
 v_count integer;
 v_seq integer;
 v_slot timestamptz;
 v_id uuid;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='admin') THEN
   RAISE EXCEPTION 'ADMIN_CANNOT_BOOK'; END IF;
 IF length(trim(coalesce(p_patient_name,''))) NOT BETWEEN 2 AND 120 THEN
   RAISE EXCEPTION 'INVALID_NAME'; END IF;
 IF coalesce(p_patient_phone,'') !~ '^\+[1-9][0-9]{7,14}$' THEN
   RAISE EXCEPTION 'INVALID_PHONE'; END IF;
 IF p_day < (now() AT TIME ZONE 'Africa/Cairo')::date OR
    p_day > (now() AT TIME ZONE 'Africa/Cairo')::date + 59 THEN
   RAISE EXCEPTION 'DAY_OUT_OF_RANGE'; END IF;
 SELECT * INTO v_doc FROM public.doctors WHERE id=p_doctor_id AND is_published FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DOCTOR_NOT_AVAILABLE'; END IF;
 IF EXISTS (SELECT 1 FROM public.doctor_blocked_days
            WHERE doctor_id=p_doctor_id AND blocked_date=p_day) THEN
   RAISE EXCEPTION 'DOCTOR_ON_LEAVE'; END IF;
 SELECT count(*) INTO v_count FROM public.appointments
 WHERE doctor_id=p_doctor_id AND status <> 'cancelled'
 AND (slot_start AT TIME ZONE 'Africa/Cairo')::date=p_day;
 IF v_count >= v_doc.max_daily_visits THEN RAISE EXCEPTION 'DAILY_VISIT_LIMIT_REACHED'; END IF;
 -- Internal times only: each booking gets a unique minute within its date.
 -- They are NOT patient appointment times. The doctor manages an ordered queue.
 SELECT coalesce(max(floor(extract(epoch FROM ((a.slot_start AT TIME ZONE 'Africa/Cairo') - p_day::timestamp))/60)::integer),-1)+1
 INTO v_seq FROM public.appointments a
 WHERE a.doctor_id=p_doctor_id
 AND (a.slot_start AT TIME ZONE 'Africa/Cairo')::date=p_day;
 -- Avoid colliding with existing slot times and preserve order for new bookings.
 IF v_seq > 1439 THEN RAISE EXCEPTION 'DAY_FULL'; END IF;
 v_slot := (p_day::timestamp + make_interval(mins=>v_seq)) AT TIME ZONE 'Africa/Cairo';
 INSERT INTO public.appointments(doctor_id,patient_id,patient_name,patient_phone,slot_start,duration_minutes)
 VALUES(p_doctor_id,v_uid,trim(p_patient_name),p_patient_phone,v_slot,v_doc.slot_minutes)
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.book_appointment_day(uuid,date,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.book_appointment_day(uuid,date,text,text) TO authenticated;

-- The booking trigger assigns a stable queue number immediately, including guest bookings.
CREATE OR REPLACE FUNCTION public.assign_queue_on_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_day date; v_number integer;
BEGIN
 IF NEW.status <> 'booked' THEN RETURN NEW; END IF;
 v_day := (NEW.slot_start AT TIME ZONE 'Africa/Cairo')::date;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.doctor_id::text||':'||v_day::text,0));
 IF EXISTS(SELECT 1 FROM public.clinic_queue WHERE appointment_id=NEW.id) THEN RETURN NEW; END IF;
 SELECT coalesce(max(queue_number),0)+1 INTO v_number FROM public.clinic_queue
 WHERE doctor_id=NEW.doctor_id AND queue_date=v_day;
 INSERT INTO public.clinic_queue(appointment_id,doctor_id,queue_date,queue_number,status)
 VALUES(NEW.id,NEW.doctor_id,v_day,v_number,'waiting');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.assign_queue_on_booking() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_assign_queue_on_booking ON public.appointments;
CREATE TRIGGER trg_assign_queue_on_booking AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.assign_queue_on_booking();
COMMIT;
