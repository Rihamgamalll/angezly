import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, FileCheck2, FileText, ShieldAlert } from 'lucide-react';
import { Alert, Button, Card } from '@/components/ui';
import { getErrorMessage } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type Credential = {
  id: string;
  title: string;
  issuer: string;
  file_path: string;
  review_status: string;
  doctor_id: string | null;
  teacher_id: string | null;
};

export function AdminCredentialsReview() {
  const [items, setItems] = useState<Credential[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: e } = await supabase
        .from('professional_credentials')
        .select('id,title,issuer,file_path,review_status,doctor_id,teacher_id')
        .eq('review_status', 'pending')
        .order('created_at', { ascending: true });
      if (e) { setError(getErrorMessage(e)); setItems([]); }
      else { setError(''); setItems((data ?? []) as Credential[]); }
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const view = async (item: Credential) => {
    setError(''); setBusy(item.id);
    try {
      const { data, error: e } = await supabase.storage.from('professional-evidence').createSignedUrl(item.file_path, 60);
      if (e || !data?.signedUrl) setError(getErrorMessage(e ?? new Error('تعذّر فتح المستند')));
      else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(''); }
  };

  const review = async (item: Credential, decision: 'approved' | 'rejected') => {
    if (!window.confirm(decision === 'approved' ? 'هل راجعتي المستند وتريدين اعتماده؟' : 'هل تريدين رفض المستند؟')) return;
    setError(''); setBusy(item.id);
    try {
      const { error: e } = await supabase.rpc('review_professional_credential', {
        p_credential_id: item.id, p_decision: decision,
      });
      if (e) setError(getErrorMessage(e));
      else await refresh();
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(''); }
  };

  return <Card className="mt-8 space-y-4 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm" >
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-3"><FileCheck2 className="h-6 w-6 text-emerald-800" aria-hidden="true" /></div>
        <div><h2 className="text-xl font-black">مراجعة الشهادات المرفوعة</h2><p className="mt-1 text-sm text-ink-500">المستندات خاصة ولا تظهر للزوار. بعد الاعتماد يظهر اسم الشهادة فقط.</p></div></div>
      <Button variant="secondary" disabled={loading || !!busy} onClick={() => void refresh()}>تحديث الشهادات</Button>
    </div>
    {error && <Alert tone="error">{error}</Alert>}
    {loading && <p className="text-sm text-ink-500">جاري تحميل المستندات...</p>}
    {!loading && !error && items.length === 0 && <p className="rounded-xl bg-ink-50 p-4 text-sm text-ink-600">لا توجد مستندات تنتظر المراجعة.</p>}
    {!loading && items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-100 p-4">
      <div><p className="font-extrabold text-ink-900">{item.title}</p><p className="mt-1 text-xs text-ink-500">{item.doctor_id ? 'طبيب' : 'مُدرّس'}{item.issuer ? ` · ${item.issuer}` : ''}</p></div>
      <div className="flex flex-wrap gap-2"><Button disabled={!!busy} variant="secondary" onClick={() => void view(item)}><FileText className="h-4 w-4" />فتح الإثبات</Button>
        <Button disabled={!!busy} onClick={() => void review(item, 'approved')}><BadgeCheck className="h-4 w-4" />اعتماد</Button>
        <Button disabled={!!busy} variant="danger" onClick={() => void review(item, 'rejected')}><ShieldAlert className="h-4 w-4" />رفض</Button></div>
    </div>)}
  </Card>;
}
