/*
# Dawrak core schema: accounts, doctors, teachers, bookings and group seats

1. Plain-English summary
- Creates the tables behind the two booking services: doctor appointments and teacher group enrollments.
- Creates a profile for every new account automatically at sign-up.
- Professionals (doctors and teachers) register through a secure function. New professional profiles stay hidden until an administrator approves them.
- Every booking, cancellation and seat change happens inside a database function that locks the row being changed. This stops two people from taking the last seat or the same appointment slot.

2. New tables
- profiles: one row per account (full name).
- user_roles: doctor, teacher or admin role per account. Users cannot write this table directly.
- doctors: public doctor profile with a unique public link slug, specialty, location and consultation price.
- doctor_availability: weekly working windows per doctor (weekday, start time, end time).
- appointments: patient bookings with a unique active-slot rule per doctor.
- teachers: public teacher profile with a unique public link slug, subjects and stages taught.
- teacher_groups: recurring teaching groups with capacity, price, schedule and a live count of active enrollments.
- group_enrollments: one active enrollment per student per group, with a booking reference.

3. Security
- Row level security is enabled on every table.
- Public visitors can read only published, approved profiles, published groups and public schedules.
- Signed-in users can read only their own bookings and their own private records. Teachers and doctors can read records of their own groups and clinic.
- Sensitive columns (approval status, live seat counts, roles, demo flags) cannot be changed by users through direct table writes. Column-level grants enforce this.
- Booking, cancellation and seat functions run with controlled rights and check ownership inside the function.

4. Important notes
- Times are interpreted in the Africa/Cairo time zone.
- Appointment and enrollment cancellation rules are enforced in the functions.
- Phone numbers must be valid Egyptian mobile numbers.
*/

-- ============================================================
-- Profiles and roles
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '' CHECK (char_length(full_name) <= 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE (full_name) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, left(trim(coalesce(NEW.raw_user_meta_data->>'full_name', '')), 120))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('doctor', 'teacher', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.user_roles TO authenticated;

DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Doctors
-- ============================================================

CREATE TABLE IF NOT EXISTS public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  specialty text NOT NULL CHECK (char_length(specialty) BETWEEN 2 AND 80),
  qualifications text NOT NULL DEFAULT '' CHECK (char_length(qualifications) <= 500),
  bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 1000),
  photo_url text CHECK (photo_url IS NULL OR photo_url ~ '^https://'),
  clinic_name text NOT NULL DEFAULT '' CHECK (char_length(clinic_name) <= 120),
  governorate text NOT NULL CHECK (char_length(governorate) BETWEEN 2 AND 60),
  city text NOT NULL DEFAULT '' CHECK (char_length(city) <= 60),
  area text NOT NULL DEFAULT '' CHECK (char_length(area) <= 60),
  clinic_address text NOT NULL DEFAULT '' CHECK (char_length(clinic_address) <= 250),
  consultation_price integer NOT NULL CHECK (consultation_price >= 0 AND consultation_price <= 100000),
  slot_minutes integer NOT NULL DEFAULT 15 CHECK (slot_minutes BETWEEN 5 AND 120),
  is_published boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS doctors_published_idx ON public.doctors (is_published, governorate);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.doctors TO anon, authenticated;
GRANT UPDATE (full_name, specialty, qualifications, bio, photo_url, clinic_name, governorate, city, area, clinic_address, consultation_price, slot_minutes)
  ON public.doctors TO authenticated;

DROP POLICY IF EXISTS "doctors_select_published" ON public.doctors;
CREATE POLICY "doctors_select_published" ON public.doctors FOR SELECT
  TO anon, authenticated USING (is_published);

DROP POLICY IF EXISTS "doctors_select_owner_or_admin" ON public.doctors;
CREATE POLICY "doctors_select_owner_or_admin" ON public.doctors FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  );

