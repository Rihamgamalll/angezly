/*
  Dawrak extension: doctor check-in queue; teacher attendance; protected administrative read access.
  Run AFTER the original three migrations. All mutating RPCs require authenticated users.
*/
CREATE TABLE IF NOT EXISTS public.clinic_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  queue_date date NOT NULL,
  queue_number integer NOT NULL CHECK (queue_number > 0),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','in_progress','completed','no_show')),
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id,queue_date,queue_number)
);
CREATE INDEX IF NOT EXISTS clinic_queue_doctor_date_idx ON public.clinic_queue(doctor_id,queue_date,queue_number);
ALTER TABLE public.clinic_queue ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.clinic_queue TO authenticated;
DROP POLICY IF EXISTS queue_select_party ON public.clinic_queue;
CREATE POLICY queue_select_party ON public.clinic_queue FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND a.patient_id = auth.uid())
 OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.clinic_check_in(p_appointment_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_appointment public.appointments%ROWTYPE; v_date date; v_number integer;
BEGIN
 SELECT a.* INTO v_appointment FROM public.appointments a WHERE a.id=p_appointment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.doctors d WHERE d.id=v_appointment.doctor_id AND d.user_id=auth.uid()) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
 IF v_appointment.status <> 'booked' THEN RAISE EXCEPTION 'NOT_CANCELLABLE'; END IF;
 v_date := (now() AT TIME ZONE 'Africa/Cairo')::date;
 IF (v_appointment.slot_start AT TIME ZONE 'Africa/Cairo')::date <> v_date THEN RAISE EXCEPTION 'CHECK_IN_ONLY_TODAY'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_appointment.doctor_id::text || v_date::text, 0));
 SELECT queue_number INTO v_number FROM public.clinic_queue WHERE appointment_id=p_appointment_id;
 IF FOUND THEN RETURN v_number; END IF;
 SELECT COALESCE(MAX(q.queue_number),0)+1 INTO v_number FROM public.clinic_queue q WHERE q.doctor_id=v_appointment.doctor_id AND q.queue_date=v_date;
 INSERT INTO public.clinic_queue(appointment_id,doctor_id,queue_date,queue_number) VALUES(p_appointment_id,v_appointment.doctor_id,v_date,v_number);
 RETURN v_number;
END $$;

