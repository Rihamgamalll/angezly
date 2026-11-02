import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpLeft, CalendarDays, Check, ChevronDown, Clock3, GraduationCap, HeartPulse, Link2, MapPin, Search, Stethoscope } from 'lucide-react';
import { Link, navigate } from '@/lib/router';
import { useDocumentMeta } from '@/lib/hooks';
import { BRAND_NAME, DOCTOR_SPECIALTIES, SUBJECTS, GOVERNORATES } from '@/lib/constants';
import { isBackendConfigured } from '@/lib/supabase';
import { ExperienceShowcase } from '@/components/ExperienceShowcase';

type SearchType = 'doctor' | 'teacher';

export function HomePage() {
  useDocumentMeta('دَوْرك | كل موعد في مكانه', 'احجز موعد طبيب أو مكانًا في مجموعة دراسية بسهولة عبر دَوْرك.');
  const [type, setType] = useState<SearchType>('doctor');
  const [query, setQuery] = useState('');
  const [governorate, setGovernorate] = useState('');

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('search', query.trim());
    if (governorate) params.set('governorate', governorate);
    const q = params.toString();
    navigate(`${type === 'doctor' ? '/doctors' : '/teachers'}${q ? `?${q}` : ''}`);
  };

  return (
    <div className="dawrak-home">
      <section className="home-hero">
        <div className="home-hero-doodle home-doodle-one" aria-hidden="true" />
        <div className="home-hero-doodle home-doodle-two" aria-hidden="true" />
        <div className="home-hero-inner">
          <div className="home-hero-content">
            <div className="home-kicker"><span className="home-kicker-dot" /> منصّتك لحجز المواعيد</div>
            <h1 className="home-title">كل موعد،<br /><span>في مكانه.</span></h1>
            <p className="home-description">احجز موعد طبيبك أو مكانك في مجموعة دراسية،<br className="hidden sm:block" /> بخطوات واضحة وتجربة مريحة.</p>
            <form className="home-search" onSubmit={search} role="search">
              <div className="home-search-tabs" role="group" aria-label="مجال البحث">
                <button type="button" className={type === 'doctor' ? 'is-selected' : ''} aria-pressed={type === 'doctor'} onClick={() => { setType('doctor'); setQuery(''); }}><Stethoscope size={19}/> طبيب</button>
                <button type="button" className={type === 'teacher' ? 'is-selected' : ''} aria-pressed={type === 'teacher'} onClick={() => { setType('teacher'); setQuery(''); }}><GraduationCap size={19}/> مُدرّس</button>
              </div>
              <div className="home-search-fields">
                <label className="home-search-input"><Search size={20} aria-hidden="true" /><span className="sr-only">{type === 'doctor' ? 'اسم الطبيب أو التخصص' : 'اسم المُدرّس أو المادة'}</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder={type === 'doctor' ? 'اسم الطبيب أو التخصص' : 'اسم المُدرّس أو المادة'} /></label>
                <label className="home-search-location"><MapPin size={18} aria-hidden="true" /><span className="sr-only">المحافظة</span><select value={governorate} onChange={e => setGovernorate(e.target.value)}><option value="">جميع المحافظات</option>{GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}</select><ChevronDown size={16} className="home-location-arrow" aria-hidden="true" /></label>
                <button type="submit" className="home-search-submit">ابحث الآن <ArrowLeft size={20}/></button>
              </div>
            </form>
            <div className="home-hero-shortcut"><span>تود استكشاف المنصّة أولًا؟</span><Link to="/demo">شاهد التجربة التوضيحية <ArrowUpLeft size={16}/></Link></div>
            {!isBackendConfigured && <p className="home-preview-note" role="status">نسخة للمعاينة · تتطلب الحجوزات الفعلية ربط قاعدة البيانات.</p>}
          </div>
          <div className="home-visual" aria-label="مثال توضيحي لشكل المواعيد والمجموعات في دَوْرك">
            <div className="visual-orbit visual-orbit-one" aria-hidden="true" />
            <div className="visual-orbit visual-orbit-two" aria-hidden="true" />
            <span className="visual-spark visual-spark-a" aria-hidden="true">✳</span>
            <span className="visual-spark visual-spark-b" aria-hidden="true">✦</span>
            <div className="visual-main-card">
              <div className="visual-card-top"><span className="visual-card-heading"><CalendarDays size={20}/> مثال لموعد محجوز</span><span className="visual-dots">•••</span></div>
              <div className="visual-date-line"><span className="visual-date-day">١٥</span><div><strong>الأحد</strong><small>نوفمبر · ٢٠٢٦</small></div><span className="visual-green-tag"><Check size={14}/> مؤكد</span></div>
              <div className="visual-separator" />
              <div className="visual-appointment"><div className="visual-doctor-icon"><HeartPulse size={23}/></div><div><strong>موعد الكشف</strong><small>الساعة ٦:٣٠ مساءً</small></div><span className="visual-appointment-badge">محجوز</span></div>
            </div>
            <div className="visual-float-card"><span className="visual-float-icon"><GraduationCap size={25}/></span><div><small>مجموعة رياضيات</small><strong>٣ أماكن متاحة</strong><div className="visual-seats"><i/><i/><i/><i/><i/></div></div></div>
            <div className="visual-notice"><span className="visual-notice-icon"><Check size={19}/></span><span>مواعيد أكثر وضوحًا</span></div>
          </div>
        </div>
        <div className="home-hero-wave" aria-hidden="true" />
      </section>

      <section className="home-choice-section" aria-labelledby="home-choice-title">
        <div className="home-section-heading"><span className="section-marker">خدمات دَوْرك</span><h2 id="home-choice-title">اختر الخدمة المناسبة لك</h2><p className="choice-heading-note">وجهتان مختلفتان، وتجربة حجز واحدة سهلة.</p></div>
        <div className="home-choice-grid">
          <Link className="choice-feature choice-doctor" to="/doctors" aria-label="استكشف الأطباء واحجز موعد كشف">
            <div className="choice-top-line"><span className="choice-category-index">01 / الرعاية الصحية</span><Stethoscope size={22}/></div>
            <div className="choice-inner"><div><span className="choice-overline">مواعيد طبية تناسب يومك</span><h3>احجز طبيبك</h3><p>استكشف الأطباء واختر موعد الكشف المناسب.</p></div></div>
            <span className="choice-arrow" aria-hidden="true"><ArrowUpLeft size={23}/></span>
          </Link>
          <Link className="choice-feature choice-teacher" to="/teachers" aria-label="استكشف المدرسين واحجز مكانًا في مجموعة">
            <div className="choice-top-line"><span className="choice-category-index">02 / التعليم</span><GraduationCap size={22}/></div>
            <div className="choice-inner"><div><span className="choice-overline">المجموعة المناسبة تبدأ هنا</span><h3>احجز مجموعتك</h3><p>تعرّف على المجموعات المتاحة واحجز مكانك.</p></div></div>
            <span className="choice-arrow" aria-hidden="true"><ArrowUpLeft size={23}/></span>
          </Link>
        </div>
      </section>

      <section className="home-flow" aria-label="خطوات الحجز"><div className="home-flow-inner"><div className="flow-intro"><span className="section-marker">تجربة حجز واضحة</span><h2>ثلاث خطوات.<br/><em>وحجزك أوضح.</em></h2></div><div className="flow-steps"><div><span className="flow-num">01</span><Search size={22}/><strong>ابحث</strong><small>عن الطبيب أو المُدرّس</small></div><div><span className="flow-num">02</span><Clock3 size={22}/><strong>اختر</strong><small>الموعد أو المجموعة المناسبة</small></div><div><span className="flow-num">03</span><Check size={22}/><strong>أكّد الحجز</strong><small>واحتفظ بتفاصيله في حسابك</small></div></div></div></section>

      <ExperienceShowcase />

      <section className="home-explore"><div className="home-explore-head"><div><span className="section-marker">استكشف بسهولة</span><h2>ابدأ بما تبحث عنه</h2></div><p>تخصّصات ومواد دراسية، مباشرة إلى ما يهمّك.</p></div><div className="explore-columns"><div className="explore-panel"><div className="explore-label"><span className="explore-label-icon"><Stethoscope size={21}/></span><h3>التخصصات الطبية</h3><Link to="/doctors">عرض الكل <ArrowLeft size={17}/></Link></div><div className="explore-chips">{DOCTOR_SPECIALTIES.slice(0,7).map(x => <Link to={`/doctors?specialty=${encodeURIComponent(x)}`} key={x}>{x} <ArrowUpLeft size={13}/></Link>)}</div></div><div className="explore-panel explore-panel-edu"><div className="explore-label"><span className="explore-label-icon"><GraduationCap size={21}/></span><h3>المواد الدراسية</h3><Link to="/teachers">عرض الكل <ArrowLeft size={17}/></Link></div><div className="explore-chips">{SUBJECTS.slice(0,7).map(x => <Link to={`/teachers?subject=${encodeURIComponent(x)}`} key={x}>{x} <ArrowUpLeft size={13}/></Link>)}</div></div></div></section>

      <section className="home-pro-section" aria-labelledby="home-pro-title"><div className="home-pro-card">
        <div className="home-pro-copy"><span className="pro-eyebrow">للأطباء والمُدرّسين</span><h2 id="home-pro-title">سيب تنظيم المواعيد علينا،<br />وركّز في شغلك.</h2><p>صفحة خاصة باسمك، حجوزات واضحة، ورابط واحد تشاركه مع الجميع.</p><div className="home-pro-actions"><Link to="/join" className="home-pro-link">أنشئ صفحتك الآن <ArrowUpLeft size={20}/></Link><span className="pro-link-hint"><Link2 size={17}/> رابط حجز خاص بك</span></div></div>
      </div></section>
      <div className="home-lower-note"><span><span className="home-kicker-dot"/> {BRAND_NAME}</span> — كل حاجة في ميعادها</div>
    </div>
  );
}
