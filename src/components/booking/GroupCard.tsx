import type { ReactNode } from 'react';
import { CalendarDays, Clock3, MapPin, Users } from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import { formatEgp, formatTime, formatWeekdays } from '@/lib/format';
import { getSeatsLeft, isGroupOpen } from '@/lib/groups';
import { GROUP_MODE_LABELS, PRICE_PERIOD_LABELS } from '@/lib/constants';
import type { TeacherGroup } from '@/lib/types';

type GroupCardProps = {
  group: TeacherGroup;
  subtitle?: string;
  action: ReactNode;
};

export function GroupCard({ group, subtitle, action }: GroupCardProps) {
  const seatsLeft = getSeatsLeft(group);
  const open = isGroupOpen(group);
  const fillPercent = Math.min(100, Math.round((group.active_enrollments / group.capacity) * 100));
  const statusTone = !group.registration_open ? 'neutral' : open ? (seatsLeft <= 3 ? 'warning' : 'success') : 'danger';
  const statusLabel = !group.registration_open ? 'التسجيل مقفول' : group.end_date && !open && seatsLeft > 0 ? 'المجموعة انتهت' : open ? `${seatsLeft} مكان فاضي` : 'المجموعة اكتملت';

  return (
    <Card className="flex flex-col gap-4 p-5 transition duration-300 hover:shadow-lift">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-ink-900">{group.name}</h3>
          <p className="mt-1 text-sm text-ink-500">
            {subtitle ? `${subtitle} · ` : ''}
            {group.subject} · {group.grade}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={group.mode === 'online' ? 'cyan' : 'brand'}>{GROUP_MODE_LABELS[group.mode]}</Badge>
          <Badge tone={statusTone}>{statusLabel}</Badge>
        </div>
      </div>

      <ul className="grid gap-2 text-sm text-ink-600 sm:grid-cols-2">
        <li className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
          {formatWeekdays(group.weekdays)}
        </li>
        <li className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
          <span dir="ltr">{formatTime(group.start_time)} - {formatTime(group.end_time)}</span>
        </li>
        <li className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
          <span className="truncate">{group.location}</span>
        </li>
        <li className="flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
          {group.active_enrollments} من {group.capacity} طالب
        </li>
      </ul>

      <div>
        <div className="h-2 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuemin={0} aria-valuemax={group.capacity} aria-valuenow={group.active_enrollments}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${open ? 'bg-brand-500' : 'bg-rose-400'}`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
        <p className="text-sm text-ink-500">
          <span className="text-lg font-extrabold text-ink-900">{formatEgp(group.price)}</span>{' '}
          {PRICE_PERIOD_LABELS[group.price_period]}
        </p>
        {action}
      </div>
    </Card>
  );
}
