import { useState } from 'react';
import { ArrowUpLeft, CalendarCheck2, Check, Clock3, GraduationCap, Link2, Stethoscope, Users2 } from 'lucide-react';
import { Link } from '@/lib/router';

type View = 'doctor' | 'teacher';

const experiences = {
  doctor: {
    label: 'للأطباء والعيادات',
    title: 'عيادتك، بصورة أوضح.',
    description: 'مواعيد المرضى، حركة الانتظار، ورابط الحجز؛ كل ما تحتاجه في مساحة واحدة.',
    route: '/register/doctor',
    cta: 'اكتشف مساحة الطبيب',
  },
  teacher: {
    label: 'للمُدرّسين',
    title: 'مجموعاتك، بكل هدوء.',
    description: 'أنشئ مجموعاتك، تابع الأماكن المتاحة، ودع الطلاب يحجزون من رابطك الخاص.',
    route: '/register/teacher',
    cta: 'اكتشف مساحة المُدرّس',
  },
};

/** An intentionally illustrative product tour; figures here are not live bookings. */
export function ExperienceShowcase() {
  const [view, setView] = useState<View>('teacher');
  const item = experiences[view];

  return (
    <section className="home-product-section" aria-labelledby="experience-section-title">
      <div className="home-product-heading">
        <div>
          <span className="section-marker"><span aria-hidden="true">✳</span> لأن التفاصيل تصنع الفرق</span>
          <h2 id="experience-section-title">واجهة هادئة، <span>ويوم أكثر ترتيبًا.</span></h2>
        </div>
        <p>كل شيء واضح في مكانه، من أول نظرة.</p>
      </div>
      <div className={`product-lens product-lens-${view}`}>
        <div className="lens-copy">
          <div className="lens-switch" role="group" aria-label="عرض مميزات إدارة المواعيد">
            <button type="button" className={view === 'doctor' ? 'is-selected' : ''} aria-pressed={view === 'doctor'} onClick={() => setView('doctor')}><Stethoscope size={18} /> للطبيب</button>
            <button type="button" className={view === 'teacher' ? 'is-selected' : ''} aria-pressed={view === 'teacher'} onClick={() => setView('teacher')}><GraduationCap size={18} /> للمُدرّس</button>
          </div>
          <div className="lens-text" key={view}>
            <span className="lens-kicker">{item.label}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
          <div className="lens-benefits" aria-label="مميزات المنصة">
            <span><Check size={15} /> جدول منظّم</span>
            <span><Check size={15} /> رابط حجز خاص</span>
          </div>
          <Link to={item.route} className="lens-action">{item.cta}<ArrowUpLeft size={20} /></Link>
        </div>
        <div className="lens-visual" role="img" aria-label={`تصور توضيحي لواجهة ${view === 'doctor' ? 'الطبيب' : 'المدرس'}`}>
          <div className="lens-photo" aria-hidden="true" />
          <div className="lens-stamp" aria-hidden="true"><span>دَوْرك</span><span>✳</span></div>
          <div className="lens-ticket" aria-hidden="true">
            <div className="lens-ticket-head"><span>{view === 'doctor' ? 'تنظيم العيادة' : 'إدارة المجموعات'}</span><span className="lens-ticket-dots">● ● ●</span></div>
            {view === 'doctor' ? (
              <>
                <div className="lens-ticket-title"><CalendarCheck2 size={23} /><strong>مواعيد اليوم</strong></div>
                <div className="lens-timeline"><div><span>09:00</span><b>موعد مؤكد</b><i /></div><div><span>10:30</span><b>في انتظار الحضور</b><i /></div><div><span>12:00</span><b>موعد متاح</b><i /></div></div>
              </>
            ) : (
              <>
                <div className="lens-ticket-title"><Users2 size={23} /><strong>مجموعاتك</strong></div>
                <div className="lens-group-title"><span>مجموعة رياضيات</span><b>مثال توضيحي</b></div>
                <div className="lens-seat-number"><strong>١٨ <small>/ ٢٠</small></strong><span>متبقي مكانان</span></div>
                <div className="lens-seat-bar"><span /></div>
                <div className="lens-group-foot"><Clock3 size={15} /> جدول واضح، وحجز منظّم</div>
              </>
            )}
          </div>
          <div className="lens-share-note" aria-hidden="true"><Link2 size={17} /> رابط واحد للحجز <Check size={15} /></div>
        </div>
      </div>
      <p className="lens-disclaimer">الواجهات المعروضة أمثلة تصميمية لتوضيح التجربة، وليست حجوزات فعلية.</p>
    </section>
  );
}
