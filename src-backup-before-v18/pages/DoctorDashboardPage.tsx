import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CalendarCheck, Clock3, RefreshCcw, Stethoscope, Users } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, SelectInput, Spinner, TextInput } from '@/components/ui';
import { ShareLinkPanel } from '@/components/ShareLinkPanel';
import { ProfessionalProfileEditor } from '@/components/ProfessionalProfileEditor';
import { APPOINTMENT_STATUS_LABELS, WEEKDAYS } from '@/lib/constants';
import { formatCairoDateTime, formatTime, getErrorMessage } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { Link } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import { getCairoDateKey, useDoctorDashboardStats } from '@/lib/useDoctorDashboardStats';
import { professionalGreeting } from '@/lib/professionalGreeting';
import type { Appointment, Doctor, DoctorAvailability } from '@/lib/types';

type QueueRow = { id:string; appointment_id:string; queue_number:number; status:'waiting'|'in_progress'|'completed'|'no_show'; checked_in_at:string; appointments:{patient_name:string}|null };
export function DoctorDashboardPage(){
  const {session,accountReady,hasRole}=useAuth();
  const [doctor,setDoctor]=useState<Doctor|null>(null);const [appointments,setAppointments]=useState<Appointment[]>([]);
  const {stats,lastUpdated,statsError,refreshStats}=useDoctorDashboardStats(doctor?.id??null);
  const [availability,setAvailability]=useState<DoctorAvailability[]>([]);const [queue,setQueue]=useState<QueueRow[]>([]);
  const [blocked,setBlocked]=useState<Array<{id:string;blocked_date:string;reason:string}>>([]);
  const [dayOff,setDayOff]=useState('');
  const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [success,setSuccess]=useState('');const [busy,setBusy]=useState('');
  const [weekday,setWeekday]=useState('6');const [startTime,setStartTime]=useState('16:00');const [endTime,setEndTime]=useState('21:00');
  const load=useCallback(async()=>{
    if(!session || !accountReady)return;
    setLoading(true);const {data:d,error:e}=await supabase.from('doctors').select('*').eq('user_id',session.user.id).maybeSingle();
    if(e){setError(getErrorMessage(e));setLoading(false);return;}
    setDoctor(d as Doctor|null);
    if(d){const [a,v,q,b]=await Promise.all([
      supabase.from('appointments').select('id,doctor_id,patient_id,patient_name,patient_phone,slot_start,status,created_at').eq('doctor_id',d.id).order('slot_start',{ascending:false}).limit(200),
      supabase.from('doctor_availability').select('id,doctor_id,weekday,start_time,end_time').eq('doctor_id',d.id).order('weekday'),
      supabase.from('clinic_queue').select('id,appointment_id,queue_number,status,checked_in_at,appointments(patient_name)').eq('doctor_id',d.id).eq('queue_date',getCairoDateKey(new Date())).order('queue_number'),
      supabase.from('doctor_blocked_days').select('id,blocked_date,reason').eq('doctor_id',d.id).order('blocked_date',{ascending:true}),
    ]);
    if(a.error||v.error||q.error||b.error)setError(getErrorMessage(a.error??v.error??q.error??b.error));
    setAppointments((a.data??[]) as Appointment[]);setAvailability((v.data??[]) as DoctorAvailability[]);setQueue((q.data??[]) as unknown as QueueRow[]);setBlocked(b.data??[]);
    }
    setLoading(false);
  },[session,accountReady]);
  useEffect(()=>{void load()},[load]);
  useEffect(()=>{if(!doctor)return;const interval=window.setInterval(()=>{void load()},12000);return()=>clearInterval(interval)},[load,doctor]);
  const action=async(id:string,method:'complete'|'no_show'|'cancel'|'check_in'|'queue_next')=>{
    setBusy(id);setError('');setSuccess('');
    const result=method==='cancel' ? await supabase.rpc('cancel_appointment',{p_appointment_id:id})
      :method==='complete'||method==='no_show' ? await supabase.rpc('set_appointment_status',{p_appointment_id:id,p_status:method==='complete'?'completed':'no_show'})
      :method==='check_in'?await supabase.rpc('clinic_check_in',{p_appointment_id:id})
      :await supabase.rpc('clinic_update_queue',{p_queue_id:id,p_action:'next'});
    setBusy('');if(result.error)setError(getErrorMessage(result.error));else{setSuccess('تم تحديث البيانات.');void load();void refreshStats()};
  };
  const addWindow=async(event:FormEvent)=>{event.preventDefault();if(!doctor)return;setError('');if(startTime>=endTime){setError('يجب أن يكون وقت النهاية بعد وقت البداية.');return;}
    setBusy('schedule');const{error:e}=await supabase.from('doctor_availability').insert({doctor_id:doctor.id,weekday:Number(weekday),start_time:startTime,end_time:endTime});setBusy('');if(e)setError(getErrorMessage(e));else{setSuccess('تم حفظ مواعيد العمل.');void load()};
  };
  const deleteWindow=async(id:string)=>{setBusy(id);const{error:e}=await supabase.from('doctor_availability').delete().eq('id',id);setBusy('');if(e)setError(getErrorMessage(e));else void load()};
  const addBlocked=async(event:FormEvent)=>{event.preventDefault();if(!doctor||!dayOff)return;setBusy('blocked');const{error:e}=await supabase.from('doctor_blocked_days').insert({doctor_id:doctor.id,blocked_date:dayOff,reason:'إجازة'});setBusy('');if(e)setError(getErrorMessage(e));else{setDayOff('');void load()}};
  const removeBlocked=async(id:string)=>{setBusy(id);const{error:e}=await supabase.from('doctor_blocked_days').delete().eq('id',id);setBusy('');if(e)setError(getErrorMessage(e));else void load()};
  const updatePrice=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!doctor)return;const form=new FormData(event.currentTarget);const price=Number(form.get('price')),minutes=Number(form.get('minutes'));
    setBusy('settings');const{error:e}=await supabase.from('doctors').update({consultation_price:price,slot_minutes:minutes}).eq('id',doctor.id);setBusy('');if(e)setError(getErrorMessage(e));else{setSuccess('تم تحديث إعدادات الكشف.');void load()};
  };
  if(!session||!accountReady||loading&&doctor===null)return <Spinner label="جاري تحميل بيانات العيادة..."/>;
  if(!hasRole('doctor')||!doctor)return <section className="mx-auto max-w-2xl px-4 py-16"><Alert tone="info">لم يتم إنشاء ملف طبيب لهذا الحساب. <Link to="/register/doctor" className="font-bold underline">سجّل عيادتك</Link></Alert></section>;
  const refreshedAt=lastUpdated?.toLocaleTimeString('ar-EG',{timeZone:'Africa/Cairo',hour:'numeric',minute:'2-digit'});
  return <section className="work-dashboard doctor-work-dashboard mx-auto max-w-6xl space-y-7 px-4 py-10 sm:px-6">
    <div className="work-hero doctor-work-hero"><div><p className="work-hero-label">لوحة إدارة العيادة</p><h1>{professionalGreeting('doctor', doctor.full_name)} <span>✳</span></h1><p>{doctor.clinic_name} · {doctor.city}</p></div><span className="work-hero-art" aria-hidden="true">✚</span></div>
    {!doctor.is_published&&<Alert tone="info">ملف الطبيب قيد المراجعة. يمكنك تجهيز مواعيد العمل، وسيظهر للمرضى بعد الموافقة.</Alert>}
    {error&&<Alert tone="error">{error}</Alert>}{success&&<Alert tone="success">{success}</Alert>}
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
        <span aria-live="polite">{statsError ? 'تعذّر تحديث الإحصائيات مؤقتًا، سنحاول مرة أخرى.' : refreshedAt ? `آخر تحديث ${refreshedAt} · تتحدث الأرقام تلقائيًا` : 'جاري تحديث إحصائيات العيادة...'}</span>
        <button type="button" onClick={()=>{void refreshStats();void load()}} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-brand-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"><RefreshCcw className="h-4 w-4" aria-hidden="true"/> تحديث الآن</button>
      </div>
