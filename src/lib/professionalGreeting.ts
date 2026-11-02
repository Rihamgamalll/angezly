/** Neutralize duplicate professional titles only in the dashboard greeting. */
export function professionalGreeting(
  kind: 'doctor' | 'teacher',
  fullName: string,
): string {
  const cleanName = fullName.trim().replace(/\s+/g, ' ');
  const withoutTitle = kind === 'doctor'
    ? cleanName.replace(/^(?:د\s*[.٫-]\s*|دكتور(?:ة)?\s+|الدكتور(?:ة)?\s+)/u, '').trim()
    : cleanName.replace(/^(?:أ\s*[.٫-]\s*|أستاذ(?:ة)?\s+|الأستاذ(?:ة)?\s+|مستر\s+)/u, '').trim();
  const title = kind === 'doctor' ? 'دكتور' : 'مستر';
  return `أهلًا ${title} ${withoutTitle || cleanName || 'بك'}`;
}
