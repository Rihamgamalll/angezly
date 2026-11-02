import { useCallback, useEffect, useState } from 'react';
import { BookOpen, GraduationCap, MapPin, Users } from 'lucide-react';
import { PublicProfessionalInfo } from '@/components/PublicProfessionalInfo';
import { Badge, Button, Card, EmptyState, Alert, Spinner } from '@/components/ui';
import { EnrollGroupModal } from '@/components/booking/EnrollGroupModal';
import { GroupAlternatives } from '@/components/booking/GroupAlternatives';
import { GroupCard } from '@/components/booking/GroupCard';
import { GROUP_MODE_LABELS, STAGES } from '@/lib/constants';
import { formatLocation, getErrorMessage } from '@/lib/format';
import { GROUP_DETAIL_COLUMNS, isGroupOpen } from '@/lib/groups';
import { useDocumentMeta } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { Teacher, TeacherGroup } from '@/lib/types';

const TEACHER_PROFILE_COLUMNS =
  'id, slug, full_name, bio, credentials_summary, visitor_note, photo_url, subjects, stages, governorate, city, area, teaching_location, teaches_online, teaches_offline, experience_years, is_published, is_demo';

type TeacherProfile = Pick<
  Teacher,
  | 'id'
  | 'slug'
  | 'full_name'
  | 'bio'
  | 'credentials_summary'
  | 'visitor_note'
  | 'photo_url'
  | 'subjects'
  | 'stages'
  | 'governorate'
  | 'city'
  | 'area'
  | 'teaching_location'
  | 'teaches_online'
  | 'teaches_offline'
  | 'experience_years'
  | 'is_demo'
  | 'is_published'
>;

const STAGE_LABELS = Object.fromEntries(STAGES.map((stage) => [stage.value, stage.label]));

