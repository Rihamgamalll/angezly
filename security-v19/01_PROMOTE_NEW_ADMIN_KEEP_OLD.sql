-- المرحلة 1: إنشاء حساب إدارة جديد دون حذف الأدمن القديم.
-- شرط أساسي: إنشاء مستخدم جديد مستقل باختيار «زائر» وتأكيد بريده الإلكتروني.
-- ابدلي PUT_NEW_ADMIN_EMAIL_HERE بالبريد الجديد. هذا الكود للتنفيذ اليدوي في SQL Editor فقط.
-- لا تشغليه في قاعدة أخرى أو قبل الاحتفاظ بنسخة احتياطية.
BEGIN;
DO $admin$
DECLARE
  v_email text := lower(trim('PUT_NEW_ADMIN_EMAIL_HERE'));
  v_new uuid;
  v_admins integer;
BEGIN
  IF v_email = 'put_new_admin_email_here' THEN
    RAISE EXCEPTION 'REPLACE_THE_NEW_ADMIN_EMAIL_FIRST';
  END IF;
  SELECT u.id INTO v_new
  FROM auth.users u
  WHERE lower(u.email) = v_email AND u.email_confirmed_at IS NOT NULL;
  IF v_new IS NULL THEN
    RAISE EXCEPTION 'NEW_CONFIRMED_AUTH_USER_NOT_FOUND';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles r
             WHERE r.user_id = v_new AND r.role IN ('doctor','teacher'))
     OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.user_id = v_new)
     OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.user_id = v_new) THEN
    RAISE EXCEPTION 'NEW_ADMIN_MUST_NOT_HAVE_A_PROFESSIONAL_ACCOUNT';
  END IF;
  SELECT count(DISTINCT user_id) INTO v_admins FROM public.user_roles WHERE role = 'admin';
  IF v_admins <> 1 THEN
    RAISE EXCEPTION 'EXPECTED_EXACTLY_ONE_EXISTING_ADMIN_GOT_%', v_admins;
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_new AND r.role = 'admin') THEN
    RAISE EXCEPTION 'NEW_ACCOUNT_IS_ALREADY_ADMIN';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_new, 'admin');
  RAISE NOTICE 'Temporary state: TWO admins. Keep the old account until MFA is tested.';
END;
$admin$;
COMMIT;

-- Verifying query (does not display emails):
SELECT role::text, count(DISTINCT user_id) AS account_count
FROM public.user_roles
WHERE role = 'admin'
GROUP BY role;
