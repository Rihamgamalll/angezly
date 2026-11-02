-- المرحلة 2: بعد التأكد من دخول الحساب الجديد إلى /admin برمز المصادقة بنجاح.
-- واحتفاظك بنسخة احتياطية واسترجاع الوصول للطوارئ.
-- استبدلي PUT_NEW_ADMIN_EMAIL_HERE بالبريد المستخدم في المرحلة الأولى.
-- يحتفظ هذا الكود بملف الطبيب وحجوزاته كما هي، ويزيل دور admin من الحساب القديم فقط.
BEGIN;
DO $admin$
DECLARE
  v_email text := lower(trim('PUT_NEW_ADMIN_EMAIL_HERE'));
  v_new uuid;
  v_old uuid;
  v_admin_count integer;
BEGIN
  IF v_email = 'put_new_admin_email_here' THEN
    RAISE EXCEPTION 'REPLACE_THE_NEW_ADMIN_EMAIL_FIRST';
  END IF;
  SELECT id INTO v_new FROM auth.users WHERE lower(email) = v_email AND email_confirmed_at IS NOT NULL;
  IF v_new IS NULL THEN RAISE EXCEPTION 'NEW_OWNER_USER_NOT_FOUND'; END IF;
  SELECT count(DISTINCT user_id) INTO v_admin_count FROM public.user_roles WHERE role='admin';
  IF v_admin_count <> 2 THEN RAISE EXCEPTION 'EXPECTED_TWO_ADMINS_BEFORE_CUTOVER_GOT_%', v_admin_count; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_new AND role='admin') THEN
    RAISE EXCEPTION 'NEW_USER_NOT_ADMIN';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_new AND role IN ('doctor','teacher'))
     OR EXISTS (SELECT 1 FROM public.doctors WHERE user_id=v_new)
     OR EXISTS (SELECT 1 FROM public.teachers WHERE user_id=v_new) THEN
    RAISE EXCEPTION 'NEW_ADMIN_IS_NOT_ISOLATED';
  END IF;
  SELECT r.user_id INTO v_old FROM public.user_roles r
  WHERE r.role='admin' AND r.user_id<>v_new;
  IF v_old IS NULL THEN RAISE EXCEPTION 'OLD_ADMIN_NOT_FOUND'; END IF;
  -- No doctors, teachers, or appointments are deleted or reassigned.
  DELETE FROM public.user_roles WHERE user_id=v_old AND role='admin';
  SELECT count(DISTINCT user_id) INTO v_admin_count FROM public.user_roles WHERE role='admin';
  IF v_admin_count <> 1 THEN RAISE EXCEPTION 'CUTOVER_FAILED_AND_ROLLED_BACK'; END IF;
  RAISE NOTICE 'One dedicated administrator remains. Old professional account preserved.';
END;
$admin$;
COMMIT;

-- Check (read only): expected 1 admin / 0 mixed roles / 0 professional profiles:
WITH admins AS (
 SELECT DISTINCT user_id FROM public.user_roles WHERE role='admin'
)
SELECT
 (SELECT count(*) FROM admins) AS admin_count,
 (SELECT count(*) FROM admins a JOIN public.user_roles r ON a.user_id=r.user_id AND r.role IN ('doctor','teacher')) AS mixed_roles,
 (SELECT count(*) FROM admins a JOIN public.doctors d ON a.user_id=d.user_id) AS doctor_profiles,
 (SELECT count(*) FROM admins a JOIN public.teachers t ON a.user_id=t.user_id) AS teacher_profiles;
