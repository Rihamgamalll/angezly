-- اختبار تجهيز قاعدة البيانات للنشر التجريبي (قراءة فقط)
-- شغليه من SQL Editor بعد V14 و V15؛ كل القيم أدناه ينبغي أن تكون true.
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='doctors' AND column_name='visitor_note') AS doctor_profile_ready,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='teachers' AND column_name='credentials_summary') AS teacher_profile_ready,
  to_regclass('public.professional_credentials') IS NOT NULL AS credentials_table_ready,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id='professional-evidence' AND public=false) AS private_documents_ready,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id='professional-avatars' AND public=true) AS public_photos_ready,
  to_regprocedure('public.enroll_in_group(uuid,text,text,text,boolean)') IS NOT NULL AS student_booking_rpc_ready,
  to_regprocedure('public.book_appointment(uuid,timestamp with time zone,text,text)') IS NOT NULL AS doctor_booking_rpc_ready;
-- لا يكفي ظهور true وحده: يلزم اختبار التسجيل والحجز وإلغاء الحجز والصلاحيات من متصفحات مختلفة.
