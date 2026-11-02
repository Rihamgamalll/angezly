-- Run only after reviewing against your live production schema.
BEGIN;
ALTER TABLE public.group_enrollments
  ADD COLUMN IF NOT EXISTS guardian_phone text;
ALTER TABLE public.group_enrollments
  DROP CONSTRAINT IF EXISTS group_enrollments_guardian_phone_valid;
ALTER TABLE public.group_enrollments
  ADD CONSTRAINT group_enrollments_guardian_phone_valid
  CHECK (guardian_phone IS NULL OR guardian_phone ~ '^01[0125][0-9]{8}$');

-- A new RPC name avoids silently replacing an existing production booking function.
CREATE OR REPLACE FUNCTION public.enroll_in_group_with_guardian(
  p_group_id uuid, p_student_name text, p_student_phone text,
  p_student_grade text, p_booked_for_child boolean, p_guardian_phone text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ref text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF coalesce(p_guardian_phone,'') !~ '^01[0125][0-9]{8}$' THEN
    RAISE EXCEPTION 'INVALID_GUARDIAN_PHONE';
  END IF;
  IF p_student_phone = p_guardian_phone THEN
    RAISE EXCEPTION 'STUDENT_AND_GUARDIAN_PHONES_MUST_DIFFER';
  END IF;
  v_ref := public.enroll_in_group(
    p_group_id, p_student_name, p_student_phone,
    p_student_grade, p_booked_for_child
  );
  UPDATE public.group_enrollments
  SET guardian_phone = p_guardian_phone
  WHERE booking_ref = v_ref AND student_id = auth.uid() AND group_id = p_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;
  RETURN v_ref;
END;
$$;
REVOKE ALL ON FUNCTION public.enroll_in_group_with_guardian(uuid,text,text,text,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enroll_in_group_with_guardian(uuid,text,text,text,boolean,text) TO authenticated;
COMMIT;
