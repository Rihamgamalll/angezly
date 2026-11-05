import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarCheck2, CheckCircle2, Clock3, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { Alert, Button, Card, EmptyState, Field, TextInput } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { isGuestSession } from '@/lib/role-routing';
import { Link } from '@/lib/router';
import { formatEgp, getErrorMessage,  } from '@/lib/format';
import { cairoDateKey, formatSlotDayLabel, getCairoToday, type AvailabilityWindow } from '@/lib/schedule';
import { supabase } from '@/lib/supabase';
import { guestBookingErrorMessage } from '@/lib/guestBookingError';

const BOOKING_WINDOW_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

type DayOption = { key: string; label: string; slots: Date[] };

type AppointmentBookingProps = {
  doctorId: string;
  doctorName: string;
  price: number;
  slotMinutes: number;
  availability: AvailabilityWindow[];
};

export function AppointmentBooking({ doctorId, doctorName, price, slotMinutes, availability }: AppointmentBookingProps) {
  const { session, hasRole } = useAuth();

  const [busyIntervals, setBusyIntervals] = useState<Array<{start:number;end:number}>>([]);
  const [blockedDays, setBlockedDays] = useState<Set<string>>(() => new Set());
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState('');
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ slot: Date; ref: string; token: string | null } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [queueNumber, setQueueNumber] = useState<number | null>(null);
  const [selectedDateInput, setSelectedDateInput] = useState('');

  const loadTakenSlots = useCallback(async () => {
    setSlotsLoading(true);
    setSlotsError('');
    const now = new Date();
    const { data, error } = await supabase.rpc('get_doctor_busy_intervals', {
      p_doctor_id: doctorId,
      p_from: now.toISOString(),
      p_to: new Date(now.getTime() + (BOOKING_WINDOW_DAYS + 1) * DAY_MS).toISOString(),
    });
    const {data: blocked, error: blockedError} = await supabase.from('doctor_blocked_days').select('blocked_date').eq('doctor_id',doctorId);
    if (error || blockedError) {
      setSlotsError(getErrorMessage(error ?? blockedError));
    } else {
      setBusyIntervals((data ?? []).map((row:{slot_start:string;duration_minutes:number}) => {const start=new Date(row.slot_start).getTime();return {start,end:start+row.duration_minutes*60000};}));
      setBlockedDays(new Set((blocked??[]).map(row=>row.blocked_date)));
    }
    setSlotsLoading(false);
  }, [doctorId]);

  useEffect(() => {
    loadTakenSlots();
  }, [loadTakenSlots]);

  const days = useMemo(() => {
    const today = getCairoToday();
    const list: DayOption[] = [];
    for (let i = 0; i < BOOKING_WINDOW_DAYS; i++) {
      const date = new Date(Date.UTC(today.year, today.month - 1, today.day + i, 12));
      const key = date.toISOString().slice(0, 10);
      if (blockedDays.has(key)) continue;
      list.push({ key, label: formatSlotDayLabel(date), slots: [date] });
    }
    return list;
  }, [blockedDays]);

  // All weekdays are bookable unless the doctor blocks a specific date.
  const todayKey = useMemo(() => {
    const today = getCairoToday();
    return `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
  }, []);
  const lastDateKey = useMemo(() => {
    const today = getCairoToday();
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + BOOKING_WINDOW_DAYS - 1));
    return date.toISOString().slice(0, 10);
  }, []);
  const activeDay = days.find((day) => day.key === selectedDayKey) ?? null;

  const selectDay = (key: string) => {
    setSelectedDayKey(key);
    setSelectedDateInput(key);
    setSelectedSlot(days.find(day => day.key === key)?.slots[0] ?? null);
  };

  const resetBooking = () => {
    setConfirmation(null);
    setQueueNumber(null);
    setLinkCopied(false);
    setSelectedSlot(null);
    setFormError('');
    loadTakenSlots();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(selectedSlot ?? activeDay?.slots[0]) || submitting) return;

    const name = patientName.trim();
    const phone = patientPhone.trim();
    if (name.length < 2) {
      setFormError('يرجى إدخال اسم المريض بشكل صحيح.');
      return;
    }
    if (!(phone)) {
      setFormError('اكتب رقم موبايل صحيح مع كود الدولة.');
      return;
    }

    setFormError('');
    setSubmitting(true);
    // Guest sign-in is silent: visitors supply no email, password or account details.
    // Supabase treats the temporary visitor as an authenticated user for private RLS.
    if (!session) {
      const { error: guestError } = await supabase.auth.signInAnonymously();
      if (guestError) {
        setSubmitting(false);
        console.error('[Dawrak] Anonymous sign-in failed:', { code: guestError.code, status: guestError.status, message: guestError.message });
        setFormError(guestBookingErrorMessage(guestError));
        return;
      }
    }
    const { data, error } = await supabase.rpc('book_appointment_day', {
      p_doctor_id: doctorId,
      p_day: selectedDayKey,
      p_patient_name: name,
      p_patient_phone: phone,
    });

    if (error) {
      setSubmitting(false);
      setFormError(getErrorMessage(error));
      if (String(error.message).includes('SLOT_TAKEN')) {
        setSelectedSlot(null);
        loadTakenSlots();
      }
      return;
    }

    // A separate, high-entropy tracking secret gives the visitor access on any device.
    // The database stores only its hash; the secret is not the short booking reference.
    const { data: trackingToken, error: trackingError } = await supabase.rpc('create_appointment_tracking_link', {
      p_appointment_id: String(data),
    });
    setSubmitting(false);
    if (trackingError) console.warn('Booking saved, but no follow-up link was issued. Check V11 migration.');
    const { data: progress, error: progressError } = await supabase.rpc('get_patient_queue_progress', { p_appointment_id: String(data) });
    if (!progressError) {
      const row = Array.isArray(progress) ? progress[0] : progress;
      setQueueNumber(typeof row?.queue_number === 'number' ? row.queue_number : null);
    }
    setConfirmation({ slot: selectedSlot ?? activeDay!.slots[0], ref: String(data).slice(0, 8).toUpperCase(), token: trackingError ? null : String(trackingToken ?? '') || null });
  };

  if (confirmation) {
    const followUpLink = confirmation.token ? `${window.location.origin}/track#${confirmation.token}` : null;
    const copyFollowUp = async () => {
      if (!followUpLink) return;
      try {
        await navigator.clipboard.writeText(followUpLink);
        setLinkCopied(true);
      } catch {
        setFormError('تعذّر النسخ تلقائيًا. افتح رابط المتابعة وانسخه من شريط العنوان.');
      }
    };
    return (
      <Card className="animate-fade-up p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><CheckCircle2 className="h-8 w-8" aria-hidden /></span>
          <div>
            <h2 className="text-2xl font-extrabold text-ink-900">تم حجزك بنجاح</h2>
            <p className="mt-2 text-sm leading-7 text-ink-600">مع د. {doctorName} — {formatSlotDayLabel(confirmation.slot)}.</p>
          </div>
        </div>
        <div className="mt-5 rounded-2xl bg-brand-50 p-6 text-center" aria-live="polite">
          <p className="text-sm font-bold text-brand-800">رقمك في الكشف</p>
          <p className="mt-2 text-5xl font-black text-brand-800">{queueNumber ?? '—'}</p>
          {queueNumber === null && <p className="mt-2 text-sm text-ink-600">الحجز محفوظ، لكن تعذّر عرض رقم الدور الآن. راجعي متابعة الحجز.</p>}
        </div>
        <div className="mt-6 grid gap-4 rounded-2xl bg-[#eff5ec] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-brand-800"><ExternalLink className="h-4 w-4"/> تابع دورك من غير حساب</p>
            <p className="mt-2 text-sm leading-7 text-ink-700">احتفظ برابط المتابعة لمشاهدة دورك وعدد المرضى اللي قبلك.</p>
          </div>
          {followUpLink && <a href={followUpLink} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800">تابع دورك <ExternalLink className="mr-2 h-4 w-4"/></a>}
        </div>
        {followUpLink ? <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={copyFollowUp}><Copy className="h-4 w-4" /> {linkCopied ? 'تم نسخ رابط المتابعة' : 'انسخ رابط المتابعة'}</Button>
            <a href={`https://wa.me/?text=${encodeURIComponent(`احتفظ برابط متابعة حجز الكشف على دَوْرك:\n${followUpLink}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink-200 px-4 text-sm font-bold text-brand-700">احفظه في واتساب</a>
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs leading-6 text-ink-500"><ShieldCheck className="mt-1 h-4 w-4 shrink-0"/> الرابط خاص بحجزك؛ احتفظ به لنفسك ولا تشاركه علنًا.</p>
        </> : <Alert tone="info">الحجز محفوظ، لكن رابط المتابعة غير متاح حاليًا. افتح «حجوزاتي» لمراجعة الحجز.</Alert>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5">
          <p className="text-xs text-ink-500">رقم مرجعي للحجز: <span className="font-mono font-bold" dir="ltr">{confirmation.ref}</span></p>
          <div className="flex gap-2"><Button variant="secondary" onClick={resetBooking}>حجز آخر</Button><Link to="/dashboard" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-brand-200 px-4 text-sm font-semibold text-brand-700">حجوزاتي</Link></div>
        </div>
        {formError && <div className="mt-4"><Alert tone="error">{formError}</Alert></div>}
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <CalendarCheck2 className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink-900">اختار يوم الكشف</h2>
          <p className="text-sm text-ink-500">اختار اليوم المناسب من الأيام المتاحة.</p>
        </div>
      </div>


      <div className="mt-6">
        {slotsLoading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-ink-100" />
        ) : slotsError ? (
          <Alert tone="error">{slotsError}</Alert>
        ) : days.length === 0 ? (
          <EmptyState
            icon={<Clock3 className="h-7 w-7" aria-hidden />}
            title="لا توجد مواعيد متاحة"
            text="لا توجد أيام متاحة للحجز حاليًا."
          />
        ) : (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-700">اليوم</p>
              <input
                type="date"
                aria-label="يوم الكشف"
                value={selectedDateInput}
                min={todayKey}
                max={lastDateKey}
                onChange={(event) => selectDay(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-ink-200 bg-white px-4 text-ink-900"
              />
              {selectedDateInput && !activeDay && <p className="mt-2 text-sm text-ink-600">اليوم ده غير متاح للحجز. اختار يوم تاني.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {days.slice(0, 10).map((day) => (
                  <button key={day.key} type="button" onClick={() => selectDay(day.key)}
                    className={`rounded-xl border px-3 py-2 text-sm ${activeDay?.key === day.key ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 text-ink-700'}`}>
                    {day.label}
                  </button>
                ))}
              </div>
            </div>



          </div>
        )}
      </div>

      {(selectedSlot ?? activeDay?.slots[0]) && !slotsLoading && (
        <div className="animate-fade-up mt-6 border-t border-ink-100 pt-6">
          <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
            يوم كشفك: {formatSlotDayLabel((selectedSlot ?? activeDay!.slots[0]))}
          </div>

          {hasRole('admin') ? (
            <Alert tone="info">حساب إدارة المنصة مخصص للإشراف فقط. لاختبار حجز مريض، سجّلي الدخول بحساب مستخدم تجريبي منفصل.</Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Field label="اسم المريض" htmlFor="patient-name">
                <TextInput
                  id="patient-name"
                  value={patientName}
                  onChange={(event) => setPatientName(event.target.value)}
                  autoComplete="off"
                  placeholder="اكتب اسم المريض"
                  maxLength={80}
                  required
                />
              </Field>
              <Field label="رقم الموبايل" htmlFor="patient-phone" hint="بكود الدولة، مثل +20 أو +966">
                <TextInput
                  id="patient-phone"
                  value={patientPhone}
                  onChange={(event) => setPatientPhone(event.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+201xxxxxxxxx"
                  dir="ltr"
                  className="text-start"
                  required
                />
              </Field>

              {formError && <Alert tone="error">{formError}</Alert>}

              {(!session || isGuestSession(session)) && <p className="text-xs leading-6 text-ink-500">يمكنك الحجز دون إنشاء حساب. احفظ رقم الحجز بعد التأكيد، فالدخول من جهاز آخر لن يُظهره تلقائيًا.</p>}
              <Button type="submit" size="lg" fullWidth loading={submitting}>
                أكد الحجز · {formatEgp(price)}
              </Button>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}