<div className="work-stats grid gap-4 sm:grid-cols-3" aria-live="polite">
  {[
    { icon: CalendarCheck, label: 'الحجوزات القادمة', value: stats?.upcomingBookings },
    { icon: Users, label: 'في العيادة الآن', value: stats?.atClinicNow },
    { icon: Stethoscope, label: 'زيارات مكتملة', value: stats?.completedVisits },
  ].map(({ icon: Icon, label, value }) => (
    <Card key={label} className="work-stat-card flex items-center gap-4 p-5">
      <span className="work-stat-card__icon shrink-0 rounded-xl bg-brand-50 p-3 text-brand-700">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="work-stat-card__body min-w-0">
        <p className="work-stat-card__label">{label}</p>
        <p className="work-stat-card__value tabular-nums" dir="ltr">{value ?? '—'}</p>
      </div>
    </Card>
  ))}
</div>
    </div>
    <div className="rounded-xl border border-brand-100 bg-brand-50 px-5 py-4 text-sm leading-7 text-ink-700"><strong className="text-brand-900">كيف يعرف المرضى دورهم؟</strong> بعد الحجز يحصل كل مريض على رابط متابعة خاص به. عند الضغط على «تسجيل حضور» يظهر رقم دوره، وعند «ابدأ الكشف» و«إنهاء الدور» تتجدد حالته على صفحة المتابعة تلقائيًا خلال ثوانٍ. لا تظهر أسماء المرضى الآخرين.</div>
    <ShareLinkPanel kind="doctor" slug={doctor.slug}/>
    <ProfessionalProfileEditor kind="doctor" professionalId={doctor.id} initialBio={doctor.bio} initialQualifications={doctor.qualifications} initialVisitorNote={doctor.visitor_note ?? ''} initialPhotoUrl={doctor.photo_url} onSaved={() => { void load(); }} />
    <div className="grid gap-6 lg:grid-cols-5"><Card className="p-5 lg:col-span-3"><h2 className="mb-4 text-xl font-bold">الحجوزات <span className="text-sm font-normal text-ink-400">(آخر 200)</span></h2><div className="max-h-[520px] space-y-3 overflow-auto">{appointments.map(a=><div key={a.id} className="rounded-xl border border-ink-100 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold">{a.patient_name}</p><p className="text-xs text-ink-500">{formatCairoDateTime(a.slot_start)} · <span dir="ltr">{a.patient_phone}</span></p></div><Badge tone={a.status==='booked'?'success':'neutral'}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge></div>{a.status==='booked'&&<div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" disabled={busy===a.id} onClick={()=>action(a.id,'check_in')}>تسجيل حضور</Button><Button variant="secondary" disabled={busy===a.id} onClick={()=>action(a.id,'complete')}>تم الكشف</Button><Button variant="ghost" disabled={busy===a.id} onClick={()=>action(a.id,'no_show')}>لم يحضر</Button><Button variant="danger" disabled={busy===a.id} onClick={()=>action(a.id,'cancel')}>إلغاء</Button></div>}</div>)}{appointments.length===0&&<p className="text-sm text-ink-500">لا توجد حجوزات حتى الآن.</p>}</div></Card>
    <Card className="p-5 lg:col-span-2"><h2 className="mb-4 text-xl font-bold">الدور في العيادة</h2><p className="mb-4 text-xs leading-6 text-ink-500">يُحدَّث ترتيب الانتظار بعد تسجيل حضور المرضى، ويمكنك الانتقال للمريض التالي من هنا.</p><div className="space-y-2">{queue.filter(q=>q.status==='waiting'||q.status==='in_progress').map(q=><div key={q.id} className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-bold">#{q.queue_number} · {q.appointments?.patient_name}</p><Badge tone={q.status==='in_progress'?'brand':'warning'}>{q.status==='in_progress'?'جاري الكشف':'منتظر'}</Badge></div><Button disabled={busy===q.id} variant="secondary" onClick={()=>action(q.id,'queue_next')}>{q.status==='waiting'?'ابدأ الكشف':'إنهاء الدور'}</Button></div>)}{queue.every(q=>q.status!=='waiting'&&q.status!=='in_progress')&&<p className="text-sm text-ink-500">لا يوجد مرضى في قائمة الانتظار حاليًا.</p>}</div></Card></div>
    <div className="grid gap-6 lg:grid-cols-2"><Card className="p-6"><h2 className="mb-4 text-xl font-bold">مواعيد العمل</h2><div className="space-y-2">{availability.map(a=><div key={a.id} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-sm"><span>{WEEKDAYS.find(d=>d.value===a.weekday)?.label} · {formatTime(a.start_time)} - {formatTime(a.end_time)}</span><Button variant="ghost" disabled={busy===a.id} onClick={()=>deleteWindow(a.id)}>حذف</Button></div>)}</div><form className="mt-5 space-y-3 border-t pt-4" onSubmit={addWindow}><h3 className="font-bold">إضافة فترة عمل</h3><Field htmlFor="weekday" label="اليوم"><SelectInput id="weekday" value={weekday} onChange={e=>setWeekday(e.target.value)}>{WEEKDAYS.map(day=><option key={day.value} value={day.value}>{day.label}</option>)}</SelectInput></Field><div className="grid grid-cols-2 gap-3"><Field htmlFor="from" label="من"><TextInput type="time" id="from" value={startTime} onChange={e=>setStartTime(e.target.value)}/></Field><Field htmlFor="to" label="إلى"><TextInput type="time" id="to" value={endTime} onChange={e=>setEndTime(e.target.value)}/></Field></div><Button type="submit" loading={busy==='schedule'}>إضافة الميعاد</Button></form></Card>
    <Card className="p-6"><h2 className="mb-4 text-xl font-bold">إعدادات الكشف</h2><form onSubmit={updatePrice} className="space-y-4"><Field htmlFor="price" label="سعر الكشف بالجنيه"><TextInput id="price" key={`p-${doctor.consultation_price}`} name="price" type="number" min={0} max={100000} defaultValue={doctor.consultation_price} required/></Field><Field htmlFor="mins" label="مدة الكشف (بالدقيقة)"><SelectInput id="mins" key={`m-${doctor.slot_minutes}`} name="minutes" defaultValue={doctor.slot_minutes}>{[5,10,15,20,30,40,45,60,90,120].map(n=><option key={n} value={n}>{n} دقيقة</option>)}</SelectInput></Field><Button type="submit" loading={busy==='settings'}><Clock3 className="h-4 w-4"/> حفظ الإعدادات</Button><p className="text-xs leading-6 text-ink-500">مهم: تغيير مدة الكشف ممكن يؤثر على المواعيد الجديدة. الحجوزات السابقة لا تتغير تلقائيًا.</p></form></Card></div>
    <Card className="p-6"><h2 className="mb-4 text-xl font-bold">أيام الإجازات</h2><p className="mb-4 text-sm text-ink-500">لن تظهر أيام الإجازات ضمن المواعيد المتاحة، وسيمنع النظام الحجز خلالها.</p><div className="mb-4 flex flex-wrap gap-2">{blocked.map(b=><div key={b.id} className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">{b.blocked_date}<button type="button" onClick={()=>removeBlocked(b.id)} disabled={busy===b.id} aria-label="إزالة الإجازة">✕</button></div>)}</div><form onSubmit={addBlocked} className="flex flex-wrap items-end gap-3"><div className="min-w-52"><Field htmlFor="blocked-day" label="يوم الإجازة"><TextInput id="blocked-day" type="date" min={new Date().toISOString().slice(0,10)} value={dayOff} onChange={e=>setDayOff(e.target.value)} required/></Field></div><Button type="submit" loading={busy==='blocked'}>إضافة إجازة</Button></form></Card>
  </section>;
}
