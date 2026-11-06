-- Website-only removal: does NOT delete Authentication, files, bookings or profiles.
BEGIN;
CREATE TABLE IF NOT EXISTS public.owner_removed_profiles (
  kind text NOT NULL CHECK (kind IN ('doctor','teacher')),
  profile_id uuid NOT NULL,
  removed_at timestamptz NOT NULL DEFAULT now(),
  removed_by uuid NOT NULL,
  PRIMARY KEY (kind, profile_id)
);
ALTER TABLE public.owner_removed_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_removed_profiles FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_remove_professional_from_site(p_kind text, p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid(); v_found uuid;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'admin'
  ) THEN RAISE EXCEPTION 'OWNER_ONLY' USING ERRCODE = '42501'; END IF;
  IF p_kind = 'doctor' THEN
    UPDATE public.doctors SET is_published = false WHERE id = p_id RETURNING id INTO v_found;
  ELSIF p_kind = 'teacher' THEN
    UPDATE public.teachers SET is_published = false WHERE id = p_id RETURNING id INTO v_found;
  ELSE RAISE EXCEPTION 'INVALID_KIND'; END IF;
  IF v_found IS NULL THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  INSERT INTO public.owner_removed_profiles(kind, profile_id, removed_by)
  VALUES (p_kind, p_id, v_uid)
  ON CONFLICT (kind, profile_id) DO UPDATE SET removed_at = now(), removed_by = EXCLUDED.removed_by;
END; $$;
REVOKE ALL ON FUNCTION public.owner_remove_professional_from_site(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_remove_professional_from_site(text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_list_removed_profiles()
RETURNS TABLE(kind text, profile_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN RAISE EXCEPTION 'OWNER_ONLY' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT r.kind, r.profile_id FROM public.owner_removed_profiles r;
END; $$;
REVOKE ALL ON FUNCTION public.owner_list_removed_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_list_removed_profiles() TO authenticated;
COMMIT;