export function TeacherProfilePage({ slug }: { slug: string }) {
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [groups, setGroups] = useState<TeacherGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<TeacherGroup | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useDocumentMeta(
    teacher ? `${teacher.full_name} | مجموعات تقوية | دَوْرك` : 'ملف المُدرّس | دَوْرك',
    teacher
      ? `احجز مكانك في مجموعات ${teacher.full_name}. اطّلع على المواد والمراحل والأماكن المتاحة.`
      : 'احجز مكانك في مجموعات المُدرّس أونلاين أو حضوري.',
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      setTeacher(null);

      const { data, error: queryError } = await supabase
        .from('teachers')
        .select(TEACHER_PROFILE_COLUMNS)
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();
      if (!active) return;

      if (queryError) {
        setError(getErrorMessage(queryError));
      } else if (data) {
        setTeacher(data as TeacherProfile);
      }
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [slug]);

  const teacherId = teacher?.id;

  useEffect(() => {
    if (!teacherId) return;
    let active = true;

    const load = async () => {
      setGroupsLoading(true);
      const { data, error: queryError } = await supabase
        .from('teacher_groups')
        .select(GROUP_DETAIL_COLUMNS)
        .eq('teacher_id', teacherId)
        .eq('is_published', true)
        .order('start_date', { ascending: true });
      if (!active) return;

      if (queryError) {
        setError(getErrorMessage(queryError));
      } else {
        setGroups((data ?? []) as TeacherGroup[]);
      }
      setGroupsLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [teacherId, reloadToken]);

  const closeModal = useCallback(() => setSelectedGroup(null), []);
  const refreshGroups = useCallback(() => setReloadToken((token) => token + 1), []);

  if (loading) {
    return <Spinner label="جاري تحميل ملف المُدرّس..." />;
  }

  if (error && !teacher) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Alert tone="error">{error}</Alert>
      </section>
    );
  }

  if (!teacher) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<GraduationCap className="h-7 w-7" aria-hidden />}
          title="الصفحة دي مش موجودة"
          text="قد يكون الرابط غير صحيح، أو لم يُنشر ملف المُدرّس بعد."
        />
      </section>
    );
  }

  const location = formatLocation([teacher.governorate, teacher.city, teacher.area]);
  const closedGroups = groups.filter(group => !isGroupOpen(group) && !groups.some(other => other.id !== group.id && isGroupOpen(other) && other.subject === group.subject && other.grade === group.grade));
  const modes = [teacher.teaches_online && 'online', teacher.teaches_offline && 'offline'].filter(Boolean) as Array<'online' | 'offline'>;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="grid gap-8 lg:grid-cols-5">
        <aside className="lg:col-span-2">
          <Card className="overflow-hidden lg:sticky lg:top-24">
            <div className="profile-photo-head teacher-profile-photo-head px-6 pb-6 pt-8 text-center">
              {teacher.photo_url ? (
                <img src={teacher.photo_url} alt={teacher.full_name} className="mx-auto h-28 w-28 rounded-3xl object-cover ring-4 ring-white shadow-lift" />
              ) : (
                <span className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl bg-white text-3xl font-bold text-edu-700 shadow-lift" aria-hidden>
                  {teacher.full_name.trim().charAt(0)}
                </span>
              )}
              <h1 className="mt-4 text-2xl font-extrabold text-white">{teacher.full_name}</h1>
              {location && (
                <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-edu-50">
                  <MapPin className="h-4 w-4" aria-hidden />
                  {location}
                </p>
              )}
            </div>
            <div className="space-y-5 p-6">
              {teacher.bio && <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{teacher.bio}</p>}
              <PublicProfessionalInfo kind="teacher" professionalId={teacher.id} qualifications={teacher.credentials_summary} visitorNote={teacher.visitor_note} />

              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-bold text-ink-900">
                  <BookOpen className="h-4 w-4 text-edu-600" aria-hidden />
                  المواد
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {teacher.subjects.map((subject) => (
                    <Badge key={subject} tone="edu">{subject}</Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold text-ink-900">المراحل</p>
                <div className="flex flex-wrap gap-1.5">
                  {teacher.stages.map((stage) => (
                    <Badge key={stage} tone="neutral">{STAGE_LABELS[stage] ?? stage}</Badge>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-ink-600">
                <Users className="h-4 w-4 text-ink-400" aria-hidden />
                <span>{modes.map((mode) => GROUP_MODE_LABELS[mode]).join(' و ')}</span>
                <span className="text-ink-300">·</span>
                <span>خبرة {teacher.experience_years} سنة</span>
              </div>
              {teacher.teaching_location && <p className="text-sm text-ink-500">مكان الحصص: {teacher.teaching_location}</p>}
            </div>
          </Card>
        </aside>

        <div className="space-y-8 lg:col-span-3">
          <div>
            <h2 className="text-2xl font-extrabold text-ink-900">المجموعات المتاحة</h2>
            <p className="mt-1 text-sm text-ink-500">لكل مجموعة عدد محدد من الأماكن، ويُغلق الحجز عند اكتمال العدد.</p>
          </div>

          {teacher.is_demo && <Alert tone="info">هذا ملف تجريبي لشخصية غير حقيقية. المجموعات المعروضة للتجربة.</Alert>}
          {error && <Alert tone="error">{error}</Alert>}

          {groupsLoading && groups.length === 0 ? (
            <Spinner label="جاري تحميل المجموعات..." />
          ) : groups.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="h-7 w-7" aria-hidden />}
              title="لا توجد مجموعات منشورة حاليًا"
              text="لم يُعلن المُدرّس عن مجموعات جديدة حتى الآن."
            />
          ) : (
            <div className="grid gap-5">
              {groups.map((group) => {
                const open = isGroupOpen(group);
                const sameTeacherAlternative = groups.find(other => other.id !== group.id && other.subject === group.subject && other.grade === group.grade && isGroupOpen(other));
                return (
                  <div key={group.id} id={`group-${group.id}`} className="scroll-mt-24"><GroupCard
                    group={group}
                    action={
                      open ? (
                        <Button onClick={() => setSelectedGroup(group)}>احجز مكانك</Button>
                      ) : (
                        <a
                          href={sameTeacherAlternative ? `#group-${sameTeacherAlternative.id}` : "#alternatives"}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
                        >
                          {sameTeacherAlternative ? "عرض مجموعة أخرى للمُدرّس" : "عرض البدائل"}
                        </a>
                      )
                    }
                  /></div>
                );
              })}
            </div>
          )}

          {closedGroups.length > 0 && <GroupAlternatives teacherId={teacher.id} closedGroups={closedGroups} governorate={teacher.governorate} city={teacher.city} />}
        </div>
      </div>

      <EnrollGroupModal
        group={selectedGroup}
        teacherName={teacher.full_name}
        onClose={closeModal}
        onEnrolled={refreshGroups}
      />
    </section>
  );
}
