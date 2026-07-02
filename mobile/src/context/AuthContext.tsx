import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { disconnectSocket } from '../lib/socket';
import { clearToken, getToken, setToken } from '../lib/tokenStorage';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setUser(null);
        return;
      }

      const response = await api<{ user: User }>('/auth/me');
      setUser(response.user);
    } catch {
      await clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function login(username: string, password: string) {
    const response = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    await setToken(response.token);
    setUser(response.user);
  }

  async function logout() {
    disconnectSocket();
    await clearToken();
    setUser(null);
  }

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
