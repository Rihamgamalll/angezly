import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { BookOpen, CalendarClock, GraduationCap, Plus, Users } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, Modal, SelectInput, Spinner, TextAreaInput, TextInput } from '@/components/ui';
import { ShareLinkPanel } from '@/components/ShareLinkPanel';
import { ProfessionalProfileEditor } from '@/components/ProfessionalProfileEditor';
import { GROUP_MODE_LABELS, PRICE_PERIOD_LABELS, STAGES, SUBJECTS, WEEKDAYS } from '@/lib/constants';
import { formatEgp, formatWeekdays, getErrorMessage, isValidEgyptianPhone } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { Link } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import type { Teacher, TeacherGroup, GroupEnrollment } from '@/lib/types';
import { professionalGreeting } from '@/lib/professionalGreeting';

const COLUMNS = 'id,teacher_id,name,subject,stage,grade,mode,location,weekdays,start_time,end_time,start_date,end_date,price,price_period,capacity,active_enrollments,description,registration_open,is_published,is_demo';
const empty = {name:'',subject:'',stage:'secondary',grade:'تالتة ثانوي',mode:'offline' as 'online'|'offline',location:'',weekdays:[6,2] as number[],start_time:'17:00',end_time:'18:30',start_date:new Date().toISOString().slice(0,10),end_date:'',price:'300',price_period:'month' as 'month'|'session'|'term',capacity:'20',description:'',registration_open:true,is_published:true};
type GroupForm = typeof empty;

