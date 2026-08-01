'use client';

import { createContext, useContext, useEffect, useReducer, useCallback, type ReactNode } from 'react';
import { ADMIN_SESSION_EXPIRED_EVENT, httpClient } from '@/lib/api-clients';
import { normalizeUser } from '@/lib/api-clients/normalizers';
import { ENABLE_MOCKS, mockAdminUser } from '@/lib/mockData';
import type { User } from '@/types';

const REFRESH_INTERVAL = 5 * 60 * 1000;
const LEGACY_TOKEN_KEYS = ['admin_access_token', 'admin_refresh_token'] as const;

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

interface AdminAuthContext extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AdminAuthContext | null>(null);

// 仅清理迁移前遗留凭证；2026-08-10 后删除此函数和调用。
function clearLegacyAdminTokens(): void {
  if (typeof window === 'undefined') return;
  LEGACY_TOKEN_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

/* ── API 调用（通过 httpClient） ── */

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await httpClient.post(path, body);
  const json = response.data as { success: boolean; data?: T; error?: string; message?: string };
  if (!json.success) throw new Error(json.error || json.message || 'Request failed');
  return json.data as T;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await httpClient.get(path);
  const json = response.data as { success: boolean; data?: T; error?: string; message?: string };
  if (!json.success) throw new Error(json.error || json.message || 'Request failed');
  return json.data as T;
}

/* ── Provider ── */

function getInitialState(): AuthState {
  if (ENABLE_MOCKS) {
    return { user: mockAdminUser, loading: false, isAuthenticated: true };
  }
  return { user: null, loading: true, isAuthenticated: false };
}

type AuthAction = { type: 'SYNC'; user: User | null; isAuthenticated: boolean };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  return { user: action.user, loading: false, isAuthenticated: action.isAuthenticated };
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, undefined, getInitialState);

  const sync = useCallback((user: User | null, authed: boolean) => {
    dispatch({ type: 'SYNC', user, isAuthenticated: authed });
  }, []);

  const refreshUser = useCallback(async () => {
    if (ENABLE_MOCKS) {
      sync(mockAdminUser, true);
      return;
    }

    try {
      const user = await apiGet<User>('/api/v1/auth/admin/me');
      sync(normalizeUser(user as unknown as Record<string, unknown>), true);
    } catch {
      sync(null, false);
    }
  }, [sync]);

  useEffect(() => {
    clearLegacyAdminTokens();
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const handleSessionExpired = () => sync(null, false);
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [sync]);

  useEffect(() => {
    const id = setInterval(() => { refreshUser().catch(() => {}); }, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [refreshUser]);

  const login = useCallback(async (username: string, password: string) => {
    if (ENABLE_MOCKS) {
      const trimmedUsername = username.trim() || mockAdminUser.username || 'admin';
      sync({ ...mockAdminUser, username: trimmedUsername, login_account: trimmedUsername }, true);
      return;
    }

    const data = await apiPost<{ user: Record<string, unknown>; expires_in: number }>(
      '/api/v1/auth/admin/login', { username, password },
    );
    sync(normalizeUser(data.user), true);
  }, [sync]);

  const logout = useCallback(async () => {
    if (ENABLE_MOCKS) {
      sync(null, false);
      return;
    }

    try {
      await httpClient.post('/api/v1/auth/admin/logout', {});
    } catch { /* ignore */ }
    sync(null, false);
  }, [sync]);

  const value: AdminAuthContext = { ...state, login, logout, refreshUser };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminAuth(): AdminAuthContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
