import { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Search, SlidersHorizontal } from 'lucide-react';
import { TeacherResultCard, type GroupSummary, type TeacherSummary } from '@/components/directory/TeacherResultCard';
import { Alert, EmptyState, Field, SelectInput, SkeletonList, TextInput } from '@/components/ui';
import { GOVERNORATES, GROUP_MODE_LABELS, STAGES, SUBJECTS } from '@/lib/constants';
import { getErrorMessage, sanitizeSearchTerm } from '@/lib/format';
import { isGroupOpen } from '@/lib/groups';
import { useDebouncedValue, useDocumentMeta } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';

const GROUP_COLUMNS =
  'id, teacher_id, name, subject, stage, grade, mode, weekdays, start_time, end_time, price, price_period, capacity, active_enrollments, registration_open, end_date';

type TeacherGroupRow = GroupSummary & { teachers: TeacherSummary };

type TeacherEntry = { teacher: TeacherSummary; groups: GroupSummary[] };

export function TeacherSearchPage() {
  useDocumentMeta('ابحث عن مُدرّس | دَوْرك', 'ابحث عن مجموعات تقوية بالمادة والمرحلة والمنطقة واحجز مكان لابنك أو بنتك.');

  const [term, setTerm] = useState(() => new URLSearchParams(window.location.search).get('search') ?? '');
  const [subject, setSubject] = useState(() => new URLSearchParams(window.location.search).get('subject') ?? '');
  const [customSubject, setCustomSubject] = useState('');
  const debouncedCustomSubject = useDebouncedValue(customSubject);
  const [stage, setStage] = useState('');
  const [grade, setGrade] = useState('');
  const [governorate, setGovernorate] = useState(() => new URLSearchParams(window.location.search).get('governorate') ?? '');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [mode, setMode] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const debouncedTerm = useDebouncedValue(term);
  const debouncedCity = useDebouncedValue(city);
  const debouncedArea = useDebouncedValue(area);

  const [rows, setRows] = useState<TeacherGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const gradeOptions = useMemo(
    () => STAGES.find((item) => item.value === stage)?.grades ?? STAGES.flatMap((item) => item.grades),
    [stage],
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');

      let query = supabase
        .from('teacher_groups')
        .select(`${GROUP_COLUMNS}, teachers!inner(id, slug, full_name, photo_url, governorate, city, area, teaching_location, is_published, is_demo)`)
        .eq('is_published', true)
        .eq('teachers.is_published', true)
        .order('start_date', { ascending: true })
        .limit(150);

      const safeTerm = sanitizeSearchTerm(debouncedTerm);
      if (safeTerm) {
        const matchingSubjects = SUBJECTS.filter(item => item.includes(safeTerm));
        query = matchingSubjects.length > 0 ? query.in('subject',matchingSubjects) : query.ilike('teachers.full_name', `%${safeTerm}%`);
      }
      if (subject === '__other__') {
        const safeCustom = sanitizeSearchTerm(debouncedCustomSubject);
        if (safeCustom) query = query.ilike('subject', `%${safeCustom}%`);
      } else if (subject) query = query.eq('subject', subject);
      if (stage) query = query.eq('stage', stage);
      if (grade) query = query.eq('grade', grade);
      if (mode) query = query.eq('mode', mode);
      if (governorate) query = query.eq('teachers.governorate', governorate);
      if (debouncedCity.trim()) query = query.ilike('teachers.city', `%${sanitizeSearchTerm(debouncedCity)}%`);
      if (debouncedArea.trim()) query = query.ilike('teachers.area', `%${sanitizeSearchTerm(debouncedArea)}%`);

      const { data, error: queryError } = await query;
      if (!active) return;

      if (queryError) {
        setError(getErrorMessage(queryError));
        setRows([]);
      } else {
        setRows((data ?? []) as unknown as TeacherGroupRow[]);
      }
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [debouncedTerm, subject, debouncedCustomSubject, stage, grade, governorate, mode, debouncedCity, debouncedArea]);

  const entries = useMemo<TeacherEntry[]>(() => {
    const byTeacher = new Map<string, TeacherEntry>();
    for (const row of rows) {
      if (availableOnly && !isGroupOpen(row)) continue;
      const { teachers, ...group } = row;
      if (!teachers?.id) continue;
      const existing = byTeacher.get(teachers.id);
      if (existing) {
        existing.groups.push(group);
      } else {
        byTeacher.set(teachers.id, { teacher: teachers, groups: [group] });
      }
    }
    return [...byTeacher.values()];
  }, [rows, availableOnly]);

  const hasFilters = Boolean(term || subject || customSubject || stage || grade || governorate || city || area || mode || availableOnly);

  const resetFilters = () => {
    setTerm('');
    setSubject('');
    setCustomSubject('');
    setStage('');
    setGrade('');
    setGovernorate('');
    setCity('');
    setArea('');
    setMode('');
    setAvailableOnly(false);
  };

  return (
    <section className="search-page search-teacher">
      <div className="search-hero"><div className="search-hero-inner"><div><span className="search-hero-eyebrow"><GraduationCap className="h-4 w-4"/> حجز مجموعة دراسية</span><h1>المجموعة المناسبة،<br/><em>أقرب إليك.</em></h1><p>ابحث بالمادة والصف الدراسي، واختر مجموعة بها أماكن متاحة.</p></div><div className="search-hero-decoration" aria-hidden="true"><GraduationCap size={135} strokeWidth={1.1}/><span>✳</span></div></div></div>
      <div className="search-body">
        <div className="search-filter-panel">
          <div className="search-filter-heading"><strong><Search size={19}/> ابحث عن مجموعة</strong><span>حدّد المادة والموقع</span></div>
          <div className="search-core-filters">
            <Field label="المدرّس أو المادة" htmlFor="teacher-term"><TextInput id="teacher-term" value={term} onChange={e=>setTerm(e.target.value)} placeholder="اسم المدرّس أو المادة" /></Field>
            <Field label="المادة" htmlFor="teacher-subject"><SelectInput id="teacher-subject" value={subject} onChange={e=>setSubject(e.target.value)}><option value="">كل المواد</option>{SUBJECTS.map(x=><option key={x}>{x}</option>)}<option value="__other__">مادة أخرى — اكتبها</option></SelectInput></Field>
            {subject === "__other__" && <Field label="اسم المادة" htmlFor="teacher-custom-subject"><TextInput id="teacher-custom-subject" value={customSubject} onChange={e=>setCustomSubject(e.target.value)} maxLength={60} placeholder="اكتب المادة التي تبحث عنها" /></Field>}
            <Field label="المحافظة" htmlFor="teacher-governorate"><SelectInput id="teacher-governorate" value={governorate} onChange={e=>setGovernorate(e.target.value)}><option value="">جميع المحافظات</option>{GOVERNORATES.map(x=><option key={x}>{x}</option>)}</SelectInput></Field>
          </div>
          <details className="search-more-filters"><summary><SlidersHorizontal size={17}/> خيارات بحث إضافية <span>الصف، المكان، نوع الحصة</span></summary><div className="search-extra-grid">
            <Field label="المرحلة" htmlFor="teacher-stage"><SelectInput id="teacher-stage" value={stage} onChange={e=>{setStage(e.target.value);setGrade('')}}><option value="">كل المراحل</option>{STAGES.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</SelectInput></Field>
            <Field label="الصف" htmlFor="teacher-grade"><SelectInput id="teacher-grade" value={grade} onChange={e=>setGrade(e.target.value)}><option value="">كل الصفوف</option>{gradeOptions.map(x=><option key={x}>{x}</option>)}</SelectInput></Field>
            <Field label="المدينة" htmlFor="teacher-city"><TextInput id="teacher-city" value={city} onChange={e=>setCity(e.target.value)} placeholder="المنصورة"/></Field>
            <Field label="المنطقة" htmlFor="teacher-area"><TextInput id="teacher-area" value={area} onChange={e=>setArea(e.target.value)} placeholder="اسم المنطقة"/></Field>
            <Field label="نوع الحصة" htmlFor="teacher-mode"><SelectInput id="teacher-mode" value={mode} onChange={e=>setMode(e.target.value)}><option value="">أونلاين وحضوري</option>{Object.entries(GROUP_MODE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</SelectInput></Field>
            <label className="search-available"><input type="checkbox" checked={availableOnly} onChange={e=>setAvailableOnly(e.target.checked)}/> المجموعات المتاحة فقط</label>
          </div></details>
          {hasFilters&&<button type="button" className="search-clear" onClick={resetFilters}>مسح الاختيارات ✕</button>}
        </div>
        <div className="search-results-heading"><h2>المُدرّسون <span>والمجموعات</span></h2>{!loading&&!error&&<span>{entries.length} نتيجة</span>}</div>
        {loading ? <SkeletonList count={4}/> : error ? <Alert tone="error">{error}</Alert> : entries.length===0 ? <EmptyState icon={<GraduationCap size={28}/>} title="لا توجد مجموعات مطابقة لبحثك" text="يمكنك تغيير المادة أو المحافظة." action={<button className="search-reset-action" type="button" onClick={resetFilters}>عرض جميع المجموعات</button>} /> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{entries.map(({teacher,groups})=><TeacherResultCard key={teacher.id} teacher={teacher} groups={groups}/>)}</div>}
      </div>
    </section>
  );
}
