import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, UserRound } from 'lucide-react';
import { ProfessionalProfileEditor } from '@/components/ProfessionalProfileEditor';
import { ProfessionalUpdates } from '@/components/ProfessionalUpdates';
import { ShareLinkPanel } from '@/components/ShareLinkPanel';
import { Alert, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { isGuestSession } from '@/lib/role-routing';
import { getErrorMessage } from '@/lib/format';
import { useDocumentMeta } from '@/lib/hooks';
import { Link } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import type { Doctor, Teacher } from '@/lib/types';

export function WorkspaceProfilePage() {
  useDocumentMeta('ملفي الشخصي | دَوْرك', 'صوّرتك ومؤهلاتك ومعلومات ملفك العام في مكان واحد.');
  const { session, sessionLoading, accountReady, roles } = useAuth();
  const kind = roles.includes('doctor') ? 'doctor' : roles.includes('teacher') ? 'teacher' : null;
  const [record, setRecord] = useState<Doctor | Teacher | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!session || !accountReady || !kind) { setBusy(false); return; }
    const { data, error: fetchError } = await supabase.from(kind === 'doctor' ? 'doctors' : 'teachers')
      .select('*').eq('user_id', session.user.id).maybeSingle();
    if (fetchError) setError(getErrorMessage(fetchError));
    else { setRecord(data as Doctor | Teacher | null); setError(''); }
    setBusy(false);
  }, [session, accountReady, kind]);
  useEffect(() => { void load(); }, [load]);
  if (sessionLoading || (session && !accountReady) || busy) return <Spinner />;
  if (isGuestSession(session) || !kind) return <section className="mx-auto max-w-3xl px-4 py-12"><Alert tone="info">الملف المهني متاح للأطباء والمُدرّسين فقط. <Link to="/dashboard" className="font-bold underline">حجوزاتي</Link></Alert></section>;
  if (!record) return <section className="mx-auto max-w-3xl px-4 py-12"><Alert tone="info">لم يكتمل ملفك المهني بعد. <Link to={`/register/${kind}`} className="font-bold underline">إكمال التسجيل</Link></Alert></section>;
  return <section className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6" dir="rtl">
    <Link to="/workspace" className="inline-flex items-center gap-2 text-sm font-bold text-brand-700"><ArrowRight className="h-4 w-4"/> مساحتي</Link>
    <div className="rounded-[1.8rem] border border-ink-100 bg-white p-7">
      <p className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-brand-700"><UserRound className="h-4 w-4"/> الملف العام</p>
      <h1 className="text-3xl font-extrabold text-brand-900">بروفايلك، بطريقتك.</h1>
      <p className="mt-2 text-sm leading-7 text-ink-600">اختار صورة مناسبة، عرّف الناس بخبرتك، وأضف مؤهلاتك اختيارياً. كل حاجة هنا للعرض في صفحتك العامة، بعيدًا عن إدارة المواعيد.</p>
    </div>
    {error && <Alert tone="error">{error}</Alert>}
    <ShareLinkPanel kind={kind} slug={record.slug} />
    <ProfessionalProfileEditor kind={kind} professionalId={record.id} initialBio={record.bio} initialQualifications={kind === 'doctor' ? (record as Doctor).qualifications : (record as Teacher).credentials_summary ?? ''} initialVisitorNote={record.visitor_note ?? ''} initialPhotoUrl={record.photo_url} onSaved={() => void load()} />
    <ProfessionalUpdates kind={kind} professionalId={record.id} editable />
  </section>;
}
