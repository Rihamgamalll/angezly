import type { Session } from '@supabase/supabase-js';

/** Anonymous Supabase sessions let visitors book without a visible account. */
export function isGuestSession(session: Session | null): boolean {
  return Boolean(session?.user?.is_anonymous);
}

export function professionalDestination(roles: string[], fallback = '/join'): string {
  if (roles.includes('admin')) return '/admin';
  if (roles.includes('doctor')) return '/dashboard/doctor';
  if (roles.includes('teacher')) return '/dashboard/teacher';
  return fallback;
}
