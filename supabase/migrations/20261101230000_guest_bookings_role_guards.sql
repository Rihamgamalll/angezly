-- دَوْرك V9: public booking without signup, private provider workspaces.
-- Apply only AFTER the five original migrations and the V8 isolation migration.
-- Visitor booking is NOT a naked anon/public SQL RPC: the client first obtains a
-- temporary Supabase anonymous user session via auth.signInAnonymously().
-- The existing book_appointment/enroll_in_group RPCs remain authenticated-only,
-- with ownership-based RLS for private appointment and enrollment records.
-- Enable Anonymous Sign-ins in Supabase Auth settings separately.

BEGIN;

-- Temporary visitor identities must never register a doctor/teacher account.
-- This is enforced at the database layer even if someone bypasses the UI.
CREATE OR REPLACE FUNCTION public.reject_anonymous_professional_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' THEN
    RAISE EXCEPTION 'PROFESSIONAL_ACCOUNT_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS doctor_needs_permanent_account ON public.doctors;
CREATE TRIGGER doctor_needs_permanent_account
  BEFORE INSERT ON public.doctors FOR EACH ROW
  EXECUTE FUNCTION public.reject_anonymous_professional_insert();
DROP TRIGGER IF EXISTS teacher_needs_permanent_account ON public.teachers;
CREATE TRIGGER teacher_needs_permanent_account
  BEFORE INSERT ON public.teachers FOR EACH ROW
  EXECUTE FUNCTION public.reject_anonymous_professional_insert();

-- Reduce automated abuse in the temporary visitor flow. This is an additional
-- control, NOT a replacement for CAPTCHA/OTP + rate limiting before launch.
CREATE OR REPLACE FUNCTION public.guard_guest_appointment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' THEN
    IF NEW.patient_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'NOT_ALLOWED';
    END IF;
    IF (SELECT count(*) FROM public.appointments
        WHERE patient_id = auth.uid() AND created_at > now() - interval '24 hours') >= 5 THEN
      RAISE EXCEPTION 'GUEST_BOOKING_LIMIT';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guest_appointment_limit ON public.appointments;
CREATE TRIGGER guest_appointment_limit BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_guest_appointment_insert();

CREATE OR REPLACE FUNCTION public.guard_guest_group_enrollment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Duplicate active registrations for the same name and phone must be stopped
  -- even if a person opens the public link in another browser. The group row is
  -- locked by _reserve_group_seat before the insert, preventing last-seat races.
  IF EXISTS (SELECT 1 FROM public.group_enrollments e
             WHERE e.group_id = NEW.group_id AND e.status = 'active'
               AND lower(trim(e.student_name)) = lower(trim(NEW.student_name))
               AND e.student_phone = NEW.student_phone) THEN
    RAISE EXCEPTION 'ALREADY_ENROLLED';
  END IF;
  IF coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' THEN
    IF NEW.student_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'NOT_ALLOWED';
    END IF;
    IF (SELECT count(*) FROM public.group_enrollments
        WHERE student_id = auth.uid() AND created_at > now() - interval '24 hours') >= 5 THEN
      RAISE EXCEPTION 'GUEST_BOOKING_LIMIT';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guest_group_enrollment_limit ON public.group_enrollments;
CREATE TRIGGER guest_group_enrollment_limit BEFORE INSERT ON public.group_enrollments
FOR EACH ROW EXECUTE FUNCTION public.guard_guest_group_enrollment_insert();

REVOKE EXECUTE ON FUNCTION public.reject_anonymous_professional_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_guest_appointment_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_guest_group_enrollment_insert() FROM PUBLIC, anon, authenticated;

-- Explicitly keep write functions off the public anon API role.
REVOKE EXECUTE ON FUNCTION public.book_appointment(uuid,timestamptz,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enroll_in_group(uuid,text,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid,timestamptz,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_in_group(uuid,text,text,text,boolean) TO authenticated;

COMMIT;
