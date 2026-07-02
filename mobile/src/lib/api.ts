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

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_ORIGIN) {
    throw new ApiError('EXPO_PUBLIC_API_ORIGIN is not configured', 0);
  }

  const token = await getToken();
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
    throw new ApiError((data as { error?: string }).error ?? 'Request failed', res.status);
  }

  return data as T;
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  if (!API_ORIGIN) {
    throw new ApiError('EXPO_PUBLIC_API_ORIGIN is not configured', 0);
  }

  const token = await getToken();
  const res = await fetch(`${API_ORIGIN}/api${path}`, {
    method: 'POST',
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error ?? 'Upload failed', res.status);
  }

  return data as T;
}

export function assetUrl(path: string): string {
  if (!path || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path;
  }
  if (path.startsWith('/')) return `${API_ORIGIN}${path}`;
  return path;
}
