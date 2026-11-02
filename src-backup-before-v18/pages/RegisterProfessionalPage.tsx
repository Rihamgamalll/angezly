import { DoctorRegistrationForm } from '@/components/onboarding/DoctorRegistrationForm';
import { TeacherRegistrationForm } from '@/components/onboarding/TeacherRegistrationForm';
import { Alert, Card, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { isGuestSession } from '@/lib/role-routing';
import { useDocumentMeta } from '@/lib/hooks';
import { Link } from '@/lib/router';

export function RegisterProfessionalPage({ kind }: { kind: 'doctor' | 'teacher' }) {
  const { session, sessionLoading, accountReady, hasRole } = useAuth();
  const label = kind === 'doctor' ? 'دكتور' : 'مُدرّس';
  useDocumentMeta(`سجّل كـ${label} | دَوْرك`, `انضم إلى دَوْرك وسجّل بياناتك كـ${label}.`);
  if (sessionLoading || (session && !accountReady)) return <Spinner />;
  if (!session || isGuestSession(session)) return <section className="mx-auto max-w-2xl px-4 py-20"><Card className="space-y-4 p-8"><h1 className="text-2xl font-bold">انضم إلى دَوْرك كـ{label}</h1><p className="text-ink-600">أنشئ حسابًا أو سجّل الدخول لربط ملفك المهني بحسابك.</p><div className="flex gap-4"><Link to={`/signup?next=/register/${kind}`} className="rounded-xl bg-brand-600 px-5 py-3 font-bold text-white">إنشاء حساب</Link><Link to={`/login?next=/register/${kind}`} className="rounded-xl border border-ink-200 px-5 py-3 font-bold">تسجيل الدخول</Link></div></Card></section>;
  if (hasRole('admin')) return <section className="mx-auto max-w-2xl px-4 py-20"><Card className="space-y-4 p-8"><h1 className="text-2xl font-extrabold text-brand-900">حساب إدارة المنصة</h1><p className="leading-7 text-ink-600">حساب الإدارة منفصل عن حسابات الأطباء والمُدرّسين. لتجربة التسجيل المهني، استخدمي حسابًا تجريبيًا آخر.</p><Link to="/admin" className="inline-flex rounded-xl bg-brand-700 px-5 py-3 font-bold text-white">العودة إلى لوحة الإدارة</Link></Card></section>;
  if (hasRole(kind === 'doctor' ? 'teacher' : 'doctor')) return <section className="mx-auto max-w-2xl px-4 py-20"><Alert tone="info">حسابك مخصص بالفعل لمجال مهني آخر. للحفاظ على استقلالية كل مساحة عمل، يُرجى استخدام حساب مهني منفصل.</Alert></section>;
  if (hasRole(kind)) return <section className="mx-auto max-w-2xl px-4 py-20"><Alert tone="info">هذا الحساب مسجّل بالفعل. <Link to={`/dashboard/${kind}`} className="font-bold underline">الانتقال إلى لوحة التحكم</Link></Alert></section>;
  return <section className="professional-registration mx-auto max-w-4xl px-4 py-12 sm:px-6"><div className={`registration-banner ${kind === 'doctor' ? 'registration-banner-doctor' : 'registration-banner-teacher'}`}><p className="text-sm font-bold text-brand-700">انضم إلى دَوْرك</p><h1 className="mt-2 text-3xl font-extrabold">إنشاء ملف {label} على دَوْرك</h1><p className="mt-2 text-sm leading-7 text-ink-500">تخضع بيانات الملف للمراجعة قبل النشر. وبعد الموافقة، يمكنك مشاركة رابط الحجز الخاص بك.</p></div><Card className="registration-form-card p-6 sm:p-8">{kind === 'doctor' ? <DoctorRegistrationForm /> : <TeacherRegistrationForm />}</Card></section>;
}
