/*
# Seed fictional demonstration data

1. Plain-English summary
- Adds 4 fictional doctors, 4 fictional teachers, weekly clinic hours and 6 teaching groups.
- Adds fictional student enrollments so the groups show realistic seat counts.
- Every seeded record is marked as demonstration content (is_demo = true) and is clearly fictional.
- The script can be run again safely. Existing records with the same identifiers are left untouched.

2. Records added
- doctors: 4 published fictional doctors (is_demo = true).
- doctor_availability: Saturday to Thursday, 16:00 to 21:00, for each demo doctor.
- teachers: 4 published fictional teachers (is_demo = true).
- teacher_groups: 6 published groups. Group seat counts: 18/20 (2 open), 15/15 (full), 10/25 (15 open), plus 3 other groups.
- group_enrollments: fictional student enrollments matching those counts.
- Seat counters on the seeded groups are recalculated from the enrollment records.

3. Security
- No real user accounts, phone numbers or personal records are created or changed.
- Demo rows have no owning user account, so nobody can manage them through a dashboard.
- Phone numbers use the reserved fictional range 0100000xxxx.

4. Important notes
- Demo data can be removed later by deleting rows where is_demo is true.
*/

INSERT INTO public.doctors (slug, full_name, specialty, qualifications, bio, photo_url, clinic_name, governorate, city, area, clinic_address, consultation_price, slot_minutes, is_published, is_demo)
VALUES
  ('ahmed-ali', 'د. أحمد علي', 'باطنة', 'بكالوريوس طب وجراحة — جامعة المنصورة. دبلومة باطنة وسكر.', 'استشاري باطنة وأمراض السكر، بيكشف على الضغط والسكر والمتابعة الدورية.', 'https://images.pexels.com/photos/19601385/pexels-photo-19601385.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'عيادة الشفاء', 'الدقهلية', 'المنصورة', 'الجامعة', 'شارع جيهان — بجوار مول المنصورة', 250, 15, true, true),
  ('mohamed-ali', 'د. محمد سامي', 'أطفال', 'بكالوريوس طب — جامعة عين شمس. ماجستير طب الأطفال.', 'متابعة نمو الأطفال والتطعيمات وعلاج نزلات البرد والحساسية.', 'https://images.pexels.com/photos/29995629/pexels-photo-29995629.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'مركز النور للأطفال', 'القاهرة', 'مدينة نصر', 'الحي الثامن', 'شارع عباس العقاد — أمام نادي الشمس', 300, 20, true, true),
  ('nour-hassan', 'د. نور حسن', 'جلدية', 'بكالوريوس طب — جامعة القاهرة. دبلومة الأمراض الجلدية.', 'علاج حب الشباب والأكزيما والعناية ببشرة الوجه والشعر.', 'https://images.pexels.com/photos/37272329/pexels-photo-37272329.png?auto=compress&cs=tinysrgb&h=650&w=940', 'عيادة بشرة وجمال', 'الجيزة', 'الدقي', 'شارع التحرير', 'شارع التحرير — بجوار محطة مترو الدقي', 350, 30, true, true),
  ('tarek-fathy', 'د. طارق فتحي', 'عظام', 'بكالوريوس طب وجراحة — جامعة الإسكندرية. زمالة جراحة العظام.', 'إصابات الملاعب والكسور ومشاكل الفقرات والمفاصل.', 'https://images.pexels.com/photos/30269649/pexels-photo-30269649.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'مركز سموحة الطبي', 'الإسكندرية', 'سموحة', 'شارع فوزي معاذ', 'شارع فوزي معاذ — مركز سموحة الطبي', 400, 20, true, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.doctor_availability (doctor_id, weekday, start_time, end_time)
SELECT d.id, w.weekday, time '16:00', time '21:00'
FROM public.doctors d
CROSS JOIN (VALUES (6), (0), (1), (2), (3), (4)) AS w(weekday)
WHERE d.is_demo
  AND NOT EXISTS (SELECT 1 FROM public.doctor_availability a WHERE a.doctor_id = d.id);

INSERT INTO public.teachers (slug, full_name, bio, photo_url, subjects, stages, governorate, city, area, teaching_location, experience_years, teaches_online, teaches_offline, is_published, is_demo)
VALUES
  ('ahmed-mohamed', 'أ/ أحمد محمد', 'مُدرّس رياضيات بخبرة أكتر من 12 سنة في الثانوية العامة. بيركز على الفهم وحل المسائل خطوة بخطوة.', 'https://images.pexels.com/photos/8617769/pexels-photo-8617769.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', ARRAY['الرياضيات', 'الفيزياء'], ARRAY['preparatory', 'secondary'], 'الدقهلية', 'المنصورة', 'شارع الجمهورية', 'سنتر المنصورة التعليمي — شارع الجمهورية', 12, true, true, true, true),
  ('mona-hassan', 'أ/ منى حسن', 'مُدرّسة لغة عربية للمراحل الإعدادية والثانوية، بتحب تخلّي الطالب يحب القراءة والتعبير.', 'https://images.pexels.com/photos/16160869/pexels-photo-16160869.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', ARRAY['اللغة العربية'], ARRAY['preparatory', 'secondary'], 'القاهرة', 'مدينة نصر', 'الحي السابع', 'مركز المعرفة — مدينة نصر', 8, true, true, true, true),
  ('karim-saeed', 'أ/ كريم سعيد', 'مُدرّس فيزياء وكيمياء، بيشرح بالتجارب والأمثلة من الحياة اليومية.', 'https://images.pexels.com/photos/16160952/pexels-photo-16160952.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', ARRAY['الفيزياء', 'الكيمياء'], ARRAY['secondary'], 'الإسكندرية', 'سموحة', 'شارع سعد زغلول', 'مجموعة النجاح التعليمية — سموحة', 10, false, true, true, true),
  ('salma-adel', 'أ/ سلمى عادل', 'مُدرّسة لغة إنجليزية، متخصصة في المحادثة وتأسيس القواعد للمرحلة الإعدادية.', 'https://images.pexels.com/photos/8617961/pexels-photo-8617961.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', ARRAY['اللغة الإنجليزية'], ARRAY['preparatory', 'primary'], 'الجيزة', 'الهرم', 'شارع الأهرام', 'مركز الهرم التعليمي', 6, true, true, true, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.teacher_groups (id, teacher_id, name, subject, stage, grade, mode, location, weekdays, start_time, end_time, start_date, price, price_period, capacity, description, registration_open, is_published, is_demo)
VALUES
  ('a1000000-0000-4000-8000-000000000001', (SELECT id FROM public.teachers WHERE slug = 'ahmed-mohamed'), 'رياضيات — تالتة ثانوي', 'الرياضيات', 'secondary', 'تالتة ثانوي', 'offline', 'سنتر المنصورة التعليمي — شارع الجمهورية', ARRAY[0, 3]::smallint[], time '18:00', time '19:30', date '2026-09-01', 300, 'month', 20, 'مراجعة شاملة للمنهج مع حصص حل امتحانات.', true, true, true),
  ('a1000000-0000-4000-8000-000000000002', (SELECT id FROM public.teachers WHERE slug = 'ahmed-mohamed'), 'رياضيات — تانية ثانوي', 'الرياضيات', 'secondary', 'تانية ثانوي', 'offline', 'سنتر المنصورة التعليمي — شارع الجمهورية', ARRAY[1, 4]::smallint[], time '16:00', time '17:30', date '2026-09-01', 280, 'month', 15, 'شرح المنهج مع تمارين أسبوعية.', true, true, true),
  ('a1000000-0000-4000-8000-000000000003', (SELECT id FROM public.teachers WHERE slug = 'ahmed-mohamed'), 'رياضيات — أولى ثانوي', 'الرياضيات', 'secondary', 'أولى ثانوي', 'online', '', ARRAY[2, 6]::smallint[], time '17:00', time '18:30', date '2026-09-01', 250, 'month', 25, 'حصص أونلاين مسجلة ومباشرة لأساسيات الجبر والهندسة.', true, true, true),
  ('a1000000-0000-4000-8000-000000000004', (SELECT id FROM public.teachers WHERE slug = 'mona-hassan'), 'عربي — تانية إعدادي', 'اللغة العربية', 'preparatory', 'تانية إعدادي', 'offline', 'مركز المعرفة — مدينة نصر', ARRAY[4, 6]::smallint[], time '17:00', time '18:00', date '2026-09-01', 200, 'month', 12, 'نحو وإملاء وقراءة وتعبير.', true, true, true),
  ('a1000000-0000-4000-8000-000000000005', (SELECT id FROM public.teachers WHERE slug = 'karim-saeed'), 'فيزياء — تالتة ثانوي', 'الفيزياء', 'secondary', 'تالتة ثانوي', 'offline', 'مجموعة النجاح التعليمية — سموحة', ARRAY[0, 2]::smallint[], time '19:00', time '20:30', date '2026-09-01', 320, 'month', 18, 'ميكانيكا وكهربا مع حل مسائل الامتحانات.', true, true, true),
  ('a1000000-0000-4000-8000-000000000006', (SELECT id FROM public.teachers WHERE slug = 'salma-adel'), 'English — أولى إعدادي', 'اللغة الإنجليزية', 'preparatory', 'أولى إعدادي', 'online', '', ARRAY[1, 3]::smallint[], time '18:00', time '19:00', date '2026-09-01', 180, 'month', 30, 'محادثة وقواعد أساسية أونلاين.', true, true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_enrollments (group_id, student_name, student_phone, student_grade, is_demo, booking_ref)
SELECT
  v.group_id,
  'طالب تجريبي ' || s.i,
  '0100000' || lpad(v.group_no::text || s.i::text, 4, '0'),
  'طالب تجريبي',
  true,
  'DW-DEMO-' || v.group_no || '-' || lpad(s.i::text, 3, '0')
FROM (VALUES
  ('a1000000-0000-4000-8000-000000000001'::uuid, 18, 1),
  ('a1000000-0000-4000-8000-000000000002'::uuid, 15, 2),
  ('a1000000-0000-4000-8000-000000000003'::uuid, 10, 3),
  ('a1000000-0000-4000-8000-000000000004'::uuid, 4, 4),
  ('a1000000-0000-4000-8000-000000000005'::uuid, 9, 5),
  ('a1000000-0000-4000-8000-000000000006'::uuid, 22, 6)
) AS v(group_id, enrolled, group_no)
CROSS JOIN LATERAL generate_series(1, v.enrolled) AS s(i)
ON CONFLICT (booking_ref) DO NOTHING;

UPDATE public.teacher_groups g
SET active_enrollments = (
  SELECT count(*) FROM public.group_enrollments e
  WHERE e.group_id = g.id AND e.status = 'active'
)
WHERE g.is_demo;
