import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarCheck2, CheckCircle2, Clock3, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { Alert, Button, Card, EmptyState, Field, TextInput } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { isGuestSession } from '@/lib/role-routing';
import { Link } from '@/lib/router';
import { formatEgp, getErrorMessage, isValidEgyptianPhone } from '@/lib/format';
import { buildUpcomingSlots, cairoDateKey, formatSlotDayLabel, formatSlotTime, type AvailabilityWindow } from '@/lib/schedule';
import { supabase } from '@/lib/supabase';
import { guestBookingErrorMessage } from '@/lib/guestBookingError';
import { downloadCalendarInvite } from '@/lib/calendarInvite';

const BOOKING_WINDOW_DAYS = 14;
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

  const slots = useMemo(
    () => buildUpcomingSlots(availability, slotMinutes, new Set<number>(), BOOKING_WINDOW_DAYS).filter(slot=>{
      const start=slot.getTime(), end=start+slotMinutes*60000;
      return !blockedDays.has(cairoDateKey(slot)) && !busyIntervals.some(b=>start<b.end&&end>b.start);
    }),
    [availability, slotMinutes, busyIntervals, blockedDays],
  );

  const days = useMemo(() => {
    const map = new Map<string, DayOption>();
    for (const slot of slots) {
      const key = cairoDateKey(slot);
      const entry = map.get(key) ?? { key, label: formatSlotDayLabel(slot), slots: [] };
      entry.slots.push(slot);
      map.set(key, entry);
    }
    return [...map.values()];
  }, [slots]);

  const activeDay = days.find((day) => day.key === selectedDayKey) ?? days[0] ?? null;

  const selectDay = (key: string) => {
    setSelectedDayKey(key);
    setSelectedSlot(null);
  };

  const resetBooking = () => {
    setConfirmation(null);
    setLinkCopied(false);
    setSelectedSlot(null);
    setFormError('');
    loadTakenSlots();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSlot || submitting) return;

    const name = patientName.trim();
    const phone = patientPhone.trim();
    if (name.length < 2) {
      setFormError('يرجى إدخال اسم المريض بشكل صحيح.');
      return;
    }
    if (!isValidEgyptianPhone(phone)) {
      setFormError('رقم الموبايل لازم يكون رقم مصري صحيح (01xxxxxxxxx).');
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
    const { data, error } = await supabase.rpc('book_appointment', {
      p_doctor_id: doctorId,
      p_slot_start: selectedSlot.toISOString(),
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
    setConfirmation({ slot: selectedSlot, ref: String(data).slice(0, 8).toUpperCase(), token: trackingError ? null : String(trackingToken ?? '') || null });
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
            <h2 className="text-2xl font-extrabold text-ink-900">تم تأكيد موعدك بنجاح</h2>
            <p className="mt-2 text-sm leading-7 text-ink-600">مع د. {doctorName}، يوم {formatSlotDayLabel(confirmation.slot)} الساعة {formatSlotTime(confirmation.slot)}.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 rounded-2xl bg-[#eff5ec] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-brand-800"><ExternalLink className="h-4 w-4"/> تابع دورك من غير حساب</p>
            <p className="mt-2 text-sm leading-7 text-ink-700">احفظ رابط المتابعة الآن. افتحه لاحقًا من أي موبايل لتعرف حالة حجزك، ورقم دورك بعد تسجيل وصولك للعيادة.</p>
          </div>
          {followUpLink && <a href={followUpLink} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800">تابع دورك <ExternalLink className="mr-2 h-4 w-4"/></a>}
        </div>
        {followUpLink ? <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => downloadCalendarInvite({ title: `كشف مع د. ${doctorName}`, description: 'حجز من دَوْرك — احتفظ برابط المتابعة الخاص بك.', start: confirmation.slot, minutes: slotMinutes })}><CalendarCheck2 className="h-4 w-4" />أضف الموعد للتقويم</Button>
            <Button variant="secondary" onClick={copyFollowUp}><Copy className="h-4 w-4" /> {linkCopied ? 'تم نسخ رابط المتابعة' : 'انسخ رابط المتابعة'}</Button>
            <a href={`https://wa.me/?text=${encodeURIComponent(`احتفظ برابط متابعة حجز الكشف على دَوْرك:\n${followUpLink}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink-200 px-4 text-sm font-bold text-brand-700">احفظه في واتساب</a>
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs leading-6 text-ink-500"><ShieldCheck className="mt-1 h-4 w-4 shrink-0"/> الرابط خاص بحجزك؛ احتفظ به لنفسك ولا تشاركه علنًا.</p>
        </> : <Alert tone="info">تم حفظ الحجز بالفعل، لكن رابط المتابعة لم يتوفر. يمكنك استخراجه من «حجوزاتي» على هذا المتصفح بعد تشغيل تحديث V11 لقاعدة البيانات.</Alert>}
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
          <h2 className="text-lg font-bold text-ink-900">اختر موعدك</h2>
          <p className="text-sm text-ink-500">المواعيد المتاحة خلال الأسبوعين المقبلين.</p>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-xs leading-6 text-brand-800">بعد تأكيد الحجز ستحصل على رابط متابعة خاص بك. احتفظ به لتعرف حالة الحجز ودورك في العيادة من أي هاتف، دون إنشاء حساب.</p>
      <div className="mt-6">
        {slotsLoading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-ink-100" />
        ) : slotsError ? (
          <Alert tone="error">{slotsError}</Alert>
        ) : days.length === 0 ? (
          <EmptyState
            icon={<Clock3 className="h-7 w-7" aria-hidden />}
            title="لا توجد مواعيد متاحة"
            text="الدكتور محجوز بالكامل في الأسبوعين الجايين. جرّب تاني بعد شوية."
          />
        ) : (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-700">اليوم</p>
              <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
                {days.map((day) => {
                  const active = activeDay?.key === day.key;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => selectDay(day.key)}
                      aria-pressed={active}
                      className={`min-h-11 shrink-0 snap-start rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                        active ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeDay && (
              <div>
                <p className="mb-2 text-sm font-semibold text-ink-700">الساعة</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {activeDay.slots.map((slot) => {
                    const active = selectedSlot?.getTime() === slot.getTime();
                    return (
                      <button
                        key={slot.getTime()}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        aria-pressed={active}
                        className={`min-h-11 rounded-xl border px-2 py-2 text-sm font-semibold transition duration-200 active:scale-95 ${
                          active ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-ink-200 bg-white text-ink-800 hover:border-brand-400 hover:text-brand-700'
                        }`}
                      >
                        {formatSlotTime(slot)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedSlot && !slotsLoading && (
        <div className="animate-fade-up mt-6 border-t border-ink-100 pt-6">
          <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
            ميعادك: {formatSlotDayLabel(selectedSlot)} الساعة {formatSlotTime(selectedSlot)}
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
              <Field label="رقم الموبايل" htmlFor="patient-phone" hint="للتواصل بشأن الموعد، دون إنشاء حساب">
                <TextInput
                  id="patient-phone"
                  value={patientPhone}
                  onChange={(event) => setPatientPhone(event.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="01xxxxxxxxx"
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
