import { useState, type ReactNode } from 'react';
import { ArrowUpLeft, CircleHelp, ExternalLink, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { Link, navigate, useCurrentPath } from '@/lib/router';
import { useAuth } from '@/lib/auth';
import { isGuestSession } from '@/lib/role-routing';
import { BRAND_NAME } from '@/lib/constants';
import { isBackendConfigured } from '@/lib/supabase';

const PUBLIC_NAV = [
  { to: '/doctors', label: 'الأطباء' },
  { to: '/teachers', label: 'المُدرّسون' },
  { to: '/track', label: 'متابعة حجز' },
  { to: '/demo', label: 'تجربة المنصة' },
];

export function BrandMark({ light = false }: { light?: boolean }) {
  return <span className={`new-brand-mark ${light ? 'brand-light' : ''}`}><span className="brand-symbol" aria-hidden="true"><img src="/images/logo.png" alt="" className="brand-logo-image" /><i /></span><strong>{BRAND_NAME}</strong><span className="brand-mini-star" aria-hidden="true">✳</span></span>;
}

export function SiteLayout({ children }: { children: ReactNode }) {
  const path = useCurrentPath();
  const pathname = path.split('?')[0];
  const isHome = pathname === '/';
  const directBookingPage = /^\/(doctor|teacher)\/[^/]+$/.test(pathname);
  const experienceTheme = /^\/(teachers|teacher(?:\/|$)|register\/teacher|dashboard\/teacher)/.test(pathname) ? 'experience-education' : /^\/(doctors|doctor(?:\/|$)|register\/doctor|dashboard\/doctor)/.test(pathname) ? 'experience-healthcare' : pathname.startsWith('/admin') ? 'experience-admin' : 'experience-neutral';
  const { session, roles, hasRole, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const isGuest = isGuestSession(session);
  const adminMode = !isGuest && hasRole('admin');
  const professional = !isGuest && !adminMode && (hasRole('doctor') || hasRole('teacher'));
  const doctor = hasRole('doctor');
  const workspace = adminMode ? '/admin' : '/workspace';
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const handleSignOut = async () => { setMenuOpen(false); await signOut(); navigate('/join'); };
  const nav = adminMode
    ? [{ to: '/admin', label: 'إدارة المنصة' }]
    : professional
      ? [{ to: '/workspace', label: 'اختيار المساحة' }, { to: '/workspace/profile', label: 'ملفي المهني' }, { to: '/workspace/work', label: doctor ? 'إدارة العيادة' : 'إدارة المجموعات' }]
      : directBookingPage
        ? isGuest ? [{ to: '/dashboard', label: 'متابعة حجوزاتي' }, { to: '/track', label: 'رابط المتابعة' }] : [{ to: '/track', label: 'متابعة حجز' }]
        : isGuest || (session && !professional && !adminMode) ? [{ to: '/choose', label: 'احجز الآن' }, { to: '/dashboard', label: 'حجوزاتي' }, { to: '/track', label: 'متابعة حجز' }] : PUBLIC_NAV;

  const brandDestination = adminMode || professional ? workspace : '/';
  const compactNav = adminMode || professional || directBookingPage;

  return <div className={`flex min-h-screen flex-col dawrak-app ${experienceTheme}${isHome ? ' home-cover-layout' : ''}${compactNav ? ' workspace-layout' : ''}${directBookingPage ? ' direct-booking-layout' : ''}`}>
    <header className="site-header">
      <div className="site-header-inner">
        <Link to={brandDestination} className="site-brand-link" aria-label="دَوْرك — الرئيسية"><BrandMark /></Link>
        <nav className="site-desktop-nav" aria-label="القائمة الرئيسية">
          {nav.map(item => <Link key={item.to} to={item.to} className={isActive(item.to) ? 'nav-is-active' : ''}>{item.label}</Link>)}
        </nav>
        <div className="site-header-actions">
          {adminMode && <span className="admin-account-pill"><ShieldCheck size={15}/> حساب إدارة المنصة</span>}
          {professional && <span className="workspace-context"><ShieldCheck size={15}/> {doctor ? 'مساحة إدارة العيادة' : 'مساحة إدارة المجموعات'}</span>}
          {directBookingPage && !professional && !adminMode && <span className="workspace-context"><ExternalLink size={15}/> حجز مباشر دون حساب</span>}
          {!session && !directBookingPage && <Link to="/login" className="site-login">تسجيل الدخول</Link>}
          {session && !isGuest && <button type="button" onClick={handleSignOut} className="site-login"><LogOut size={17}/> خروج</button>}
          {!adminMode && !professional && !directBookingPage && <Link to="/signup" className="site-join-button">إنشاء حساب <ArrowUpLeft size={18}/></Link>}
        </div>
        {!directBookingPage && <button type="button" className="site-mobile-trigger" aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'} aria-expanded={menuOpen} onClick={() => setMenuOpen(x => !x)}>{menuOpen ? <X size={24}/> : <Menu size={24}/>}</button>}
      </div>
      {menuOpen && !directBookingPage && <div className="site-mobile-menu"><nav aria-label="قائمة الموبايل">
        {nav.map(item => <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>{item.label}</Link>)}
        {!adminMode && !professional && <Link to="/signup" onClick={() => setMenuOpen(false)}>إنشاء حساب</Link>}
        {session && !isGuest ? <button type="button" onClick={handleSignOut}>تسجيل الخروج</button> : <Link to="/login" onClick={() => setMenuOpen(false)}>تسجيل الدخول</Link>}
      </nav></div>}
    </header>
    {!isHome && !isBackendConfigured && <div className="preview-strip" role="status"><CircleHelp size={15}/><span>نسخة معاينة. يلزم ربط قاعدة البيانات لتفعيل الحجوزات الفعلية.</span><Link to="/demo">شاهد التجربة <ArrowUpLeft size={13}/></Link></div>}
    <main className="flex-1">{children}</main>
    {!professional && !adminMode && !directBookingPage && <footer className="site-footer"><div className="site-footer-inner"><Link to="/" aria-label="دَوْرك الرئيسية"><BrandMark /></Link><span>مواعيد منظّمة. تجربة أبسط.</span><div><Link to="/doctors">الأطباء</Link><Link to="/teachers">المُدرّسون</Link><Link to="/join">انضم إلينا</Link><Link to="/track">متابعة حجز</Link><Link to="/demo">التجربة</Link></div></div></footer>}
    {directBookingPage && <div className="direct-booking-footnote">الحجز مُتاح عبر صفحة مقدم الخدمة على دَوْرك — لا يلزم إنشاء حساب.</div>}
  </div>;
}
