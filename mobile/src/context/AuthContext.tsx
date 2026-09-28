import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setMediaToken, setUnauthorizedHandler } from '../lib/api';
import { unregisterPushNotifications } from '../lib/notifications';
import { disconnectSocket } from '../lib/socket';
import { clearToken, getToken, setToken } from '../lib/tokenStorage';
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

  // Анхны ачаалалтаас бусад үед loading-г асаахгүй — эс бөгөөс AppShell spinner харуулж
  // бүх дэлгэцийг unmount хийн, профайл хадгалсны дараа Home tab руу үсэрдэг байсан.
  async function refresh() {
    try {
      const token = await getToken();
      if (!token) {
        applyUser(null);
        return;
      }

      const response = await api<{ user: User }>('/auth/me');
      applyUser(response.user);
    } catch (err) {
      // Зөвхөн token хүчингүй бол гаргана; сүлжээний түр алдаанд session-г хадгална.
      if ((err as { status?: number }).status === 401 || (err as { status?: number }).status === 404) {
        await clearToken();
        applyUser(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // Token хугацаа дууссан/хүчингүй болсон үед (401) автоматаар гаргана.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      disconnectSocket();
      void clearToken().finally(() => applyUser(null));
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  async function login(username: string, password: string) {
    const response = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    await setToken(response.token);
    applyUser(response.user);
  }

  async function logout() {
    await unregisterPushNotifications();
    disconnectSocket();
    await clearToken();
    applyUser(null);
  }

  // Бүртгэл бүрмөсөн устгах (App Store / Google Play шаардлага).
  async function deleteAccount(password: string) {
    await api('/auth/me', { method: 'DELETE', body: JSON.stringify({ password }) });
    disconnectSocket();
    await clearToken();
    applyUser(null);
  }

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, logout, deleteAccount, refresh }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
