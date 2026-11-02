-- One-time owner/admin account setup for دَوْرك.
-- 1) Run 20261101220000_admin_account_isolation.sql FIRST.
-- 2) Register a NEW account with a separate email via /signup.
-- 3) Copy the NEW account User UID from Supabase → Authentication → Users.
-- 4) Replace NEW_ADMIN_USER_UID below (keep the single quotes).
-- 5) Run ONLY ONCE in SQL Editor, in the test project.
-- This keeps the original doctor's profile, published status, and bookings.

DO $$
DECLARE
  v_new_owner uuid := 'NEW_ADMIN_USER_UID'; -- replace this value with new UID
  v_previous_admin uuid;
  v_mixed_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_new_owner) THEN
    RAISE EXCEPTION 'NEW_ADMIN_USER_NOT_FOUND';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles
             WHERE user_id = v_new_owner AND role IN ('doctor', 'teacher')) THEN
    RAISE EXCEPTION 'NEW_OWNER_MUST_NOT_BE_A_PROVIDER';
  END IF;

  -- Identify the current mixed doctor/teacher+admin account automatically.
  SELECT COUNT(DISTINCT a.user_id)
  INTO v_mixed_count
  FROM public.user_roles a
  WHERE a.role = 'admin'
    AND EXISTS (SELECT 1 FROM public.user_roles p
                WHERE p.user_id = a.user_id AND p.role IN ('doctor','teacher'));

  IF v_mixed_count <> 1 THEN
    RAISE EXCEPTION 'EXPECTED_EXACTLY_ONE_EXISTING_MIXED_ADMIN_FOUND_%', v_mixed_count;
  END IF;

  SELECT a.user_id INTO v_previous_admin
  FROM public.user_roles a
  WHERE a.role = 'admin'
    AND EXISTS (SELECT 1 FROM public.user_roles p
                WHERE p.user_id = a.user_id AND p.role IN ('doctor','teacher'))
  LIMIT 1;

  IF v_previous_admin = v_new_owner THEN
    RAISE EXCEPTION 'NEW_ADMIN_MUST_BE_A_DIFFERENT_ACCOUNT';
  END IF;

  -- Promote the new dedicated owner account; demote the OLD mixed account
  -- to its professional role, without changing the professional profile.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_new_owner, 'admin') ON CONFLICT DO NOTHING;

  DELETE FROM public.user_roles
  WHERE user_id = v_previous_admin AND role = 'admin';

  RAISE NOTICE 'Dedicated admin account created; old professional account retained.';
END;
$$;

-- Read-only verification: exactly one role for the new admin and the former
-- doctor's role should be present without the admin role.
SELECT role, COUNT(*) AS accounts
FROM public.user_roles
GROUP BY role
ORDER BY role;
