import { useEffect, type ReactNode } from 'react';
import { InstallApp } from '@/components/InstallApp';
import { SiteLayout } from '@/components/SiteLayout';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { useAuth } from '@/lib/auth';
import { professionalDestination } from '@/lib/role-routing';
import { navigate, useCurrentPath } from '@/lib/router';
import { HomePage } from '@/pages/HomePage';
import { DoctorSearchPage } from '@/pages/DoctorSearchPage';
import { TeacherSearchPage } from '@/pages/TeacherSearchPage';
import { DoctorProfilePage } from '@/pages/DoctorProfilePage';
import { TeacherProfilePage } from '@/pages/TeacherProfilePage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { JoinPage } from '@/pages/JoinPage';
import { RegisterProfessionalPage } from '@/pages/RegisterProfessionalPage';
import { MyBookingsPage } from '@/pages/MyBookingsPage';
import { DoctorDashboardPage } from '@/pages/DoctorDashboardPage';
import { TeacherDashboardPage } from '@/pages/TeacherDashboardPage';
import { AdminPage } from '@/pages/AdminPage';
import { AdminMfaGate } from '@/components/AdminMfaGate';
import { AdminLoginPage } from '@/pages/AdminLoginPage';
import { DemoPage } from '@/pages/DemoPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { AppointmentTrackingPage } from '@/pages/AppointmentTrackingPage';
import { WorkspaceHomePage } from '@/pages/WorkspaceHomePage';
import { WorkspaceProfilePage } from '@/pages/WorkspaceProfilePage';
import { VisitorStartPage } from '@/pages/VisitorStartPage';
import { isGuestSession } from '@/lib/role-routing';

function renderRoute(pathname: string): ReactNode {
  const [first, second, ...rest] = pathname.split('?')[0].split('/').filter(Boolean);

  if (!first) return <HomePage />;
  if (first === 'doctors' && !second) return <DoctorSearchPage />;
  if (first === 'teachers' && !second) return <TeacherSearchPage />;
  if (first === 'doctor' && second && rest.length === 0) return <DoctorProfilePage slug={second} />;
  if (first === 'teacher' && second && rest.length === 0) return <TeacherProfilePage slug={second} />;
  if (first === 'login' && !second) return <LoginPage />;
  if (first === 'portal' && (second === 'doctor' || second === 'teacher') && !rest.length) return <LoginPage />;
  if (first === 'signup' && !second) return <SignupPage />;
  if (first === 'join' && !second) return <JoinPage />;
  if (first === 'register' && (second === 'doctor' || second === 'teacher') && rest.length === 0) {
    return <RegisterProfessionalPage kind={second} />;
  }
  if (first === 'track' && !second) return <AppointmentTrackingPage />;
  if (first === 'dashboard' && !second) return <MyBookingsPage />;
  if (first === 'choose' && !second) return <VisitorStartPage />;
  if (first === 'workspace' && !second) return <WorkspaceHomePage />;
  if (first === 'workspace' && second === 'profile' && rest.length === 0) return <WorkspaceProfilePage />;
  if (first === 'workspace' && second === 'work' && rest.length === 0) return <ProfessionalWorkRoute />;
  if (first === 'dashboard' && second === 'doctor' && rest.length === 0) return <DoctorDashboardPage />;
  if (first === 'dashboard' && second === 'teacher' && rest.length === 0) return <TeacherDashboardPage />;
  if (first === 'admin' && second === 'login' && rest.length === 0) return <AdminLoginPage />;
  if (first === 'admin' && !second) return <AdminMfaGate><AdminPage /></AdminMfaGate>;
  if (first === 'demo' && !second) return <DemoPage />;
  if (first === 'notifications' && !second) return <NotificationsPage />;
  return <NotFoundPage />;
}

const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/workspace'];

function ProfessionalWorkRoute() {
  const { roles } = useAuth();
  if (roles.includes('doctor')) return <DoctorDashboardPage />;
  if (roles.includes('teacher')) return <TeacherDashboardPage />;
  return <MyBookingsPage />;
}

function AuthRedirect({ children }: { children: ReactNode }) {
  const path = useCurrentPath();
  const { session, sessionLoading, accountReady, roles } = useAuth();
  const pathname = path.split('?')[0];
  const permanent = Boolean(session && !isGuestSession(session));
  const isAdmin = permanent && roles.includes('admin');
  const professional = permanent && (roles.includes('doctor') || roles.includes('teacher'));
  const protectedPath = pathname !== '/admin/login' && PROTECTED_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  // Direct /dashboard/doctor links from older versions now open the choice screen.
  // The operational dashboard only renders at /workspace/work after selecting it.
  let destination: string | null = null;
  if (!sessionLoading && !session && protectedPath) {
    destination = pathname === '/admin' ? '/admin/login' : `/login?next=${encodeURIComponent(path)}`;
  } else if (session && accountReady) {
    if (isAdmin && (pathname.startsWith('/workspace') || pathname.startsWith('/dashboard'))) {
      destination = '/admin';
    } else if (!isAdmin && pathname === '/admin') {
      destination = '/choose';
    } else if (!isAdmin && !professional && pathname.startsWith('/workspace')) {
      destination = '/choose';
    } else if (!professional && (pathname === '/dashboard/doctor' || pathname === '/dashboard/teacher')) {
      destination = '/choose';
    } else if (professional && (pathname === '/dashboard' || pathname === '/dashboard/doctor' || pathname === '/dashboard/teacher')) {
      destination = '/workspace';
    } else if (professional && pathname === '/choose') {
      destination = '/workspace';
    }
  }
  useEffect(() => {
    if (destination && destination !== path) navigate(destination);
  }, [destination, path]);
  if (destination || (protectedPath && (sessionLoading || (session && !accountReady)))) return null;
  return <>{children}</>;
}

export default function App() {
  const path = useCurrentPath();
  const pathname = path.split('?')[0];

  return (
    <SiteLayout>
      <AuthRedirect>
        <RouteErrorBoundary key={pathname}>
          <div className="animate-fade-up">
            {renderRoute(path)}
          </div>
        </RouteErrorBoundary>
      </AuthRedirect>
      <InstallApp />
    </SiteLayout>
  );
}
