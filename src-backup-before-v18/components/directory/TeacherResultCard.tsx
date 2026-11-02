import { ArrowUpLeft, BookOpen, MapPin, Users } from 'lucide-react';
import { Badge } from '@/components/ui';
import { Link } from '@/lib/router';
import { formatEgp, formatLocation } from '@/lib/format';
import { getSeatsLeft, isGroupOpen } from '@/lib/groups';
import { PRICE_PERIOD_LABELS } from '@/lib/constants';
import type { TeacherGroup } from '@/lib/types';

export type TeacherSummary = {
  id: string;
  slug: string;
  full_name: string;
  photo_url: string | null;
  governorate: string;
  city: string;
  area: string;
  teaching_location: string;
  is_demo: boolean;
};

export type GroupSummary = Pick<
  TeacherGroup,
  | 'id' | 'teacher_id' | 'name' | 'subject' | 'stage' | 'grade' | 'mode'
  | 'weekdays' | 'start_time' | 'end_time' | 'price' | 'price_period'
  | 'capacity' | 'active_enrollments' | 'registration_open' | 'end_date'
>;

export function TeacherResultCard({ teacher, groups }: { teacher: TeacherSummary; groups: GroupSummary[] }) {
  const subjects = [...new Set(groups.map(group => group.subject))];
  const openSeats = groups.filter(isGroupOpen).reduce((total, group) => total + getSeatsLeft(group), 0);
  const cheapest = groups.reduce((min, group) => group.price < min.price ? group : min, groups[0]);
  const location = formatLocation([teacher.governorate, teacher.city, teacher.area]);
  return (
    <article className="directory-card teacher-directory-card">
      <div className="directory-card-stripe"><span><BookOpen size={16}/> {subjects.slice(0,2).join(' • ')}</span><span className="directory-card-mark">✳</span></div>
      <div className="directory-card-body"><div className="directory-profile-row">
        {teacher.photo_url ? <img src={teacher.photo_url} alt={teacher.full_name} loading="lazy" className="directory-avatar"/> : <span className="directory-avatar directory-avatar-placeholder" aria-hidden>{teacher.full_name.trim().charAt(0)}</span>}
        <div className="directory-profile-copy"><h3>{teacher.full_name}</h3><p><MapPin size={14}/>{location}</p></div></div>
        {teacher.is_demo&&<div className="mt-3"><Badge tone="warning">ملف تجريبي</Badge></div>}
        <div className="directory-info-lines teacher-info-lines"><span className={openSeats>0 ? 'seat-indicator seat-open' : 'seat-indicator seat-full'}><Users size={17}/>{openSeats>0 ? `${openSeats} مكان متاح` : 'المجموعات مكتملة'}</span><span>من <b>{formatEgp(cheapest.price)}</b> <small>{PRICE_PERIOD_LABELS[cheapest.price_period]}</small></span></div>
      </div>
      <Link to={`/teacher/${teacher.slug}`} className="directory-cta">عرض المجموعات والمواعيد <span><ArrowUpLeft size={20}/></span></Link>
    </article>
  );
}
