import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Stethoscope, GraduationCap, UserRound, Check } from 'lucide-react';
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
  const incomingNext = getNextPath('/join');
  const inferredRole = incomingNext.startsWith('/register/doctor') ? 'doctor' : incomingNext.startsWith('/register/teacher') ? 'teacher' : null;
  const [accountKind, setAccountKind] = useState<'doctor' | 'teacher' | 'visitor' | null>(inferredRole);
  const nextPath = accountKind === 'doctor' ? '/register/doctor' : accountKind === 'teacher' ? '/register/teacher' : '/choose';
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

    if (!accountKind) { setError('يرجى اختيار نوع الحساب أولًا.'); return; }
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
      options: { data: { full_name: name, account_kind: accountKind } },
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
      subtitle="اختَر نوع الحساب المناسب؛ لكل مستخدم مساحة واضحة وصلاحيات مستقلة."
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
        <fieldset className="space-y-3">
          <legend className="mb-2 text-base font-extrabold text-brand-900">نوع الحساب</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              { id: 'doctor', label: 'طبيب', description: 'إدارة عيادتي', icon: Stethoscope },
              { id: 'teacher', label: 'مُدرّس', description: 'إدارة مجموعاتي', icon: GraduationCap },
              { id: 'visitor', label: 'زائر', description: 'حجوزاتي فقط', icon: UserRound },
            ] as const).map(({ id, label, description, icon: Icon }) => (
              <label key={id} className={`relative flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 p-3 text-center transition focus-within:ring-2 focus-within:ring-brand-600 ${accountKind === id ? 'border-brand-600 bg-brand-50' : 'border-ink-100 bg-white hover:border-brand-200'}`}>
                <input type="radio" name="account-kind" value={id} checked={accountKind === id} onChange={() => { setAccountKind(id); setError(''); }} className="sr-only" required />
                <Icon className="h-6 w-6 text-brand-700" aria-hidden="true" />
                <span className="text-sm font-extrabold text-ink-900">{label}</span>
                <span className="text-xs text-ink-500">{description}</span>
                {accountKind === id && <Check className="absolute left-2 top-2 h-4 w-4 text-brand-700" aria-hidden="true" />}
              </label>
            ))}
          </div>
          {accountKind === 'visitor' && <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs leading-6 text-brand-900">حساب الزائر لمتابعة حجوزاتك فقط. مش هتقدر تدخل بيانات أو إدارة أي عيادة أو مجموعة. وممكن تحجز من رابط الطبيب أو المدرس حتى من غير حساب.</p>}
          {(accountKind === 'doctor' || accountKind === 'teacher') && <p className="rounded-xl bg-ink-50 px-3 py-2 text-xs leading-6 text-ink-700">بعد إنشاء الحساب هتكمل بياناتك المهنية، وبعد مراجعتها هيتاح رابط الحجز الخاص بيك. كل أدوات الإدارة هتكون في مساحة عمل منفصلة عن بروفايلك.</p>}
        </fieldset>
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
