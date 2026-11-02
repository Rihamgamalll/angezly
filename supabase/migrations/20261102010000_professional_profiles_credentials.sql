-- Dawrak V14: optional professional story, visitor instructions, private credentials.
-- Run ONCE after all existing migrations in Supabase SQL Editor.
-- Do not make the evidence bucket public: review proof may contain private information.

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS visitor_note text NOT NULL DEFAULT '';
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS credentials_summary text NOT NULL DEFAULT '';
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS visitor_note text NOT NULL DEFAULT '';

GRANT UPDATE (visitor_note) ON public.doctors TO authenticated;
GRANT UPDATE (credentials_summary, visitor_note) ON public.teachers TO authenticated;

CREATE TABLE IF NOT EXISTS public.professional_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 150),
  issuer text NOT NULL DEFAULT '' CHECK (char_length(issuer) <= 120),
  issued_year integer CHECK (issued_year BETWEEN 1950 AND 2100),
  file_path text NOT NULL UNIQUE CHECK (char_length(file_path) BETWEEN 10 AND 300),
  visible_on_profile boolean NOT NULL DEFAULT true,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professional_credential_one_owner CHECK (
    (doctor_id IS NOT NULL AND teacher_id IS NULL) OR
    (doctor_id IS NULL AND teacher_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS professional_credentials_doctor_idx ON public.professional_credentials (doctor_id, review_status);
CREATE INDEX IF NOT EXISTS professional_credentials_teacher_idx ON public.professional_credentials (teacher_id, review_status);
ALTER TABLE public.professional_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.professional_credentials FROM anon, authenticated;
GRANT SELECT, DELETE ON public.professional_credentials TO authenticated;
GRANT INSERT (doctor_id, teacher_id, title, issuer, issued_year, file_path, visible_on_profile)
 ON public.professional_credentials TO authenticated;

DROP POLICY IF EXISTS credential_read_owner_admin ON public.professional_credentials;
CREATE POLICY credential_read_owner_admin ON public.professional_credentials
 FOR SELECT TO authenticated USING (
   EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid())
   OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid())
   OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
 );
DROP POLICY IF EXISTS credential_insert_owner ON public.professional_credentials;
CREATE POLICY credential_insert_owner ON public.professional_credentials
 FOR INSERT TO authenticated WITH CHECK (
   (doctor_id IS NOT NULL
    AND file_path LIKE ('doctor/' || doctor_id::text || '/%')
    AND EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid()))
   OR (teacher_id IS NOT NULL
    AND file_path LIKE ('teacher/' || teacher_id::text || '/%')
    AND EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid()))
 );
DROP POLICY IF EXISTS credential_delete_owner ON public.professional_credentials;
CREATE POLICY credential_delete_owner ON public.professional_credentials
 FOR DELETE TO authenticated USING (
   EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid())
   OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid())
 );

-- Private storage: neither original scans nor document filenames are exposed publicly.
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('professional-evidence', 'professional-evidence', false, 5242880,
        ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS professional_evidence_upload_owner ON storage.objects;
CREATE POLICY professional_evidence_upload_owner ON storage.objects
 FOR INSERT TO authenticated WITH CHECK (
   bucket_id = 'professional-evidence'
   AND EXISTS (
      SELECT 1 FROM public.professional_credentials c
      WHERE c.file_path = name AND c.review_status = 'pending'
      AND (
         EXISTS (SELECT 1 FROM public.doctors d WHERE d.id=c.doctor_id AND d.user_id=auth.uid())
         OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id=c.teacher_id AND t.user_id=auth.uid())
      )
   )
 );
DROP POLICY IF EXISTS professional_evidence_read_owner_admin ON storage.objects;
CREATE POLICY professional_evidence_read_owner_admin ON storage.objects
 FOR SELECT TO authenticated USING (
    bucket_id = 'professional-evidence'
    AND EXISTS (
      SELECT 1 FROM public.professional_credentials c WHERE c.file_path=name
        AND (
           EXISTS (SELECT 1 FROM public.doctors d WHERE d.id=c.doctor_id AND d.user_id=auth.uid())
           OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id=c.teacher_id AND t.user_id=auth.uid())
           OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role='admin')
        )
    )
 );
DROP POLICY IF EXISTS professional_evidence_delete_owner ON storage.objects;
CREATE POLICY professional_evidence_delete_owner ON storage.objects
 FOR DELETE TO authenticated USING (
    bucket_id='professional-evidence'
    AND EXISTS (
      SELECT 1 FROM public.professional_credentials c WHERE c.file_path=name
        AND (
          EXISTS (SELECT 1 FROM public.doctors d WHERE d.id=c.doctor_id AND d.user_id=auth.uid())
          OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id=c.teacher_id AND t.user_id=auth.uid())
        )
    )
 );

-- Public endpoint returns ONLY approved safe metadata, not any file paths.
CREATE OR REPLACE FUNCTION public.get_public_credentials(p_kind text, p_professional_id uuid)
RETURNS TABLE (id uuid, title text, issuer text, issued_year integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT c.id, c.title, c.issuer, c.issued_year
  FROM public.professional_credentials c
  WHERE c.review_status = 'approved' AND c.visible_on_profile = true
    AND (
      (p_kind='doctor' AND c.doctor_id=p_professional_id AND EXISTS (
        SELECT 1 FROM public.doctors d WHERE d.id=c.doctor_id AND d.is_published=true))
      OR (p_kind='teacher' AND c.teacher_id=p_professional_id AND EXISTS (
        SELECT 1 FROM public.teachers t WHERE t.id=c.teacher_id AND t.is_published=true))
    )
  ORDER BY c.created_at DESC
  LIMIT 25;
$$;
REVOKE ALL ON FUNCTION public.get_public_credentials(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_credentials(text, uuid) TO anon, authenticated;

-- Admin-only review: cannot be self-approved through client API.
CREATE OR REPLACE FUNCTION public.review_professional_credential(p_credential_id uuid, p_decision text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Invalid review decision';
  END IF;
  UPDATE public.professional_credentials c
    SET review_status = p_decision, reviewed_at = now()
    WHERE c.id = p_credential_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credential not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.review_professional_credential(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_professional_credential(uuid, text) TO authenticated;
