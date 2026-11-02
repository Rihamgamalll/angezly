import { ArrowUpLeft, CalendarRange, GraduationCap, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import { Alert, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { isGuestSession } from '@/lib/role-routing';
import { Link } from '@/lib/router';
import { useDocumentMeta } from '@/lib/hooks';
import { professionalGreeting } from '@/lib/professionalGreeting';

export function WorkspaceHomePage() {
  useDocumentMeta('مساحتي | دَوْرك', 'ملفك المهني وإدارة عملك، كلٌّ في مساحته.');
  const { session, sessionLoading, accountReady, roles, fullName } = useAuth();
  if (sessionLoading || (session && !accountReady)) return <Spinner />;
  const kind = !isGuestSession(session) && roles.includes('doctor') ? 'doctor'
    : !isGuestSession(session) && roles.includes('teacher') ? 'teacher' : null;
  if (!kind) return <section className="mx-auto max-w-2xl px-4 py-14"><Alert tone="info">هذه المساحة للأطباء والمُدرّسين. <Link to="/choose" className="font-bold underline">اختر حجزك</Link></Alert></section>;
  const title = kind === 'doctor' ? 'إدارة عيادتي' : 'إدارة مجموعاتي';
  const WorkIcon = kind === 'doctor' ? Stethoscope : GraduationCap;
  return (
    <section className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16" dir="rtl">
      <div className="mb-9 text-center">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700"><ShieldCheck className="h-4 w-4"/> مساحتك الخاصة</p>
        <h1 className="text-3xl font-extrabold leading-snug text-brand-900 sm:text-5xl">{professionalGreeting(kind, fullName)}</h1>
        <p className="mt-3 text-base text-ink-600">إلى أين تحب أن تتجه اليوم؟</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Link to="/workspace/profile" className="group relative flex min-h-[290px] flex-col overflow-hidden rounded-[2rem] border border-[#d4e5d8] bg-white p-7 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 sm:p-9">
          <div className="mb-6 flex items-start justify-between"><span className="rounded-[1.15rem] bg-[#eaf4eb] p-4 text-brand-800"><UserRound className="h-8 w-8"/></span><ArrowUpLeft className="h-6 w-6 text-ink-500 transition group-hover:-translate-x-1"/></div>
          <h2 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">ملفي المهني</h2>
          <p className="mt-3 max-w-sm text-sm leading-8 text-ink-600">صورتك، نبذتك، مؤهلاتك وشهاداتك. كل ما يُعرّف الناس بك في مكان واحد.</p>
          <span className="mt-auto pt-6 text-sm font-extrabold text-brand-700">تعديل الملف الشخصي ←</span>
        </Link>
        <Link to="/workspace/work" className="group relative flex min-h-[290px] flex-col overflow-hidden rounded-[2rem] border border-[#e2e5d3] bg-[#f0f4e8] p-7 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 sm:p-9">
          <div className="mb-6 flex items-start justify-between"><span className="rounded-[1.15rem] bg-white p-4 text-brand-800"><WorkIcon className="h-8 w-8"/></span><ArrowUpLeft className="h-6 w-6 text-ink-500 transition group-hover:-translate-x-1"/></div>
          <h2 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">{title}</h2>
          <p className="mt-3 max-w-sm text-sm leading-8 text-ink-600">{kind === 'doctor' ? 'الحجوزات، مواعيد الكشف، حضور المرضى ومتابعة الدور.' : 'مواعيد الحصص، سعة المجموعات، تسجيل الطلاب والحضور.'}</p>
          <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-extrabold text-brand-700"><CalendarRange className="h-4 w-4"/> فتح مساحة العمل ←</span>
        </Link>
      </div>
      <p className="mt-7 text-center text-xs leading-6 text-ink-500">ملفك المهني ظاهر للزوار بعد اعتماد الحساب، أما بيانات العمل فلا يراها إلا المصرّح لهم.</p>
    </section>
  );
}
