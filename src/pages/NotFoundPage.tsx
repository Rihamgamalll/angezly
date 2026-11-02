import { SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { Link } from '@/lib/router';
export function NotFoundPage() {
  return <div className="mx-auto max-w-2xl px-4 py-24"><EmptyState icon={<SearchX className="h-7 w-7" />} title="الصفحة مش موجودة" text="ممكن الرابط اتكتب غلط، أو الصفحة اتنقلت." action={<Link to="/" className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white">العودة للرئيسية</Link>} /></div>;
}
