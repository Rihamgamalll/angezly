import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, FileText, Paperclip, ShieldCheck, Trash2 } from 'lucide-react';
import { Alert, Button, Card, Field, TextAreaInput, TextInput } from '@/components/ui';
import { getErrorMessage } from '@/lib/format';
import { ProfessionalPhotoEditor } from '@/components/ProfessionalPhotoEditor';
import { supabase } from '@/lib/supabase';

type Kind = 'doctor' | 'teacher';
type Credential = {
  id: string;
  title: string;
  issuer: string;
  file_path: string;
  review_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

type Props = {
  kind: Kind;
  professionalId: string;
  initialBio: string;
  initialQualifications: string;
  initialVisitorNote: string;
  initialPhotoUrl: string | null;
  onSaved: () => void;
};

const BUCKET = 'professional-evidence';
const MAX_BYTES = 5 * 1024 * 1024;
const MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export function ProfessionalProfileEditor({
  kind, professionalId, initialBio, initialQualifications, initialVisitorNote, initialPhotoUrl, onSaved,
}: Props) {
  const [bio, setBio] = useState(initialBio || '');
  const [qualifications, setQualifications] = useState(initialQualifications || '');
  const [visitorNote, setVisitorNote] = useState(initialVisitorNote || '');
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setBio(initialBio || '');
    setQualifications(initialQualifications || '');
    setVisitorNote(initialVisitorNote || '');
  }, [kind, professionalId, initialBio, initialQualifications, initialVisitorNote]);

  const loadCredentials = useCallback(async () => {
    const field = kind === 'doctor' ? 'doctor_id' : 'teacher_id';
    const { data, error: e } = await supabase.from('professional_credentials')
      .select('id,title,issuer,file_path,review_status,created_at')
      .eq(field, professionalId).order('created_at', { ascending: false });
    if (e) setError(getErrorMessage(e));
    else setCredentials((data || []) as Credential[]);
  }, [kind, professionalId]);

  useEffect(() => { void loadCredentials(); }, [loadCredentials]);

  const saveText = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(''); setSuccess(''); setBusy('text');
    const table = kind === 'doctor' ? 'doctors' : 'teachers';
    const data = {
      bio: bio.trim(),
      visitor_note: visitorNote.trim(),
      [kind === 'doctor' ? 'qualifications' : 'credentials_summary']: qualifications.trim(),
    };
    const { error: e } = await supabase.from(table).update(data).eq('id', professionalId);
    setBusy('');
    if (e) { setError(getErrorMessage(e)); return; }
    setSuccess('تم حفظ التعديلات على صفحتك.');
    onSaved();
  };

  const uploadEvidence = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || title.trim().length < 3) {
      setError('يرجى كتابة اسم المستند واختيار ملف.'); return;
    }
    const extension = MIME[file.type];
    if (!extension || file.size > MAX_BYTES || file.size === 0) {
      setError('الملفات المسموحة: PDF أو JPG أو PNG أو WebP، بحجم لا يزيد على 5 ميجابايت.');
      return;
    }
    setError(''); setSuccess(''); setBusy('upload');
    const path = `${kind}/${professionalId}/${crypto.randomUUID()}.${extension}`;
    const foreignKey = kind === 'doctor' ? 'doctor_id' : 'teacher_id';
    const { data: row, error: insertError } = await supabase.from('professional_credentials')
      .insert({ [foreignKey]: professionalId, title: title.trim(), issuer: issuer.trim(), file_path: path })
      .select('id').single();
    if (insertError || !row) {
      setError(getErrorMessage(insertError || new Error('لم يمكن إنشاء المستند.')));
      setBusy(''); return;
    }
    const { error: storageError } = await supabase.storage.from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });
    if (storageError) {
      await supabase.from('professional_credentials').delete().eq('id', row.id);
      setError(`تعذّر رفع الملف: ${getErrorMessage(storageError)}`);
    } else {
      setSuccess('تم استلام المستند للمراجعة. لن يظهر على صفحتك قبل اعتماده.');
      setTitle(''); setIssuer(''); setFile(null); setFileInputKey(key => key + 1);
    }
    setBusy(''); void loadCredentials();
  };

  const removeEvidence = async (credential: Credential) => {
    if (!window.confirm('هل تريد حذف هذا المستند؟')) return;
    setBusy(credential.id); setError(''); setSuccess('');
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([credential.file_path]);
    if (storageError) { setError(getErrorMessage(storageError)); setBusy(''); return; }
    const { error: dbError } = await supabase.from('professional_credentials').delete().eq('id', credential.id);
    setBusy('');
    if (dbError) setError(getErrorMessage(dbError));
    else { setSuccess('تم حذف المستند.'); void loadCredentials(); }
  };

  return (
    <Card className="overflow-hidden p-5 sm:p-7">
      <div className="mb-6 flex items-start gap-3">
        <span className="rounded-2xl bg-brand-50 p-3 text-brand-700"><FileText className="h-6 w-6" aria-hidden="true" /></span>
        <div>
          <h2 className="text-xl font-extrabold text-ink-900">عرّف الناس بخبرتك</h2>
          <p className="mt-1 text-sm leading-6 text-ink-500">صفحة أكثر وضوحًا وثقة. كل البيانات والمستندات هنا اختيارية ويمكن تحديثها لاحقًا.</p>
        </div>
      </div>
      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
      {success && <div className="mb-4"><Alert tone="success">{success}</Alert></div>}
      <ProfessionalPhotoEditor kind={kind} professionalId={professionalId} initialPhotoUrl={initialPhotoUrl} onSaved={onSaved} />
      <form onSubmit={saveText} className="space-y-4">
        <Field htmlFor={`${kind}-about`} label="نبذة عنك (اختياري)" hint="عرّف الزائر بأسلوبك وخبرتك في كلمات بسيطة.">
          <TextAreaInput id={`${kind}-about`} value={bio} onChange={e => setBio(e.target.value)} maxLength={1000} rows={4} placeholder={kind === 'doctor' ? 'خبرتك، نوع الحالات التي تستقبلها، وطريقتك في تنظيم الزيارات...' : 'أسلوب الشرح، المواد التي تدرّسها، وطريقتك في متابعة الطلاب...'} />
        </Field>
        <Field htmlFor={`${kind}-qualifications`} label="المؤهلات والخبرات (اختياري)" hint="اذكر المؤهلات بدقة، ولا تكتب اعتمادًا لم تحصل عليه.">
          <TextAreaInput id={`${kind}-qualifications`} value={qualifications} onChange={e => setQualifications(e.target.value)} maxLength={500} rows={3} placeholder="مثال: المؤهل، الجهة المانحة، وسنوات الخبرة" />
        </Field>
        <Field htmlFor={`${kind}-arrival`} label={kind === 'doctor' ? 'معلومة مفيدة قبل زيارة العيادة (اختياري)' : 'معلومة مفيدة قبل الحصة (اختياري)'} hint="معلومة تظهر على صفحة الحجز للزائر، مثل طريقة الوصول أو موعد الحضور.">
          <TextAreaInput id={`${kind}-arrival`} value={visitorNote} onChange={e => setVisitorNote(e.target.value)} maxLength={500} rows={2} placeholder={kind === 'doctor' ? 'يُفضّل الحضور قبل الموعد بعشر دقائق.' : 'يرجى الحضور قبل بداية الحصة بعشر دقائق.'} />
        </Field>
        <Button type="submit" loading={busy === 'text'} disabled={busy !== ''}>حفظ بيانات صفحتي</Button>
      </form>
      <div className="my-6 border-t border-ink-100" />
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-lg font-extrabold text-ink-900"><ShieldCheck className="h-5 w-5 text-brand-700" aria-hidden="true" />الشهادات والمستندات (اختياري)</h3>
        <p className="mt-1 text-sm leading-6 text-ink-500">ارفع إثباتات المؤهلات للمراجعة. يحتفظ دَوْرك بالملف بصورة خاصة، ولا يظهر للزائر إلا اسم المستند بعد موافقة الإدارة.</p>
      </div>
      <form onSubmit={uploadEvidence} className="grid gap-3 rounded-2xl border border-ink-100 bg-ink-50 p-4 sm:grid-cols-2">
        <Field htmlFor={`${kind}-credential-title`} label="اسم الشهادة أو المستند">
          <TextInput id={`${kind}-credential-title`} value={title} onChange={e => setTitle(e.target.value)} maxLength={150} placeholder="مثال: شهادة معتمدة في ..." />
        </Field>
        <Field htmlFor={`${kind}-credential-issuer`} label="الجهة المانحة (إن وجدت)">
          <TextInput id={`${kind}-credential-issuer`} value={issuer} onChange={e => setIssuer(e.target.value)} maxLength={120} placeholder="اسم الجامعة أو الجهة" />
        </Field>
        <div className="sm:col-span-2">
          <label htmlFor={`${kind}-credential-file`} className="mb-2 block text-sm font-semibold text-ink-800">صورة أو ملف PDF للمستند</label>
          <input key={fileInputKey} id={`${kind}-credential-file`} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full rounded-xl border border-ink-200 bg-white p-3 text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:p-2 file:text-brand-800" />
          <p className="mt-2 text-xs text-ink-500">الحد الأقصى 5 ميجابايت؛ لا ترفع أرقام هوية أو بيانات شخصية لا نحتاجها.</p>
        </div>
        <div className="sm:col-span-2"><Button type="submit" disabled={busy !== ''} loading={busy === 'upload'}><Paperclip className="h-4 w-4" aria-hidden="true" />إرسال المستند للمراجعة</Button></div>
      </form>
      {credentials.length > 0 && (
        <div className="mt-4 space-y-2">
          {credentials.map(c => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-3">
              <div className="min-w-0"><p className="font-bold text-ink-900">{c.title}</p>
                <p className="mt-1 text-xs text-ink-500">{c.issuer && `${c.issuer} · `}{c.review_status === 'approved' ? 'تمت المراجعة' : c.review_status === 'rejected' ? 'لم يُعتمد' : 'قيد المراجعة'}</p>
              </div>
              <div className="flex gap-2">
                {c.review_status === 'approved' && <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="تمت المراجعة" />}
                <button type="button" disabled={busy !== ''} onClick={() => void removeEvidence(c)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" aria-hidden="true" />حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
