import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCouple } from '../context/CoupleContext';
import { api } from '../lib/api';
import type { Member, Milestone } from '../types';

interface TimelineItem {
  id: string;
  title: string;
  date: Date;
  icon: string;
  badge: string;
  upcoming: boolean;
  custom: boolean;
}

const ICONS = {
  heart: '\u2665',
  sparkle: '\u2726',
  cake: '\u25cf',
  gift: '\u25a0',
  ring: '\u25c7',
  flower: '\u273f',
  star: '\u2605',
  check: '\u2713',
};

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function generatedMilestones(anniversary: string | null | undefined, members: Member[]): TimelineItem[] {
  const today = startOfToday();
  const items: TimelineItem[] = [];

  if (anniversary) {
    const start = new Date(anniversary);
    if (!Number.isNaN(start.getTime())) {
      items.push({
        id: 'anniversary-start',
        title: 'First day together',
        date: start,
        icon: ICONS.heart,
        upcoming: start.getTime() > today.getTime(),
        badge: start.getTime() > today.getTime() ? `${daysBetween(today, start)} days left` : 'Started',
        custom: false,
      });

      for (let year = 1; year <= 5; year += 1) {
        const date = new Date(start);
        date.setFullYear(start.getFullYear() + year);
        items.push({
          id: `anniversary-${year}`,
          title: `${year} year anniversary`,
          date,
          icon: ICONS.sparkle,
          upcoming: date.getTime() > today.getTime(),
          badge: date.getTime() > today.getTime() ? `${daysBetween(today, date)} days left` : ICONS.check,
          custom: false,
        });
      }
    }
  }

  for (const member of members) {
    if (!member.birthday) continue;
    const birthday = new Date(member.birthday);
    if (Number.isNaN(birthday.getTime())) continue;
    const next = new Date(today);
    next.setMonth(birthday.getMonth(), birthday.getDate());
    if (next.getTime() < today.getTime()) next.setFullYear(next.getFullYear() + 1);
    items.push({
      id: `birthday-${member._id}`,
      title: `${member.name}'s birthday`,
      date: next,
      icon: ICONS.cake,
      upcoming: true,
      badge: `${daysBetween(today, next)} days left`,
      custom: false,
    });
  }

  return items;
}

