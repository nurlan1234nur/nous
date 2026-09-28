import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

// Web-ийн client/src/lib/theme.ts-тэй ижил 5 өнгөний загвар. Хэрэглэгч профайлаасаа сонгоно.
export type ThemeId = 'rose' | 'sunset' | 'ocean' | 'violet' | 'forest';

export interface Palette {
  rose: string; // гол (accent) өнгө — товч, идэвхтэй таб, icon
  blush: string; // цайвар хүрээ
  warm: string; // зөөлөн дэвсгэр
}

export const THEMES: Array<{ id: ThemeId; name: string; palette: Palette }> = [
  { id: 'rose', name: 'Сарнай', palette: { rose: '#e8607a', blush: '#f5c6ce', warm: '#f9ede6' } },
  { id: 'sunset', name: 'Нар жаргах', palette: { rose: '#f0833e', blush: '#f8d3b0', warm: '#fbeede' } },
  { id: 'ocean', name: 'Далай', palette: { rose: '#3e8ed0', blush: '#bcdcf0', warm: '#e6f1f9' } },
  { id: 'violet', name: 'Ягаан', palette: { rose: '#9b6eb5', blush: '#ddc9ea', warm: '#f0e9f5' } },
  { id: 'forest', name: 'Ой', palette: { rose: '#4fae7a', blush: '#c2e6d2', warm: '#e6f3ec' } },
];

const BASE = THEMES[0].palette;
const KEYS = Object.keys(BASE) as Array<keyof Palette>;

export function paletteFor(id: string | null | undefined): Palette {
  return (THEMES.find((t) => t.id === id) ?? THEMES[0]).palette;
}

// Одоогийн өнгө. Render үед уншина (жнь <ActivityIndicator color={colors.rose} />).
export const colors: Palette = { ...BASE };
let currentId: ThemeId = 'rose';

type AnyStyle = ViewStyle | TextStyle | ImageStyle;
type Styles = Record<string, AnyStyle>;

// Үндсэн (rose) өнгийг сонгосон загварын өнгөөр солино. Бусад өнгө (текст, алдаа г.м.) хэвээр.
export function mapColor(value: unknown, palette: Palette): unknown {
  if (typeof value !== 'string') return value;
  const lower = value.toLowerCase();
  const key = KEYS.find((k) => BASE[k] === lower);
  return key ? palette[key] : value;
}

const registry: Array<{ target: Styles; original: Styles }> = [];

function recolor(target: Styles, original: Styles, palette: Palette): void {
  for (const name of Object.keys(original)) {
    const src = original[name] as Record<string, unknown>;
    const dst = target[name] as Record<string, unknown>;
    for (const prop of Object.keys(src)) dst[prop] = mapColor(src[prop], palette);
  }
}

// StyleSheet.create-ийн оронд. RN dev горимд StyleSheet.create style-уудыг freeze хийдэг тул
// энд энгийн объект үлдээж, theme солигдоход байранд нь өнгийг шинэчилнэ.
export function themedStyles<T extends { [K in keyof T]: AnyStyle }>(styles: T): T {
  const target = styles as unknown as Styles;
  const original: Styles = {};
  for (const name of Object.keys(target)) original[name] = { ...target[name] };
  registry.push({ target, original });
  if (currentId !== 'rose') recolor(target, original, colors);
  return styles;
}

// Theme солино. Өөрчлөгдсөн бол true (дуудагч дэлгэцийг дахин зурах ёстой).
export function applyTheme(id: string | null | undefined): boolean {
  const next = (THEMES.find((t) => t.id === id)?.id ?? 'rose') as ThemeId;
  if (next === currentId) return false;
  currentId = next;
  Object.assign(colors, paletteFor(next));
  for (const { target, original } of registry) recolor(target, original, colors);
  return true;
}

export function currentTheme(): ThemeId {
  return currentId;
}
