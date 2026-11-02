import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, SelectInput, TextAreaInput, TextInput } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { GOVERNORATES, STAGES, SUBJECTS } from '@/lib/constants';
import { getErrorMessage, isValidSlugHint } from '@/lib/format';
import { navigate } from '@/lib/router';
import { supabase } from '@/lib/supabase';

type TeacherValues = {
  fullName: string;
  slugHint: string;
  bio: string;
  subjects: string[];
  stages: string[];
  governorate: string;
  city: string;
  area: string;
  teachingLocation: string;
  experienceYears: string;
  teachesOnline: boolean;
  teachesOffline: boolean;
};

const INITIAL_VALUES: TeacherValues = {
  fullName: '',
  slugHint: '',
  bio: '',
  subjects: [],
  stages: [],
  governorate: '',
  city: '',
  area: '',
  teachingLocation: '',
  experienceYears: '0',
  teachesOnline: true,
  teachesOffline: false,
};

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
}

export function TeacherRegistrationForm() {
  const { refreshAccount } = useAuth();
  const [values, setValues] = useState<TeacherValues>(INITIAL_VALUES);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof TeacherValues>(field: K, value: TeacherValues[K]) =>
    setValues((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const slugHint = values.slugHint.trim().toLowerCase();
    const experience = Number(values.experienceYears);
    if (values.fullName.trim().length < 3) return setError('يرجى إدخال الاسم الكامل (3 أحرف على الأقل).');
    if (slugHint && !isValidSlugHint(slugHint)) return setError('الرابط لازم يكون حروف إنجليزية صغيرة وأرقام وشرطة بين الكلمات.');
    if (values.subjects.length === 0) return setError('يرجى اختيار مادة واحدة على الأقل.');
    if (values.stages.length === 0) return setError('يرجى اختيار مرحلة واحدة على الأقل.');
    if (!values.governorate) return setError('اختر المحافظة.');
    if (!values.teachesOnline && !values.teachesOffline) return setError('يرجى تحديد نوع الحصص: عن بُعد أو حضوري أو كلاهما.');
    if (!Number.isInteger(experience) || experience < 0) return setError('سنين الخبرة لازم تكون رقم صحيح.');

    setError('');
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc('register_teacher', {
      p_full_name: values.fullName.trim(),
      p_slug_hint: slugHint,
      p_bio: values.bio.trim(),
      p_subjects: values.subjects,
      p_stages: values.stages,
      p_governorate: values.governorate,
      p_city: values.city.trim(),
      p_area: values.area.trim(),
      p_teaching_location: values.teachingLocation.trim(),
      p_experience_years: experience,
      p_teaches_online: values.teachesOnline,
      p_teaches_offline: values.teachesOffline,
    });
    if (rpcError) {
      setSubmitting(false);
      setError(getErrorMessage(rpcError));
      return;
    }

    await refreshAccount();
    navigate('/dashboard/teacher');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-base font-bold text-ink-900">بياناتك</legend>
        <div className="sm:col-span-2">
          <Field label="الاسم بالكامل" htmlFor="teacher-name" hint="هيظهر على ملفك العام بعد المراجعة">
            <TextInput id="teacher-name" value={values.fullName} onChange={(event) => update('fullName', event.target.value)} maxLength={80} required />
          </Field>
        </div>
        <Field label="رابط ملفك الخاص" htmlFor="teacher-slug" hint="حروف إنجليزية وأرقام، مثال: mr-ahmed-math">
          <TextInput id="teacher-slug" value={values.slugHint} onChange={(event) => update('slugHint', event.target.value)} dir="ltr" className="text-start" maxLength={60} />
        </Field>
        <Field label="سنين الخبرة" htmlFor="teacher-experience">
          <TextInput id="teacher-experience" type="number" min={0} inputMode="numeric" value={values.experienceYears} onChange={(event) => update('experienceYears', event.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="نبذة عنك (اختياري)" htmlFor="teacher-bio">
            <TextAreaInput id="teacher-bio" value={values.bio} onChange={(event) => update('bio', event.target.value)} maxLength={600} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-base font-bold text-ink-900">المواد التي تُدرّسها</legend>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((subject) => (
            <ChipToggle key={subject} label={subject} active={values.subjects.includes(subject)} onToggle={() => update('subjects', toggle(values.subjects, subject))} />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-base font-bold text-ink-900">المراحل</legend>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((stage) => (
            <ChipToggle key={stage.value} label={stage.label} active={values.stages.includes(stage.value)} onToggle={() => update('stages', toggle(values.stages, stage.value))} />
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-base font-bold text-ink-900">مكان الحصص</legend>
        <Field label="المحافظة" htmlFor="teacher-governorate">
          <SelectInput id="teacher-governorate" value={values.governorate} onChange={(event) => update('governorate', event.target.value)} required>
            <option value="">اختر المحافظة</option>
            {GOVERNORATES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="المدينة" htmlFor="teacher-city">
          <TextInput id="teacher-city" value={values.city} onChange={(event) => update('city', event.target.value)} maxLength={80} />
        </Field>
        <Field label="المنطقة" htmlFor="teacher-area">
          <TextInput id="teacher-area" value={values.area} onChange={(event) => update('area', event.target.value)} maxLength={80} />
        </Field>
        <Field label="عنوان السنتر أو المكان" htmlFor="teacher-location">
          <TextInput id="teacher-location" value={values.teachingLocation} onChange={(event) => update('teachingLocation', event.target.value)} maxLength={160} />
        </Field>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <ChipToggle label="أونلاين" active={values.teachesOnline} onToggle={() => update('teachesOnline', !values.teachesOnline)} />
          <ChipToggle label="حضوري" active={values.teachesOffline} onToggle={() => update('teachesOffline', !values.teachesOffline)} />
        </div>
      </fieldset>

      {error && <Alert tone="error">{error}</Alert>}

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        ابعت طلب التسجيل
      </Button>
      <p className="text-center text-xs text-ink-500">بعد التسجيل هتعمل مجموعاتك من لوحة التحكم، وهيظهر ملفك للطلبة بعد مراجعة فريقنا.</p>
    </form>
  );
}

function ChipToggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`min-h-10 rounded-full border px-4 py-2 text-sm font-semibold transition duration-200 active:scale-95 ${
        active ? 'border-edu-600 bg-edu-600 text-white shadow-sm' : 'border-ink-200 bg-white text-ink-700 hover:border-edu-300 hover:bg-edu-50'
      }`}
    >
      {label}
    </button>
  );
}
