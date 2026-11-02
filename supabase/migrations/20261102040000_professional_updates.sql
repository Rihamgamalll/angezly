-- V18: professional announcements stay in the profile, separate from operational appointments.
-- Run AFTER the original core schema and V17. Never use a service key in the frontend.
BEGIN;
CREATE TABLE IF NOT EXISTS public.professional_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('doctor','teacher')),
  professional_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 80),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 5 AND 600),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS professional_updates_owner_idx ON public.professional_updates (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS professional_updates_public_idx ON public.professional_updates (kind, professional_id, created_at DESC);
ALTER TABLE public.professional_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.professional_updates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.professional_updates TO anon, authenticated;
GRANT INSERT, DELETE ON public.professional_updates TO authenticated;

DROP POLICY IF EXISTS professional_updates_public_read ON public.professional_updates;
CREATE POLICY professional_updates_public_read ON public.professional_updates
FOR SELECT TO anon,authenticated USING (
  (kind='doctor' AND EXISTS (SELECT 1 FROM public.doctors d WHERE d.id=professional_id AND d.is_published))
  OR (kind='teacher' AND EXISTS (SELECT 1 FROM public.teachers t WHERE t.id=professional_id AND t.is_published))
);
DROP POLICY IF EXISTS professional_updates_owner_read ON public.professional_updates;
CREATE POLICY professional_updates_owner_read ON public.professional_updates
FOR SELECT TO authenticated USING (owner_user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS professional_updates_owner_insert ON public.professional_updates;
CREATE POLICY professional_updates_owner_insert ON public.professional_updates
FOR INSERT TO authenticated WITH CHECK (
  owner_user_id = (SELECT auth.uid())
  AND COALESCE((SELECT auth.jwt()->>'is_anonymous'), 'false') <> 'true'
  AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=(SELECT auth.uid()) AND r.role='admin')
  AND (
    (kind='doctor' AND EXISTS (SELECT 1 FROM public.doctors d WHERE d.id=professional_id AND d.user_id=(SELECT auth.uid())))
    OR (kind='teacher' AND EXISTS (SELECT 1 FROM public.teachers t WHERE t.id=professional_id AND t.user_id=(SELECT auth.uid())))
  )
);
DROP POLICY IF EXISTS professional_updates_owner_delete ON public.professional_updates;
CREATE POLICY professional_updates_owner_delete ON public.professional_updates
FOR DELETE TO authenticated USING (
  owner_user_id=(SELECT auth.uid())
  AND (
    (kind='doctor' AND EXISTS (SELECT 1 FROM public.doctors d WHERE d.id=professional_id AND d.user_id=(SELECT auth.uid())))
    OR (kind='teacher' AND EXISTS (SELECT 1 FROM public.teachers t WHERE t.id=professional_id AND t.user_id=(SELECT auth.uid())))
  )
);
COMMIT;
