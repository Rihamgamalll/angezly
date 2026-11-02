-- قراءة فقط. راجعي النتائج ولا تمنحي دور admin بواسطة حساب عادي.
SELECT 'doctors' AS table_name, c.relrowsecurity AS rls_enabled,
 (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='doctors') AS policy_count
FROM pg_class c WHERE c.oid='public.doctors'::regclass
UNION ALL SELECT 'teachers', c.relrowsecurity,
 (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='teachers')
FROM pg_class c WHERE c.oid='public.teachers'::regclass
UNION ALL SELECT 'appointments', c.relrowsecurity,
 (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='appointments')
FROM pg_class c WHERE c.oid='public.appointments'::regclass
UNION ALL SELECT 'group_enrollments', c.relrowsecurity,
 (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='group_enrollments')
FROM pg_class c WHERE c.oid='public.group_enrollments'::regclass
UNION ALL SELECT 'user_roles', c.relrowsecurity,
 (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='user_roles')
FROM pg_class c WHERE c.oid='public.user_roles'::regclass;
-- RLS ON وسياسات موجودة شرط مبدئي فقط؛ تحتاج اختبار allow/deny لكل مستخدم.

SELECT
  has_table_privilege('authenticated', 'public.user_roles', 'INSERT') AS authenticated_can_directly_insert_roles,
  has_table_privilege('anon', 'public.user_roles', 'INSERT') AS visitor_can_directly_insert_roles,
  (
    SELECT count(*) FROM (
      SELECT user_id FROM public.user_roles
      GROUP BY user_id
      HAVING bool_or(role = 'admin') AND bool_or(role IN ('doctor','teacher'))
    ) mixed_roles
  ) AS accounts_mixing_admin_and_professional_roles;
-- المتوقع: false / false / 0. إذا كانت آخر قيمة أكبر من صفر، افصل الحسابات بحذر بعد مراجعة المالك.
