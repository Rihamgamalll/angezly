import type { ReactNode } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return <section className="auth-redesign"><div className="auth-layout">
    <div className="auth-aside"><div className="auth-aside-top"><span><Sparkles size={18}/> تجربة أكثر تنظيمًا</span></div><div><h2>مواعيدك<br/><em>في مكان واحد.</em></h2><p>تابع حجوزاتك ومجموعاتك بسهولة، في أي وقت.</p></div><div className="auth-aside-note"><CheckCircle2 size={21}/> دَوْرك — كل حاجة في ميعادها</div><span className="auth-aside-art" aria-hidden="true">✳</span></div>
    <div className="auth-form-side"><div className="auth-form-top"><span>دَوْرك / حسابك</span><span className="auth-form-spark">✳</span></div><Card className="auth-form-card"><h1>{title}</h1><p>{subtitle}</p><div className="mt-8">{children}</div></Card><div className="auth-form-footer">{footer}</div></div>
  </div></section>;
}
