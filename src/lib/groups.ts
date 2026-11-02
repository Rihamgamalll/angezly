import type { TeacherGroup } from '@/lib/types';

export const GROUP_DETAIL_COLUMNS =
  'id, teacher_id, name, subject, stage, grade, mode, location, weekdays, start_time, end_time, start_date, end_date, price, price_period, capacity, active_enrollments, description, registration_open, is_published';

type GroupSeats = Pick<TeacherGroup, 'capacity' | 'active_enrollments' | 'registration_open'> & {end_date?:string|null};

export function getSeatsLeft(group: GroupSeats): number {
  return Math.max(group.capacity - group.active_enrollments, 0);
}

export function isGroupOpen(group: GroupSeats): boolean {
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return group.registration_open && getSeatsLeft(group) > 0 && (!group.end_date || group.end_date >= today);
}