export function TimelineScreen() {
  const { couple, loading: coupleLoading } = useCouple();
  const [custom, setCustom] = useState<Milestone[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newIcon, setNewIcon] = useState(ICONS.sparkle);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadMilestones = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api<{ milestones: Milestone[] }>('/milestones');
      setCustom(response.milestones);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load timeline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMilestones();
  }, [loadMilestones]);

  const today = startOfToday();
  const daysTogether = useMemo(() => {
    if (!couple?.anniversary) return null;
    const start = new Date(couple.anniversary);
    if (Number.isNaN(start.getTime())) return null;
    return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
  }, [couple?.anniversary, today]);

  const items = useMemo<TimelineItem[]>(() => {
    const members = couple?.members.filter((member): member is Member => typeof member === 'object' && '_id' in member) ?? [];
    const customItems = custom.map((milestone) => {
      const date = new Date(milestone.date);
      const upcoming = date.getTime() > today.getTime();
      return {
        id: milestone._id,
        title: milestone.title,
        date,
        icon: milestone.icon || ICONS.star,
        upcoming,
        badge: upcoming ? `${daysBetween(today, date)} days left` : ICONS.check,
        custom: true,
      };
    });
    return [...generatedMilestones(couple?.anniversary, members), ...customItems].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [couple?.anniversary, couple?.members, custom, today]);

  async function addMilestone() {
    if (!newTitle.trim() || !newDate) {
      setError('Title and date are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await api<{ milestone: Milestone }>('/milestones', {
        method: 'POST',
        body: JSON.stringify({ title: newTitle.trim(), date: newDate, icon: newIcon }),
      });
      setCustom((current) => [...current, response.milestone]);
      setNewTitle('');
      setNewDate('');
      setNewIcon(ICONS.sparkle);
      setAddOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add milestone');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(item: TimelineItem) {
    Alert.alert('Delete milestone?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteMilestone(item.id) },
    ]);
  }

  async function deleteMilestone(id: string) {
    const existing = custom.find((milestone) => milestone._id === id);
    if (!existing) return;
    setCustom((current) => current.filter((milestone) => milestone._id !== id));
    try {
      await api(`/milestones/${id}`, { method: 'DELETE' });
    } catch (err) {
      setCustom((current) => (current.some((milestone) => milestone._id === id) ? current : [...current, existing]));
      setError(err instanceof Error ? err.message : 'Could not delete milestone');
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Timeline</Text>
        <Text style={styles.subtitle}>
          {couple?.anniversary ? `Since ${formatDate(new Date(couple.anniversary))}` : 'Set your anniversary from the web app for now.'}
        </Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroNumber}>{daysTogether ?? '-'}</Text>
        <Text style={styles.heroLabel}>days together</Text>
      </View>

      <View style={styles.addPanel}>
        <Pressable onPress={() => setAddOpen((value) => !value)} style={styles.addToggle}>
          <Text style={styles.addToggleText}>{addOpen ? 'Close milestone form' : '+ Add milestone'}</Text>
        </Pressable>
        {addOpen ? (
          <View style={styles.form}>
            <TextInput editable={!busy} onChangeText={setNewTitle} placeholder="Milestone title" placeholderTextColor="#9b8a93" style={styles.input} value={newTitle} />
            <TextInput editable={!busy} onChangeText={setNewDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9b8a93" style={styles.input} value={newDate} />
            <View style={styles.iconRow}>
              {[ICONS.sparkle, ICONS.cake, ICONS.gift, ICONS.heart, ICONS.ring, ICONS.flower].map((icon) => (
                <Pressable key={icon} onPress={() => setNewIcon(icon)} style={[styles.iconChoice, newIcon === icon && styles.iconChoiceActive]}>
                  <Text style={styles.iconChoiceText}>{icon}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable disabled={busy} onPress={addMilestone} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, busy && styles.disabled]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save milestone</Text>}
            </Pressable>
          </View>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading || coupleLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#e8607a" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No timeline items yet.</Text>}
          renderItem={({ item, index }) => (
            <View style={styles.itemRow}>
              <View style={styles.rail}>
                <View style={[styles.icon, item.upcoming && styles.upcomingIcon]}>
                  <Text style={[styles.iconText, item.upcoming && styles.upcomingIconText]}>{item.icon}</Text>
                </View>
                {index < items.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <Pressable onLongPress={() => item.custom && confirmDelete(item)} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDate}>{formatDate(item.date)}</Text>
                <Text style={[styles.badge, item.upcoming && styles.upcomingBadge]}>{item.badge}</Text>
                {item.custom ? <Text style={styles.deleteHint}>Long press to delete</Text> : null}
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#fdf6f0',
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  title: {
    color: '#2d1f2e',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9b8a93',
    fontSize: 14,
    marginTop: 4,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: '#e8607a',
    borderRadius: 28,
    marginHorizontal: 16,
    marginTop: 18,
    paddingVertical: 26,
    shadowColor: '#e8607a',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 6,
  },
  heroNumber: {
    color: '#fff',
    fontFamily: 'PlayfairDisplay_600SemiBold_Italic',
    fontSize: 56,
  },
  heroLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.86,
  },
  error: {
    backgroundColor: '#f9ede6',
    color: '#b9314f',
    marginHorizontal: 24,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlign: 'center',
  },
  addPanel: {
    marginHorizontal: 16,
    marginTop: 14,
  },
  addToggle: {
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    borderColor: '#e8607a',
    borderRadius: 18,
    borderStyle: 'dashed',
    borderWidth: 1,
    paddingVertical: 12,
  },
  addToggleText: {
    color: '#e8607a',
    fontSize: 14,
    fontWeight: '800',
  },
  form: {
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    marginTop: 10,
    padding: 12,
  },
  input: {
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    color: '#2d1f2e',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconChoice: {
    alignItems: 'center',
    backgroundColor: '#fdf6f0',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  iconChoiceActive: {
    backgroundColor: '#f9ede6',
    borderColor: '#e8607a',
    borderWidth: 1,
  },
  iconChoiceText: {
    color: '#e8607a',
    fontSize: 20,
    fontWeight: '900',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#e8607a',
    borderRadius: 12,
    minHeight: 46,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    padding: 18,
    paddingBottom: 32,
  },
  empty: {
    color: '#9b8a93',
    paddingTop: 32,
    textAlign: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  rail: {
    alignItems: 'center',
    width: 42,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: '#e8607a',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  upcomingIcon: {
    backgroundColor: '#f9ede6',
    borderColor: '#f5c6ce',
    borderWidth: 1,
  },
  iconText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  upcomingIconText: {
    color: '#e8607a',
  },
  line: {
    backgroundColor: '#f5c6ce',
    flex: 1,
    marginTop: 4,
    width: 2,
  },
  itemCard: {
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    padding: 14,
    shadowColor: '#2d1f2e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  deleteHint: {
    color: '#9b8a93',
    fontSize: 11,
    marginTop: 8,
  },
  itemTitle: {
    color: '#2d1f2e',
    fontSize: 15,
    fontWeight: '800',
  },
  itemDate: {
    color: '#9b8a93',
    fontSize: 13,
    marginTop: 3,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f9ede6',
    borderRadius: 8,
    color: '#e8607a',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 8,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  upcomingBadge: {
    backgroundColor: '#fdf6f0',
  },
});