export function TeacherDashboardPage() {
  const {session,accountReady,hasRole}=useAuth();
  const [teacher,setTeacher]=useState<Teacher|null>(null);
  const [groups,setGroups]=useState<TeacherGroup[]>([]);
  const [students,setStudents]=useState<GroupEnrollment[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(''); const [success,setSuccess]=useState('');
  const [editId,setEditId]=useState<string|null>(null); const [form,setForm]=useState<GroupForm>(empty);
  const [saving,setSaving]=useState(false);
  const [activeGroup,setActiveGroup]=useState<string>('');
  const [manualName,setManualName]=useState(''); const [manualPhone,setManualPhone]=useState('');
  const [actionId,setActionId]=useState('');
  const [attendanceDate,setAttendanceDate]=useState(new Date().toISOString().slice(0,10));
  const [attendance,setAttendance]=useState<Record<string,string>>({});
  const load=useCallback(async(silent = false)=>{
    if(!session || !accountReady) return;
    if (!silent) { setLoading(true); setError(''); }
    const {data:profile,error:profileError}=await supabase.from('teachers').select('*').eq('user_id',session.user.id).maybeSingle();
    if(profileError){setError(getErrorMessage(profileError));setLoading(false);return;}
    setTeacher(profile as Teacher|null);
    if(profile){
      const g = await supabase.from('teacher_groups').select(COLUMNS).eq('teacher_id',profile.id).order('created_at',{ascending:false});
      const ownedGroups = (g.data ?? []) as TeacherGroup[];
      let groupMembers: GroupEnrollment[] = [];
      let enrollmentsError: unknown = null;
      // Avoid querying `group_id in ()` when the teacher has not made any groups.
      if (ownedGroups.length) {
        const e = await supabase.from('group_enrollments')
          .select('id,group_id,student_id,student_name,student_phone,student_grade,booked_for_child,added_by_teacher,status,booking_ref,created_at')
          .in('group_id', ownedGroups.map(group => group.id));
        if (e.error) enrollmentsError = e.error;
        else groupMembers = (e.data ?? []) as GroupEnrollment[];
      }
      if (g.error || enrollmentsError) setError(getErrorMessage(g.error ?? enrollmentsError));
      setGroups(ownedGroups);
      setStudents(groupMembers);
    }
    setLoading(false);
  },[session,accountReady]);
  useEffect(()=>{void load()},[load]);
  useEffect(() => {
    if (!teacher?.id) return;
    const poll = window.setInterval(() => { void load(true); }, 15000);
    const whenVisible = () => { if (document.visibilityState === 'visible') void load(true); };
    document.addEventListener('visibilitychange', whenVisible);
    return () => { window.clearInterval(poll); document.removeEventListener('visibilitychange', whenVisible); };
  }, [teacher?.id, load]);
  const groupStudents=useMemo(()=>students.filter(s=>s.group_id===activeGroup),[students,activeGroup]);
  useEffect(()=>{
    if(!activeGroup){setAttendance({});return;}let active=true;
    const read=async()=>{
      const {data:sessions}=await supabase.from('group_sessions').select('id').eq('group_id',activeGroup).eq('session_date',attendanceDate).limit(1);
      if(!active)return;
      if(!sessions?.length){setAttendance({});return;}
      const {data:rows}=await supabase.from('student_attendance').select('enrollment_id,status').eq('session_id',sessions[0].id);
      if(active)setAttendance(Object.fromEntries((rows??[]).map(r=>[r.enrollment_id,r.status])));
    };void read();return()=>{active=false};
  },[activeGroup,attendanceDate]);
  const markAttendance=async(id:string,status:'present'|'absent')=>{
    setActionId(id);setError('');const {error:e}=await supabase.rpc('teacher_mark_attendance',{p_enrollment_id:id,p_date:attendanceDate,p_status:status});setActionId('');
    if(e)setError(getErrorMessage(e));else setAttendance(current=>({...current,[id]:status}));
  };
  const openNew=()=>{setForm({...empty,weekdays:[6,2],subject:teacher?.subjects?.[0]??'',location:teacher?.teaching_location??''});setEditId('new');setError('')};
  const openEdit=(g:TeacherGroup)=>{setForm({name:g.name,subject:g.subject,stage:g.stage,grade:g.grade,mode:g.mode,location:g.location,weekdays:g.weekdays,start_time:g.start_time.slice(0,5),end_time:g.end_time.slice(0,5),start_date:g.start_date,end_date:g.end_date??'',price:String(g.price),price_period:g.price_period,capacity:String(g.capacity),description:g.description,registration_open:g.registration_open,is_published:g.is_published});setEditId(g.id);setError('')};
  const save=async(event:FormEvent)=>{
    event.preventDefault(); if(!teacher || !editId)return;
    if(!form.name.trim()||!form.subject||!form.grade||form.weekdays.length===0){setError('يرجى استكمال بيانات المجموعة واختيار يوم واحد على الأقل.');return;}
    if(form.end_time<=form.start_time){setError('يجب أن يكون وقت النهاية بعد وقت البداية.');return;}
    const capacity=Number(form.capacity),price=Number(form.price);
    if(!Number.isInteger(capacity)||capacity<1||capacity>500||price<0){setError('يرجى تحديد عدد طلاب من 1 إلى 500، وسعر صالح.');return;}
    setSaving(true);setError('');const payload={...form,capacity,price,teacher_id:teacher.id,weekdays:form.weekdays,start_date:form.start_date,end_date:form.end_date||null};
    const {teacher_id: _ownerId, ...editable} = payload;
    const result=editId==='new'?await supabase.from('teacher_groups').insert(payload):await supabase.from('teacher_groups').update(editable).eq('id',editId).eq('teacher_id',teacher.id);
    setSaving(false);if(result.error){setError(getErrorMessage(result.error));return;}
    setEditId(null);setSuccess('تم حفظ المجموعة بنجاح.');void load();
  };
  const toggle=(g:TeacherGroup)=>async()=>{setActionId(g.id);setError('');const{error:err}=await supabase.from('teacher_groups').update({registration_open:!g.registration_open}).eq('id',g.id);setActionId('');if(err)setError(getErrorMessage(err));else void load()};
  const addManual=async(event:FormEvent)=>{event.preventDefault();if(!isValidEgyptianPhone(manualPhone)){setError('يرجى إدخال رقم هاتف مصري صحيح.');return;}setActionId('add');setError('');const{error:err}=await supabase.rpc('teacher_add_enrollment',{p_group_id:activeGroup,p_student_name:manualName.trim(),p_student_phone:manualPhone.trim(),p_student_grade:groups.find(g=>g.id===activeGroup)?.grade??''});setActionId('');if(err)setError(getErrorMessage(err));else{setManualName('');setManualPhone('');setSuccess('تمت إضافة الطالب بنجاح.');void load();}};
  const cancel=async(id:string)=>{if(!confirm('هل تريد إلغاء تسجيل هذا الطالب؟'))return;setActionId(id);const{error:err}=await supabase.rpc('cancel_group_enrollment',{p_enrollment_id:id});setActionId('');if(err)setError(getErrorMessage(err));else void load()};
  if(!session||!accountReady||loading)return <Spinner label="جاري تحميل لوحة المُدرّس..."/>;
  if(!hasRole('teacher')||!teacher)return <section className="mx-auto max-w-2xl px-4 py-16"><Alert tone="info">لم يتم إنشاء ملف مُدرّس لهذا الحساب. <Link to="/register/teacher" className="font-bold underline">ابدأ التسجيل</Link></Alert></section>;
  return <section className="work-dashboard teacher-work-dashboard mx-auto max-w-6xl px-4 py-10 sm:px-6">
    <div className="work-hero teacher-work-hero"><div><p className="work-hero-label">لوحة إدارة المجموعات</p><h1>{professionalGreeting('teacher', teacher.full_name)} <span>✳</span></h1><p>كل مجموعة وموعد، في مكان واحد.</p></div><Button onClick={openNew}><Plus className="h-4 w-4"/> إضافة مجموعة</Button><span className="work-hero-art" aria-hidden="true">✳</span></div>
    {!teacher.is_published&&<div className="mb-5"><Alert tone="info">ملفك قيد المراجعة. يمكنك تجهيز مجموعاتك، وسيظهر ملفك للطلاب بعد الموافقة.</Alert></div>}
    {error&&<div className="mb-4"><Alert tone="error">{error}</Alert></div>}{success&&<div className="mb-4"><Alert tone="success">{success}</Alert></div>}
<div className="work-stats grid gap-4 sm:grid-cols-3" aria-live="polite">
  {[
    { icon: BookOpen, label: 'إجمالي المجموعات', value: groups.length },
    { icon: Users, label: 'الطلاب المسجلون', value: groups.reduce((total, group) => total + group.active_enrollments, 0) },
    { icon: CalendarClock, label: 'مجموعات مكتملة', value: groups.filter(group => group.active_enrollments >= group.capacity).length },
  ].map(({ icon: Icon, label, value }) => (
    <Card key={label} className="work-stat-card flex items-center gap-4 p-5">
      <span className="work-stat-card__icon shrink-0 rounded-xl bg-edu-50 p-3 text-edu-700">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="work-stat-card__body min-w-0">
        <p className="work-stat-card__label">{label}</p>
        <p className="work-stat-card__value tabular-nums" dir="ltr">{value}</p>
      </div>
    </Card>
  ))}
</div>
    <div className="my-7 work-share"><ShareLinkPanel kind="teacher" slug={teacher.slug}/></div>
    <div className="mb-7"><ProfessionalProfileEditor kind="teacher" professionalId={teacher.id} initialBio={teacher.bio} initialQualifications={teacher.credentials_summary ?? ''} initialVisitorNote={teacher.visitor_note ?? ''} initialPhotoUrl={teacher.photo_url} onSaved={() => { void load(true); }} /></div>
    <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-extrabold">مجموعاتي<span className="ml-1 text-[#8fa398]">.</span></h2><span className="text-xs text-ink-500">{groups.length} مجموعة</span></div>
    <div className="grid gap-4 md:grid-cols-2">{groups.map(g=><Card key={g.id} className="work-group-card p-5"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-extrabold">{g.name}</h3><Badge tone={!g.registration_open?'neutral':g.active_enrollments>=g.capacity?'danger':'success'}>{!g.registration_open?'التسجيل متوقف':g.active_enrollments>=g.capacity?'المجموعة اكتملت':'متاحة'}</Badge></div><p className="mt-2 text-sm text-ink-500">{g.subject} · {g.grade} · {formatWeekdays(g.weekdays)}</p><p className="mt-1 text-sm text-ink-500">{GROUP_MODE_LABELS[g.mode]} · {formatEgp(g.price)} {PRICE_PERIOD_LABELS[g.price_period]}</p><div className="mt-4 flex items-center justify-between text-sm"><span className="font-bold">{g.active_enrollments} / {g.capacity} طالب</span><span className="text-ink-500">الأماكن المتاحة: {Math.max(0,g.capacity-g.active_enrollments)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-edu-500" style={{width:`${100*g.active_enrollments/g.capacity}%`}} /></div><div className="mt-5 flex flex-wrap gap-2"><Button variant="secondary" onClick={()=>openEdit(g)}>تعديل</Button><Button variant="secondary" onClick={()=>setActiveGroup(g.id)}>الطلاب</Button><Button variant="ghost" disabled={actionId===g.id} onClick={toggle(g)}>{g.registration_open?'إغلاق التسجيل':'فتح التسجيل'}</Button></div></Card>)}
    {groups.length===0&&<Card className="p-10 text-center"><GraduationCap className="mx-auto h-10 w-10 text-edu-500"/><h3 className="mt-3 text-xl font-bold">ابدأ بأول مجموعة</h3><p className="my-3 text-sm text-ink-500">حدد المواعيد وعدد الأماكن، وشارك رابط الحجز مع طلبتك.</p><Button onClick={openNew}>إضافة أول مجموعة</Button></Card>}
    </div>
    <Modal open={!!editId} title={editId==='new'?'إضافة مجموعة جديدة':'تعديل المجموعة'} onClose={()=>setEditId(null)} wide><form onSubmit={save} className="space-y-4"><Field htmlFor="group-name" label="اسم المجموعة"><TextInput id="group-name" value={form.name} required onChange={e=>setForm({...form,name:e.target.value})}/></Field><div className="grid gap-3 sm:grid-cols-2"><Field htmlFor="group-sub" label="المادة"><SelectInput id="group-sub" value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}><option value="">اختر المادة</option>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</SelectInput></Field><Field htmlFor="group-stage" label="المرحلة"><SelectInput id="group-stage" value={form.stage} onChange={e=>{const st=STAGES.find(s=>s.value===e.target.value);setForm({...form,stage:e.target.value,grade:st?.grades[0]??''})}}>{STAGES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</SelectInput></Field><Field htmlFor="group-grade" label="الصف"><SelectInput id="group-grade" value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}>{STAGES.find(s=>s.value===form.stage)?.grades.map(g=><option key={g}>{g}</option>)}</SelectInput></Field><Field htmlFor="group-mode" label="نوع الحصة"><SelectInput id="group-mode" value={form.mode} onChange={e=>setForm({...form,mode:e.target.value as 'online'|'offline'})}><option value="offline">حضوري</option><option value="online">أونلاين</option></SelectInput></Field></div><Field htmlFor="group-location" label="مكان الحصة للطلاب (لو حضوري)"><TextInput id="group-location" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></Field><div><p className="mb-2 text-sm font-bold">أيام الحصص</p><div className="flex flex-wrap gap-2">{WEEKDAYS.map(day=><label key={day.value} className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold ${form.weekdays.includes(day.value)?'border-edu-500 bg-edu-50 text-edu-700':'border-ink-200'}`}><input className="sr-only" type="checkbox" checked={form.weekdays.includes(day.value)} onChange={()=>setForm({...form,weekdays:form.weekdays.includes(day.value)?form.weekdays.filter(v=>v!==day.value):[...form.weekdays,day.value]})}/>{day.label}</label>)}</div></div><div className="grid gap-3 sm:grid-cols-2"><Field htmlFor="group-start" label="من الساعة"><TextInput type="time" id="group-start" value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})} required/></Field><Field htmlFor="group-end" label="للساعة"><TextInput type="time" id="group-end" value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})} required/></Field><Field htmlFor="group-from" label="بداية المجموعة"><TextInput type="date" id="group-from" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></Field><Field htmlFor="group-to" label="تاريخ النهاية (اختياري)"><TextInput type="date" id="group-to" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></Field><Field htmlFor="group-cap" label="الحد الأقصى للطلاب"><TextInput type="number" id="group-cap" min={1} max={500} value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})}/></Field><Field htmlFor="group-price" label="السعر بالجنيه"><TextInput type="number" id="group-price" min={0} value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></Field><Field htmlFor="group-period" label="السعر لكل"><SelectInput id="group-period" value={form.price_period} onChange={e=>setForm({...form,price_period:e.target.value as GroupForm['price_period']})}><option value="month">شهر</option><option value="session">حصة</option><option value="term">ترم</option></SelectInput></Field></div><Field htmlFor="group-desc" label="وصف المجموعة"><TextAreaInput id="group-desc" maxLength={1000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Field><label className="flex gap-2 text-sm"><input type="checkbox" checked={form.registration_open} onChange={e=>setForm({...form,registration_open:e.target.checked})}/>فتح التسجيل</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={form.is_published} onChange={e=>setForm({...form,is_published:e.target.checked})}/>نشر المجموعة بعد الموافقة على الملف</label>{error&&<Alert tone="error">{error}</Alert>}<Button loading={saving} type="submit" fullWidth>حفظ المجموعة</Button></form></Modal>
    <Modal open={!!activeGroup} title="طلاب المجموعة والحضور" onClose={()=>setActiveGroup('')} wide><div className="space-y-4"><div className="rounded-xl bg-edu-50 p-3"><Field htmlFor="attendance-date" label="تسجيل حضور يوم"><TextInput id="attendance-date" type="date" value={attendanceDate} max={new Date().toISOString().slice(0,10)} onChange={e=>setAttendanceDate(e.target.value)}/></Field><p className="mt-2 text-xs text-edu-700">سجّل حضور كل طالب في تاريخ الحصة الفعلي.</p></div><div className="max-h-64 space-y-2 overflow-y-auto">{groupStudents.map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"><div><p className="text-sm font-bold">{s.student_name}</p><p className="text-xs text-ink-500" dir="ltr">{s.student_phone}</p></div><div className="flex gap-2"><Badge tone={s.status==='active'?'success':'neutral'}>{s.status==='active'?'مسجل':'ملغي'}</Badge>{s.status==='active'&&<><Button variant={attendance[s.id]==='present'?'primary':'secondary'} disabled={actionId===s.id} onClick={()=>markAttendance(s.id,'present')}>حاضر</Button><Button variant={attendance[s.id]==='absent'?'danger':'secondary'} disabled={actionId===s.id} onClick={()=>markAttendance(s.id,'absent')}>غائب</Button><Button variant="ghost" disabled={actionId===s.id} onClick={()=>cancel(s.id)}>إلغاء</Button></>}</div></div>)}{groupStudents.length===0&&<p className="text-sm text-ink-500">لا يوجد طلاب مسجّلون في المجموعة حتى الآن.</p>}</div><form className="space-y-3 border-t pt-4" onSubmit={addManual}><h3 className="font-bold">إضافة طالب يدويًا</h3><Field htmlFor="manual-name" label="اسم الطالب"><TextInput id="manual-name" required minLength={2} value={manualName} onChange={e=>setManualName(e.target.value)}/></Field><Field htmlFor="manual-phone" label="موبايل الطالب أو ولي الأمر"><TextInput id="manual-phone" required dir="ltr" value={manualPhone} onChange={e=>setManualPhone(e.target.value)}/></Field><Button type="submit" loading={actionId==='add'}>إضافة الطالب</Button></form></div></Modal>
  </section>;
}
