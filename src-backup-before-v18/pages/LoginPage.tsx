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

export function LoginPage() {
  useDocumentMeta('تسجيل الدخول | دَوْرك', 'تسجيل الدخول عشان تتابع حجوزاتك ومجموعاتك على دَوْرك.');

  const { session, accountReady, roles } = useAuth();
  const portalKind = window.location.pathname === '/portal/doctor' ? 'doctor' : window.location.pathname === '/portal/teacher' ? 'teacher' : null;
  const nextPath = getNextPath(portalKind ? `/register/${portalKind}` : '/join');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session && accountReady && !isGuestSession(session)) {
      navigate(professionalDestination(roles, nextPath));
    }
  }, [session, accountReady, roles, nextPath]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (signInError) {
      setError(getAuthErrorMessage(signInError));
    }
  };

  return (
    <AuthShell
      title={portalKind === 'doctor' ? 'دخول الطبيب' : portalKind === 'teacher' ? 'دخول المُدرّس' : 'مرحبًا بعودتك'}
      subtitle={portalKind === 'doctor' ? 'عيادتك ومواعيد مرضاك، في مساحة عمل خاصة بك.' : portalKind === 'teacher' ? 'مجموعاتك وجدولك وطلابك، في مساحة عمل خاصة بك.' : 'سجّل الدخول للانتقال مباشرةً إلى مساحة عملك الخاصة.'}
      footer={
        <>
          ليس لديك حساب؟{' '}
          <Link to={`/signup?next=${encodeURIComponent(nextPath)}`} className="font-bold text-brand-700 hover:text-brand-800">
            إنشاء حساب جديد
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="البريد الإلكتروني" htmlFor="login-email">
          <TextInput
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            dir="ltr"
            className="text-start"
            required
          />
        </Field>
        <Field label="كلمة المرور" htmlFor="login-password">
          <div className="relative">
            <TextInput
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
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
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" size="lg" fullWidth loading={submitting}>
          تسجيل الدخول
        </Button>
      </form>
    </AuthShell>
  );
}
