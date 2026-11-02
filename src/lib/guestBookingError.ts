/** A helpful message for an anonymous sign-in failure; no credentials are logged. */
export function guestBookingErrorMessage(error: { code?: string; message?: string; status?: number }): string {
  const code = (error.code || '').toLowerCase();
  const message = (error.message || '').toLowerCase();
  if (code.includes('anonymous_provider_disabled') || message.includes('anonymous sign-ins are disabled')) {
    return 'الحجز بدون حساب غير مفعّل حاليًا. يُرجى التواصل مع مسؤول المنصة.';
  }
  if (error.status === 429 || code.includes('rate_limit') || message.includes('rate limit')) {
    return 'وصلنا للحد المؤقت من محاولات الحجز. يُرجى المحاولة بعد قليل.';
  }
  if (code.includes('captcha') || message.includes('captcha')) {
    return 'تعذّر إتمام التحقق الأمني. يُرجى تحديث الصفحة وإعادة المحاولة.';
  }
  if (message.includes('fetch') || message.includes('network')) {
    return 'الاتصال بالإنترنت غير مستقر. تحقّق من اتصالك ثم حاول مرة أخرى.';
  }
  return 'تعذّر بدء الحجز مؤقتًا. يُرجى المحاولة مرة أخرى.';
}