DROP POLICY IF EXISTS "doctors_update_owner" ON public.doctors;
CREATE POLICY "doctors_update_owner" ON public.doctors FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.doctor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS doctor_availability_doctor_idx ON public.doctor_availability (doctor_id);

ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.doctor_availability TO anon, authenticated;
GRANT INSERT, DELETE ON public.doctor_availability TO authenticated;

DROP POLICY IF EXISTS "availability_select_visible" ON public.doctor_availability;
CREATE POLICY "availability_select_visible" ON public.doctor_availability FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND (d.is_published OR d.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "availability_insert_owner" ON public.doctor_availability;
CREATE POLICY "availability_insert_owner" ON public.doctor_availability FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "availability_delete_owner" ON public.doctor_availability;
CREATE POLICY "availability_delete_owner" ON public.doctor_availability FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
  patient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_name text NOT NULL CHECK (char_length(patient_name) BETWEEN 2 AND 120),
  patient_phone text NOT NULL CHECK (patient_phone ~ '^01[0125][0-9]{8}$'),
  slot_start timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'completed', 'no_show', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_live_slot
  ON public.appointments (doctor_id, slot_start)
  WHERE status IN ('booked', 'completed', 'no_show');
CREATE INDEX IF NOT EXISTS appointments_patient_idx ON public.appointments (patient_id);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.appointments TO authenticated;

DROP POLICY IF EXISTS "appointments_select_party" ON public.appointments;
CREATE POLICY "appointments_select_party" ON public.appointments FOR SELECT
  TO authenticated USING (
    patient_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid())
  );

-- ============================================================
-- Teachers and groups
-- ============================================================

CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 1000),
  photo_url text CHECK (photo_url IS NULL OR photo_url ~ '^https://'),
  subjects text[] NOT NULL DEFAULT '{}' CHECK (cardinality(subjects) <= 10),
  stages text[] NOT NULL DEFAULT '{}' CHECK (cardinality(stages) <= 3),
  governorate text NOT NULL CHECK (char_length(governorate) BETWEEN 2 AND 60),
  city text NOT NULL DEFAULT '' CHECK (char_length(city) <= 60),
  area text NOT NULL DEFAULT '' CHECK (char_length(area) <= 60),
  teaching_location text NOT NULL DEFAULT '' CHECK (char_length(teaching_location) <= 250),
  teaches_online boolean NOT NULL DEFAULT true,
  teaches_offline boolean NOT NULL DEFAULT true,
  experience_years integer NOT NULL DEFAULT 0 CHECK (experience_years BETWEEN 0 AND 80),
  is_published boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teachers_published_idx ON public.teachers (is_published, governorate);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.teachers TO anon, authenticated;
GRANT UPDATE (full_name, bio, photo_url, subjects, stages, governorate, city, area, teaching_location, teaches_online, teaches_offline, experience_years)
  ON public.teachers TO authenticated;

DROP POLICY IF EXISTS "teachers_select_published" ON public.teachers;
CREATE POLICY "teachers_select_published" ON public.teachers FOR SELECT
  TO anon, authenticated USING (is_published);

DROP POLICY IF EXISTS "teachers_select_owner_or_admin" ON public.teachers;
CREATE POLICY "teachers_select_owner_or_admin" ON public.teachers FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  );

DROP POLICY IF EXISTS "teachers_update_owner" ON public.teachers;
CREATE POLICY "teachers_update_owner" ON public.teachers FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.teacher_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 2 AND 60),
  stage text NOT NULL CHECK (stage IN ('primary', 'preparatory', 'secondary')),
  grade text NOT NULL CHECK (char_length(grade) BETWEEN 2 AND 60),
  mode text NOT NULL DEFAULT 'offline' CHECK (mode IN ('online', 'offline')),
  location text NOT NULL DEFAULT '' CHECK (char_length(location) <= 250),
  weekdays smallint[] NOT NULL CHECK (cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
  start_time time NOT NULL,
  end_time time NOT NULL,
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  price integer NOT NULL CHECK (price >= 0 AND price <= 100000),
  price_period text NOT NULL DEFAULT 'month' CHECK (price_period IN ('session', 'month', 'term')),
  capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 500),
  active_enrollments integer NOT NULL DEFAULT 0 CHECK (active_enrollments >= 0),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  registration_open boolean NOT NULL DEFAULT true,
  is_published boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (active_enrollments <= capacity),
  CHECK (end_time > start_time),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS teacher_groups_teacher_idx ON public.teacher_groups (teacher_id);
