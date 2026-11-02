export type Doctor = {
  id: string;
  slug: string;
  full_name: string;
  specialty: string;
  qualifications: string;
  bio: string;
  visitor_note?: string;
  photo_url: string | null;
  clinic_name: string;
  governorate: string;
  city: string;
  area: string;
  clinic_address: string;
  consultation_price: number;
  slot_minutes: number;
  max_daily_visits?: number;
  is_published: boolean;
  is_demo: boolean;
  user_id: string | null;
};

export type DoctorAvailability = {
  id: string;
  doctor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

export type Teacher = {
  id: string;
  slug: string;
  full_name: string;
  bio: string;
  credentials_summary?: string;
  visitor_note?: string;
  photo_url: string | null;
  subjects: string[];
  stages: string[];
  governorate: string;
  city: string;
  area: string;
  teaching_location: string;
  teaches_online: boolean;
  teaches_offline: boolean;
  experience_years: number;
  is_published: boolean;
  is_demo: boolean;
  user_id: string | null;
};

export type TeacherGroup = {
  id: string;
  teacher_id: string;
  name: string;
  subject: string;
  stage: string;
  grade: string;
  mode: 'online' | 'offline';
  location: string;
  weekdays: number[];
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string | null;
  price: number;
  price_period: 'session' | 'month' | 'term';
  capacity: number;
  active_enrollments: number;
  description: string;
  registration_open: boolean;
  is_published: boolean;
  is_demo: boolean;
};

export type Appointment = {
  id: string;
  doctor_id: string;
  patient_id: string | null;
  patient_name: string;
  patient_phone: string;
  slot_start: string;
  status: 'booked' | 'completed' | 'no_show' | 'cancelled';
  created_at: string;
};

export type GroupEnrollment = {
  id: string;
  group_id: string;
  student_id: string | null;
  student_name: string;
  student_phone: string;
  student_grade: string;
  booked_for_child: boolean;
  added_by_teacher: boolean;
  status: 'active' | 'cancelled';
  booking_ref: string;
  created_at: string;
};
