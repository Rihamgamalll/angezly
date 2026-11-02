import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { Alert, Button, Field, TextInput } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { isGuestSession, professionalDestination } from '@/lib/role-routing';
import { getAuthErrorMessage } from '@/lib/format';
import { useDocumentMeta } from '@/lib/hooks';
import { getNextPath, Link, navigate } from '@/lib/router';
import { supabase } from '@/lib/supabase';

const MIN_PASSWORD_LENGTH = 6;

export function SignupPage() {
  useDocumentMeta('إنشاء حساب | دَوْرك', 'أنشئ حسابك على دَوْرك لتتابع حجوزاتك ومجموعاتك الدراسية.');

  const { session, accountReady, roles } = useAuth();
  const nextPath = getNextPath('/join');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session && accountReady && !isGuestSession(session)) navigate(professionalDestination(roles, nextPath));
  }, [session, accountReady, roles, nextPath]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const name = fullName.trim();
    if (name.length < 2) {
      setError('يرجى كتابة الاسم الكامل (حرفان على الأقل).');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`يجب أن تتكوّن كلمة المرور من ${MIN_PASSWORD_LENGTH} أحرف أو أرقام على الأقل.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setError('');
    setSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name } },
    });
    setSubmitting(false);

    if (signUpError) {
      setError(getAuthErrorMessage(signUpError));
      return;
    }
    if (!data.session) {
      setError('تم إنشاء الحساب. يُرجى تأكيد البريد الإلكتروني قبل تسجيل الدخول.');
    }
  };

  return (
    <AuthShell
      title="أنشئ حسابك على دَوْرك"
      subtitle="حساب مهني واحد لإدارة عيادتك أو مجموعاتك الدراسية. الحجز للزوار لا يحتاج حسابًا."
      footer={
        <>
          لديك حساب بالفعل؟{' '}
          <Link to={`/login?next=${encodeURIComponent(nextPath)}`} className="font-bold text-brand-700 hover:text-brand-800">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="الاسم الكامل" htmlFor="signup-name">
          <TextInput id="signup-name" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" maxLength={80} required />
        </Field>
        <Field label="البريد الإلكتروني" htmlFor="signup-email">
          <TextInput
            id="signup-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            dir="ltr"
            className="text-start"
            required
          />
        </Field>
        <Field label="كلمة المرور" htmlFor="signup-password" hint={`${MIN_PASSWORD_LENGTH} حروف أو أرقام على الأقل`}>
          <div className="relative">
            <TextInput
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              dir="ltr"
              className="w-full pr-12 text-start"
              required
            />
            <button type="button" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-brand-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2">
              {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
            </button>
          </div>
        </Field>
        <Field label="تأكيد كلمة المرور" htmlFor="signup-confirm">
          <div className="relative">
            <TextInput
              id="signup-confirm"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              dir="ltr"
              className="w-full pr-12 text-start"
              required
            />
            <button type="button" aria-label={showConfirmPassword ? 'إخفاء تأكيد كلمة المرور' : 'إظهار تأكيد كلمة المرور'} aria-pressed={showConfirmPassword}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-brand-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2">
              {showConfirmPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
            </button>
          </div>
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" size="lg" fullWidth loading={submitting}>
          إنشاء الحساب
        </Button>
      </form>
    </AuthShell>
  );
}
