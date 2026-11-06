import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Stethoscope, GraduationCap, Search, EyeOff, Eye, RefreshCw, Clock3, CheckCircle2, ListFilter, AlertCircle, Users, RotateCcw } from 'lucide-react';
import { AdminCredentialsReview } from '@/components/AdminCredentialsReview';
import { Alert, Badge, Button, Card, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/format';
import { Link } from '@/lib/router';
import { supabase } from '@/lib/supabase';

type Kind = 'doctor' | 'teacher';
type Filter = 'pending' | 'published' | 'hidden' | 'all';
type Professional = { id: string; full_name: string; slug: string; governorate: string; is_published: boolean; user_id: string | null };
type HiddenRow = { kind: Kind; profile_id: string };
const keyOf = (kind: Kind, id: string) => `${kind}:${id}`;

export function AdminPage() {
  const { session, accountReady, hasRole } = useAuth();
  const [doctors, setDoctors] = useState<Professional[]>([]);
  const [teachers, setTeachers] = useState<Professional[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [hiddenReady, setHiddenReady] = useState(false);
  const [tab, setTab] = useState<Kind>('doctor');
  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hiddenError, setHiddenError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!session || !accountReady || !hasRole('admin')) { setLoading(false); return; }
    setLoading(true);
    try {
      const [d, t, h] = await Promise.all([
        supabase.from('doctors').select('id,full_name,slug,governorate,is_published,user_id').order('created_at', { ascending: false }),
        supabase.from('teachers').select('id,full_name,slug,governorate,is_published,user_id').order('created_at', { ascending: false }),
        supabase.from('admin_hidden_professionals').select('kind,profile_id'),
      ]);
      const issues: string[] = [];
      if (d.error) issues.push(`الدكاترة: ${getErrorMessage(d.error)}`);
      else setDoctors((d.data ?? []) as Professional[]);
      if (t.error) issues.push(`المدرسين: ${getErrorMessage(t.error)}`);
      else setTeachers((t.data ?? []) as Professional[]);
      setError(issues.length ? `تعذّر تحميل بعض الحسابات: ${issues.join(' | ')}` : '');
      if (h.error) {
        setHiddenReady(false);
        setHiddenError('نظام الإخفاء والاسترجاع غير مفعّل بعد. الحسابات بتظهر عادي؛ نفّذي ملف SQL المرفق مرة واحدة بعد مراجعته.');
      } else {
        setHidden((h.data ?? []).map((x: HiddenRow) => keyOf(x.kind, x.profile_id)));
        setHiddenReady(true);
        setHiddenError('');
      }
    } catch (e) { setError(`تعذّر تحميل البيانات: ${getErrorMessage(e)}`); }
    finally { setLoading(false); }
  }, [session, accountReady, hasRole]);

  useEffect(() => { void load(); }, [load]);
  const all = useMemo(() => [...doctors.map(p => ({ ...p, kind: 'doctor' as Kind })), ...teachers.map(p => ({ ...p, kind: 'teacher' as Kind }))], [doctors, teachers]);
  const isHidden = (kind: Kind, id: string) => hidden.includes(keyOf(kind, id));
  const publishedCount = all.filter(p => p.is_published && !isHidden(p.kind, p.id)).length;
  const pendingCount = all.filter(p => !p.is_published && !isHidden(p.kind, p.id) && !!p.user_id).length;
  const hiddenCount = all.filter(p => isHidden(p.kind, p.id)).length;
  const rows = (tab === 'doctor' ? doctors : teachers).filter(p => {
    const removed = isHidden(tab, p.id);
    if (filter === 'hidden' && !removed) return false;
    if (filter === 'pending' && (removed || p.is_published)) return false;
    if (filter === 'published' && (removed || !p.is_published)) return false;
    if (filter === 'all' && removed) return false;
    const term = search.trim().toLocaleLowerCase();
    return !term || `${p.full_name} ${p.governorate} ${p.slug}`.toLocaleLowerCase().includes(term);
  });

  const publish = async (kind: Kind, p: Professional) => {
    if (busy) return;
    if (!p.is_published && !window.confirm(`هل راجعتي بيانات ${p.full_name} وشهاداته وتوافقي على نشره؟`)) return;
    setBusy(p.id); setError(''); setSuccess('');
    try {
      const { error: e } = await supabase.rpc('admin_set_professional_published', { p_kind: kind, p_id: p.id, p_published: !p.is_published });
      if (e) setError(getErrorMessage(e));
      else { setSuccess(p.is_published ? 'تم إيقاف النشر.' : 'تمت الموافقة والنشر.'); await load(); }
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(''); }
  };

  const changeHidden = async (kind: Kind, p: Professional, restore: boolean) => {
    if (!hiddenReady || busy) return;
    const question = restore
      ? `استرجاع ${p.full_name}؟\n\nهيرجع لقائمة الإدارة، لكنه هيفضل غير منشور لحد ما تضغطي «موافقة ونشر».`
      : `إزالة ${p.full_name} من الموقع؟\n\nهيختفي من قوائم الزوار ويتنقل لقسم «مخفي من الموقع». بياناته وحسابه هيفضلوا محفوظين.`;
    if (!window.confirm(question)) return;
    setBusy(p.id); setError(''); setSuccess('');
    try {
      const { error: e } = await supabase.rpc('admin_set_professional_hidden', { p_kind: kind, p_id: p.id, p_hidden: !restore });
      if (e) setError(`تعذّر تنفيذ العملية: ${getErrorMessage(e)}`);
      else { setSuccess(restore ? 'تم استرجاع الحساب لقائمة الإدارة، وهو غير منشور حاليًا.' : 'تم إخفاء الحساب من الموقع ونقله لقسم «مخفي».'); await load(); }
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(''); }
  };

  if (!session || !accountReady) return <Spinner />;
  if (!hasRole('admin')) return <section className="mx-auto max-w-2xl px-4 py-20"><Alert tone="error">الصفحة مخصصة لإدارة المنصة فقط. <Link className="underline" to="/">الرئيسية</Link></Alert></section>;

  const filters: { id: Filter; label: string; icon: typeof Clock3 }[] = [
    { id: 'pending', label: 'بانتظار المراجعة', icon: Clock3 },
    { id: 'published', label: 'المنشور', icon: CheckCircle2 },
    { id: 'hidden', label: 'مخفي من الموقع', icon: EyeOff },
    { id: 'all', label: 'كل الحسابات النشطة', icon: ListFilter },
  ];
  return <section className="mx-auto max-w-7xl px-4 py-9 sm:px-6" dir="rtl">
    <div className="relative mb-7 overflow-hidden rounded-3xl bg-gradient-to-l from-emerald-900 via-teal-800 to-emerald-700 p-7 text-white shadow-xl sm:p-10">
      <div className="pointer-events-none absolute -left-12 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold"><ShieldCheck className="h-4 w-4" /> لوحة تحكم المالك</div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">إدارة أنجزلي</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-emerald-50/90">كل الحسابات والموافقات في مكان واحد. راجعي، انشري، أو اخفي الحسابات بهدوء ومن غير حذف أي بيانات.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || !!busy} className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/15 px-5 py-3 text-sm font-bold transition hover:bg-white/25 disabled:opacity-50"><RefreshCw className="h-4 w-4" /> تحديث البيانات</button>
      </div>
    </div>

    {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
    {hiddenError && <div className="mb-4"><Alert tone="warning">{hiddenError}</Alert></div>}
    {success && <div className="mb-4"><Alert tone="success">{success}</Alert></div>}

    <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {[
        { label: 'إجمالي الدكاترة', value: doctors.length, icon: Stethoscope },
        { label: 'إجمالي المدرسين', value: teachers.length, icon: GraduationCap },
        { label: 'طلبات المراجعة', value: pendingCount, icon: Clock3 },
        { label: 'الظاهر على الموقع', value: publishedCount, icon: Eye },
        { label: 'مخفي من الموقع', value: hiddenReady ? hiddenCount : '—', icon: EyeOff },
      ].map(({ label, value, icon: Icon }) => <Card key={label} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Icon className="h-5 w-5" /></div><p className="text-xs font-semibold text-ink-500">{label}</p><p className="mt-1 text-3xl font-black text-emerald-950">{value}</p></Card>)}
    </div>

    <Card className="mb-7 rounded-3xl border border-ink-100 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-emerald-950">إدارة الحسابات</h2><p className="mt-1 text-sm text-ink-500">اختاري التخصص والحالة أو ابحثي بالاسم</p></div><div className="inline-flex gap-1 rounded-2xl bg-emerald-50 p-1">
        <button type="button" onClick={() => setTab('doctor')} className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${tab === 'doctor' ? 'bg-emerald-800 text-white shadow-sm' : 'text-emerald-900 hover:bg-white'}`}>الدكاترة</button>
        <button type="button" onClick={() => setTab('teacher')} className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${tab === 'teacher' ? 'bg-emerald-800 text-white shadow-sm' : 'text-emerald-900 hover:bg-white'}`}>المدرسين</button>
      </div></div>
      <div className="mb-5 flex flex-wrap gap-2">{filters.map(f => <button key={f.id} type="button" onClick={() => setFilter(f.id)} disabled={f.id === 'hidden' && !hiddenReady} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${filter === f.id ? 'border-emerald-800 bg-emerald-800 text-white' : 'border-ink-100 bg-white text-ink-600 hover:border-emerald-300 hover:bg-emerald-50'}`}><f.icon className="h-4 w-4" />{f.label}</button>)}</div>
      <div className="relative mb-6"><Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحثي بالاسم أو المحافظة أو رابط الصفحة..." aria-label="بحث في الحسابات" className="w-full rounded-2xl border border-ink-100 bg-ink-50 py-3 pl-4 pr-12 text-sm outline-none transition focus:border-emerald-500 focus:bg-white" /></div>
      <div className="mb-4 flex items-center justify-between text-sm text-ink-500"><span>عدد النتائج: <strong className="text-emerald-950">{rows.length}</strong></span><span>{tab === 'doctor' ? 'قسم الأطباء' : 'قسم المدرسين'}</span></div>
      {loading ? <Spinner /> : <div className="space-y-3">{rows.map(p => {
        const removed = isHidden(tab, p.id);
        return <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-100 bg-white p-5 transition hover:border-emerald-200 hover:shadow-sm">
          <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="text-base font-black text-emerald-950">{p.full_name}</h3><Badge tone={removed ? 'warning' : p.is_published ? 'success' : 'warning'}>{removed ? 'مخفي من الموقع' : p.is_published ? 'منشور' : 'منتظر المراجعة'}</Badge></div><p className="break-all text-xs text-ink-500">{p.governorate || 'المحافظة غير محددة'} · /{tab}/{p.slug}</p>{!p.user_id && <p className="mt-2 flex items-center gap-1 text-xs text-amber-700"><AlertCircle className="h-3 w-3" /> الحساب غير مرتبط بمستخدم</p>}</div>
          <div className="flex flex-wrap items-center gap-2"><Link to={`/${tab}/${p.slug}`} className="inline-flex items-center gap-2 rounded-xl border border-ink-100 px-4 py-2.5 text-sm font-bold text-ink-700 hover:bg-ink-50"><Eye className="h-4 w-4" /> عرض الصفحة</Link>
            {removed ? <Button disabled={!!busy || !hiddenReady} variant="secondary" onClick={() => void changeHidden(tab, p, true)}><RotateCcw className="h-4 w-4" /> استرجاع</Button> : <>
              <Button disabled={!!busy} variant={p.is_published ? 'danger' : 'primary'} onClick={() => void publish(tab, p)}>{p.is_published ? 'إيقاف النشر' : 'موافقة ونشر'}</Button>
              <Button disabled={!!busy || !hiddenReady} variant="secondary" onClick={() => void changeHidden(tab, p, false)}><EyeOff className="h-4 w-4" /> إزالة من الموقع</Button>
            </>}
          </div>
        </div>;
      })}{rows.length === 0 && <div className="rounded-2xl border border-dashed border-ink-100 bg-ink-50 px-6 py-12 text-center"><Users className="mx-auto mb-3 h-8 w-8 text-emerald-600" /><p className="font-bold text-ink-700">مفيش حسابات مطابقة هنا</p><p className="mt-1 text-sm text-ink-500">جرّبي تغيير القسم أو الفلتر أو البحث.</p></div>}</div>}
    </Card>
    <AdminCredentialsReview />
    <p className="mt-6 text-xs leading-6 text-ink-500">تنبيه: الموافقة على حسابات الأطباء تكون بعد التحقق من الهوية والمؤهلات. «إزالة من الموقع» إخفاء قابل للاسترجاع وليست حذفًا من قاعدة البيانات.</p>
  </section>;
}