CREATE INDEX IF NOT EXISTS teacher_groups_browse_idx ON public.teacher_groups (is_published, subject, stage);

ALTER TABLE public.teacher_groups ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.teacher_groups TO anon, authenticated;
GRANT INSERT (teacher_id, name, subject, stage, grade, mode, location, weekdays, start_time, end_time, start_date, end_date, price, price_period, capacity, description, registration_open, is_published)
  ON public.teacher_groups TO authenticated;
GRANT UPDATE (name, subject, stage, grade, mode, location, weekdays, start_time, end_time, start_date, end_date, price, price_period, capacity, description, registration_open, is_published)
  ON public.teacher_groups TO authenticated;

DROP POLICY IF EXISTS "groups_select_public" ON public.teacher_groups;
CREATE POLICY "groups_select_public" ON public.teacher_groups FOR SELECT
  TO anon, authenticated USING (
    is_published AND EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.is_published)
  );

DROP POLICY IF EXISTS "groups_select_owner_or_admin" ON public.teacher_groups;
CREATE POLICY "groups_select_owner_or_admin" ON public.teacher_groups FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  );

DROP POLICY IF EXISTS "groups_insert_owner" ON public.teacher_groups;
CREATE POLICY "groups_insert_owner" ON public.teacher_groups FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "groups_update_owner" ON public.teacher_groups;
CREATE POLICY "groups_update_owner" ON public.teacher_groups FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.group_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.teacher_groups(id) ON DELETE RESTRICT,
  student_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  student_name text NOT NULL CHECK (char_length(student_name) BETWEEN 2 AND 120),
  student_phone text NOT NULL CHECK (student_phone ~ '^01[0125][0-9]{8}$'),
  student_grade text NOT NULL DEFAULT '' CHECK (char_length(student_grade) <= 60),
  booked_for_child boolean NOT NULL DEFAULT false,
  added_by_teacher boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  booking_ref text NOT NULL UNIQUE DEFAULT ('DW-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS group_enrollments_one_active_student
  ON public.group_enrollments (group_id, student_id)
  WHERE status = 'active' AND student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS group_enrollments_group_idx ON public.group_enrollments (group_id);
CREATE INDEX IF NOT EXISTS group_enrollments_student_idx ON public.group_enrollments (student_id);

ALTER TABLE public.group_enrollments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.group_enrollments TO authenticated;

DROP POLICY IF EXISTS "enrollments_select_party" ON public.group_enrollments;
CREATE POLICY "enrollments_select_party" ON public.group_enrollments FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.teacher_groups g
      JOIN public.teachers t ON t.id = g.teacher_id
      WHERE g.id = group_id AND t.user_id = auth.uid()
    )
  );

-- ============================================================
-- Helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION public._unique_professional_slug(p_hint text, p_fallback text)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_base text;
  v_slug text;
