import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, FileCheck2, FileText, ShieldAlert } from 'lucide-react';
import { Alert, Button, Card } from '@/components/ui';
import { getErrorMessage } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type Credential = {
  id: string; title: string; issuer: string; file_path: string; review_status: string;
  doctor_id: string | null; teacher_id: string | null;
};

export function AdminCredentialsReview() {
  const [items, setItems] = useState<Credential[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const refresh = useCallback(async () => {
    const { data, error: e } = await supabase.from('professional_credentials')
      .select('id,title,issuer,file_path,review_status,doctor_id,teacher_id')
      .eq('review_status', 'pending').order('created_at', { ascending: true });
    if (e) { setError(getErrorMessage(e)); setItems([]); }
    else { setError(''); setItems((data || []) as Credential[]); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const view = async (item: Credential) => {
    setError(''); setBusy(item.id);
    const { data, error: e } = await supabase.storage.from('professional-evidence').createSignedUrl(item.file_path, 60);
    setBusy('');
    if (e || !data?.signedUrl) setError(getErrorMessage(e || new Error('تعذّر فتح المستند')));
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };
  const review = async (item: Credential, decision: 'approved' | 'rejected') => {
    if (!window.confirm(decision === 'approved' ? 'هل تمت مراجعة المستند وتريدين اعتماده؟' : 'هل تريدين رفض المستند؟')) return;
    setError(''); setBusy(item.id);
    const { error: e } = await supabase.rpc('review_professional_credential', {
      p_credential_id: item.id, p_decision: decision,
    });
    setBusy('');
    if (e) setError(getErrorMessage(e)); else void refresh();
  };
  return (
    <Card className="mt-8 space-y-4 p-6">
      <div className="flex items-center gap-3"><FileCheck2 className="h-6 w-6 text-brand-700" aria-hidden="true" />
        <div><h2 className="text-xl font-extrabold">مراجعة الشهادات المرفوعة</h2><p className="mt-1 text-sm text-ink-500">المستندات خاصة، ولا تظهر للزوار. بعد الاعتماد يظهر اسم الشهادة فقط.</p></div>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {!error && items.length === 0 && <p className="rounded-xl bg-ink-50 p-4 text-sm text-ink-600">لا توجد مستندات تنتظر المراجعة.</p>}
      {items.map(item => (
        <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 p-4">
          <div><p className="font-extrabold text-ink-900">{item.title}</p>
            <p className="mt-1 text-xs text-ink-500">{item.doctor_id ? 'طبيب' : 'مُدرّس'}{item.issuer ? ` · ${item.issuer}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!!busy} variant="secondary" onClick={() => void view(item)}><FileText className="h-4 w-4" />فتح الإثبات</Button>
            <Button disabled={!!busy} onClick={() => void review(item, 'approved')}><BadgeCheck className="h-4 w-4" />اعتماد</Button>
            <Button disabled={!!busy} variant="danger" onClick={() => void review(item, 'rejected')}><ShieldAlert className="h-4 w-4" />رفض</Button>
          </div>
        </div>
      ))}
    </Card>
  );
}
