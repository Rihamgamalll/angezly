import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { Alert, Button, Field, TextInput } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getAuthErrorMessage } from '@/lib/format';
import { useDocumentMeta } from '@/lib/hooks';
import { Link, navigate } from '@/lib/router';
import { supabase } from '@/lib/supabase';

/** Administrative entrance. Auth is Supabase; privileges are verified in the DB. */
export function AdminLoginPage() {
  useDocumentMeta('دخول إدارة دَوْرك | دَوْرك', 'بوابة إدارة المنصة للمصرح لهم فقط.');
  const { session, accountReady, hasRole, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session && accountReady && hasRole('admin')) navigate('/admin');
  }, [session, accountReady, hasRole]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(), password,
    });
    setSubmitting(false);
    if (authError) setError(getAuthErrorMessage(authError));
    // The effect redirects only after roles are read and verified.
  };

  return (
    <AuthShell
      title="دخول إدارة دَوْرك"
      subtitle="مساحة خاصة بإدارة المنصة ومراجعة الحسابات والطلبات."
      footer={<Link to="/login" className="font-bold text-brand-700">تسجيل الدخول كمستخدم</Link>}
    >
      {session && accountReady && !hasRole('admin') ? (
        <div className="space-y-4">
          <Alert tone="info">الحساب الحالي ليس حساب إدارة. يُرجى تسجيل الخروج أولًا لاستخدام حساب الإدارة.</Alert>
          <Button fullWidth onClick={async () => { await signOut(); setError(''); }}>
            تسجيل الخروج وتبديل الحساب
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-bold text-brand-800">
            <ShieldCheck size={18}/> الدخول مقتصر على الحسابات المصرّح لها.
          </div>
          <Field label="البريد الإلكتروني" htmlFor="owner-email">
            <TextInput id="owner-email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" dir="ltr" className="text-start" required />
          </Field>
          <Field label="كلمة المرور" htmlFor="owner-password">
            <div className="relative">
              <TextInput id="owner-password" type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} autoComplete="current-password" dir="ltr" className="w-full pr-12 text-start" required />
              <button type="button" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-brand-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2">
                {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
            </div>
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" size="lg" fullWidth loading={submitting}>دخول لوحة الإدارة</Button>
        </form>
      )}
    </AuthShell>
  );
}