BEGIN
  v_base := trim(both '-' from left(regexp_replace(lower(coalesce(p_hint, '')), '[^a-z0-9]+', '-', 'g'), 40));
  IF char_length(v_base) < 2 THEN
    v_base := p_fallback;
  END IF;
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.teachers WHERE slug = v_slug)
     OR EXISTS (SELECT 1 FROM public.doctors WHERE slug = v_slug) LOOP
    v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
  END LOOP;
  RETURN v_slug;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._unique_professional_slug(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._reserve_group_seat(
  p_group_id uuid,
  p_student_id uuid,
  p_student_name text,
  p_student_phone text,
  p_student_grade text,
  p_booked_for_child boolean,
  p_manual boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_group public.teacher_groups%ROWTYPE;
  v_ref text;
BEGIN
  SELECT * INTO v_group FROM public.teacher_groups WHERE id = p_group_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GROUP_NOT_FOUND';
  END IF;
  IF NOT v_group.registration_open THEN
    RAISE EXCEPTION 'REGISTRATION_CLOSED';
  END IF;
  IF v_group.end_date IS NOT NULL AND v_group.end_date < current_date THEN
    RAISE EXCEPTION 'GROUP_ENDED';
  END IF;
  IF v_group.active_enrollments >= v_group.capacity THEN
    RAISE EXCEPTION 'GROUP_FULL';
  END IF;
  IF p_manual AND EXISTS (
    SELECT 1 FROM public.group_enrollments
    WHERE group_id = p_group_id AND status = 'active'
      AND student_name = p_student_name AND student_phone = p_student_phone
  ) THEN
    RAISE EXCEPTION 'ALREADY_ENROLLED';
  END IF;

  INSERT INTO public.group_enrollments (
    group_id, student_id, student_name, student_phone, student_grade, booked_for_child, added_by_teacher
  )
  VALUES (
    p_group_id, p_student_id, p_student_name, p_student_phone, p_student_grade, p_booked_for_child, p_manual
  )
  RETURNING booking_ref INTO v_ref;

  UPDATE public.teacher_groups
  SET active_enrollments = active_enrollments + 1
  WHERE id = p_group_id;

  RETURN v_ref;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._reserve_group_seat(uuid, uuid, text, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Professional registration and approval
-- ============================================================

CREATE OR REPLACE FUNCTION public.register_doctor(
  p_full_name text,
  p_slug_hint text,
  p_specialty text,
  p_qualifications text,
  p_bio text,
  p_clinic_name text,
  p_governorate text,
  p_city text,
  p_area text,
  p_clinic_address text,
  p_consultation_price integer,
  p_slot_minutes integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_slug text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.doctors WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'ALREADY_REGISTERED';
  END IF;

  v_slug := public._unique_professional_slug(p_slug_hint, 'doctor');

  INSERT INTO public.doctors (
    user_id, slug, full_name, specialty, qualifications, bio, clinic_name,
    governorate, city, area, clinic_address, consultation_price, slot_minutes
  )
  VALUES (
    v_uid, v_slug, trim(p_full_name), trim(p_specialty), trim(coalesce(p_qualifications, '')),
    trim(coalesce(p_bio, '')), trim(coalesce(p_clinic_name, '')), trim(p_governorate),
    trim(coalesce(p_city, '')), trim(coalesce(p_area, '')), trim(coalesce(p_clinic_address, '')),
    p_consultation_price, p_slot_minutes
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'doctor')
  ON CONFLICT DO NOTHING;

  RETURN v_slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_teacher(
  p_full_name text,
  p_slug_hint text,
  p_bio text,
  p_subjects text[],
  p_stages text[],
  p_governorate text,
  p_city text,
  p_area text,
  p_teaching_location text,
  p_experience_years integer,
  p_teaches_online boolean,
  p_teaches_offline boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_slug text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.teachers WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'ALREADY_REGISTERED';
  END IF;

  v_slug := public._unique_professional_slug(p_slug_hint, 'teacher');

  INSERT INTO public.teachers (
    user_id, slug, full_name, bio, subjects, stages, governorate, city, area,
    teaching_location, experience_years, teaches_online, teaches_offline
  )
  VALUES (
    v_uid, v_slug, trim(p_full_name), trim(coalesce(p_bio, '')), coalesce(p_subjects, '{}'),
    coalesce(p_stages, '{}'), trim(p_governorate), trim(coalesce(p_city, '')), trim(coalesce(p_area, '')),
    trim(coalesce(p_teaching_location, '')), p_experience_years, p_teaches_online, p_teaches_offline
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'teacher')
  ON CONFLICT DO NOTHING;

  RETURN v_slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_professional_published(p_kind text, p_id uuid, p_published boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  IF p_kind = 'doctor' THEN
    UPDATE public.doctors SET is_published = p_published WHERE id = p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'NOT_FOUND';
    END IF;
  ELSIF p_kind = 'teacher' THEN
    UPDATE public.teachers SET is_published = p_published WHERE id = p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'NOT_FOUND';
    END IF;
  ELSE
    RAISE EXCEPTION 'INVALID_KIND';
  END IF;
END;
$$;

-- ============================================================
-- Doctor appointments
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_doctor_taken_slots(p_doctor_id uuid, p_from timestamptz, p_to timestamptz)
RETURNS SETOF timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.slot_start
  FROM public.appointments a
  JOIN public.doctors d ON d.id = a.doctor_id AND d.is_published
  WHERE a.doctor_id = p_doctor_id
    AND a.status IN ('booked', 'completed', 'no_show')
    AND a.slot_start >= p_from
    AND a.slot_start < p_to
    AND p_to > p_from
    AND p_to - p_from <= interval '62 days';
$$;

CREATE OR REPLACE FUNCTION public.book_appointment(
  p_doctor_id uuid,
  p_slot_start timestamptz,
  p_patient_name text,
  p_patient_phone text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_doc public.doctors%ROWTYPE;
  v_local timestamp := p_slot_start AT TIME ZONE 'Africa/Cairo';
  v_dow smallint := EXTRACT(DOW FROM v_local)::smallint;
  v_time time := v_local::time;
  v_fits boolean;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF char_length(trim(coalesce(p_patient_name, ''))) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;
  IF coalesce(p_patient_phone, '') !~ '^01[0125][0-9]{8}$' THEN
    RAISE EXCEPTION 'INVALID_PHONE';
  END IF;
  IF p_slot_start <= now() THEN
    RAISE EXCEPTION 'SLOT_IN_PAST';
  END IF;

  SELECT * INTO v_doc FROM public.doctors WHERE id = p_doctor_id AND is_published FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOCTOR_NOT_AVAILABLE';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.doctor_availability a
    WHERE a.doctor_id = v_doc.id
      AND a.weekday = v_dow
      AND v_time >= a.start_time
      AND v_time + make_interval(mins => v_doc.slot_minutes) <= a.end_time
      AND (EXTRACT(EPOCH FROM (v_time - a.start_time))::bigint % (v_doc.slot_minutes * 60)) = 0
  ) INTO v_fits;
  IF NOT v_fits THEN
    RAISE EXCEPTION 'SLOT_NOT_AVAILABLE';
  END IF;

  BEGIN
    INSERT INTO public.appointments (doctor_id, patient_id, patient_name, patient_phone, slot_start)
    VALUES (v_doc.id, v_uid, trim(p_patient_name), p_patient_phone, p_slot_start)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'SLOT_TAKEN';
  END;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_appointment(p_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_appt public.appointments%ROWTYPE;
  v_is_doctor boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  v_is_doctor := EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = v_appt.doctor_id AND d.user_id = v_uid);
  IF NOT (v_appt.patient_id = v_uid OR v_is_doctor) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF v_appt.status <> 'booked' THEN
    RAISE EXCEPTION 'NOT_CANCELLABLE';
  END IF;
  IF NOT v_is_doctor AND v_appt.slot_start <= now() + interval '2 hours' THEN
    RAISE EXCEPTION 'CANCELLATION_WINDOW_PASSED';
  END IF;

  UPDATE public.appointments SET status = 'cancelled' WHERE id = p_appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_appointment_status(p_appointment_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_appt public.appointments%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF p_status NOT IN ('completed', 'no_show') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  SELECT a.* INTO v_appt FROM public.appointments a WHERE a.id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = v_appt.doctor_id AND d.user_id = v_uid) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF v_appt.status <> 'booked' THEN
    RAISE EXCEPTION 'NOT_CANCELLABLE';
  END IF;

  UPDATE public.appointments SET status = p_status WHERE id = p_appointment_id;
END;
$$;

-- ============================================================
-- Group enrollment (capacity enforced in the database)
-- ============================================================

CREATE OR REPLACE FUNCTION public.enroll_in_group(
  p_group_id uuid,
  p_student_name text,
  p_student_phone text,
  p_student_grade text,
  p_booked_for_child boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_student_name, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF char_length(v_name) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;
  IF coalesce(p_student_phone, '') !~ '^01[0125][0-9]{8}$' THEN
    RAISE EXCEPTION 'INVALID_PHONE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_groups g
    JOIN public.teachers t ON t.id = g.teacher_id
    WHERE g.id = p_group_id AND g.is_published AND t.is_published
  ) THEN
    RAISE EXCEPTION 'GROUP_NOT_AVAILABLE';
  END IF;

  BEGIN
    RETURN public._reserve_group_seat(
      p_group_id, v_uid, v_name, p_student_phone, left(trim(coalesce(p_student_grade, '')), 60),
      coalesce(p_booked_for_child, false), false
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ALREADY_ENROLLED';
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_add_enrollment(
  p_group_id uuid,
  p_student_name text,
  p_student_phone text,
  p_student_grade text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_student_name, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_groups g
    JOIN public.teachers t ON t.id = g.teacher_id
    WHERE g.id = p_group_id AND t.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF char_length(v_name) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;
  IF coalesce(p_student_phone, '') !~ '^01[0125][0-9]{8}$' THEN
    RAISE EXCEPTION 'INVALID_PHONE';
  END IF;

  RETURN public._reserve_group_seat(
    p_group_id, NULL, v_name, p_student_phone, left(trim(coalesce(p_student_grade, '')), 60), false, true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_group_enrollment(p_enrollment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT e.group_id INTO v_group_id
  FROM public.group_enrollments e
  WHERE e.id = p_enrollment_id AND e.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENROLLMENT_NOT_FOUND';
  END IF;

  PERFORM 1 FROM public.teacher_groups WHERE id = v_group_id FOR UPDATE;

  UPDATE public.group_enrollments AS e
  SET status = 'cancelled', cancelled_at = now()
  WHERE e.id = p_enrollment_id
    AND e.status = 'active'
    AND (
      e.student_id = v_uid
      OR EXISTS (
        SELECT 1 FROM public.teacher_groups g
        JOIN public.teachers t ON t.id = g.teacher_id
        WHERE g.id = e.group_id AND t.user_id = v_uid
      )
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  UPDATE public.teacher_groups
  SET active_enrollments = active_enrollments - 1
  WHERE id = v_group_id;
END;
$$;

-- ============================================================
-- Function privileges: only signed-in users may call the actions above
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.register_doctor(text, text, text, text, text, text, text, text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_teacher(text, text, text, text[], text[], text, text, text, text, integer, boolean, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_professional_published(text, uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.book_appointment(uuid, timestamptz, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_appointment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_appointment_status(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enroll_in_group(uuid, text, text, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.teacher_add_enrollment(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_group_enrollment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_doctor_taken_slots(uuid, timestamptz, timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_doctor(text, text, text, text, text, text, text, text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_teacher(text, text, text, text[], text[], text, text, text, text, integer, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_professional_published(text, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid, timestamptz, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_appointment_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_in_group(uuid, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_add_enrollment(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_group_enrollment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_doctor_taken_slots(uuid, timestamptz, timestamptz) TO anon, authenticated;
