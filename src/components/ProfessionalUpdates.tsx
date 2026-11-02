import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { Alert, Button, Field, TextAreaInput, TextInput } from '@/components/ui';
import { getErrorMessage } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Kind = 'doctor' | 'teacher';
type Update = { id: string; title: string; body: string; created_at: string };
type Props = { kind: Kind; professionalId: string; editable?: boolean };

export function ProfessionalUpdates({ kind, professionalId, editable = false }: Props) {
  const { session, hasRole } = useAuth();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('professional_updates')
      .select('id,title,body,created_at')
      .eq('kind', kind).eq('professional_id', professionalId)
      .order('created_at', { ascending: false }).limit(15);
    if (queryError) {
      if (editable) setError('قسم المستجدات يحتاج تشغيل ملف V18 في Supabase أولًا.');
    } else { setUpdates((data ?? []) as Update[]); setError(''); }
    setReady(true);
  }, [kind, professionalId, editable]);

  useEffect(() => { void load(); }, [load]);
  const canEdit = editable && Boolean(session && !session.user.is_anonymous && hasRole(kind) && !hasRole('admin'));

  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!session || !canEdit || cleanTitle.length < 3 || cleanTitle.length > 80 || cleanBody.length < 5 || cleanBody.length > 600) {
      setError('يرجى كتابة عنوان من 3 إلى 80 حرفًا، ونص من 5 إلى 600 حرف.'); return;
    }
    setBusy(true); setError('');
    const { error: insertError } = await supabase.from('professional_updates').insert({
      owner_user_id: session.user.id, kind, professional_id: professionalId, title: cleanTitle, body: cleanBody,
    });
    setBusy(false);
    if (insertError) { setError(getErrorMessage(insertError)); return; }
    setTitle(''); setBody(''); await load();
  };
  const remove = async (id: string) => {
    if (!canEdit || !window.confirm('هل تريد حذف هذا المستجد من صفحتك؟')) return;
    setBusy(true); setError('');
    const { error: deleteError } = await supabase.from('professional_updates').delete()
      .eq('id', id).eq('professional_id', professionalId);
    setBusy(false);
    if (deleteError) { setError(getErrorMessage(deleteError)); return; }
    await load();
  };

  if (!editable && (!ready || updates.length === 0)) return null;
  return <section className="space-y-4 rounded-[1.5rem] border border-ink-100 bg-white p-5 sm:p-6" dir="rtl">
    <div className="flex items-center gap-3">
      <span className="rounded-xl bg-brand-50 p-3 text-brand-700"><Megaphone className="h-5 w-5"/></span>
      <div><h2 className="text-xl font-extrabold text-brand-900">{editable ? 'مستجدات صفحتي' : 'آخر المستجدات'}</h2>
        {editable && <p className="mt-1 text-xs leading-6 text-ink-500">شارك خبرًا أو نشاطًا مهنيًا. يُعرض في ملفك العام بعد اعتماد الحساب.</p>}
      </div>
    </div>
    {canEdit && <form onSubmit={publish} className="space-y-3 rounded-2xl bg-ink-50 p-4">
      <Field label="عنوان المستجد" htmlFor={`${kind}-update-title`}><TextInput id={`${kind}-update-title`} value={title} onChange={e=>setTitle(e.target.value)} minLength={3} maxLength={80} placeholder="مثال: مواعيد جديدة أو نشاط مهني" required /></Field>
      <Field label="التفاصيل" htmlFor={`${kind}-update-body`} hint="لا تُدرج أي بيانات تخص مرضى أو طلابًا دون موافقتهم."><TextAreaInput id={`${kind}-update-body`} value={body} onChange={e=>setBody(e.target.value)} maxLength={600} required /></Field>
      <Button loading={busy} type="submit"><Plus className="h-4 w-4"/> إضافة مستجد</Button>
    </form>}
    {error && <Alert tone="error">{error}</Alert>}
    {updates.length === 0 && ready && !error && editable && <p className="rounded-2xl bg-ink-50 px-4 py-6 text-sm text-ink-500">لا توجد مستجدات بعد. يمكنك إضافة أول تحديث في أي وقت.</p>}
    <div className="space-y-3">{updates.map(update => <article key={update.id} className="rounded-xl border border-ink-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-extrabold text-brand-900">{update.title}</h3>
        {canEdit && <button type="button" aria-label={`حذف ${update.title}`} disabled={busy} onClick={()=>void remove(update.id)} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-bold text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4"/> حذف</button>}
      </div>
      <p className="mt-2 whitespace-pre-line text-sm leading-7 text-ink-700">{update.body}</p>
      <time className="mt-3 block text-xs text-ink-500" dateTime={update.created_at}>{new Date(update.created_at).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', year: 'numeric', month: 'long', day: 'numeric' })}</time>
    </article>)}</div>
  </section>;
}
