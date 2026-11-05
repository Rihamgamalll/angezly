import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Stethoscope, GraduationCap } from 'lucide-react';

import { AdminCredentialsReview } from '@/components/AdminCredentialsReview';
import { Alert, Badge, Button, Card, Spinner } from '@/components/ui';

import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/format';
import { Link } from '@/lib/router';
import { supabase } from '@/lib/supabase';

type Kind = 'doctor' | 'teacher';

type Professional = {
  id: string;
  full_name: string;
  slug: string;
  governorate: string;
  is_published: boolean;
  user_id: string | null;
};

export function AdminPage() {
  const { session, accountReady, hasRole } = useAuth();

  const [doctors, setDoctors] = useState<Professional[]>([]);
  const [teachers, setTeachers] = useState<Professional[]>([]);

  const [tab, setTab] = useState<Kind>('doctor');

  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // تحميل الدكاترة والمدرسين بشكل مستقل
  const load = useCallback(async () => {
    if (!session || !accountReady || !hasRole('admin')) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [doctorsResult, teachersResult] = await Promise.all([
        supabase
          .from('doctors')
          .select(
            'id,full_name,slug,governorate,is_published,user_id'
          )
          .order('created_at', { ascending: false }),

        supabase
          .from('teachers')
          .select(
            'id,full_name,slug,governorate,is_published,user_id'
          )
          .order('created_at', { ascending: false }),
      ]);

      const errors: string[] = [];

      // تحميل الدكاترة حتى لو المدرسين حصل عندهم خطأ
      if (doctorsResult.error) {
        errors.push(
          `تعذر تحميل الدكاترة: ${getErrorMessage(doctorsResult.error)}`
        );
      } else {
        setDoctors(
          (doctorsResult.data ?? []) as Professional[]
        );
      }

      // تحميل المدرسين حتى لو الدكاترة حصل عندهم خطأ
      if (teachersResult.error) {
        errors.push(
          `تعذر تحميل المدرسين: ${getErrorMessage(teachersResult.error)}`
        );
      } else {
        setTeachers(
          (teachersResult.data ?? []) as Professional[]
        );
      }

      if (errors.length > 0) {
        setError(errors.join(' — '));
      }
    } catch (err) {
      setError(
        `حصل خطأ أثناء تحميل الحسابات: ${getErrorMessage(err)}`
      );
    } finally {
      setLoading(false);
    }
  }, [session, accountReady, hasRole]);

  useEffect(() => {
    void load();
  }, [load]);

  // الموافقة على الحساب أو إيقاف نشره
  const setPublished = async (
    kind: Kind,
    professional: Professional
  ) => {
    if (busy) return;

    setBusy(professional.id);
    setError('');
    setSuccess('');

    try {
      const newStatus = !professional.is_published;

      const { error: updateError } = await supabase.rpc(
        'admin_set_professional_published',
        {
          p_kind: kind,
          p_id: professional.id,
          p_published: newStatus,
        }
      );

      if (updateError) {
        setError(getErrorMessage(updateError));
        return;
      }

      setSuccess(
        newStatus
          ? 'تمت الموافقة على الحساب ونشره بنجاح.'
          : 'تم إيقاف نشر الحساب بنجاح.'
      );

      await load();
    } catch (err) {
      setError(
        `تعذر تحديث الحساب: ${getErrorMessage(err)}`
      );
    } finally {
      setBusy('');
    }
  };

  // انتظار تحميل بيانات تسجيل الدخول
  if (!session || !accountReady) {
    return <Spinner />;
  }

  // حماية صفحة الإدارة
  if (!hasRole('admin')) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20">
        <Alert tone="error">
          الصفحة دي مخصصة لإدارة المنصة فقط.
          {' '}
          <Link className="underline" to="/">
            ارجعي للرئيسية
          </Link>
        </Alert>
      </section>
    );
  }

  const rows = tab === 'doctor' ? doctors : teachers;

  const pendingCount = [...doctors, ...teachers].filter(
    (professional) =>
      !professional.is_published && Boolean(professional.user_id)
  ).length;

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">

      {/* عنوان لوحة الإدارة */}
      <div className="mb-7 flex items-center gap-3">
        <ShieldCheck className="h-9 w-9 text-brand-700" />

        <div>
          <h1 className="text-3xl font-extrabold">
            إدارة أنجزلي
          </h1>

          <p className="mt-1 text-ink-500">
            مساحة الإدارة الخاصة بكِ.
            راجعي ملفات الأطباء والمدرسين قبل اعتمادها.
          </p>
        </div>
      </div>

      {/* رسائل الأخطاء والنجاح */}
      {error && (
        <div className="mb-5">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {success && (
        <div className="mb-5">
          <Alert tone="success">{success}</Alert>
        </div>
      )}

      {/* إحصائيات الحسابات */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: 'الدكاترة',
            count: doctors.length,
            icon: Stethoscope,
          },
          {
            title: 'المدرّسين',
            count: teachers.length,
            icon: GraduationCap,
          },
          {
            title: 'طلبات منتظرة',
            count: pendingCount,
            icon: ShieldCheck,
          },
        ].map(({ title, count, icon: Icon }) => (
          <Card
            key={title}
            className="flex items-center gap-4 p-5"
          >
            <Icon className="h-6 w-6 text-brand-600" />

            <div>
              <p className="text-sm text-ink-500">
                {title}
              </p>

              <p className="text-2xl font-extrabold">
                {count}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* التبديل بين الدكاترة والمدرسين */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Button
          onClick={() => setTab('doctor')}
          variant={
            tab === 'doctor' ? 'primary' : 'secondary'
          }
        >
          الدكاترة
        </Button>

        <Button
          onClick={() => setTab('teacher')}
          variant={
            tab === 'teacher' ? 'primary' : 'secondary'
          }
        >
          المدرّسين
        </Button>

        <Button
          onClick={() => void load()}
          variant="secondary"
          disabled={loading}
        >
          تحديث القائمة
        </Button>
      </div>

      {/* قائمة الحسابات */}
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          {rows.map((professional) => (
            <Card
              key={professional.id}
              className="flex flex-wrap items-center justify-between gap-3 p-5"
            >
              <div>
                <h2 className="font-extrabold">
                  {professional.full_name}
                </h2>

                <p className="mt-1 text-xs text-ink-500">
                  {professional.governorate}
                  {' · '}
                  /{tab}/{professional.slug}
                </p>

                <div className="mt-2">
                  <Badge
                    tone={
                      professional.is_published
                        ? 'success'
                        : 'warning'
                    }
                  >
                    {professional.is_published
                      ? 'منشور'
                      : 'منتظر المراجعة'}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/${tab}/${professional.slug}`}
                  className="rounded-xl border px-4 py-2 text-sm font-bold"
                >
                  عرض الصفحة
                </Link>

                <Button
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void setPublished(tab, professional)
                  }
                  variant={
                    professional.is_published
                      ? 'danger'
                      : 'primary'
                  }
                >
                  {busy === professional.id
                    ? 'جاري التنفيذ...'
                    : professional.is_published
                      ? 'إيقاف النشر'
                      : 'موافقة ونشر'}
                </Button>
              </div>
            </Card>
          ))}

          {rows.length === 0 && !error && (
            <Alert tone="info">
              لا توجد حسابات في هذا القسم حاليًا.
            </Alert>
          )}
        </div>
      )}

      {/* مراجعة شهادات الأطباء والمدرسين */}
      <AdminCredentialsReview />

      <p className="mt-8 text-xs leading-6 text-ink-500">
        تنبيه: تفعيل الطبيب لازم يكون بعد التحقق الفعلي
        من بياناته ومؤهلاته. صلاحية الإدارة تُمنح من
        قاعدة البيانات فقط، مش من واجهة التسجيل.
      </p>

    </section>
  );
}