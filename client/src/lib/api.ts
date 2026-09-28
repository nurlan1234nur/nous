// Backend API client. Token-ийг localStorage-д хадгална.
const TOKEN_KEY = 'nous-token';
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, '') ?? '';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_ORIGIN}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? 'Алдаа гарлаа');
  }
  return data as T;
}

// Multipart (зураг) upload. Content-Type-ийг browser өөрөө boundary-тэй тавина.
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_ORIGIN}/api${path}`, {
    method: 'POST',
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? 'Алдаа гарлаа');
  }
  return data as T;
}

// Server-ийн статик зам (/uploads/...) — same-origin тул шууд буцаана.
const ASSET_ORIGIN = import.meta.env.VITE_ASSET_ORIGIN?.replace(/\/$/, '') ?? '';

// Зураг (/uploads) нь нэвтрэлттэй — server-ээс авсан media token-ийг URL-д залгана.
// AuthContext хэрэглэгч солигдох бүрд шинэчилнэ.
let mediaToken = '';

export function setMediaToken(token: string | null | undefined): void {
  mediaToken = token ?? '';
}

function withMediaToken(url: string): string {
  if (!mediaToken) return url;
  return `${url}${url.includes('?') ? '&' : '?'}t=${encodeURIComponent(mediaToken)}`;
}

export function assetUrl(path: string): string {
  if (!path || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path;
  }
  const url = ASSET_ORIGIN && path.startsWith('/') ? `${ASSET_ORIGIN}${path}` : path;
  return path.startsWith('/uploads/') ? withMediaToken(url) : url;
}
