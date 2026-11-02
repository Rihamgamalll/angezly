import { useEffect, useState } from 'react';
import { BadgeCheck, BookOpenCheck, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type PublicCredential = { id: string; title: string; issuer: string; issued_year: number | null };

type Props = {
  kind: 'doctor' | 'teacher';
  professionalId: string;
  qualifications?: string;
  visitorNote?: string;
};

export function PublicProfessionalInfo({ kind, professionalId, qualifications, visitorNote }: Props) {
  const [credentials, setCredentials] = useState<PublicCredential[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.rpc('get_public_credentials', {
        p_kind: kind, p_professional_id: professionalId,
      });
      if (mounted && !error) setCredentials((data || []) as PublicCredential[]);
    })();
    return () => { mounted = false; };
  }, [kind, professionalId]);
  if (!qualifications?.trim() && !visitorNote?.trim() && credentials.length === 0) return null;
  return (
    <div className="space-y-4">
      {qualifications?.trim() && (
        <div className="rounded-xl bg-ink-50 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink-900"><BookOpenCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />المؤهلات والخبرات</h3>
          <p className="whitespace-pre-line text-sm leading-7 text-ink-700">{qualifications}</p>
          <p className="mt-2 text-xs text-ink-500">معلومات أضافها صاحب الصفحة.</p>
        </div>
      )}
      {credentials.length > 0 && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink-900"><BadgeCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />مستندات راجعتها إدارة دَوْرك</h3>
          <ul className="space-y-2">{credentials.map(c => (
            <li key={c.id} className="flex gap-2 text-sm text-ink-800"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              <span>{c.title}{c.issuer ? ` — ${c.issuer}` : ''}{c.issued_year ? ` (${c.issued_year})` : ''}</span>
            </li>
          ))}</ul>
          <p className="mt-3 text-xs text-ink-500">تمت مراجعة المستندات المقدمة، ولا يُعد ذلك ضمانًا لجودة الخدمة أو نتيجتها.</p>
        </div>
      )}
      {visitorNote?.trim() && (
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-brand-900"><Info className="h-4 w-4" aria-hidden="true" />{kind === 'doctor' ? 'قبل زيارة العيادة' : 'قبل الحصة'}</h3>
          <p className="whitespace-pre-line text-sm leading-7 text-ink-700">{visitorNote}</p>
        </div>
      )}
    </div>
  );
}
