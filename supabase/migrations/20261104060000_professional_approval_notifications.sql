-- Notify a professional when publication approval changes.
-- Does not automatically approve unverified credentials.
CREATE OR REPLACE FUNCTION public.notify_professional_publication_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.is_published IS DISTINCT FROM NEW.is_published AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, category)
    VALUES (NEW.user_id,
      CASE WHEN NEW.is_published THEN 'تم قبول حسابك في أنجزلي' ELSE 'تم إيقاف نشر حسابك' END,
      CASE WHEN NEW.is_published THEN 'حسابك اتراجع واتنشر على أنجزلي. تقدر تدخل على صفحتك دلوقتي.' ELSE 'تم إيقاف ظهور صفحتك مؤقتًا. راجع الإدارة لمزيد من التفاصيل.' END,
      'professional_approval');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_doctor_publication ON public.doctors;
CREATE TRIGGER notify_doctor_publication AFTER UPDATE OF is_published ON public.doctors
FOR EACH ROW EXECUTE FUNCTION public.notify_professional_publication_change();
DROP TRIGGER IF EXISTS notify_teacher_publication ON public.teachers;
CREATE TRIGGER notify_teacher_publication AFTER UPDATE OF is_published ON public.teachers
FOR EACH ROW EXECUTE FUNCTION public.notify_professional_publication_change();
REVOKE ALL ON FUNCTION public.notify_professional_publication_change() FROM PUBLIC, anon, authenticated;
