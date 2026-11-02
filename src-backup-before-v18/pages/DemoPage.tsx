import { useState } from 'react';
import { ArrowLeft, ArrowUpLeft, GraduationCap, Info, RotateCcw, Stethoscope, Users } from 'lucide-react';
import { Link } from '@/lib/router';
import { useDocumentMeta } from '@/lib/hooks';

export function DemoPage() {
  useDocumentMeta('جرّب الحجز | دَوْرك', 'تجربة توضيحية توضّح إدارة الأماكن المتاحة في المجموعات.');
  const [count, setCount] = useState(1);
  const capacity = 3;
  const remaining = capacity - count;
  return <section className="demo-reimagined">
    <div className="demo-heading"><span className="demo-badge"><Info size={17}/> تجربة توضيحية · دون حجز فعلي</span><h1>اكتشف طريقة الحجز. <span>✳</span></h1><p>تابع كيف تتغير الأماكن المتاحة عند حجز مجموعة.</p></div>
    <div className="demo-layout"><div className="demo-ticket">
      <div className="demo-ticket-top"><span><GraduationCap size={19}/> مجموعة تجريبية</span><span>١ / ١</span></div>
      <div className="demo-ticket-inner"><p>أ/ أحمد (مثال)</p><h2>رياضيات<br/>الصف الثالث الثانوي</h2><span>السبت والثلاثاء · الساعة ٥ مساءً</span></div>
      <div className="demo-ticket-cut" aria-hidden="true"/>
      <div className="demo-ticket-bottom"><div><span>المسجّل</span><strong>{count} <small>/ {capacity}</small></strong></div><div><span>أماكن متاحة</span><strong>{remaining}</strong></div></div>
      <div className="demo-progress" role="progressbar" aria-valuenow={count} aria-valuemin={0} aria-valuemax={capacity} aria-label="عدد الأماكن المحجوزة"><span style={{width:`${(count/capacity)*100}%`}}/></div>
    </div>
    <div className="demo-action-panel"><span className={`demo-availability ${remaining===0?'demo-full':''}`}>{remaining===0?'المجموعة اكتملت':'الحجز مفتوح'}</span><h2>{remaining===0?'اكتمل عدد الطلاب':'يمكنك حجز مكان في المجموعة'}</h2><p>{remaining===0?'أُغلق الحجز تلقائيًا. يمكنك الاطلاع على مجموعة بديلة.':'اضغط على الحجز لمتابعة تغيّر عدد الأماكن المتاحة.'}</p>
      <button type="button" className="demo-book-button" disabled={remaining===0} onClick={()=>setCount(c=>Math.min(capacity,c+1))}><Users size={19}/>{remaining===0?'الحجز مغلق':'احجز مكانًا للتجربة'}<ArrowUpLeft size={20}/></button>
      <button type="button" className="demo-reset" onClick={()=>setCount(1)}><RotateCcw size={16}/> إعادة التجربة</button>
      {remaining===0&&<div className="demo-alternative"><strong>مجموعة بديلة متاحة</strong><p>الأحد والأربعاء · ٦ مساءً</p><span>٧ أماكن متاحة (مثال)</span></div>}
      <p className="demo-disclaimer">هذه محاكاة محلية للتوضيح فقط؛ لا تحفظ الحجوزات في قاعدة البيانات.</p>
    </div></div>
    <div className="demo-paths"><Link to="/doctors"><Stethoscope size={23}/> استكشف الأطباء <ArrowLeft size={19}/></Link><Link to="/teachers"><GraduationCap size={23}/> استكشف المُدرّسين <ArrowLeft size={19}/></Link></div>
  </section>;
}
