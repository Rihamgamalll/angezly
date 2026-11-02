import { useEffect, type ReactNode } from 'react';
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
import { AdminLoginPage } from '@/pages/AdminLoginPage';
import { DemoPage } from '@/pages/DemoPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { AppointmentTrackingPage } from '@/pages/AppointmentTrackingPage';

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
  if (first === 'dashboard' && second === 'doctor' && rest.length === 0) return <DoctorDashboardPage />;
  if (first === 'dashboard' && second === 'teacher' && rest.length === 0) return <TeacherDashboardPage />;
  if (first === 'admin' && second === 'login' && rest.length === 0) return <AdminLoginPage />;
  if (first === 'admin' && !second) return <AdminPage />;
  if (first === 'demo' && !second) return <DemoPage />;
  if (first === 'notifications' && !second) return <NotificationsPage />;
  return <NotFoundPage />;
}

const PROTECTED_PREFIXES = ['/dashboard', '/admin'];

function AuthRedirect({ children }: { children: ReactNode }) {
  const path = useCurrentPath();
  const { session, sessionLoading, accountReady, hasRole, roles } = useAuth();
  const pathname = path.split('?')[0];
  const isProtected = pathname !== '/admin/login' && PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isProfessionalBookingsDashboard = (hasRole('doctor') || hasRole('teacher')) && pathname === '/dashboard';
  const isAdminForbiddenDashboard = hasRole('admin') && (
    pathname === '/dashboard' || pathname === '/dashboard/doctor' || pathname === '/dashboard/teacher'
  );

  useEffect(() => {
    if (!sessionLoading && !session && isProtected) {
      navigate(pathname === '/admin' ? '/admin/login' : `/login?next=${encodeURIComponent(path)}`);
    } else if (session && accountReady && isAdminForbiddenDashboard) {
      navigate('/admin');
    } else if (session && accountReady && isProfessionalBookingsDashboard) {
      navigate(professionalDestination(roles));
    }
  }, [sessionLoading, session, accountReady, isAdminForbiddenDashboard, isProfessionalBookingsDashboard, roles, isProtected, path]);

  if (session && accountReady && (isAdminForbiddenDashboard || isProfessionalBookingsDashboard)) return null;
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
    </SiteLayout>
  );
}
