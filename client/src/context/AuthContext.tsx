import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setToken, clearToken, getToken, setMediaToken } from '../lib/api';
import { disconnectSocket } from '../lib/socket';
import { applyTheme } from '../lib/theme';
import { disableNotifications } from '../lib/notifications';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Зургийн token-ийг хэрэглэгчтэй зэрэг шинэчилнэ (render-ээс өмнө — assetUrl шууд ашиглана).
  function applyUser(next: User | null) {
    setMediaToken(next?.mediaToken);
    setUser(next);
  }

  async function refresh() {
    if (!getToken()) {
      applyUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await api<{ user: User }>('/auth/me');
      applyUser(user);
    } catch {
      clearToken();
      applyUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // Хэрэглэгчийн theme өөрчлөгдөх бүрд (нэвтрэх, профайл засах) апп даяар хэрэгжүүлнэ.
  useEffect(() => {
    applyTheme(user?.theme);
  }, [user?.theme]);

  async function login(username: string, password: string) {
    const { token, user } = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(token);
    applyUser(user);
  }

  async function logout() {
    await disableNotifications().catch(() => {});
    clearToken();
    disconnectSocket();
    applyUser(null);
  }

  async function deleteAccount(password: string) {
    await api('/auth/me', { method: 'DELETE', body: JSON.stringify({ password }) });
    await disableNotifications().catch(() => {});
    clearToken();
    disconnectSocket();
    applyUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, deleteAccount, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
