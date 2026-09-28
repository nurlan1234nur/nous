import { API_ORIGIN } from '../config/env';
import { getToken } from './tokenStorage';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const REQUEST_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 60_000;

// Token хүчингүй болсон (401) үед AuthContext logout хийхийн тулд бүртгэнэ.
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, init: RequestInit, timeoutMs: number, fallback: string): Promise<T> {
  if (!API_ORIGIN) {
    throw new ApiError('EXPO_PUBLIC_API_ORIGIN is not configured', 0);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}/api${path}`, { ...init, signal: controller.signal });
  } catch (err) {
    const aborted = (err as { name?: string })?.name === 'AbortError';
    throw new ApiError(aborted ? 'Сервер хариу өгсөнгүй. Дахин оролдоно уу' : 'Интернэт холболтоо шалгана уу', 0);
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Нэвтэрсэн хүсэлт 401 авбал session дууссан гэсэн үг (login-ийн 401 биш).
    const hadAuth = Boolean((init.headers as Record<string, string> | undefined)?.Authorization);
    if (res.status === 401 && hadAuth) unauthorizedHandler?.();
    throw new ApiError((data as { error?: string }).error ?? fallback, res.status);
  }

  return data as T;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  return request<T>(
    path,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers as Record<string, string> | undefined),
      },
    },
    REQUEST_TIMEOUT_MS,
    'Request failed',
  );
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const token = await getToken();
  return request<T>(
    path,
    {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    UPLOAD_TIMEOUT_MS,
    'Upload failed',
  );
}

export function assetUrl(path: string): string {
  if (!path || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path;
  }
  if (path.startsWith('/')) return `${API_ORIGIN}${path}`;
  return path;
}
