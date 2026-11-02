import { ArrowLeft, ArrowUpLeft, GraduationCap, Sparkles, Stethoscope } from 'lucide-react';
import { useDocumentMeta } from '@/lib/hooks';
import { Link } from '@/lib/router';

export function JoinPage() {
  useDocumentMeta('انضم إلى دَوْرك | دَوْرك', 'إدارة منظّمة للمواعيد الطبية والمجموعات الدراسية.');
  return (
    <section className="join-redesign">
      <div className="join-intro">
        <span className="home-kicker"><Sparkles size={17}/> لمن يصنعون الفارق كل يوم</span>
        <h1>وقتك لعملك،<br/><span>والمواعيد علينا.</span></h1>
        <p>اختر مجالك، وأنشئ صفحتك الخاصة على دَوْرك.</p>
      </div>
      <div className="join-options">
        <Link to="/register/doctor" className="join-option join-option-med" aria-label="التسجيل كطبيب">
          <div className="join-option-tag"><Stethoscope size={18}/> إدارة العيادات</div>
          <div className="join-option-bottom"><div><span className="join-card-small">لأصحاب العيادات</span><h2>طبيب</h2><p>مواعيد مرضاك وتنظيم عيادتك، في مساحة واحدة.</p></div><span className="join-option-arrow" aria-hidden="true"><ArrowUpLeft size={24}/></span></div>
        </Link>
        <Link to="/register/teacher" className="join-option join-option-edu" aria-label="التسجيل كمُدرّس">
          <div className="join-option-tag"><GraduationCap size={18}/> إدارة المجموعات</div>
          <div className="join-option-bottom"><div><span className="join-card-small">للمُدرّسين</span><h2>مُدرّس</h2><p>نظّم مجموعاتك، وحدّد الأماكن المتاحة لكل مجموعة.</p></div><span className="join-option-arrow" aria-hidden="true"><ArrowUpLeft size={24}/></span></div>
        </Link>
      </div>
      <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-3 text-sm font-bold">
        <Link to="/portal/doctor" className="rounded-xl border border-[#cfe3d5] bg-white px-5 py-3 text-[#175b48] hover:bg-[#eef6ee]">لديك عيادة؟ دخول الطبيب</Link>
        <Link to="/portal/teacher" className="rounded-xl border border-[#dcd6f3] bg-white px-5 py-3 text-[#6854a4] hover:bg-[#f4f1ff]">لديك مجموعات؟ دخول المُدرّس</Link>
      </div>
      <div className="join-bottom-note"><span>لديك بالفعل حساب مهني؟</span><Link to="/login" className="inline-flex items-center gap-2">دخول مساحة عملك <ArrowLeft size={18}/></Link><span className="text-xs text-ink-500">أما الحجز، فيتم مباشرةً من رابط الطبيب أو المُدرّس.</span></div>
    </section>
  );
}
