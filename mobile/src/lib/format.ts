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
