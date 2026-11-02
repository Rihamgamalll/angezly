import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowUpLeft, CalendarDays, CheckCircle2, Clock3, Copy, HeartPulse, Link2, RefreshCw, ShieldCheck, Users, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card } from '@/components/ui';
import { formatCairoDateTime, getErrorMessage } from '@/lib/format';
import { useDocumentMeta } from '@/lib/hooks';
import { Link } from '@/lib/router';
import { supabase } from '@/lib/supabase';

const POLL_MS = 8000;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

type FollowUp = {
  doctor_name: string;
  doctor_slug: string;
  clinic_name: string;
  clinic_address: string;
  slot_start: string;
  appointment_status: 'booked' | 'completed' | 'no_show' | 'cancelled';
  queue_number: number | null;
  current_number: number | null;
  patients_ahead: number | null;
  queue_status: 'waiting' | 'in_progress' | 'completed' | 'no_show' | null;
  updated_at: string;
};

function extractToken(text: string): string {
  const input = text.trim();
  if (TOKEN_PATTERN.test(input)) return input;
  try {
    const url = new URL(input);
    return TOKEN_PATTERN.test(url.hash.slice(1)) && url.pathname === '/track' ? url.hash.slice(1) : '';
  } catch { return ''; }
}

export function AppointmentTrackingPage() {
  useDocumentMeta('متابعة موعد الكشف | دَوْرك', 'تابع حالة حجزك والدور في العيادة من خلال رابطك الخاص.');
  const [token, setToken] = useState(() => extractToken(window.location.hash.slice(1)));
  const [pastedLink, setPastedLink] = useState('');
  const [info, setInfo] = useState<FollowUp | null>(null);
  const [loading, setLoading] = useState(Boolean(window.location.hash));
  const [error, setError] = useState('');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!token) return;
    if (!quiet) setLoading(true);
    const { data, error: rpcError } = await supabase.rpc('get_appointment_tracking', { p_token: token });
    if (rpcError) {
      setError(getErrorMessage(rpcError));
    } else {
      const row = (data?.[0] ?? null) as FollowUp | null;
      setInfo(row);
      setError(row ? '' : 'الرابط غير صالح أو انتهت صلاحيته. استخدم رابط المتابعة الذي حصلت عليه بعد الحجز.');
      setLastChecked(new Date());
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void load();
    const interval = window.setInterval(() => { if (!document.hidden) void load(true); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) void load(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [load, token]);

  useEffect(() => {
    const syncHash = () => {
      const next = extractToken(window.location.hash.slice(1));
      if (next && next !== token) { setToken(next); setInfo(null); setError(''); }
    };
    window.addEventListener('hashchange', syncHash);
    window.addEventListener('popstate', syncHash);
    return () => { window.removeEventListener('hashchange', syncHash); window.removeEventListener('popstate', syncHash); };
  }, [token]);

  const submitLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = extractToken(pastedLink);
    if (!found) { setError('الصق رابط المتابعة كاملًا كما ظهر بعد الحجز.'); return; }
    window.history.replaceState(null, '', `/track#${found}`);
    setInfo(null);
    setError('');
    setToken(found);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/track#${token}`);
      setCopySuccess(true);
      window.setTimeout(() => setCopySuccess(false), 2600);
    } catch {
      setError('تعذّر نسخ الرابط تلقائيًا. يمكنك نسخه من شريط عنوان المتصفح.');
    }
  };

  const isFinished = info?.appointment_status === 'completed' || info?.queue_status === 'completed';
  const isCancelled = info?.appointment_status === 'cancelled';
  const isAbsent = info?.appointment_status === 'no_show' || info?.queue_status === 'no_show';
  const inConsultation = info?.queue_status === 'in_progress';
  const waiting = info?.queue_status === 'waiting';
  const hasArrived = info?.queue_number != null;
  const stage = isFinished ? 3 : isCancelled || isAbsent ? 0 : inConsultation ? 2 : waiting ? 1 : 0;
  const stateText = isCancelled ? 'تم إلغاء الموعد' : isAbsent ? 'تم تسجيل عدم الحضور' : isFinished ? 'اكتمل الكشف' : inConsultation ? 'جاري الكشف الآن' : waiting ? 'أنت في قائمة الانتظار' : 'موعدك مؤكد';
  const stateDescription = isCancelled ? 'أُلغِي هذا الموعد. يمكنك التواصل مع العيادة لحجز موعد جديد.'
    : isAbsent ? 'سجّلت العيادة عدم الحضور. يُرجى التواصل معها إذا كانت هناك مشكلة.'
    : isFinished ? 'انتهت زيارتك. نتمنى لك دوام الصحة.'
    : inConsultation ? 'وصل دورك، والطبيب يجري الكشف الآن.'
    : waiting ? 'تم تسجيل وصولك. يتحدث ترتيب الانتظار تلقائيًا أثناء عمل العيادة.'
    : 'عند وصولك إلى العيادة، أبلغ الاستقبال لتسجيل حضورك وتحديد رقم دورك.';

  return <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-brand-700"><HeartPulse className="h-4 w-4" /> دَوْرك معاك خطوة بخطوة</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">متابعة موعد الكشف</h1>
        <p className="mt-3 text-sm leading-7 text-ink-600">اعرف حالة حجزك والدور في العيادة، من غير ما تحتاج تعمل حساب.</p>
      </div>
      <span className="flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700"><ShieldCheck className="h-4 w-4"/> رابط متابعة خاص وآمن</span>
    </div>

    {!token ? <Card className="p-6 sm:p-8">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Link2 className="h-6 w-6"/></div>
      <h2 className="text-xl font-extrabold text-ink-900">معاك رابط متابعة الحجز؟</h2>
      <p className="mt-2 max-w-xl text-sm leading-7 text-ink-600">بعد تأكيد الحجز بيظهر لك رابط خاص. احتفظ به في ملاحظاتك أو ابعته لنفسك على واتساب، وارجع افتحه في أي وقت لمتابعة دورك.</p>
      <form onSubmit={submitLink} className="mt-6 space-y-3">
        <label htmlFor="tracking-link" className="block text-sm font-bold text-ink-800">رابط المتابعة</label>
        <input id="tracking-link" type="text" dir="ltr" autoComplete="off" value={pastedLink} onChange={e => setPastedLink(e.target.value)} placeholder="الصق رابط المتابعة هنا" className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" required/>
        <Button type="submit" size="lg">عرض الحجز <ArrowUpLeft className="h-4 w-4"/></Button>
      </form>
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
      <p className="mt-5 text-xs leading-6 text-ink-500">للحجوزات القديمة من نفس المتصفح: <Link to="/dashboard" className="font-bold text-brand-700 underline">افتح حجوزاتي واستخرج رابطًا</Link>.</p>
    </Card> : <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}
      {loading && !info ? <Card className="p-9 text-center text-sm text-ink-500">جارٍ تحميل حالة حجزك...</Card> : info ? <>
        <div className="overflow-hidden rounded-[28px] border border-brand-100 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-[#eaf2e9] via-[#f5f8f1] to-white p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-bold text-brand-700">موعدك مع الطبيب</p><h2 className="mt-1 text-2xl font-extrabold text-ink-900">د. {info.doctor_name}</h2><p className="mt-2 text-sm text-ink-600">{info.clinic_name || info.clinic_address}</p></div>
              <Badge tone={isCancelled || isAbsent ? 'neutral' : isFinished ? 'success' : 'brand'}>{stateText}</Badge>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-ink-800"><CalendarDays className="h-5 w-5 text-brand-700"/>{formatCairoDateTime(info.slot_start)}</p>
          </div>
          <div className="p-6 sm:p-8">
            <div aria-live="polite" className="rounded-2xl bg-brand-50 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-brand-800">{stateText}</p>{!isCancelled && !isAbsent && !isFinished && <span className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"/> تحديث تلقائي</span>}</div>
              <p className="mt-2 text-sm leading-7 text-ink-700">{stateDescription}</p>
              {!isCancelled && !isAbsent && !isFinished && hasArrived && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white p-4"><p className="text-xs text-ink-500">رقم دورك</p><strong className="mt-2 block text-3xl text-ink-900">{info.queue_number}</strong></div>
                <div className="rounded-xl bg-white p-4"><p className="text-xs text-ink-500">الدور الجاري</p><strong className="mt-2 block text-2xl text-ink-900">{info.current_number || 'لم يبدأ بعد'}</strong></div>
                <div className="col-span-2 rounded-xl bg-white p-4 sm:col-span-1"><p className="text-xs text-ink-500">المنتظرون قبلك</p><strong className="mt-2 block text-3xl text-ink-900">{inConsultation ? '0' : (info.patients_ahead ?? 0)}</strong></div>
              </div>}
              {!isCancelled && !isAbsent && !isFinished && !hasArrived && <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-ink-700">رقم الدور يظهر بعد تسجيل حضورك لدى العيادة، وليس عند حجز الموعد.</p>}
            </div>
            {!isCancelled && !isAbsent && <div className="mt-7">
              <p className="mb-4 text-sm font-extrabold text-ink-900">مراحل زيارتك</p>
              <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[{label:'تأكيد الحجز',number:0},{label:'تسجيل الوصول',number:1},{label:'بدء الكشف',number:2},{label:'اكتمال الكشف',number:3}].map(({label,number})=><li key={number} className={`rounded-xl border p-3 text-center text-xs font-bold ${stage>=number?'border-brand-200 bg-brand-50 text-brand-800':'border-ink-100 bg-white text-ink-400'}`}><div className="mb-2 flex justify-center">{stage>=number?<CheckCircle2 className="h-5 w-5"/>:<span className="flex h-5 w-5 items-center justify-center rounded-full border">{number+1}</span>}</div>{label}</li>)}
              </ol>
            </div>}
            {(isCancelled || isAbsent) && <div className="mt-5 flex items-center gap-2 text-sm text-ink-600"><XCircle className="h-5 w-5" /> لو محتاج موعدًا جديدًا، تواصل مع العيادة.</div>}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5 text-xs text-ink-500">
              <span className="flex items-center gap-2"><Clock3 className="h-4 w-4"/> آخر تحديث للعيادة: {formatCairoDateTime(info.updated_at)}</span>
              <span>{lastChecked ? `تم التحقق ${lastChecked.toLocaleTimeString('ar-EG',{timeZone:'Africa/Cairo',hour:'numeric',minute:'2-digit',second:'2-digit'})}` : 'جارٍ التحقق...'}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => void load()} loading={loading}><RefreshCw className="h-4 w-4"/> تحديث الآن</Button>
          <Button variant="secondary" onClick={copyLink}><Copy className="h-4 w-4"/> {copySuccess ? 'تم نسخ الرابط' : 'نسخ رابط المتابعة'}</Button>
          {info.doctor_slug && <Link to={`/doctor/${info.doctor_slug}`} className="inline-flex min-h-10 items-center rounded-xl border border-ink-200 px-4 text-sm font-bold text-brand-700">صفحة الطبيب <ArrowUpLeft className="mr-2 h-4 w-4"/></Link>}
        </div>
        <p className="text-xs leading-6 text-ink-500">تظهر التغييرات عادةً خلال ثوانٍ أثناء فتح الصفحة. عدد المنتظرين مبني على من سجّلت العيادة حضورهم؛ لا يمثل تقديرًا دقيقًا لوقت الانتظار. احتفظ بالرابط لنفسك، فمَن يملكه يستطيع رؤية حالة الحجز.</p>
      </> : <Card className="p-6"><h2 className="mb-2 text-lg font-bold">تعذّر عرض الحجز</h2><p className="text-sm text-ink-500">تأكد من رابط المتابعة. لو فقدته وكان الحجز على نفس الجهاز، تقدر تفتحه من حجوزاتي.</p><button type="button" onClick={()=>{setToken('');window.history.replaceState(null,'','/track');setError('');}} className="mt-4 text-sm font-bold text-brand-700 underline">إدخال رابط مختلف</button></Card>}
    </div>}
  </section>;
}
