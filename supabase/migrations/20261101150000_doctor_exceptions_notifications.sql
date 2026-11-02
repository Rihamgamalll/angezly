/*
 * Availability safeguards, patient-facing notifications and private doctor exceptions.
 * Apply after 20261101140000_queue_attendance_security.sql.
 */
ALTER TABLE public.appointments
 ADD COLUMN IF NOT EXISTS duration_minutes integer CHECK (duration_minutes BETWEEN 5 AND 120);
UPDATE public.appointments a SET duration_minutes=d.slot_minutes
FROM public.doctors d WHERE a.doctor_id=d.id AND a.duration_minutes IS NULL;
ALTER TABLE public.appointments ALTER COLUMN duration_minutes SET NOT NULL;
CREATE INDEX IF NOT EXISTS appointments_doctor_time_idx ON public.appointments(doctor_id,slot_start);

CREATE TABLE IF NOT EXISTS public.doctor_blocked_days (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
 blocked_date date NOT NULL,
 reason text NOT NULL DEFAULT '' CHECK(char_length(reason)<=120),
 UNIQUE(doctor_id,blocked_date)
);
ALTER TABLE public.doctor_blocked_days ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.doctor_blocked_days TO anon,authenticated;
GRANT INSERT (doctor_id,blocked_date,reason),DELETE ON public.doctor_blocked_days TO authenticated;
DROP POLICY IF EXISTS blocked_days_read ON public.doctor_blocked_days;
CREATE POLICY blocked_days_read ON public.doctor_blocked_days FOR SELECT TO anon,authenticated USING (
 EXISTS(SELECT 1 FROM public.doctors d WHERE d.id=doctor_id AND (d.is_published OR d.user_id=auth.uid()))
);
DROP POLICY IF EXISTS blocked_days_add ON public.doctor_blocked_days;
CREATE POLICY blocked_days_add ON public.doctor_blocked_days FOR INSERT TO authenticated WITH CHECK(
 EXISTS(SELECT 1 FROM public.doctors d WHERE d.id=doctor_id AND d.user_id=auth.uid())
);
DROP POLICY IF EXISTS blocked_days_remove ON public.doctor_blocked_days;
CREATE POLICY blocked_days_remove ON public.doctor_blocked_days FOR DELETE TO authenticated USING(
 EXISTS(SELECT 1 FROM public.doctors d WHERE d.id=doctor_id AND d.user_id=auth.uid())
);

