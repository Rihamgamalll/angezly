import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatCairoDateTime, getErrorMessage } from '@/lib/format';
import { Link } from '@/lib/router';
import { supabase } from '@/lib/supabase';

type Notification = { id:string; title:string; body:string; created_at:string; read_at:string|null };
export function NotificationsPage(){
  const {session,sessionLoading}=useAuth();
  const [items,setItems]=useState<Notification[]>([]);const[loading,setLoading]=useState(true);const[busy,setBusy]=useState('');const[error,setError]=useState('');
  const load=useCallback(async()=>{if(!session){setLoading(false);return;}const{data,error:e}=await supabase.from('notifications').select('id,title,body,created_at,read_at').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(100);if(e)setError(getErrorMessage(e));else setItems(data??[]);setLoading(false)},[session]);
  useEffect(()=>{void load()},[load]);
  const markRead=async(item:Notification)=>{setBusy(item.id);const{error:e}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',item.id);setBusy('');if(e)setError(getErrorMessage(e));else void load()};
  if(sessionLoading||loading)return <Spinner label="جاري تحميل الإشعارات..."/>;
  if(!session)return <div className="mx-auto max-w-xl px-4 py-20"><Alert tone="info">سجّل دخولك الأول. <Link to="/login?next=/notifications" className="underline">تسجيل الدخول</Link></Alert></div>;
  return <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6"><div className="mb-7 flex items-center gap-3"><Bell className="h-7 w-7 text-brand-600"/><div><h1 className="text-3xl font-extrabold">الإشعارات</h1><p className="mt-1 text-sm text-ink-500">تأكيدات وإلغاءات الحجوزات داخل المنصة.</p></div></div>{error&&<Alert tone="error">{error}</Alert>}{items.length===0?<EmptyState icon={<Bell/>} title="لا توجد إشعارات حاليًا" text="ستظهر تأكيدات الحجوزات والإلغاءات هنا بعد تفعيل الاتصال بقاعدة البيانات."/>:<div className="space-y-3">{items.map(item=><Card key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-5"><div><div className="flex items-center gap-2"><h2 className="font-extrabold">{item.title}</h2>{!item.read_at&&<Badge tone="brand">جديد</Badge>}</div><p className="mt-2 text-sm text-ink-600">{item.body}</p><p className="mt-2 text-xs text-ink-400">{formatCairoDateTime(item.created_at)}</p></div>{!item.read_at&&<Button variant="secondary" loading={busy===item.id} onClick={()=>markRead(item)}><CheckCheck className="h-4 w-4"/> تمت القراءة</Button>}</Card>)}</div>}</section>;
}
