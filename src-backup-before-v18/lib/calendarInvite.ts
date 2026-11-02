function stamp(date: Date): string { return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function safe(value: string): string { return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
/** Download an appointment into the visitor's phone/computer calendar. */
export function downloadCalendarInvite({ title, description, start, minutes }: { title: string; description: string; start: Date; minutes: number }) {
  const uid = `${crypto.randomUUID()}@dawrak-calendar`;
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DAWRAK//Appointment//AR','BEGIN:VEVENT',
    `UID:${uid}`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(start)}`,
    `DTEND:${stamp(new Date(start.getTime() + minutes * 60_000))}`,
    `SUMMARY:${safe(title)}`,`DESCRIPTION:${safe(description)}`,'END:VEVENT','END:VCALENDAR',''].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'dawrak-appointment.ics';
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
