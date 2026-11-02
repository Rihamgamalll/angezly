import { ArrowUpLeft, MapPin, Stethoscope, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui';
import { Link } from '@/lib/router';
import { formatEgp, formatLocation } from '@/lib/format';
import type { Doctor } from '@/lib/types';

export const DOCTOR_LIST_COLUMNS =
  'id, slug, full_name, specialty, qualifications, photo_url, clinic_name, governorate, city, area, consultation_price, is_demo';

export type DoctorListItem = Pick<
  Doctor,
  'id' | 'slug' | 'full_name' | 'specialty' | 'qualifications' | 'photo_url' | 'clinic_name' | 'governorate' | 'city' | 'area' | 'consultation_price' | 'is_demo'
>;

export function DoctorResultCard({ doctor }: { doctor: DoctorListItem }) {
  const location = formatLocation([doctor.governorate, doctor.city, doctor.area]);
  return (
    <article className="directory-card doctor-directory-card">
      <div className="directory-card-stripe"><span><Stethoscope size={16}/> {doctor.specialty}</span><span className="directory-card-mark">✳</span></div>
      <div className="directory-card-body"><div className="directory-profile-row"><DoctorAvatar name={doctor.full_name} photoUrl={doctor.photo_url}/><div className="directory-profile-copy"><h3>{doctor.full_name.startsWith('د.') ? doctor.full_name : `د. ${doctor.full_name}`}</h3><p>{doctor.qualifications}</p></div></div>
        {doctor.is_demo&&<div className="mt-3"><Badge tone="warning">ملف تجريبي</Badge></div>}
        <div className="directory-info-lines"><span><MapPin size={17}/>{location}</span><span><Wallet size={17}/> الكشف <b>{formatEgp(doctor.consultation_price)}</b></span></div>
      </div>
      <Link to={`/doctor/${doctor.slug}`} className="directory-cta">عرض المواعيد والحجز <span><ArrowUpLeft size={20}/></span></Link>
    </article>
  );
}

export function DoctorAvatar({ name, photoUrl, size = 'md' }: { name: string; photoUrl: string | null; size?: 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-28 w-28 text-3xl' : 'h-16 w-16 text-lg';
  if (photoUrl) return <img src={photoUrl} alt={name} loading="lazy" className={`${sizeClass} shrink-0 rounded-2xl object-cover ring-4 ring-white shadow-soft`} />;
  return <span className={`${sizeClass} flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-cyanx-100 font-bold text-brand-700`} aria-hidden>{name.trim().charAt(0)}</span>;
}
