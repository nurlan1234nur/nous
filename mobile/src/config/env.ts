export const API_ORIGIN = process.env.EXPO_PUBLIC_API_ORIGIN?.replace(/\/$/, '') ?? '';

// Нууцлалын бодлого (web client-ийн public/privacy.html). Store-д мөн энэ URL-г өгнө.
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? (API_ORIGIN ? `${API_ORIGIN}/privacy.html` : '');