CREATE OR REPLACE FUNCTION public.clinic_update_queue(p_queue_id uuid,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_q public.clinic_queue%ROWTYPE;
BEGIN
 SELECT * INTO v_q FROM public.clinic_queue WHERE id=p_queue_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.doctors WHERE id=v_q.doctor_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
 IF p_action <> 'next' THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
 IF v_q.status='waiting' THEN
   IF EXISTS (SELECT 1 FROM public.clinic_queue WHERE doctor_id=v_q.doctor_id AND queue_date=v_q.queue_date AND status='in_progress') THEN
    RAISE EXCEPTION 'CONSULTATION_IN_PROGRESS';
   END IF;
   UPDATE public.clinic_queue SET status='in_progress', updated_at=now() WHERE id=p_queue_id;
 ELSIF v_q.status='in_progress' THEN
   UPDATE public.clinic_queue SET status='completed',updated_at=now() WHERE id=p_queue_id;
   UPDATE public.appointments SET status='completed' WHERE id=v_q.appointment_id AND status='booked';
 ELSE RAISE EXCEPTION 'INVALID_STATUS'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_patient_queue_progress(p_appointment_id uuid)
RETURNS TABLE(queue_number integer,current_number integer,patients_ahead integer,queue_status text,updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_q public.clinic_queue%ROWTYPE;
BEGIN
 SELECT q.* INTO v_q FROM public.clinic_queue q JOIN public.appointments a ON a.id=q.appointment_id
 WHERE q.appointment_id=p_appointment_id AND (a.patient_id=auth.uid() OR EXISTS(SELECT 1 FROM public.doctors d WHERE d.id=q.doctor_id AND d.user_id=auth.uid()));
 IF NOT FOUND THEN RETURN; END IF;
 RETURN QUERY SELECT v_q.queue_number,
   COALESCE((SELECT q.queue_number FROM public.clinic_queue q WHERE q.doctor_id=v_q.doctor_id AND q.queue_date=v_q.queue_date AND q.status='in_progress' LIMIT 1),
      (SELECT COALESCE(MAX(q.queue_number),0) FROM public.clinic_queue q WHERE q.doctor_id=v_q.doctor_id AND q.queue_date=v_q.queue_date AND q.status='completed'))::integer,
   (SELECT COUNT(*)::integer FROM public.clinic_queue q WHERE q.doctor_id=v_q.doctor_id AND q.queue_date=v_q.queue_date AND q.queue_number < v_q.queue_number AND q.status IN ('waiting','in_progress')),
   v_q.status, v_q.updated_at;
END $$;

-- Attendance for each actual lesson date, not for the recurring group enrollment itself.
CREATE TABLE IF NOT EXISTS public.group_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.teacher_groups(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled','completed')),
  UNIQUE(group_id,session_date)
);
CREATE TABLE IF NOT EXISTS public.student_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.group_enrollments(id) ON DELETE CASCADE,
  status text NOT NULL CHECK(status IN ('present','absent')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id,enrollment_id)
);
ALTER TABLE public.group_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.group_sessions, public.student_attendance TO authenticated;
DROP POLICY IF EXISTS session_teacher_select ON public.group_sessions;
CREATE POLICY session_teacher_select ON public.group_sessions FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.teacher_groups g JOIN public.teachers t ON t.id=g.teacher_id WHERE g.id=group_id AND t.user_id=auth.uid())
);
DROP POLICY IF EXISTS attendance_teacher_select ON public.student_attendance;
CREATE POLICY attendance_teacher_select ON public.student_attendance FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.group_sessions s JOIN public.teacher_groups g ON g.id=s.group_id JOIN public.teachers t ON t.id=g.teacher_id WHERE s.id=session_id AND t.user_id=auth.uid())
);
CREATE OR REPLACE FUNCTION public.teacher_mark_attendance(p_enrollment_id uuid,p_date date,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_enrollment public.group_enrollments%ROWTYPE; v_session uuid;
BEGIN
 IF p_status NOT IN ('present','absent') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
 SELECT * INTO v_enrollment FROM public.group_enrollments WHERE id=p_enrollment_id AND status='active';
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.teacher_groups g JOIN public.teachers t ON t.id=g.teacher_id WHERE g.id=v_enrollment.group_id AND t.user_id=auth.uid()) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
 IF p_date IS NULL OR p_date > (now() AT TIME ZONE 'Africa/Cairo')::date THEN RAISE EXCEPTION 'INVALID_DATE'; END IF;
 INSERT INTO public.group_sessions(group_id,session_date) VALUES(v_enrollment.group_id,p_date)
 ON CONFLICT(group_id,session_date) DO UPDATE SET group_id=EXCLUDED.group_id RETURNING id INTO v_session;
 INSERT INTO public.student_attendance(session_id,enrollment_id,status) VALUES(v_session,p_enrollment_id,p_status)
 ON CONFLICT(session_id,enrollment_id) DO UPDATE SET status=EXCLUDED.status,updated_at=now();
END $$;

-- Admin can view professional rows and aggregate them, without accessing patient details by default.
DROP POLICY IF EXISTS queue_admin_all ON public.clinic_queue;
DROP POLICY IF EXISTS groups_admin_select ON public.teacher_groups;
CREATE POLICY groups_admin_select ON public.teacher_groups FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin')
);

REVOKE EXECUTE ON FUNCTION public.clinic_check_in(uuid) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.clinic_update_queue(uuid,text) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.get_patient_queue_progress(uuid) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.teacher_mark_attendance(uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinic_check_in(uuid),public.clinic_update_queue(uuid,text),public.get_patient_queue_progress(uuid),public.teacher_mark_attendance(uuid,date,text) TO authenticated;
