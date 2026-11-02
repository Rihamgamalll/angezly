export const BRAND_NAME = 'انجزلي';
export const BRAND_SLOGAN = 'كل حاجة في ميعادها';

export const WEEKDAYS = [
  { value: 6, label: 'السبت' },
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الاثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
] as const;

export const WEEKDAY_NAMES: Record<number, string> = Object.fromEntries(
  WEEKDAYS.map((day) => [day.value, day.label]),
);

export const GOVERNORATES = [
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'الدقهلية',
  'الشرقية',
  'القليوبية',
  'الغربية',
  'المنوفية',
  'البحيرة',
  'كفر الشيخ',
  'دمياط',
  'بورسعيد',
  'الإسماعيلية',
  'السويس',
  'الفيوم',
  'بني سويف',
  'المنيا',
  'أسيوط',
  'سوهاج',
  'قنا',
  'الأقصر',
  'أسوان',
  'الوادي الجديد',
  'مطروح',
  'البحر الأحمر',
  'شمال سيناء',
  'جنوب سيناء',
] as const;

export const DOCTOR_SPECIALTIES = [
  'باطنة',
  'أطفال',
  'جلدية',
  'عظام',
  'نساء وتوليد',
  'قلب وأوعية دموية',
  'أسنان',
  'عيون',
  'نفسية',
  'أنف وأذن وحنجرة',
] as const;

export const STAGES = [
  {
    value: 'primary',
    label: 'ابتدائي',
    grades: ['أولى ابتدائي', 'تانية ابتدائي', 'تالتة ابتدائي', 'رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي'],
  },
  {
    value: 'preparatory',
    label: 'إعدادي',
    grades: ['أولى إعدادي', 'تانية إعدادي', 'تالتة إعدادي'],
  },
  {
    value: 'secondary',
    label: 'ثانوي',
    grades: ['أولى ثانوي', 'تانية ثانوي', 'تالتة ثانوي'],
  },
] as const;

export type StageValue = (typeof STAGES)[number]['value'];

export const SUBJECTS = [
  'اللغة العربية',
  'اللغة الإنجليزية',
  'الرياضيات',
  'الفيزياء',
  'الكيمياء',
  'الأحياء',
  'التاريخ',
  'الجغرافيا',
  'العلوم',
  'الدراسات الاجتماعية',
] as const;

export const PRICE_PERIOD_LABELS: Record<string, string> = {
  session: 'للحصة',
  month: 'شهرياً',
  term: 'للترم',
};

export const GROUP_MODE_LABELS: Record<string, string> = {
  online: 'أونلاين',
  offline: 'ط­ط¶ظˆط±ظٹ',
};

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  booked: 'محجوز',
  completed: 'تمت الزيارة',
  no_show: 'لم يحضر',
  cancelled: 'ملغي',
};

export const PUBLIC_SHARE_MESSAGES = {
  teacher: 'احجز مكانك في مجموعاتي من خلال دَوْرك',
  doctor: 'تقدر تحجز ميعاد كشفك بسهولة من خلال دَوْرك',
} as const;

