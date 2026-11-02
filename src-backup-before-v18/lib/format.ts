import { WEEKDAY_NAMES } from '@/lib/constants';

const PHONE_PATTERN = /^01[0125][0-9]{8}$/;

export function isValidEgyptianPhone(value: string): boolean {
  return PHONE_PATTERN.test(value.trim());
}

const SLUG_HINT_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlugHint(value: string): boolean {
  return SLUG_HINT_PATTERN.test(value);
}

export function formatEgp(amount: number): string {
  return `${amount.toLocaleString('ar-EG')} جنيه`;
}

export function formatTime(time: string): string {
  const [hourText, minuteText] = time.split(':');
  const hour = Number(hourText);
  const period = hour >= 12 ? 'م' : 'ص';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return minuteText === '00'
    ? `${displayHour} ${period}`
    : `${displayHour}:${minuteText} ${period}`;
}

export function formatWeekdays(weekdays: readonly number[]): string {
  return [...weekdays]
    .sort((a, b) => ((a + 1) % 7) - ((b + 1) % 7))
    .map((day) => WEEKDAY_NAMES[day])
    .join(' و ');
}

export function formatCairoDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatCairoDate(iso: string): string {
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatLocation(parts: ReadonlyArray<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(' - ');
}

export function sanitizeSearchTerm(value: string): string {
  return value.replace(/[(),"'%*\\]/g, ' ').trim();
}

export function getPublicProfileUrl(kind: 'doctor' | 'teacher', slug: string): string {
  return `${window.location.origin}/${kind}/${slug}`;
}

export function getWhatsAppShareUrl(message: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}`;
}

export function getAuthErrorMessage(error: unknown): string {
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
  if (/invalid login credentials/i.test(message)) return 'الإيميل أو كلمة السر غلط.';
  if (/email not confirmed/i.test(message)) return 'لازم تأكد الإيميل الأول.';
  if (/already registered|already exists/i.test(message)) return 'الإيميل ده مسجل قبل كده. سجّل دخولك بدل ما تعمل حساب جديد.';
  if (/password should be at least/i.test(message)) return 'كلمة السر لازم تكون 6 حروف أو أرقام على الأقل.';
  if (/rate limit|too many/i.test(message)) return 'محاولات كتير. استنى شوية وحاول تاني.';
  return getErrorMessage(error);
}

const ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'تعذّر إتمام الحجز الآن. يرجى المحاولة مرة أخرى.',
  PROFESSIONAL_ACCOUNT_REQUIRED: 'لإنشاء مساحة عمل، يُرجى استخدام حساب مهني دائم.',
  GUEST_BOOKING_LIMIT: 'وصلت للحد المسموح من الحجوزات التجريبية خلال اليوم. يرجى التواصل مع مقدم الخدمة.',
  INVALID_NAME: 'اكتب الاسم بشكل صحيح (حرفين على الأقل).',
  INVALID_PHONE: 'رقم الموبايل لازم يكون رقم مصري صحيح (01xxxxxxxxx).',
  SLOT_IN_PAST: 'الميعاد ده فات، اختار ميعاد تاني.',
  SLOT_NOT_AVAILABLE: 'الميعاد ده مش ضمن مواعيد الدكتور.',
  SLOT_TAKEN: 'الميعاد ده اتحجز قبل كده، اختار ميعاد تاني.',
  DOCTOR_ON_LEAVE: 'الدكتور في إجازة اليوم ده، اختار يوم تاني.',
  BLOCKED_DAY_HAS_APPOINTMENTS: 'مينفعش تضيف إجازة اليوم ده قبل ما تتعامل مع الحجوزات الموجودة عليه.',
  CHECK_IN_ONLY_TODAY: 'تسجيل الحضور متاح بس يوم الكشف.',
  CONSULTATION_IN_PROGRESS: 'في كشف شغال بالفعل. خلّصه قبل ما تبدأ الدور اللي بعده.',
  INVALID_DATE: 'التاريخ ده مش متاح لتسجيل الحضور.',
  DOCTOR_NOT_AVAILABLE: 'الدكتور مش متاح للحجز حالياً.',
  GROUP_NOT_AVAILABLE: 'المجموعة دي مش متاحة للحجز حالياً.',
  GROUP_NOT_FOUND: 'المجموعة دي مش موجودة.',
  GROUP_FULL: 'المجموعة اكتملت.',
  REGISTRATION_CLOSED: 'التسجيل في المجموعة ده مقفول حالياً.',
  GROUP_ENDED: 'المجموعة خلصت ومش بتقبل تسجيل جديد.',
  ALREADY_ENROLLED: 'انت مسجّل في المجموعة دي بالفعل.',
  ALREADY_REGISTERED: 'انت مسجّل كمحترف قبل كده.',
  NOT_CANCELLABLE: 'الحجز ده مش ممكن يتلغى.',
  CANCELLATION_WINDOW_PASSED: 'ميعاد الإلغاء اتقفل (لازم قبل الميعاد بساعتين على الأقل).',
  ENROLLMENT_NOT_FOUND: 'التسجيل ده مش موجود أو اتلغى قبل كده.',
  NOT_ALLOWED: 'مش مسموح لك تعمل العملية دي.',
  NOT_FOUND: 'مش لاقيين البيانات دي.',
  INVALID_STATUS: 'الحالة دي مش مدعومة.',
  INVALID_KIND: 'نوع الملف ده مش مدعوم.',
};

const ERROR_CODES_BY_LENGTH = Object.keys(ERROR_MESSAGES).sort((a, b) => b.length - a.length);

export function getErrorMessage(error: unknown): string {
  const message =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : '';
  if (!message) {
    return 'تعذّر إتمام العملية. لم تُحفظ أي تغييرات؛ يُرجى مراجعة إعدادات الاتصال أو إبلاغ إدارة دَوْرك.';
  }
  const codeValue = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (['42P01', '42703', 'PGRST205', 'PGRST204', 'PGRST202'].includes(codeValue)
      || /does not exist|could not find the table|could not find the function|schema cache/i.test(message)) {
    return 'إعدادات قاعدة البيانات لهذا القسم لم تكتمل بعد. يُرجى التواصل مع إدارة دَوْرك لإتمام التحديث.';
  }
  if (/row.level security|permission denied|not authorized/i.test(message) || codeValue === '42501') {
    return 'لا توجد صلاحية لإجراء هذا التغيير من الحساب الحالي.';
  }
  if (/storage.*bucket|bucket not found/i.test(message)) {
    return 'مساحة حفظ الملفات لم تُجهز بعد. يُرجى التواصل مع إدارة دَوْرك.';
  }
  if (/failed to fetch|network/i.test(message)) {
    return 'في مشكلة في الاتصال بالإنترنت. اتأكد منه وحاول تاني.';
  }
  const code = ERROR_CODES_BY_LENGTH.find((key) => message.includes(key));
  return code ? ERROR_MESSAGES[code] : 'تعذّر إتمام العملية. لم يتم تأكيد الحفظ؛ يُرجى مراجعة الاتصال أو التواصل مع إدارة دَوْرك.';
}
