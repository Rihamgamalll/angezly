import { useEffect, useState } from 'react';
import { Download, Smartphone, X, Share2, CheckCircle2 } from 'lucide-react';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

/** Shared PWA install entry point for visitors, students, patients, doctors and teachers. */
export function InstallApp() {
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [inAppBrowser, setInAppBrowser] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setPlatform(ios ? 'ios' : /Android/i.test(ua) ? 'android' : 'desktop');
    setInAppBrowser(/FBAN|FBAV|Instagram|WhatsApp|wv\)|; wv|Line\//i.test(ua));
    setInstalled(isStandalone());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setOpen(false);
      setPromptEvent(null);
    };
    const onModeChange = () => setInstalled(isStandalone());
    const media = window.matchMedia('(display-mode: standalone)');
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    media.addEventListener?.('change', onModeChange);

    // Show once to each visitor on any device; a dismissal is respected across visits.
    if (!isStandalone() && !localStorage.getItem('angezly-install-intro-dismissed')) {
      const timer = window.setTimeout(() => {
        setOpen(true);
      }, 1800);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', onPrompt);
        window.removeEventListener('appinstalled', onInstalled);
        media.removeEventListener?.('change', onModeChange);
      };
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      media.removeEventListener?.('change', onModeChange);
    };
  }, []);

  if (installed) return null;

  const dismiss = () => {
    localStorage.setItem('angezly-install-intro-dismissed', 'yes');
    setOpen(false);
  };

  const install = async () => {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setOpen(false);
        setPromptEvent(null);
      } else {
        setNotice('تقدري تثبتي أنجزلي في أي وقت من زر «نزّل أنجزلي».');
      }
    } catch {
      setNotice('المتصفح منع نافذة التثبيت. جرّبي قائمة المتصفح بالطريقة الموضحة تحت.');
    }
  };

  return (
    <div dir="rtl" style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 80, maxWidth: 'calc(100vw - 32px)' }}>
      {!open ? (
        <button type="button" onClick={() => { setOpen(true); setNotice(''); }} aria-label="تثبيت تطبيق أنجزلي"
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0e9387', color: 'white', padding: '12px 16px', borderRadius: 30, boxShadow: '0 6px 24px #0003', fontWeight: 700 }}>
          <Smartphone size={18} /> نزّل أنجزلي
        </button>
      ) : (
        <aside role="dialog" aria-modal="false" aria-label="تثبيت تطبيق أنجزلي"
          style={{ width: 370, maxWidth: 'calc(100vw - 32px)', background: 'white', border: '1px solid #b8ddd5', borderRadius: 18, padding: 18, boxShadow: '0 8px 32px #0003' }}>
          <button type="button" aria-label="إغلاق" onClick={dismiss} style={{ float: 'left' }}><X size={20} /></button>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>أنجزلي أقرب لك 📱</h2>
          <p style={{ fontSize: 14, lineHeight: 1.8, marginBottom: 12 }}>
            ثبّت أنجزلي على جهازك وادخل لحجوزاتك بضغطة واحدة!
          </p>
          {promptEvent && (
            <button type="button" onClick={() => void install()}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: '#0e9387', color: 'white', padding: '12px 16px', borderRadius: 12, fontWeight: 700, marginBottom: 12 }}>
              <Download size={18} /> تثبيت أنجزلي الآن
            </button>
          )}
          <div style={{ background: '#f0faf7', borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 1.9 }}>
            {inAppBrowser && <p style={{ fontWeight: 700, marginBottom: 8 }}>افتحي الرابط خارج واتساب أو فيسبوك أو إنستجرام أولًا، من قائمة ⋮ ثم «فتح في المتصفح».</p>}
            {platform === 'ios' ? (
              <><Share2 size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> على آيفون: افتحي الرابط في <b>Safari</b>، اضغطي <b>مشاركة</b> ثم <b>إضافة إلى الشاشة الرئيسية</b> وبعدها <b>إضافة</b>. على بعض إصدارات iOS قد يظهر الخيار داخل قائمة «المزيد».</>
            ) : platform === 'android' ? (
              <>على أندرويد: افتحي الرابط في <b>Chrome</b> واضغطي <b>⋮</b> ثم <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>. {promptEvent ? 'أو استخدمي زر التثبيت الأخضر فوق.' : 'لو مش ظاهر، جرّبي بعد فتح الموقع المنشور HTTPS في Chrome مباشرة.'}</>
            ) : (
              <>افتحي <b>رابط أنجزلي المنشور</b> على الموبايل في Chrome (أندرويد) أو Safari (آيفون) لتثبيته. على الكمبيوتر قد يظهر خيار «تثبيت» في شريط العنوان في Chrome أو Edge.</>
            )}
          </div>
          {notice && <p role="status" style={{ fontSize: 13, marginTop: 10, color: '#165e50' }}><CheckCircle2 size={14} style={{ display: 'inline' }} /> {notice}</p>}
          <button type="button" onClick={dismiss} style={{ marginTop: 12, fontSize: 13, textDecoration: 'underline' }}>تجاهل</button>
        </aside>
      )}
    </div>
  );
}
