import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AccountSnapshot = { userId: string; roles: string[]; fullName: string; accountKind: 'doctor' | 'teacher' | 'visitor' | null };

type AuthContextValue = {
  session: Session | null;
  sessionLoading: boolean;
  accountReady: boolean;
  roles: string[];
  fullName: string;
  accountKind: 'doctor' | 'teacher' | 'visitor' | null;
  hasRole: (role: string) => boolean;
  refreshAccount: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);

  const userId = session?.user.id ?? null;

  const loadAccount = useCallback(async (uid: string): Promise<AccountSnapshot> => {
    const [rolesResult, profileResult, intentResult] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', uid),
      supabase.from('profiles').select('full_name').eq('id', uid).maybeSingle(),
      supabase.from('account_intents').select('account_kind').eq('user_id', uid).maybeSingle(),
    ]);
    const roles = (rolesResult.data ?? []).map((row) => row.role as string);
    const fullName = (profileResult.data?.full_name as string | undefined) ?? '';
    const accountKind = (intentResult.data?.account_kind as 'doctor' | 'teacher' | 'visitor' | undefined) ?? null;
    return { userId: uid, roles, fullName, accountKind };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const refreshAccount = useCallback(async () => {
    if (!userId) {
      setSnapshot(null);
      return;
    }
    const next = await loadAccount(userId);
    setSnapshot(next);
  }, [userId, loadAccount]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;
    loadAccount(userId).then((next) => {
      if (!cancelled) {
        setSnapshot(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, loadAccount]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSnapshot(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const current = snapshot && snapshot.userId === userId ? snapshot : null;
    const roles = current?.roles ?? [];
    return {
      session,
      sessionLoading,
      accountReady: !userId || current !== null,
      roles,
      fullName: current?.fullName ?? '',
      accountKind: current?.accountKind ?? null,
      hasRole: (role: string) => roles.includes(role),
      refreshAccount,
      signOut,
    };
  }, [session, sessionLoading, snapshot, userId, refreshAccount, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
