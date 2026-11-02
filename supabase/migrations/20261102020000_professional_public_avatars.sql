-- V15: public professional profile photos with owner-only upload/delete.
-- Run AFTER 20261102010000_professional_profiles_credentials.sql.
-- Avatars are public; credential evidence remains PRIVATE in professional-evidence.

ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS photo_url text;
GRANT UPDATE (photo_url) ON public.doctors TO authenticated;
GRANT UPDATE (photo_url) ON public.teachers TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'professional-avatars', 'professional-avatars', true, 2097152,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS dawrak_avatar_insert_owner ON storage.objects;
CREATE POLICY dawrak_avatar_insert_owner ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'professional-avatars'
  AND (auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true'
  AND (
    (
      (storage.foldername(name))[1] = 'doctor'
      AND EXISTS (
        SELECT 1 FROM public.doctors d
        WHERE d.id::text = (storage.foldername(name))[2] AND d.user_id = auth.uid()
      )
    )
    OR
    (
      (storage.foldername(name))[1] = 'teacher'
      AND EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.id::text = (storage.foldername(name))[2] AND t.user_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS dawrak_avatar_delete_owner ON storage.objects;
CREATE POLICY dawrak_avatar_delete_owner ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'professional-avatars'
  AND (auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true'
  AND (
    ((storage.foldername(name))[1] = 'doctor' AND EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id::text = (storage.foldername(name))[2] AND d.user_id = auth.uid()
    ))
    OR
    ((storage.foldername(name))[1] = 'teacher' AND EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id::text = (storage.foldername(name))[2] AND t.user_id = auth.uid()
    ))
  )
);
-- Public bucket: getPublicUrl() is readable by guests. WRITE access is owner-only.
-- RLS table UPDATE policies for doctor/teacher owner remain active.
