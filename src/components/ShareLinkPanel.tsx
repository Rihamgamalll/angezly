import { useState } from 'react';
import { ArrowUpLeft, Check, Copy, ExternalLink, Link2, MessageCircle, Share2 } from 'lucide-react';
import { PUBLIC_SHARE_MESSAGES } from '@/lib/constants';
import { getPublicProfileUrl, getWhatsAppShareUrl } from '@/lib/format';

type ShareLinkPanelProps = {
  kind: 'doctor' | 'teacher';
  slug: string;
};

export function ShareLinkPanel({ kind, slug }: ShareLinkPanelProps) {
  const [url] = useState(() => getPublicProfileUrl(kind, slug));
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyFailed(true);
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: 'دَوْرك', text: PUBLIC_SHARE_MESSAGES[kind], url });
    } catch {
      // The user can cancel the share dialog without an error message.
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <section className="share-studio" aria-labelledby="share-studio-title">
      <div className="share-studio-content">
        <span className="share-studio-eyebrow"><Link2 size={16} /> صفحتك على دَوْرك</span>
        <h2 id="share-studio-title">رابط واحد، لكل حجوزاتك.</h2>
        <p>شارك رابط صفحتك مع {kind === 'doctor' ? 'مرضاك' : 'طلابك'}، ليصلوا إلى المواعيد المتاحة مباشرة.</p>
        <label className="share-studio-url">
          <span className="sr-only">رابط صفحتك العامة</span>
          <input dir="ltr" type="text" readOnly value={url} onFocus={event => event.target.select()} aria-label="رابط الحجز الخاص بك" />
          <button type="button" onClick={handleCopy} aria-label="نسخ رابط الحجز">{copied ? <Check size={18}/> : <Copy size={18}/>}</button>
        </label>
        {copied && <span className="share-studio-feedback" role="status">تم نسخ الرابط بنجاح.</span>}
        {copyFailed && <p className="share-studio-error" role="alert">تعذّر النسخ التلقائي. يمكنك تحديد الرابط ونسخه من الخانة أعلاه.</p>}
        <div className="share-studio-actions">
          <a href={getWhatsAppShareUrl(PUBLIC_SHARE_MESSAGES[kind], url)} target="_blank" rel="noopener noreferrer" className="share-studio-whatsapp"><MessageCircle size={19}/> مشاركة عبر واتساب <ArrowUpLeft size={16}/></a>
          <a href={url} target="_blank" rel="noopener noreferrer" className="share-studio-visit"><ExternalLink size={17}/> عرض الصفحة</a>
          {canNativeShare && <button type="button" className="share-studio-visit" onClick={handleNativeShare}><Share2 size={17}/> مشاركة أخرى</button>}
        </div>
      </div>
      <div className="share-studio-decor" aria-hidden="true"><span className="share-decor-top">دَوْرك</span><span className="share-decor-loop">↗</span><span className="share-decor-bottom">صفحة واحدة. مواعيد أوضح.</span></div>
    </section>
  );
}
