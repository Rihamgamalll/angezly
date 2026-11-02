-- دَوْرك V8 — فصل حساب إدارة المنصة عن حسابات مقدّمي الخدمة
-- RUN ONCE in Supabase SQL Editor, AFTER the five original migrations.
-- Keep this project in a TEST environment while verifying roles and bookings.
-- This script never deletes/unpublishes professional profiles or bookings.
-- After it succeeds, run the ONE-TIME ADMIN_SWITCH script with a NEW user UID.

-- This migration adds permanent separation rules. It intentionally does NOT
-- transfer the existing admin role yet. First create a second user (owner),
-- then run ADMIN_SWITCH_TO_OWNER_ACCOUNT.sql with the new user's UID.
-- This keeps the existing doctor's profile, appointments and schedules intact.
BEGIN;

-- Protect the separation for ALL future accounts, including direct SQL writes.
CREATE OR REPLACE FUNCTION public.prevent_admin_professional_role_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (NEW.role = 'admin' AND EXISTS (
    SELECT 1 FROM public.user_roles x
    WHERE x.user_id = NEW.user_id AND x.role IN ('doctor', 'teacher')
  )) OR (NEW.role IN ('doctor', 'teacher') AND EXISTS (
    SELECT 1 FROM public.user_roles x
    WHERE x.user_id = NEW.user_id AND x.role = 'admin'
  )) THEN
    RAISE EXCEPTION 'ADMIN_ACCOUNT_MUST_BE_SEPARATE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_professional_role_isolation ON public.user_roles;
CREATE TRIGGER admin_professional_role_isolation
BEFORE INSERT OR UPDATE OF role, user_id ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_professional_role_overlap();

REVOKE EXECUTE ON FUNCTION public.prevent_admin_professional_role_overlap() FROM PUBLIC, anon, authenticated;

-- Block administrator accounts from booking as patients at the backend.
-- Important: this definition preserves the clinic leave / duration / collision checks
-- from migration 20261101150000_doctor_exceptions_notifications.sql.
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_doctor_id uuid,
  p_slot_start timestamptz,
  p_patient_name text,
  p_patient_phone text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_doc public.doctors%ROWTYPE;
  v_local timestamp := p_slot_start AT TIME ZONE 'Africa/Cairo';
  v_dow smallint := EXTRACT(DOW FROM v_local)::smallint;
  v_time time := v_local::time;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'admin') THEN
    RAISE EXCEPTION 'ADMIN_CANNOT_BOOK';
  END IF;
  IF char_length(trim(coalesce(p_patient_name,''))) < 2 OR char_length(p_patient_name) > 120 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;
  IF coalesce(p_patient_phone, '') !~ '^01[0125][0-9]{8}$' THEN
    RAISE EXCEPTION 'INVALID_PHONE';
  END IF;
  IF p_slot_start <= now() THEN RAISE EXCEPTION 'SLOT_IN_PAST'; END IF;
  SELECT * INTO v_doc FROM public.doctors
    WHERE id = p_doctor_id AND is_published FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCTOR_NOT_AVAILABLE'; END IF;
  IF EXISTS (SELECT 1 FROM public.doctor_blocked_days b
    WHERE b.doctor_id = p_doctor_id AND b.blocked_date = v_local::date) THEN
    RAISE EXCEPTION 'DOCTOR_ON_LEAVE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.doctor_availability w
    WHERE w.doctor_id = p_doctor_id AND w.weekday = v_dow
      AND v_time >= w.start_time
      AND v_time + make_interval(mins => v_doc.slot_minutes) <= w.end_time
      AND (EXTRACT(EPOCH FROM (v_time - w.start_time))::bigint % (v_doc.slot_minutes * 60)) = 0) THEN
    RAISE EXCEPTION 'SLOT_NOT_AVAILABLE';
  END IF;
  IF EXISTS (SELECT 1 FROM public.appointments a
    WHERE a.doctor_id = p_doctor_id AND a.status IN ('booked','completed','no_show')
      AND tstzrange(a.slot_start, a.slot_start + make_interval(mins => a.duration_minutes), '[)') &&
          tstzrange(p_slot_start, p_slot_start + make_interval(mins => v_doc.slot_minutes), '[)')) THEN
    RAISE EXCEPTION 'SLOT_TAKEN';
  END IF;
  BEGIN
    INSERT INTO public.appointments(doctor_id, patient_id, patient_name, patient_phone, slot_start, duration_minutes)
    VALUES (p_doctor_id, v_uid, trim(p_patient_name), p_patient_phone, p_slot_start, v_doc.slot_minutes)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'SLOT_TAKEN';
  END;
  RETURN v_id;
END;
$$;

-- Same restriction for student/group bookings.
CREATE OR REPLACE FUNCTION public.enroll_in_group(
  p_group_id uuid,
  p_student_name text,
  p_student_phone text,
  p_student_grade text,
  p_booked_for_child boolean
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_student_name, ''));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'admin') THEN
    RAISE EXCEPTION 'ADMIN_CANNOT_BOOK';
  END IF;
  IF char_length(v_name) < 2 THEN RAISE EXCEPTION 'INVALID_NAME'; END IF;
  IF coalesce(p_student_phone, '') !~ '^01[0125][0-9]{8}$' THEN
    RAISE EXCEPTION 'INVALID_PHONE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_groups g
    JOIN public.teachers t ON t.id = g.teacher_id
    WHERE g.id = p_group_id AND g.is_published AND t.is_published
  ) THEN
    RAISE EXCEPTION 'GROUP_NOT_AVAILABLE';
  END IF;
  BEGIN
    RETURN public._reserve_group_seat(
      p_group_id, v_uid, v_name, p_student_phone,
      left(trim(coalesce(p_student_grade, '')), 60),
      coalesce(p_booked_for_child, false), false
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ALREADY_ENROLLED';
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.book_appointment(uuid,timestamptz,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid,timestamptz,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.enroll_in_group(uuid,text,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enroll_in_group(uuid,text,text,text,boolean) TO authenticated;

COMMIT;

-- Role separation is completed by ADMIN_SWITCH_TO_OWNER_ACCOUNT.sql.
-- Until then the previously mixed doctor+admin account remains unchanged.
