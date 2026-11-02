import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Alert, Button, Field, Modal, SelectInput, TextInput } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { STAGES } from '@/lib/constants';
import { formatTime, formatWeekdays, getErrorMessage, isValidEgyptianPhone } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { guestBookingErrorMessage } from '@/lib/guestBookingError';
import type { TeacherGroup } from '@/lib/types';

type EnrollGroupModalProps = {
  group: TeacherGroup | null;
  teacherName: string;
  onClose: () => void;
  onEnrolled: () => void;
};

const ALL_GRADES = STAGES.flatMap((stage) => stage.grades);

export function EnrollGroupModal({
  group,
  teacherName,
  onClose,
  onEnrolled,
}: EnrollGroupModalProps) {
  const { session, hasRole } = useAuth();
  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingRef, setBookingRef] = useState<string | null>(null);

  useEffect(() => {
    if (!group) return;
    setStudentName('');
    setStudentPhone('');
    setStudentGrade(group.grade);
    setFormError('');
    setBookingRef(null);
  }, [group]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!group || submitting) return;

    const name = studentName.trim();
    const phone = studentPhone.trim();

    if (name.length < 2) {
      setFormError('يرجى إدخال اسم الطالب بشكل صحيح.');
      return;
    }

    if (!isValidEgyptianPhone(phone)) {
      setFormError('يرجى إدخال رقم موبايل مصري صحيح (01xxxxxxxxx).');
      return;
    }

    setFormError('');
    setSubmitting(true);

    try {
      if (!session) {
        const { error: guestError } = await supabase.auth.signInAnonymously();
        if (guestError) {
          console.error('[Dawrak] Anonymous sign-in failed:', { code: guestError.code, status: guestError.status, message: guestError.message });
          setFormError(guestBookingErrorMessage(guestError));
          return;
        }
      }

      const { data, error } = await supabase.rpc('enroll_in_group', {
        p_group_id: group.id,
        p_student_name: name,
        p_student_phone: phone,
        p_student_grade: studentGrade || group.grade,
        // للحفاظ على التوافق مع وظيفة قاعدة البيانات الحالية.
        p_booked_for_child: false,
      });

      if (error) {
        setFormError(getErrorMessage(error));
        onEnrolled();
        return;
      }

      setBookingRef(String(data));
      onEnrolled();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const title = bookingRef ? 'تم تسجيل مكانك' : 'احجز مكانك في المجموعة';

  return (
    <Modal open={group !== null} title={title} onClose={onClose}>
      {group && bookingRef ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-9 w-9" aria-hidden />
          </div>

          <p className="text-sm leading-relaxed text-ink-600">
            تم تأكيد مكانك في{' '}
            <span className="font-bold text-ink-900">{group.name}</span> مع {teacherName}.
          </p>

          <div className="rounded-2xl bg-ink-50 p-4 text-sm">
            <p className="font-semibold text-ink-500">رقم التسجيل</p>
            <p className="mt-1 font-mono text-lg font-bold tracking-widest text-ink-900">
              {bookingRef}
            </p>
          </div>

          <ul className="space-y-1.5 text-start text-sm text-ink-600">
            <li>أيام الحصص: {formatWeekdays(group.weekdays)}</li>
            <li dir="ltr" className="text-end">
              الميعاد: {formatTime(group.start_time)} - {formatTime(group.end_time)}
            </li>
            <li>المكان: {group.location}</li>
          </ul>

          <Button variant="secondary" fullWidth onClick={onClose}>
            تمام
          </Button>
        </div>
      ) : group && hasRole('admin') ? (
        <Alert tone="info">
          حساب الإدارة مخصص لإدارة المنصة. لاختبار حجز مجموعة، استخدمي حسابًا تجريبيًا منفصلًا.
        </Alert>
      ) : group ? (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="rounded-xl bg-edu-50 px-4 py-3 text-sm text-edu-800">
            <p className="font-bold">{group.name}</p>
            <p className="mt-0.5">
              {group.subject} · {formatWeekdays(group.weekdays)} · {formatTime(group.start_time)}
            </p>
          </div>

          <Field label="اسم الطالب" htmlFor="student-name">
            <TextInput
              id="student-name"
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
              autoComplete="off"
              placeholder="اكتب اسم الطالب"
              maxLength={80}
              required
            />
          </Field>

          <Field
            label="رقم الموبايل"
            htmlFor="student-phone"
            hint="رقم الطالب أو ولي الأمر للتواصل"
          >
            <TextInput
              id="student-phone"
              value={studentPhone}
              onChange={(event) => setStudentPhone(event.target.value)}
              inputMode="tel"
              placeholder="01xxxxxxxxx"
              dir="ltr"
              className="text-start"
              required
            />
          </Field>

          <Field label="الصف الدراسي" htmlFor="student-grade">
            <SelectInput
              id="student-grade"
              value={studentGrade}
              onChange={(event) => setStudentGrade(event.target.value)}
            >
              {ALL_GRADES.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </SelectInput>
          </Field>

          {formError && <Alert tone="error">{formError}</Alert>}

          <p className="text-xs leading-6 text-ink-500">
            الحجز متاح مباشرةً دون إنشاء حساب. احتفظ برقم التسجيل لتأكيد مكانك.
          </p>

          <Button type="submit" size="lg" fullWidth loading={submitting}>
            تأكيد الحجز
          </Button>
        </form>
      ) : null}
    </Modal>
  );
}
