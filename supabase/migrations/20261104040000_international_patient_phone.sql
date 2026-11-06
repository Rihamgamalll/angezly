-- STAGING FIRST. International E.164 phone numbers, 8-15 digits after +.
-- Preserves the existing book_appointment body, changing only its phone validation.
BEGIN;
DO $$
DECLARE
  v_oid oid := to_regprocedure('public.book_appointment(uuid,timestamp with time zone,text,text)');
  v_def text;
  v_new text;
BEGIN
  IF v_oid IS NULL THEN RAISE EXCEPTION 'book_appointment signature not found; no changes made'; END IF;
  SELECT pg_get_functiondef(v_oid) INTO v_def;
  -- Only proceed when the exact legacy Egyptian-only validator is present.
  IF position('^01[0125][0-9]{8}$' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Unexpected booking validator; no changes made. Review function manually.';
  END IF;
  v_new := replace(v_def, '^01[0125][0-9]{8}$', '^\+[1-9][0-9]{7,14}$');
  EXECUTE v_new;
END $$;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_patient_phone_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_patient_phone_check
  CHECK (patient_phone ~ '^\+[1-9][0-9]{7,14}$' OR patient_phone ~ '^01[0125][0-9]{8}$');
COMMIT;
