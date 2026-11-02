
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Alert, Button, Card, Spinner, TextInput } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type GateStep = 'checking' | 'enroll' | 'challenge' | 'ready' | 'error';

/**
 * Administrator-only TOTP setup/challenge UI.
 * IMPORTANT: Authorisation is also enforced in PostgreSQL functions,
 * never by this UI alone.
 */
export function AdminMfaGate({ children }: { children: ReactNode }) {
  const { session, accountReady, roles, signOut } = useAuth();
  const isAdmin = roles.includes('admin');

  const [step, setStep] = useState<GateStep>('checking');
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session || !accountReady || !isAdmin) return;

    let alive = true;

    const check = async () => {
      const [assurance, factors] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);

      if (!alive) return;

      if (assurance.error || factors.error) {
        setError(
          assurance.error?.message ||
          factors.error?.message ||
          'تعذّر فحص التحقق الإضافي.'
        );
        setStep('error');
        return;
      }

      if (assurance.data.currentLevel === 'aal2') {
        setStep('ready');
        return;
      }

      const verified = factors.data.totp.find(
        factor => factor.status === 'verified'
      );

      if (verified) {
        setFactorId(verified.id);
        setStep('challenge');
      } else {
        setStep('enroll');
      }
    };

    void check();

    return () => {
      alive = false;
    };
  }, [session?.user.id, accountReady, isAdmin]);

  const enroll = async () => {
    setBusy(true);
    setError('');

    const { data, error: enrollError } =
      await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'إدارة المنصة',
      });

    setBusy(false);

    if (enrollError || !data?.totp) {
      setError(
        enrollError?.message || 'تعذّر بدء تفعيل الحماية.'
      );
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setToken('');
  };

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const code = token.replace(/\s/g, '');

    if (!/^\d{6}$/.test(code) || !factorId) {
      setError('اكتبي الرمز المكوّن من 6 أرقام من تطبيق المصادقة.');
      return;
    }

    setBusy(true);
    setError('');

    const result = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    if (result.error) {
      setBusy(false);
      setError(
        'رمز التحقق غير صحيح أو انتهت صلاحيته. جرّبي الرمز الأحدث.'
      );
      return;
    }

    const assurance =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    setBusy(false);
    setToken('');

    if (assurance.error || assurance.data.currentLevel !== 'aal2') {
      setError(
        'تم التحقق لكن الجلسة لم تتحدّث بعد. أعيدي تحميل الصفحة.'
      );
      return;
    }

    setStep('ready');
  };

  if (!session || !accountReady || !isAdmin) {
    return <Spinner />;
  }

  if (step === 'ready') {
    return <>{children}</>;
  }

  return (
    <section
      className="mx-auto max-w-xl px-4 py-14 sm:px-6"
      dir="rtl"
    >
      <Card className="space-y-6 p-6 sm:p-9">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
            <ShieldCheck size={28} />
          </div>

          <div>
            <p className="text-xs font-bold text-brand-700">
              حماية حساب الإدارة
            </p>

            <h1 className="text-2xl font-extrabold text-ink-900">
              تأكيد الهوية بخطوتين
            </h1>
          </div>
        </div>

        <p className="text-sm leading-7 text-ink-600">
          لحماية بيانات المستخدمين، لوحة الإدارة بتحتاج رمزًا
          من تطبيق المصادقة على موبايلك، بالإضافة لكلمة المرور.
        </p>

        {step === 'checking' && (
          <Spinner label="جاري التأكد من حماية حساب الإدارة..." />
        )}

        {step === 'error' && (
          <Alert tone="error">
            تعذّر التحقق من إعدادات الأمان.
            أعيدي تحميل الصفحة أو سجّلي الدخول مرة تانية.
          </Alert>
        )}

        {error && (
          <Alert tone="error">{error}</Alert>
        )}

        {step === 'enroll' && (
          <div className="space-y-4">
            <Alert tone="info">
              أول مرة فقط: افتحي تطبيق Google Authenticator
              أو Microsoft Authenticator، وامسحي رمز QR.
            </Alert>

            {!qrCode && (
              <Button
                fullWidth
                onClick={() => void enroll()}
                loading={busy}
              >
                بدء تفعيل التحقق بخطوتين
              </Button>
            )}

            {qrCode && (
              <>
                <div className="flex justify-center rounded-xl border border-ink-100 bg-white p-4">
                  <img
                    src={qrCode}
                    alt="رمز QR لتفعيل التحقق بخطوتين"
                    className="h-52 w-52"
                  />
                </div>

                <form
                  className="space-y-3"
                  onSubmit={verify}
                >
                  <label
                    className="block text-sm font-bold"
                    htmlFor="admin-totp-enroll"
                  >
                    رمز المصادقة (6 أرقام)
                  </label>

                  <TextInput
                    id="admin-totp-enroll"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    dir="ltr"
                    value={token}
                    onChange={event => setToken(event.target.value)}
                    required
                  />

                  <Button
                    type="submit"
                    fullWidth
                    loading={busy}
                  >
                    <LockKeyhole size={18} />
                    تفعيل الحماية والدخول
                  </Button>
                </form>
              </>
            )}
          </div>
        )}

        {step === 'challenge' && (
          <form
            className="space-y-4"
            onSubmit={verify}
          >
            <label
              className="block text-sm font-bold"
              htmlFor="admin-totp-code"
            >
              اكتبي الرمز الموجود حاليًا في تطبيق المصادقة
            </label>

            <TextInput
              id="admin-totp-code"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              dir="ltr"
              value={token}
              onChange={event => setToken(event.target.value)}
              required
            />

            <Button
              type="submit"
              fullWidth
              loading={busy}
            >
              <LockKeyhole size={18} />
              تأكيد الرمز وفتح الإدارة
            </Button>
          </form>
        )}

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => void signOut()}
        >
          تسجيل الخروج
        </Button>
      </Card>
    </section>
  );
}
