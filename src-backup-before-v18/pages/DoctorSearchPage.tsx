import { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, Stethoscope } from 'lucide-react';
import { DoctorResultCard, DOCTOR_LIST_COLUMNS, type DoctorListItem } from '@/components/directory/DoctorResultCard';
import { Alert, EmptyState, Field, SelectInput, SkeletonList, TextInput } from '@/components/ui';
import { DOCTOR_SPECIALTIES, GOVERNORATES } from '@/lib/constants';
import { getErrorMessage, sanitizeSearchTerm } from '@/lib/format';
import { useDebouncedValue, useDocumentMeta } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';

export function DoctorSearchPage() {
  useDocumentMeta('ابحث عن دكتور | دَوْرك', 'ابحث عن دكتور بالاسم أو التخصص أو المنطقة واحجز ميعادك أونلاين في ثواني.');

  const [term, setTerm] = useState(() => new URLSearchParams(window.location.search).get('search') ?? '');
  const [specialty, setSpecialty] = useState(() => new URLSearchParams(window.location.search).get('specialty') ?? '');
  const [governorate, setGovernorate] = useState(() => new URLSearchParams(window.location.search).get('governorate') ?? '');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const debouncedTerm = useDebouncedValue(term);
  const debouncedCity = useDebouncedValue(city);
  const debouncedArea = useDebouncedValue(area);

  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');

      let query = supabase
        .from('doctors')
        .select(DOCTOR_LIST_COLUMNS)
        .eq('is_published', true)
        .order('full_name')
        .limit(60);

      const safeTerm = sanitizeSearchTerm(debouncedTerm);
      if (safeTerm) {
        query = query.or(`full_name.ilike.%${safeTerm}%,specialty.ilike.%${safeTerm}%,clinic_name.ilike.%${safeTerm}%`);
      }
      if (specialty) query = query.eq('specialty', specialty);
      if (governorate) query = query.eq('governorate', governorate);
      const safeCity = sanitizeSearchTerm(debouncedCity);
      if (safeCity) query = query.ilike('city', `%${safeCity}%`);
      const safeArea = sanitizeSearchTerm(debouncedArea);
      if (safeArea) query = query.ilike('area', `%${safeArea}%`);

      const { data, error: queryError } = await query;
      if (!active) return;

      if (queryError) {
        setError(getErrorMessage(queryError));
        setDoctors([]);
      } else {
        setDoctors((data ?? []) as DoctorListItem[]);
      }
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [debouncedTerm, specialty, governorate, debouncedCity, debouncedArea]);

  const hasFilters = Boolean(term || specialty || governorate || city || area);

  const resetFilters = () => {
    setTerm('');
    setSpecialty('');
    setGovernorate('');
    setCity('');
    setArea('');
  };

  return (
    <section className="search-page search-doctor">
      <div className="search-hero"><div className="search-hero-inner"><div><span className="search-hero-eyebrow"><Stethoscope className="h-4 w-4"/> حجز موعد طبي</span><h1>رعايتك تبدأ،<br/><em>بموعد يناسبك.</em></h1><p>ابحث عن طبيبك بالتخصص أو الموقع، واطّلع على المواعيد المتاحة.</p></div><div className="search-hero-decoration" aria-hidden="true"><Stethoscope size={125} strokeWidth={1.1}/><span>+</span></div></div></div>
      <div className="search-body">
        <div className="search-filter-panel">
          <div className="search-filter-heading"><strong><Search size={19}/> ابحث عن طبيب</strong><span>ابدأ بالاسم أو التخصص</span></div>
          <div className="search-core-filters">
            <Field label="اسم الطبيب أو التخصص" htmlFor="doctor-term"><TextInput id="doctor-term" value={term} onChange={e=>setTerm(e.target.value)} placeholder="د. أحمد، جلدية، عظام..." autoComplete="off" /></Field>
            <Field label="التخصص" htmlFor="doctor-specialty"><SelectInput id="doctor-specialty" value={specialty} onChange={e=>setSpecialty(e.target.value)}><option value="">جميع التخصصات</option>{DOCTOR_SPECIALTIES.map(x=><option key={x} value={x}>{x}</option>)}</SelectInput></Field>
            <Field label="المحافظة" htmlFor="doctor-governorate"><SelectInput id="doctor-governorate" value={governorate} onChange={e=>setGovernorate(e.target.value)}><option value="">جميع المحافظات</option>{GOVERNORATES.map(x=><option key={x} value={x}>{x}</option>)}</SelectInput></Field>
          </div>
          <details className="search-more-filters"><summary><SlidersHorizontal size={17}/> خيارات بحث إضافية <span>المدينة والمنطقة</span></summary><div className="search-extra-grid"><Field label="المدينة" htmlFor="doctor-city"><TextInput id="doctor-city" value={city} onChange={e=>setCity(e.target.value)} placeholder="مثال: المنصورة" /></Field><Field label="المنطقة" htmlFor="doctor-area"><TextInput id="doctor-area" value={area} onChange={e=>setArea(e.target.value)} placeholder="مثال: الجامعة" /></Field></div></details>
          {hasFilters&&<button type="button" className="search-clear" onClick={resetFilters}>مسح الاختيارات ✕</button>}
        </div>
        <div className="search-results-heading"><h2>الأطباء <span>المتاحون</span></h2>{!loading&&!error&&<span>{doctors.length} نتيجة</span>}</div>
        {loading ? <SkeletonList count={4}/> : error ? <Alert tone="error">{error}</Alert> : doctors.length===0 ? <EmptyState icon={<Stethoscope size={28}/>} title="لا توجد نتائج مطابقة لبحثك" text="يمكنك تغيير التخصص أو الموقع لعرض نتائج أخرى." action={<button className="search-reset-action" type="button" onClick={resetFilters}>عرض جميع الأطباء</button>}/> :
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{doctors.map(doctor=><DoctorResultCard key={doctor.id} doctor={doctor}/>)}</div>}
      </div>
    </section>
  );
}
