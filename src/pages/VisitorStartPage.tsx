import { ArrowUpLeft, CalendarCheck2, GraduationCap, ShieldCheck, Stethoscope } from 'lucide-react';
import { Link } from '@/lib/router';
import { useAuth } from '@/lib/auth';
import { useDocumentMeta } from '@/lib/hooks';
import { isGuestSession } from '@/lib/role-routing';

export function VisitorStartPage() {
  useDocumentMeta('احجز بسهولة | دَوْرك', 'اختَر حجز موعد مع طبيب أو الانضمام إلى مجموعة دراسية.');
  const { session, fullName } = useAuth();
  const hasAccount = Boolean(session && !isGuestSession(session));
  const greet = hasAccount && fullName.trim() ? `أهلًا ${fullName.trim().split(/\s+/)[0]}` : 'حجزك يبدأ هنا';
  return (
    <section className="mx-auto max-w-5xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16" dir="rtl">
      <div className="mb-9 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700"><ShieldCheck className="h-4 w-4"/> اختيارات بسيطة، وحجز أوضح</span>
        <h1 className="mt-4 text-3xl font-extrabold leading-relaxed text-brand-900 sm:text-5xl">{greet}</h1>
        <p className="mt-2 text-base text-ink-600">ماذا تودّ أن تحجز؟</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Link to="/doctors" className="group flex min-h-[280px] flex-col rounded-[2rem] border border-[#d7e6db] bg-white p-7 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 sm:p-9">
          <div className="mb-7 flex items-center justify-between"><span className="rounded-2xl bg-brand-50 p-4 text-brand-700"><Stethoscope className="h-8 w-8"/></span><ArrowUpLeft className="h-6 w-6 text-brand-600"/></div>
          <h2 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">حجز موعد طبي</h2>
          <p className="mt-3 text-sm leading-8 text-ink-600">ابحث بالاسم أو التخصص، واختر موعدًا يناسبك.</p>
          <span className="mt-auto pt-6 text-sm font-extrabold text-brand-700">استعراض الأطباء ←</span>
        </Link>
        <Link to="/teachers" className="group flex min-h-[280px] flex-col rounded-[2rem] border border-[#e3dbf1] bg-[#f6f2fb] p-7 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 sm:p-9">
          <div className="mb-7 flex items-center justify-between"><span className="rounded-2xl bg-white p-4 text-[#7654aa]"><GraduationCap className="h-8 w-8"/></span><ArrowUpLeft className="h-6 w-6 text-[#7654aa]"/></div>
          <h2 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">حجز مجموعة دراسية</h2>
          <p className="mt-3 text-sm leading-8 text-ink-600">اختر المُدرّس والمجموعة، وتعرّف على الأماكن المتاحة.</p>
          <span className="mt-auto pt-6 text-sm font-extrabold text-[#7654aa]">استعراض المُدرّسين ←</span>
        </Link>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm font-bold text-brand-700">
        {hasAccount && <Link to="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-100 bg-white px-4 py-2"><CalendarCheck2 className="h-4 w-4"/> حجوزاتي</Link>}
        <Link to="/track" className="inline-flex min-h-11 items-center rounded-xl border border-brand-100 bg-white px-4 py-2">معي رابط متابعة حجز</Link>
      </div>
      <p className="mt-5 text-center text-xs leading-6 text-ink-500">الحجز متاح من الرابط المباشر دون إنشاء حساب. لحفظ الحجوزات في حسابك، سجّل الدخول قبل الحجز.</p>
    </section>
  );
}
