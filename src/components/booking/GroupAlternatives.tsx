import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/lib/router';
import { Card, Spinner } from '@/components/ui';
import { GroupCard } from '@/components/booking/GroupCard';
import { GROUP_DETAIL_COLUMNS, isGroupOpen } from '@/lib/groups';
import { getErrorMessage } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { TeacherGroup } from '@/lib/types';

const MAX_ALTERNATIVES=4;
type AlternativeRow=TeacherGroup & {teachers:{slug:string;full_name:string;governorate:string;city:string}};
type ClosedGroup=Pick<TeacherGroup,'subject'|'grade'>;
export function GroupAlternatives({teacherId,closedGroups,governorate,city}:{teacherId:string;closedGroups:ClosedGroup[];governorate:string;city:string}){
  const closedKey=closedGroups.map(g=>`${g.subject}::${g.grade}`).sort().join('|');
  const closedPairs=useMemo(()=>closedKey ? closedKey.split('|').map(part=>{const [subject,grade]=part.split('::');return {subject,grade}}) : [],[closedKey]);
  const subjectList=useMemo(()=>[...new Set(closedPairs.map(g=>g.subject))],[closedPairs]);
  const [alternatives,setAlternatives]=useState<AlternativeRow[]|null>(null);const [error,setError]=useState('');
  useEffect(()=>{if(!closedKey)return;let active=true;
    const load=async()=>{setError('');
      const {data,error:e}=await supabase.from('teacher_groups')
        .select(`${GROUP_DETAIL_COLUMNS}, teachers!inner(slug,full_name,governorate,city,is_published)`)
        .eq('is_published',true).eq('teachers.is_published',true).neq('teacher_id',teacherId)
        .in('subject',subjectList).limit(100);
      if(!active)return;
      if(e){setError(getErrorMessage(e));return;}
      const ranking=((data??[]) as unknown as AlternativeRow[])
        .filter(g=>isGroupOpen(g) && closedPairs.some(c=>c.subject===g.subject&&c.grade===g.grade))
        .sort((a,b)=>{
          const score=(g:AlternativeRow)=>Number(g.teachers.governorate===governorate)*10+Number(g.teachers.city===city)*5;
          return score(b)-score(a);
        });
      setAlternatives(ranking.slice(0,MAX_ALTERNATIVES));
    };void load();return()=>{active=false};
  },[teacherId,closedKey,governorate,city,subjectList,closedPairs]);
  if(!closedKey)return null;
  return <section id="alternatives" className="scroll-mt-24 space-y-4"><div><h2 className="text-xl font-extrabold text-ink-900">مجموعات بديلة متاحة</h2><p className="mt-1 text-sm text-ink-500">نفس المادة والصف، مع مدرسين تانيين. الأقرب لمنطقتك بيظهر الأول.</p></div>
    {error?<p className="text-sm font-medium text-rose-700">{error}</p>:alternatives===null?<Spinner label="جارٍ البحث عن مجموعات بديلة..."/>:alternatives.length===0?<Card className="p-6 text-center text-sm text-ink-500">لا توجد مجموعات بديلة مناسبة حاليًا.</Card>:
      <div className="grid gap-5 md:grid-cols-2">{alternatives.map(group=><GroupCard key={group.id} group={group} subtitle={group.teachers.full_name} action={<Link to={`/teacher/${group.teachers.slug}`} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-edu-200 bg-white px-4 py-2 text-sm font-bold text-edu-700 transition hover:bg-edu-50">عرض ملف المُدرّس</Link>}/>)}</div>}
  </section>;
}