CREATE OR REPLACE FUNCTION public.book_appointment(p_doctor_id uuid,p_slot_start timestamptz,p_patient_name text,p_patient_phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid();v_doc public.doctors%ROWTYPE;v_local timestamp:=p_slot_start AT TIME ZONE 'Africa/Cairo';v_dow smallint:=EXTRACT(DOW FROM v_local)::smallint;v_time time:=v_local::time;v_id uuid;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF char_length(trim(coalesce(p_patient_name,'')))<2 OR char_length(p_patient_name)>120 THEN RAISE EXCEPTION 'INVALID_NAME'; END IF;
 IF coalesce(p_patient_phone,'') !~ '^01[0125][0-9]{8}$' THEN RAISE EXCEPTION 'INVALID_PHONE'; END IF;
 IF p_slot_start<=now() THEN RAISE EXCEPTION 'SLOT_IN_PAST'; END IF;
 SELECT * INTO v_doc FROM public.doctors WHERE id=p_doctor_id AND is_published FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DOCTOR_NOT_AVAILABLE'; END IF;
 IF EXISTS(SELECT 1 FROM public.doctor_blocked_days b WHERE b.doctor_id=p_doctor_id AND b.blocked_date=v_local::date) THEN
  RAISE EXCEPTION 'DOCTOR_ON_LEAVE';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.doctor_availability w WHERE w.doctor_id=p_doctor_id AND w.weekday=v_dow
    AND v_time>=w.start_time AND v_time+make_interval(mins=>v_doc.slot_minutes)<=w.end_time
    AND (EXTRACT(EPOCH FROM (v_time-w.start_time))::bigint % (v_doc.slot_minutes * 60))=0) THEN
  RAISE EXCEPTION 'SLOT_NOT_AVAILABLE';
 END IF;
 IF EXISTS(SELECT 1 FROM public.appointments a WHERE a.doctor_id=p_doctor_id AND a.status IN('booked','completed','no_show')
   AND tstzrange(a.slot_start,a.slot_start+make_interval(mins=>a.duration_minutes),'[)') &&
       tstzrange(p_slot_start,p_slot_start+make_interval(mins=>v_doc.slot_minutes),'[)')) THEN
  RAISE EXCEPTION 'SLOT_TAKEN';
 END IF;
 BEGIN
  INSERT INTO public.appointments(doctor_id,patient_id,patient_name,patient_phone,slot_start,duration_minutes)
  VALUES(p_doctor_id,v_uid,trim(p_patient_name),p_patient_phone,p_slot_start,v_doc.slot_minutes) RETURNING id INTO v_id;
 EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'SLOT_TAKEN'; END;
 RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.book_appointment(uuid,timestamptz,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid,timestamptz,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_doctor_busy_intervals(p_doctor_id uuid,p_from timestamptz,p_to timestamptz)
RETURNS TABLE(slot_start timestamptz,duration_minutes integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.slot_start,a.duration_minutes FROM public.appointments a
 JOIN public.doctors d ON d.id=a.doctor_id AND d.is_published
 WHERE a.doctor_id=p_doctor_id AND a.status IN('booked','completed','no_show')
   AND a.slot_start<p_to AND a.slot_start+make_interval(mins=>a.duration_minutes)>p_from
   AND p_to>p_from AND p_to-p_from<=interval '62 days';
$$;
REVOKE EXECUTE ON FUNCTION public.get_doctor_busy_intervals(uuid,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_doctor_busy_intervals(uuid,timestamptz,timestamptz) TO anon,authenticated;

CREATE TABLE IF NOT EXISTS public.notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(char_length(title)<=150),
 body text NOT NULL DEFAULT '' CHECK(char_length(body)<=500),
 category text NOT NULL DEFAULT 'booking',
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id,created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE(read_at) ON public.notifications TO authenticated;
DROP POLICY IF EXISTS notifications_select_self ON public.notifications;
CREATE POLICY notifications_select_self ON public.notifications FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS notifications_update_self ON public.notifications;
CREATE POLICY notifications_update_self ON public.notifications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.on_appointment_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.patient_id IS NOT NULL THEN
  INSERT INTO public.notifications(user_id,title,body) VALUES (NEW.patient_id,'حجز الكشف اتأكد','ميعاد كشفك اتحجز. تقدر تتابعه من حجوزاتي.');
 ELSIF TG_OP='UPDATE' AND NEW.status='cancelled' AND OLD.status<>'cancelled' AND NEW.patient_id IS NOT NULL THEN
  INSERT INTO public.notifications(user_id,title,body) VALUES (NEW.patient_id,'تم إلغاء الحجز','تقدر تشوف حجوزاتك وتحجز ميعاد جديد.');
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS appointments_notification ON public.appointments;
CREATE TRIGGER appointments_notification AFTER INSERT OR UPDATE OF status ON public.appointments
 FOR EACH ROW EXECUTE FUNCTION public.on_appointment_notification();

CREATE OR REPLACE FUNCTION public.on_group_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.student_id IS NOT NULL THEN
  INSERT INTO public.notifications(user_id,title,body) VALUES (NEW.student_id,'مكانك في المجموعة اتأكد', 'رقم تسجيلك: '||NEW.booking_ref);
 ELSIF TG_OP='UPDATE' AND NEW.status='cancelled' AND OLD.status<>'cancelled' AND NEW.student_id IS NOT NULL THEN
  INSERT INTO public.notifications(user_id,title,body) VALUES (NEW.student_id,'تم إلغاء التسجيل','تم إلغاء مكانك في المجموعة.');
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS group_enrollments_notification ON public.group_enrollments;
CREATE TRIGGER group_enrollments_notification AFTER INSERT OR UPDATE OF status ON public.group_enrollments
 FOR EACH ROW EXECUTE FUNCTION public.on_group_notification();

-- When an appointment is resolved directly by a doctor, resolve queue entry too.
CREATE OR REPLACE FUNCTION public.sync_queue_appointment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
  UPDATE public.clinic_queue SET status='completed',updated_at=now() WHERE appointment_id=NEW.id AND status IN('waiting','in_progress');
 ELSIF NEW.status IN('no_show','cancelled') AND OLD.status IS DISTINCT FROM NEW.status THEN
  UPDATE public.clinic_queue SET status='no_show',updated_at=now() WHERE appointment_id=NEW.id AND status IN('waiting','in_progress');
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_queue_on_appointment ON public.appointments;
CREATE TRIGGER sync_queue_on_appointment AFTER UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.sync_queue_appointment();

-- Never silently declare a day off while booked patients still have appointments.
CREATE OR REPLACE FUNCTION public.prevent_blocked_day_with_bookings() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.appointments a WHERE a.doctor_id=NEW.doctor_id AND a.status='booked'
  AND (a.slot_start AT TIME ZONE 'Africa/Cairo')::date=NEW.blocked_date) THEN
  RAISE EXCEPTION 'BLOCKED_DAY_HAS_APPOINTMENTS';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS blocked_days_check_bookings ON public.doctor_blocked_days;
CREATE TRIGGER blocked_days_check_bookings BEFORE INSERT ON public.doctor_blocked_days
 FOR EACH ROW EXECUTE FUNCTION public.prevent_blocked_day_with_bookings();

CREATE OR REPLACE FUNCTION public.on_teacher_group_schedule_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF ROW(NEW.weekdays,NEW.start_time,NEW.end_time,NEW.location) IS DISTINCT FROM
    ROW(OLD.weekdays,OLD.start_time,OLD.end_time,OLD.location) THEN
  INSERT INTO public.notifications(user_id,title,body,category)
  SELECT DISTINCT e.student_id,'مواعيد المجموعة اتغيّرت','راجع تفاصيل مجموعتك الجديدة من حجوزاتي.','schedule'
  FROM public.group_enrollments e WHERE e.group_id=NEW.id AND e.status='active' AND e.student_id IS NOT NULL;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_teacher_schedule_changes ON public.teacher_groups;
CREATE TRIGGER notify_teacher_schedule_changes AFTER UPDATE OF weekdays,start_time,end_time,location ON public.teacher_groups
 FOR EACH ROW EXECUTE FUNCTION public.on_teacher_group_schedule_changed();
