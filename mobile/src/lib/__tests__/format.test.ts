import { dayLabel, daysSince, formatDate, groupByMonth, isImageAvatar, partnerSawMessage, prependUnique, presenceLabel, timeAgo, upsertById } from '../format';

const NOW = new Date('2026-09-28T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('timeAgo', () => {
  it('formats relative times', () => {
    expect(timeAgo(null, NOW)).toBe('');
    expect(timeAgo('garbage', NOW)).toBe('');
    expect(timeAgo(ago(10_000), NOW)).toBe('сая');
    expect(timeAgo(ago(5 * 60_000), NOW)).toBe('5 минутын өмнө');
    expect(timeAgo(ago(3 * 3_600_000), NOW)).toBe('3 цагийн өмнө');
    expect(timeAgo(ago(2 * 86_400_000), NOW)).toBe('2 өдрийн өмнө');
    expect(timeAgo(ago(30 * 86_400_000), NOW)).toMatch(/^2026\.08\.\d{2}$/);
  });
});

describe('presenceLabel', () => {
  it('prefers online, then last seen, then offline', () => {
    expect(presenceLabel(true, ago(60_000), NOW)).toBe('Онлайн');
    expect(presenceLabel(false, ago(5 * 60_000), NOW)).toBe('5 минутын өмнө онлайн байсан');
    expect(presenceLabel(false, null, NOW)).toBe('Офлайн');
  });
});

describe('partnerSawMessage', () => {
  it('compares read time with message time', () => {
    expect(partnerSawMessage(null, ago(0))).toBe(false);
    expect(partnerSawMessage(ago(0), undefined)).toBe(false);
    expect(partnerSawMessage(ago(0), ago(1000))).toBe(true);
    expect(partnerSawMessage(ago(1000), ago(0))).toBe(false);
  });
});

describe('list helpers', () => {
  it('upsertById replaces or appends without duplicates', () => {
    const list = [{ _id: 'a', v: 1 }];
    expect(upsertById(list, { _id: 'a', v: 2 })).toEqual([{ _id: 'a', v: 2 }]);
    expect(upsertById(list, { _id: 'b', v: 1 })).toEqual([{ _id: 'a', v: 1 }, { _id: 'b', v: 1 }]);
    expect(upsertById(list, { _id: 'b', v: 1 }, 'start')[0]._id).toBe('b');
    expect(list).toHaveLength(1); // immutable
  });

  it('prependUnique drops messages already present', () => {
    expect(prependUnique([{ _id: 'x' }, { _id: 'a' }], [{ _id: 'a' }, { _id: 'b' }]).map((m) => m._id)).toEqual([
      'x',
      'a',
      'b',
    ]);
  });
});

describe('daily archive helpers', () => {
  it('dayLabel formats Mongolian date + weekday', () => {
    expect(dayLabel('2026-09-28')).toBe('9-р сарын 28 · Даваа');
    expect(dayLabel('bad')).toBe('bad');
  });

  it('groupByMonth keeps order and groups consecutive months', () => {
    const groups = groupByMonth([{ date: '2026-09-28' }, { date: '2026-09-01' }, { date: '2026-08-31' }]);
    expect(groups.map((g) => [g.title, g.items.length])).toEqual([
      ['2026 оны 9-р сар', 2],
      ['2026 оны 8-р сар', 1],
    ]);
  });
});

describe('isImageAvatar', () => {
  it('detects uploaded image avatars', () => {
    expect(isImageAvatar('/uploads/a.jpg')).toBe(true);
    expect(isImageAvatar('https://res.cloudinary.com/x.jpg')).toBe(true);
    expect(isImageAvatar('💛')).toBe(false);
    expect(isImageAvatar('')).toBe(false);
    expect(isImageAvatar(null)).toBe(false);
  });
});

describe('daysSince / formatDate', () => {
  it('counts whole days and formats dates', () => {
    expect(daysSince(null, NOW)).toBe(0);
    expect(daysSince(ago(3 * 86_400_000 + 1000), NOW)).toBe(3);
    expect(daysSince(new Date(NOW + 86_400_000).toISOString(), NOW)).toBe(0);
    expect(formatDate('2000-05-12')).toBe('2000.05.12');
    expect(formatDate('2024-02-14T00:00:00.000Z')).toBe('2024.02.14');
    expect(formatDate('')).toBe('');
  });
});
