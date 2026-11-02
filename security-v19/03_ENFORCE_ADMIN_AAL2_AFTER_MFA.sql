-- المرحلة 3: شغّلي هذا الملف فقط بعد تجربة الدخول بحساب الأدمن الجديد مع MFA،
-- وبعد التحقق من تعريفات الدوال الحية ومطابقتها للموجودة في V18.
-- تفرض aal2 على عمليات اعتماد ملفات المحترفين والشهادات في قاعدة البيانات.
-- NOTE: This recreates two V18 RPC bodies; review before applying to a modified DB.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_set_professional_published(
 p_kind text, p_id uuid, p_published boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'MFA_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF p_kind = 'doctor' THEN
    UPDATE public.doctors SET is_published = p_published WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  ELSIF p_kind = 'teacher' THEN
    UPDATE public.teachers SET is_published = p_published WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  ELSE
    RAISE EXCEPTION 'INVALID_KIND';
  END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.admin_set_professional_published(text,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_professional_published(text,uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_professional_credential(
 p_credential_id uuid, p_decision text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'MFA_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Invalid review decision';
  END IF;
  UPDATE public.professional_credentials
  SET review_status = p_decision, reviewed_at = now()
  WHERE id = p_credential_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credential not found'; END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.review_professional_credential(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_professional_credential(uuid,text) TO authenticated;
COMMIT;
