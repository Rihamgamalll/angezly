import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type DoctorDashboardStats = {
  // Booked appointments starting now or later (not limited to the last 200 list rows).
  upcomingBookings: number;
  // Patients who have checked in today and have not left the clinic yet.
  atClinicNow: number;
  // Completed appointments across the doctor's entire history.
  completedVisits: number;
};

export function getCairoDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const datePart = (name: string) => parts.find((part) => part.type === name)?.value ?? '';
  return `${datePart('year')}-${datePart('month')}-${datePart('day')}`;
}

/**
 * Actual database counts, not counters derived from the 200 most recent rows.
 * PostgreSQL Changes make updates immediate when the publication is enabled;
 * polling + window focus keep the dashboard correct even without Realtime.
 */
export function useDoctorDashboardStats(doctorId: string | null) {
  const [stats, setStats] = useState<DoctorDashboardStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState(false);
  const requestNumber = useRef(0);

  const refresh = useCallback(async () => {
    if (!doctorId) return;

    const requestId = ++requestNumber.current;
    try {
    const [bookings, clinic, completed] = await Promise.all([
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('doctor_id', doctorId)
        .eq('status', 'booked')
        .gte('slot_start', new Date().toISOString()),
      supabase
        .from('clinic_queue')
        .select('id', { count: 'exact', head: true })
        .eq('doctor_id', doctorId)
        .eq('queue_date', getCairoDateKey(new Date()))
        .in('status', ['waiting', 'in_progress']),
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('doctor_id', doctorId)
        .eq('status', 'completed'),
    ]);

    if (requestId !== requestNumber.current) return;

    if (bookings.error || clinic.error || completed.error ||
        bookings.count === null || clinic.count === null || completed.count === null) {
      setError(true);
      return;
    }

    setStats({
      upcomingBookings: bookings.count,
      atClinicNow: clinic.count,
      completedVisits: completed.count,
    });
    setLastUpdated(new Date());
    setError(false);
    } catch {
      if (requestId === requestNumber.current) setError(true);
    }
  }, [doctorId]);

  useEffect(() => {
    if (!doctorId) {
      requestNumber.current += 1;
      setStats(null);
      setLastUpdated(null);
      setError(false);
      return;
    }

    void refresh();

    // A short debounce collapses appointment + queue triggers into one count refresh.
    let refreshTimer: number | undefined;
    const onDataChange = () => {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => { void refresh(); }, 250);
    };

    // Supabase Realtime honours row-level security for these tables.
    const channel = supabase
      .channel(`doctor-dashboard-counts-${doctorId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'appointments',
        filter: `doctor_id=eq.${doctorId}`,
      }, onDataChange)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'clinic_queue',
        filter: `doctor_id=eq.${doctorId}`,
      }, onDataChange)
      .subscribe();

    // Reliable fallback while Realtime isn't configured or is disconnected.
    const polling = window.setInterval(() => { void refresh(); }, 12000);
    const onFocus = () => { void refresh(); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      requestNumber.current += 1;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      window.clearInterval(polling);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [doctorId, refresh]);

  return { stats, lastUpdated, statsError: error, refreshStats: refresh };
}
