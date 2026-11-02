import { useEffect, useState } from 'react';
import { Briefcase, Clock3, MapPin, Stethoscope, Wallet } from 'lucide-react';
import { AppointmentBooking } from '@/components/booking/AppointmentBooking';
import { DoctorAvatar } from '@/components/directory/DoctorResultCard';
import { PublicProfessionalInfo } from '@/components/PublicProfessionalInfo';
import { Badge, Card, EmptyState, Spinner, Alert } from '@/components/ui';
import { WEEKDAY_NAMES } from '@/lib/constants';
import { formatEgp, formatLocation, formatTime, getErrorMessage } from '@/lib/format';
import { useDocumentMeta } from '@/lib/hooks';
import { Link } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import type { AvailabilityWindow } from '@/lib/schedule';
import type { Doctor, DoctorAvailability } from '@/lib/types';

const DOCTOR_PROFILE_COLUMNS =
  'id, slug, full_name, specialty, qualifications, bio, visitor_note, photo_url, clinic_name, governorate, city, area, clinic_address, consultation_price, slot_minutes, is_published, is_demo';

type DoctorProfile = Pick<
  Doctor,
  | 'id'
  | 'slug'
  | 'full_name'
  | 'specialty'
  | 'qualifications'
  | 'bio'
  | 'visitor_note'
  | 'photo_url'
  | 'clinic_name'
  | 'governorate'
  | 'city'
  | 'area'
  | 'clinic_address'
  | 'consultation_price'
  | 'slot_minutes'
  | 'is_demo'
  | 'is_published'
>;

export function DoctorProfilePage({ slug }: { slug: string }) {
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [availability, setAvailability] = useState<AvailabilityWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useDocumentMeta(
    doctor ? `${doctor.full_name} | ${doctor.specialty} | دَوْرك` : 'ملف الدكتور | دَوْرك',
    doctor
      ? `احجز ميعادك مع د. ${doctor.full_name} أخصائي ${doctor.specialty} في ${doctor.clinic_name || doctor.area}.`
      : 'احجز ميعادك مع الدكتور أونلاين في ثواني.',
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      setDoctor(null);

      const { data: row, error: doctorError } = await supabase
        .from('doctors')
        .select(DOCTOR_PROFILE_COLUMNS)
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();
      if (!active) return;

      if (doctorError) {
        setError(getErrorMessage(doctorError));
        setLoading(false);
        return;
      }
      if (!row) {
        setLoading(false);
        return;
      }

      const profile = row as DoctorProfile;
      const { data: windows, error: availabilityError } = await supabase
        .from('doctor_availability')
        .select('weekday, start_time, end_time')
        .eq('doctor_id', profile.id)
        .order('weekday');
      if (!active) return;

      if (availabilityError) {
        setError(getErrorMessage(availabilityError));
      } else {
        setDoctor(profile);
        setAvailability((windows ?? []) as DoctorAvailability[]);
      }
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return <Spinner label="جاري تحميل ملف الدكتور..." />;
  }

  if (error) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Alert tone="error">{error}</Alert>
      </section>
    );
  }

  if (!doctor) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<Stethoscope className="h-7 w-7" aria-hidden />}
          title="الصفحة دي مش موجودة"
          text="قد يكون الرابط غير صحيح، أو لم يُنشر ملف الطبيب بعد."
          action={
            <Link to="/doctors" className="mt-2 inline-flex min-h-10 items-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              تصفح الدكاترة
            </Link>
          }
        />
      </section>
    );
  }

  const location = formatLocation([doctor.governorate, doctor.city, doctor.area]);
  const workingDays = [...new Set(availability.map((window) => window.weekday))];

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="profile-photo-head doctor-profile-photo-head px-6 pb-6 pt-8 text-center">
              <div className="mx-auto w-fit rounded-3xl bg-white p-1.5 shadow-lift">
                <DoctorAvatar name={doctor.full_name} photoUrl={doctor.photo_url} size="lg" />
              </div>
              <h1 className="mt-4 text-2xl font-extrabold text-white">د. {doctor.full_name}</h1>
              <p className="mt-1 text-sm text-brand-50">{doctor.qualifications}</p>
              <div className="mt-3 flex justify-center">
                <Badge tone="neutral">
                  <Stethoscope className="h-3.5 w-3.5" aria-hidden />
                  {doctor.specialty}
                </Badge>
              </div>
            </div>
            <div className="space-y-4 p-6">
              {doctor.bio && <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{doctor.bio}</p>}
              <PublicProfessionalInfo kind="doctor" professionalId={doctor.id} visitorNote={doctor.visitor_note} />
              <dl className="grid gap-3 text-sm">
                <div className="flex items-start gap-3">
                  <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <div>
                    <dt className="sr-only">العيادة</dt>
                    <dd className="font-semibold text-ink-900">{doctor.clinic_name}</dd>
                    {doctor.clinic_address && <dd className="text-ink-500">{doctor.clinic_address}</dd>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <dd className="text-ink-700">{location}</dd>
                </div>
                <div className="flex items-center gap-3">
                  <Wallet className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <dd className="text-ink-700">سعر الكشف <span className="font-bold text-ink-900">{formatEgp(doctor.consultation_price)}</span></dd>
                </div>
                <div className="flex items-center gap-3">
                  <Clock3 className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <dd className="text-ink-700">مدة الكشف {doctor.slot_minutes} دقيقة</dd>
                </div>
              </dl>
              {availability.length > 0 && (
                <div className="rounded-xl bg-ink-50 p-4">
                  <p className="mb-2 text-sm font-bold text-ink-900">مواعيد العمل</p>
                  <ul className="space-y-1.5 text-sm text-ink-600">
                    {workingDays.map((weekday) => {
                      const windows = availability.filter((window) => window.weekday === weekday);
                      return (
                        <li key={weekday} className="flex justify-between gap-3">
                          <span className="font-semibold text-ink-800">{WEEKDAY_NAMES[weekday]}</span>
                          <span dir="ltr" className="text-end">
                            {windows.map((window) => `${formatTime(window.start_time)} - ${formatTime(window.end_time)}`).join('، ')}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {doctor.is_demo && <div className="mb-4"><Alert tone="info">ملف توضيحي لشخصية افتراضية غير حقيقية. للاختبار فقط.</Alert></div>}
          <AppointmentBooking
            doctorId={doctor.id}
            doctorName={doctor.full_name}
            price={doctor.consultation_price}
            slotMinutes={doctor.slot_minutes}
            availability={availability}
          />
        </div>
      </div>
    </section>
  );
}
