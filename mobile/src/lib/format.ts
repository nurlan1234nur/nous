// UI-аас хамааралгүй цэвэр туслах функцүүд (unit test-тэй).

export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return 'сая';
  if (min < 60) return `${min} минутын өмнө`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} цагийн өмнө`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} өдрийн өмнө`;
  const d = new Date(t);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// Чатын толгой дээрх хамтрагчийн төлөв.
export function presenceLabel(online: boolean, lastSeenIso: string | null | undefined, now: number = Date.now()): string {
  if (online) return 'Онлайн';
  const ago = timeAgo(lastSeenIso, now);
  return ago ? `${ago} онлайн байсан` : 'Офлайн';
}

// Хамтрагч миний сүүлийн зурвасыг үзсэн эсэх.
export function partnerSawMessage(partnerReadAt: string | null | undefined, messageCreatedAt: string | undefined): boolean {
  if (!partnerReadAt || !messageCreatedAt) return false;
  return new Date(partnerReadAt).getTime() >= new Date(messageCreatedAt).getTime();
}

// id-гаар давхардуулахгүйгээр жагсаалтад нэмнэ (socket + HTTP хариу хоёулаа ирэх үед).
export function upsertById<T extends { _id: string }>(list: T[], item: T, position: 'start' | 'end' = 'end'): T[] {
  const idx = list.findIndex((x) => x._id === item._id);
  if (idx >= 0) {
    const next = list.slice();
    next[idx] = item;
    return next;
  }
  return position === 'start' ? [item, ...list] : [...list, item];
}

// Хуучин зурвасуудыг эхэнд нь нэгтгэнэ (давхардлыг хасна).
export function prependUnique<T extends { _id: string }>(older: T[], current: T[]): T[] {
  const seen = new Set(current.map((x) => x._id));
  return [...older.filter((x) => !seen.has(x._id)), ...current];
}

const MONTHS_MN = ['1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар', '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар'];
const WEEKDAYS_MN = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];

// "2026-09-28" → "9-р сарын 28 · Даваа"
export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return `${m}-р сарын ${d} · ${WEEKDAYS_MN[new Date(y, m - 1, d).getDay()]}`;
}

// YYYY-MM-DD огноотой жагсаалтыг сараар бүлэглэнэ (оролтын дарааллыг хадгална).
export function groupByMonth<T extends { date: string }>(items: T[]): Array<{ key: string; title: string; items: T[] }> {
  const groups: Array<{ key: string; title: string; items: T[] }> = [];
  for (const item of items) {
    const key = item.date.slice(0, 7);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const [y, m] = key.split('-').map(Number);
      group = { key, title: `${y} оны ${MONTHS_MN[m - 1] ?? key}`, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

// Avatar нь upload хийсэн зураг (URL/зам) эсвэл emoji/үсэг байж болно.
export function isImageAvatar(avatar: string | null | undefined): boolean {
  return Boolean(avatar && (avatar.startsWith('/uploads/') || /^https?:\/\//.test(avatar)));
}

// Огнооноос хойш өнгөрсөн бүтэн хоног (хамтдаа хэдэн хоног). Огноогүй бол 0.
export function daysSince(iso: string | null | undefined, now: number = Date.now()): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

// "2000-05-12" эсвэл ISO → "2000.05.12"
export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : value;
}
