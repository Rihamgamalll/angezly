import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, GraduationCap, Stethoscope, ExternalLink, RefreshCw } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, Spinner } from '@/components/ui';
import { PageHeading } from '@/components/PageHeading';
import { APPOINTMENT_STATUS_LABELS } from '@/lib/constants';
import { formatCairoDateTime, formatWeekdays, formatTime, getErrorMessage } from '@/lib/format';
import { Link, navigate } from '@/lib/router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface BookedDoctor { full_name: string; slug: string; specialty: string; clinic_address: string }
interface BookedTeacher { full_name: string; slug: string }
interface BookedGroup { name: string; weekdays: number[]; start_time: string; end_time: string; location: string; teachers: BookedTeacher | null }
interface MyAppointment { id: string; slot_start: string; status: string; doctors: BookedDoctor | null }
interface MyEnrollment { id: string; booking_ref: string; status: string; student_name: string; teacher_groups: BookedGroup | null }

export function MyBookingsPage() {
  const { session, sessionLoading } = useAuth();
  const [tab, setTab] = useState<'doctors' | 'teachers'>('doctors');
  const [appointments, setAppointments] = useState<MyAppointment[]>([]);
  const [enrollments, setEnrollments] = useState<MyEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [queueId,setQueueId]=useState('');
  const [queueInfo,setQueueInfo]=useState<{queue_number:number;current_number:number;patients_ahead:number;queue_status:string;updated_at:string}|null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!session) { setLoading(false); return; }
    if (!quiet) setLoading(true);
    const [apts, groups] = await Promise.all([
      supabase.from('appointments').select('id,slot_start,status,doctors(full_name,slug,specialty,clinic_address)').eq('patient_id', session.user.id).order('slot_start', { ascending: false }),
      supabase.from('group_enrollments').select('id,booking_ref,status,student_name,teacher_groups(name,weekdays,start_time,end_time,location,teachers(full_name,slug))').eq('student_id', session.user.id).order('created_at', { ascending: false }),
    ]);
    if (apts.error || groups.error) setError(getErrorMessage(apts.error ?? groups.error));
    else { setAppointments((apts.data ?? []) as unknown as MyAppointment[]); setEnrollments((groups.data ?? []) as unknown as MyEnrollment[]); }
    setLoading(false);
  }, [session]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => { if (!document.hidden) void load(true); }, 12000);
    const onVisible = () => { if (!document.hidden) void load(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [session, load]);
  const openTracking = async (id: string) => {
    setTrackingId(id); setError('');
    const { data, error: rpcError } = await supabase.rpc('create_appointment_tracking_link', { p_appointment_id: id });
    setTrackingId('');
    if (rpcError || !data) { setError('تعذّر إنشاء رابط المتابعة. تأكد من تشغيل تحديث V11 في Supabase ثم حاول مرة أخرى.'); return; }
    navigate(`/track#${data}`);
  };

  useEffect(() => {
    if(!queueId)return;
    let active=true;
    const fetchQueue=async()=>{const {data,error:e}=await supabase.rpc('get_patient_queue_progress',{p_appointment_id:queueId});if(!active)return;if(e)setError(getErrorMessage(e));else setQueueInfo((data?.[0]??null) as typeof queueInfo);};
    void fetchQueue();const interval=window.setInterval(()=>void fetchQueue(),10000);return()=>{active=false;clearInterval(interval)};
  },[queueId]);
  const cancel = async (kind: 'doctor' | 'teacher', id: string) => {
    if (!window.confirm('هل تريد بالتأكيد إلغاء هذا الحجز؟')) return;
    setActionId(id); setError(''); setSuccess('');
    const result = kind === 'doctor'
      ? await supabase.rpc('cancel_appointment', { p_appointment_id: id })
      : await supabase.rpc('cancel_group_enrollment', { p_enrollment_id: id });
    setActionId('');
    if (result.error) setError(getErrorMessage(result.error));
    else { setSuccess('تم إلغاء الحجز بنجاح.'); void load(); }
  };
  if (sessionLoading || loading && !session) return <Spinner />;
  if (!session) return <div className="mx-auto max-w-3xl px-4 py-16"><Alert tone="info">سجّل الدخول للاطلاع على حجوزاتك. <Link to="/login?next=/dashboard" className="font-bold underline">تسجيل الدخول</Link></Alert></div>;
  return <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
    <PageHeading title="حجوزاتي" text="مواعيدك هنا، ويمكنك متابعة حالة دورك والاحتفاظ برابط خاص لكل كشف." />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4"><p className="max-w-xl text-sm leading-7 text-ink-700">لحجز كشف من غير حساب: اضغط «افتح المتابعة» واحفظ الرابط. هتقدر ترجع من أي جهاز وتشوف تحديثات العيادة.</p><Button variant="secondary" onClick={()=>void load(true)}><RefreshCw className="h-4 w-4"/> تحديث الحجوزات</Button></div>
    <div className="mb-6 flex flex-wrap gap-2"><Button variant={tab === 'doctors' ? 'primary' : 'secondary'} onClick={() => setTab('doctors')}><Stethoscope className="h-4 w-4" /> الحجوزات الطبية</Button><Button variant={tab === 'teachers' ? 'primary' : 'secondary'} onClick={() => setTab('teachers')}><GraduationCap className="h-4 w-4" /> حجوزات المجموعات</Button></div>
    {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}{success && <div className="mb-4"><Alert tone="success">{success}</Alert></div>}
    {loading ? <Spinner /> : tab === 'doctors' ? appointments.length === 0
      ? <EmptyState icon={<CalendarDays />} title="لا توجد حجوزات طبية بعد" text="ابحث عن الطبيب المناسب، وستظهر حجوزاتك في هذه الصفحة." action={<Link to="/doctors" className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white">ابحث عن طبيب</Link>} />
      : <div className="space-y-4">{appointments.map(item => <Card key={item.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><Badge tone={item.status === 'booked' ? 'success' : 'neutral'}>{APPOINTMENT_STATUS_LABELS[item.status] ?? item.status}</Badge><h2 className="mt-3 text-lg font-extrabold">{item.doctors?.full_name ?? 'حجز طبي'}</h2><p className="text-sm text-ink-500">{item.doctors?.specialty} · {formatCairoDateTime(item.slot_start)}</p><p className="mt-1 text-sm text-ink-500">{item.doctors?.clinic_address}</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" loading={trackingId===item.id} onClick={()=>void openTracking(item.id)}><ExternalLink className="h-4 w-4"/> افتح المتابعة</Button>{item.doctors?.slug && <Link to={`/doctor/${item.doctors.slug}`} className="rounded-xl border border-brand-200 px-4 py-2 text-sm font-bold text-brand-700">صفحة الطبيب</Link>}{item.status === 'booked' && <Button variant="secondary" onClick={()=>{setQueueId(queueId===item.id?'':item.id);setQueueInfo(null)}}>تفاصيل الدور</Button>}{item.status === 'booked' && <Button variant="danger" loading={actionId === item.id} onClick={() => cancel('doctor', item.id)}>إلغاء</Button>}</div>{queueId===item.id && <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-4">{queueInfo?<div className="grid gap-3 sm:grid-cols-3"><p>رقم دورك: <strong>{queueInfo.queue_number}</strong></p><p>الدور الحالي: <strong>{queueInfo.current_number}</strong></p><p>عدد المنتظرين قبلك: <strong>{queueInfo.patients_ahead}</strong></p><p className="text-xs text-ink-500 sm:col-span-3">آخر تحديث: {formatCairoDateTime(queueInfo.updated_at)}</p></div>:<p className="text-sm text-ink-600">تم تأكيد الحجز؛ رقم الدور يظهر بمجرد تأكيد الحجز بعد تفعيل تحديث قاعدة البيانات. ويمكنك فتح «المتابعة» من أي موبايل بعد حفظ رابطها.</p>}</div>}</div></Card>)}</div>
      : enrollments.length === 0
      ? <EmptyState icon={<GraduationCap />} title="لا توجد مجموعات محجوزة بعد" text="ستظهر مجموعاتك هنا بعد إتمام الحجز." action={<Link to="/teachers" className="rounded-xl bg-edu-600 px-5 py-3 text-sm font-bold text-white">ابحث عن مُدرّس</Link>} />
      : <div className="space-y-4">{enrollments.map(item => <Card key={item.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><Badge tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status === 'active' ? 'حجز مؤكد' : 'ملغى'}</Badge><h2 className="mt-3 text-lg font-extrabold">{item.teacher_groups?.name ?? 'مجموعة دراسية'}</h2><p className="text-sm text-ink-500">{item.teacher_groups?.teachers?.full_name} · {item.student_name}</p>{item.teacher_groups && <p className="mt-1 text-sm text-ink-500">{formatWeekdays(item.teacher_groups.weekdays)} · {formatTime(item.teacher_groups.start_time)} · {item.teacher_groups.location}</p>}<p className="mt-2 text-xs font-semibold text-ink-400" dir="ltr">{item.booking_ref}</p></div><div className="flex gap-2">{item.teacher_groups?.teachers?.slug && <Link to={`/teacher/${item.teacher_groups.teachers.slug}`} className="rounded-xl border border-edu-200 px-4 py-2 text-sm font-bold text-edu-700">صفحة المدرّس</Link>}{item.status === 'active' && <Button variant="danger" loading={actionId === item.id} onClick={() => cancel('teacher', item.id)}>إلغاء</Button>}</div></div></Card>)}</div>
    }
  </section>;
}
