"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getValidSession, readSession, signInAdmin, requestPasswordReset, type CognitoSession } from "../lib/auth";

type AdminAuthContextValue = {
  session: CognitoSession | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  resetPassword: (username: string) => Promise<void>;
  signOut: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<CognitoSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getValidSession().then((next) => {
      if (active) {
        setSession(next);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const value = useMemo<AdminAuthContextValue>(() => ({
    session,
    loading,
    signIn: async (username, password) => { const next = await signInAdmin(username, password); setSession(next); },
    resetPassword: requestPasswordReset,
    signOut: () => { clearSession(); setSession(null); },
  }), [loading, session]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return context;
}

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !session) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, pathname, router, session]);

  if (loading) return <div className="auth-loading">Checking secure session…</div>;
  if (!session) return null;
  return <>{children}</>;
}

export function hasStoredAdminSession() {
  return Boolean(readSession());
}
