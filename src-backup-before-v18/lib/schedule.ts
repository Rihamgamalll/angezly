const CAIRO_TIME_ZONE = 'Africa/Cairo';

export type CalendarDay = { year: number; month: number; day: number; weekday: number };

export type AvailabilityWindow = {
  weekday: number;
  start_time: string;
  end_time: string;
};

const cairoPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CAIRO_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function cairoOffsetMs(instant: number): number {
  const parts = Object.fromEntries(
    cairoPartsFormatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

export function getCairoToday(now: Date = new Date()): CalendarDay {
  const offset = cairoOffsetMs(now.getTime());
  const local = new Date(now.getTime() + offset);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    weekday: local.getUTCDay(),
  };
}

export function cairoLocalToInstant(year: number, month: number, day: number, hour: number, minute: number): Date {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = cairoOffsetMs(wallClock);
  const candidate = wallClock - firstOffset;
  const correctedOffset = cairoOffsetMs(candidate);
  return new Date(correctedOffset === firstOffset ? candidate : wallClock - correctedOffset);
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function buildUpcomingSlots(
  availability: readonly AvailabilityWindow[],
  slotMinutes: number,
  takenStarts: ReadonlySet<number>,
  days = 14,
  now: Date = new Date(),
): Date[] {
  const today = getCairoToday(now);
  const slots: Date[] = [];
  const seen = new Set<number>();

  for (let offset = 0; offset < days; offset += 1) {
    const calendar = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const weekday = calendar.getUTCDay();
    const dayWindows = availability.filter((window) => window.weekday === weekday);

    for (const window of dayWindows) {
      const startMinutes = toMinutes(window.start_time);
      const endMinutes = toMinutes(window.end_time);
      for (let minutes = startMinutes; minutes + slotMinutes <= endMinutes; minutes += slotMinutes) {
        const instant = cairoLocalToInstant(
          calendar.getUTCFullYear(),
          calendar.getUTCMonth() + 1,
          calendar.getUTCDate(),
          Math.floor(minutes / 60),
          minutes % 60,
        );
        const time = instant.getTime();
        if (time <= now.getTime() || seen.has(time) || takenStarts.has(time)) {
          continue;
        }
        seen.add(time);
        slots.push(instant);
      }
    }
  }

  return slots.sort((a, b) => a.getTime() - b.getTime());
}

export function formatSlotDayLabel(instant: Date): string {
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: CAIRO_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(instant);
}

export function formatSlotTime(instant: Date): string {
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: CAIRO_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);
}

export function cairoDateKey(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CAIRO_TIME_ZONE }).format(instant);
}
