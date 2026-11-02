import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, SelectInput, TextAreaInput, TextInput } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { DOCTOR_SPECIALTIES, GOVERNORATES } from '@/lib/constants';
import { getErrorMessage, isValidSlugHint } from '@/lib/format';
import { navigate } from '@/lib/router';
import { supabase } from '@/lib/supabase';

const SLOT_OPTIONS = [15, 20, 30, 45, 60];

export function DoctorRegistrationForm() {
  const { refreshAccount } = useAuth();
  const [values, setValues] = useState({
    fullName: '',
    slugHint: '',
    specialty: '',
    qualifications: '',
    bio: '',
    clinicName: '',
    governorate: '',
    city: '',
    area: '',
    clinicAddress: '',
    consultationPrice: '',
    slotMinutes: '20',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const slugHint = values.slugHint.trim().toLowerCase();
    const price = Number(values.consultationPrice);
    if (values.fullName.trim().length < 3) return setError('يرجى إدخال الاسم الكامل (3 أحرف على الأقل).');
    if (slugHint && !isValidSlugHint(slugHint)) return setError('الرابط لازم يكون حروف إنجليزية صغيرة وأرقام وشرطة بين الكلمات.');
    if (!values.specialty) return setError('اختر التخصص.');
    if (!values.qualifications.trim()) return setError('يرجى إدخال المؤهلات العلمية.');
    if (!values.clinicName.trim()) return setError('يرجى إدخال اسم العيادة.');
    if (!values.governorate) return setError('اختر المحافظة.');
    if (!Number.isInteger(price) || price < 0) return setError('يرجى إدخال سعر الكشف بالجنيه (عدد صحيح).');

    setError('');
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc('register_doctor', {
      p_full_name: values.fullName.trim(),
      p_slug_hint: slugHint,
      p_specialty: values.specialty,
      p_qualifications: values.qualifications.trim(),
      p_bio: values.bio.trim(),
      p_clinic_name: values.clinicName.trim(),
      p_governorate: values.governorate,
      p_city: values.city.trim(),
      p_area: values.area.trim(),
      p_clinic_address: values.clinicAddress.trim(),
      p_consultation_price: price,
      p_slot_minutes: Number(values.slotMinutes),
    });
    if (rpcError) {
      setSubmitting(false);
      setError(getErrorMessage(rpcError));
      return;
    }

    await refreshAccount();
    navigate('/dashboard/doctor');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-base font-bold text-ink-900">بياناتك المهنية</legend>
        <div className="sm:col-span-2">
          <Field label="الاسم بالكامل" htmlFor="doc-name" hint="هيظهر على ملفك العام بعد المراجعة">
            <TextInput id="doc-name" value={values.fullName} onChange={update('fullName')} maxLength={80} required />
          </Field>
        </div>
        <Field label="التخصص" htmlFor="doc-specialty">
          <SelectInput id="doc-specialty" value={values.specialty} onChange={update('specialty')} required>
            <option value="">اختر التخصص</option>
            {DOCTOR_SPECIALTIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="المؤهلات" htmlFor="doc-qualifications" hint="مثال: بكالوريوس طب وجراحة - ماجستير باطنة">
          <TextInput id="doc-qualifications" value={values.qualifications} onChange={update('qualifications')} maxLength={160} required />
        </Field>
        <div className="sm:col-span-2">
          <Field label="نبذة عنك (اختياري)" htmlFor="doc-bio">
            <TextAreaInput id="doc-bio" value={values.bio} onChange={update('bio')} maxLength={600} />
          </Field>
        </div>
        <Field label="رابط ملفك الخاص" htmlFor="doc-slug" hint="حروف إنجليزية وأرقام، مثال: dr-ahmed-ali">
          <TextInput id="doc-slug" value={values.slugHint} onChange={update('slugHint')} dir="ltr" className="text-start" maxLength={60} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-base font-bold text-ink-900">العيادة وسعر الكشف</legend>
        <Field label="اسم العيادة" htmlFor="doc-clinic">
          <TextInput id="doc-clinic" value={values.clinicName} onChange={update('clinicName')} maxLength={100} required />
        </Field>
        <Field label="المحافظة" htmlFor="doc-governorate">
          <SelectInput id="doc-governorate" value={values.governorate} onChange={update('governorate')} required>
            <option value="">اختر المحافظة</option>
            {GOVERNORATES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="المدينة" htmlFor="doc-city">
          <TextInput id="doc-city" value={values.city} onChange={update('city')} maxLength={80} />
        </Field>
        <Field label="المنطقة" htmlFor="doc-area">
          <TextInput id="doc-area" value={values.area} onChange={update('area')} maxLength={80} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="عنوان العيادة" htmlFor="doc-address">
            <TextInput id="doc-address" value={values.clinicAddress} onChange={update('clinicAddress')} maxLength={200} />
          </Field>
        </div>
        <Field label="سعر الكشف (جنيه)" htmlFor="doc-price">
          <TextInput id="doc-price" type="number" min={0} step={1} inputMode="numeric" value={values.consultationPrice} onChange={update('consultationPrice')} required />
        </Field>
        <Field label="مدة الكشف" htmlFor="doc-slot">
          <SelectInput id="doc-slot" value={values.slotMinutes} onChange={update('slotMinutes')}>
            {SLOT_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>{minutes} دقيقة</option>
            ))}
          </SelectInput>
        </Field>
      </fieldset>

      {error && <Alert tone="error">{error}</Alert>}

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        ابعت طلب التسجيل
      </Button>
      <p className="text-center text-xs text-ink-500">بعد التسجيل يمكنك ضبط المواعيد وإضافة نبذتك وشهاداتك اختياريًا من لوحة التحكم. تظهر صفحتك للزوار بعد مراجعة الإدارة.</p>
    </form>
  );
}
