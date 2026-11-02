import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Stethoscope, GraduationCap } from 'lucide-react';
import { AdminCredentialsReview } from '@/components/AdminCredentialsReview';
import { Alert, Badge, Button, Card, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/format';
import { Link } from '@/lib/router';
import { supabase } from '@/lib/supabase';

type Professional = {id:string;full_name:string;slug:string;governorate:string;is_published:boolean;user_id:string|null};
export function AdminPage(){
  const {session,accountReady,hasRole}=useAuth();const [doctors,setDoctors]=useState<Professional[]>([]);const [teachers,setTeachers]=useState<Professional[]>([]);const [tab,setTab]=useState<'doctor'|'teacher'>('doctor');const [busy,setBusy]=useState('');const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const load=useCallback(async()=>{if(!session||!accountReady||!hasRole('admin')){setLoading(false);return;}setLoading(true);const[d,t]=await Promise.all([supabase.from('doctors').select('id,full_name,slug,governorate,is_published,user_id').order('created_at',{ascending:false}),supabase.from('teachers').select('id,full_name,slug,governorate,is_published,user_id').order('created_at',{ascending:false})]);if(d.error||t.error)setError(getErrorMessage(d.error??t.error));else{setDoctors((d.data??[]) as Professional[]);setTeachers((t.data??[]) as Professional[]);}setLoading(false)},[session,accountReady,hasRole]);
  useEffect(()=>{void load()},[load]);
  const setPublished=async(kind:'doctor'|'teacher',p:Professional)=>{setBusy(p.id);setError('');const{error:e}=await supabase.rpc('admin_set_professional_published',{p_kind:kind,p_id:p.id,p_published:!p.is_published});setBusy('');if(e)setError(getErrorMessage(e));else void load()};
  if(!session||!accountReady)return <Spinner/>;
  if(!hasRole('admin'))return <section className="mx-auto max-w-2xl px-4 py-20"><Alert tone="error">الصفحة دي مخصصة لإدارة المنصة فقط. <Link className="underline" to="/">ارجع للرئيسية</Link></Alert></section>;
  const rows=tab==='doctor'?doctors:teachers;
  return <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6"><div className="mb-7 flex items-center gap-3"><ShieldCheck className="h-9 w-9 text-brand-700"/><div><h1 className="text-3xl font-extrabold">إدارة دَوْرك</h1><p className="mt-1 text-ink-500">مساحة الإدارة الخاصة بكِ. راجعي ملفات الأطباء والمُدرّسين قبل اعتمادها.</p></div></div>
    {error&&<div className="mb-5"><Alert tone="error">{error}</Alert></div>}
    <div className="mb-6 grid gap-4 sm:grid-cols-3">{[{title:'الدكاترة',count:doctors.length,icon:Stethoscope},{title:'المدرّسين',count:teachers.length,icon:GraduationCap},{title:'طلبات منتظرة',count:[...doctors,...teachers].filter(p=>!p.is_published&&!(!p.user_id)).length,icon:ShieldCheck}].map(({title,count,icon:Icon})=><Card key={title} className="flex items-center gap-4 p-5"><Icon className="h-6 w-6 text-brand-600"/><div><p className="text-sm text-ink-500">{title}</p><p className="text-2xl font-extrabold">{count}</p></div></Card>)}</div>
    <div className="mb-5 flex gap-2"><Button onClick={()=>setTab('doctor')} variant={tab==='doctor'?'primary':'secondary'}>الدكاترة</Button><Button onClick={()=>setTab('teacher')} variant={tab==='teacher'?'primary':'secondary'}>المدرّسين</Button></div>
    {loading?<Spinner/>:<div className="space-y-3">{rows.map(p=><Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="font-extrabold">{p.full_name}</h2><p className="mt-1 text-xs text-ink-500">{p.governorate} · /{tab}/{p.slug}</p><div className="mt-2"><Badge tone={p.is_published?'success':'warning'}>{p.is_published?'منشور':'منتظر المراجعة'}</Badge></div></div><div className="flex gap-2"><Link to={`/${tab}/${p.slug}`} className="rounded-xl border px-4 py-2 text-sm font-bold">عرض الصفحة</Link><Button disabled={busy===p.id} onClick={()=>setPublished(tab,p)} variant={p.is_published?'danger':'primary'}>{p.is_published?'إيقاف النشر':'موافقة ونشر'}</Button></div></Card>)}{rows.length===0&&<Alert tone="info">لا توجد حسابات في هذا القسم حاليًا.</Alert>}</div>}
    <AdminCredentialsReview />
    <p className="mt-8 text-xs leading-6 text-ink-500">تنبيه: تفعيل الطبيب لازم ييجي بعد التحقق الفعلي من بياناته ومؤهلاته. صلاحية الإدارة تُمنح من قاعدة البيانات فقط، مش من واجهة التسجيل.</p>
  </section>;
}
