import { LogIn, UserPlus } from 'lucide-react';
import { Card } from '@/components/ui';
import { Link, useCurrentPath } from '@/lib/router';

export function AuthPrompt({ title, text }: { title: string; text: string }) {
  const path = useCurrentPath();
  const next = encodeURIComponent(path);

  return (
    <Card className="p-6 text-center sm:p-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <LogIn className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="mt-4 text-lg font-bold text-ink-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500">{text}</p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to={`/login?next=${next}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
        >
          <LogIn className="h-4 w-4" aria-hidden />
          تسجيل الدخول
        </Link>
        <Link
          to={`/signup?next=${next}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-5 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          إنشاء حساب جديد
        </Link>
      </div>
    </Card>
  );
}
