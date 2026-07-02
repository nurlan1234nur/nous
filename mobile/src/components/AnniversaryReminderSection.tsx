import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCouple } from '../context/CoupleContext';
import { api } from '../lib/api';
import type { Member, Milestone } from '../types';

type ReminderItem = {
  id: string;
  title: string;
  date: Date;
  icon: string;
  badge: string;
  custom: boolean;
};

const ICONS = ['*', '+', '#', '@', '&', '%'];

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function cleanDate(value: string): string {
  return value.replace(/[^\d-]/g, '').slice(0, 10);
}

function toDateInput(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function generatedReminders(anniversary: string | null | undefined, members: Member[]): ReminderItem[] {
  const today = startOfToday();
  const items: ReminderItem[] = [];

  if (anniversary) {
    const start = new Date(anniversary);
    if (!Number.isNaN(start.getTime())) {
      for (let year = 1; year <= 5; year += 1) {
        const date = new Date(start);
        date.setFullYear(start.getFullYear() + year);
        const upcoming = date.getTime() >= today.getTime();
        if (upcoming) {
          items.push({
            id: `anniversary-${year}`,
            title: `${year} жилийн ой`,
            date,
            icon: '*',
            badge: `${daysBetween(today, date)} хоног`,
            custom: false,
          });
        }
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
      title: `${member.name} төрсөн өдөр`,
      date: next,
      icon: '+',
      badge: `${daysBetween(today, next)} хоног`,
      custom: false,
    });
  }

  return items;
}

export function AnniversaryReminderSection() {
  const { couple, refresh } = useCouple();
  const [open, setOpen] = useState(false);
  const [anniversary, setAnniversary] = useState('');
  const [custom, setCustom] = useState<Milestone[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadMilestones = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api<{ milestones: Milestone[] }>('/milestones');
      setCustom(response.milestones);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сануулгууд уншихад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setAnniversary(toDateInput(couple?.anniversary));
    void loadMilestones();
  }, [couple?.anniversary, loadMilestones, open]);

  const reminders = useMemo(() => {
    const today = startOfToday();
    const members = couple?.members.filter((member): member is Member => typeof member === 'object' && '_id' in member) ?? [];
    const customItems = custom.map((milestone) => {
      const reminderDate = new Date(milestone.date);
      return {
        id: milestone._id,
        title: milestone.title,
        date: reminderDate,
        icon: milestone.icon || '#',
        badge: reminderDate.getTime() >= today.getTime() ? `${daysBetween(today, reminderDate)} хоног` : 'Өнгөрсөн',
        custom: true,
      };
    });
    return [...generatedReminders(couple?.anniversary, members), ...customItems]
      .filter((item) => !Number.isNaN(item.date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 10);
  }, [couple?.anniversary, couple?.members, custom]);

  async function saveAnniversary() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(anniversary)) {
      setError('Ойн өдрөө YYYY-MM-DD хэлбэрээр оруулна уу');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api('/couples', { method: 'PATCH', body: JSON.stringify({ anniversary }) });
      await refresh();
      setMessage('Ойн өдөр хадгалагдлаа');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ойн өдөр хадгалах алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  }

  async function addReminder() {
    if (!title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Сануулгын нэр болон YYYY-MM-DD огноо оруулна уу');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await api<{ milestone: Milestone }>('/milestones', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), date, icon }),
      });
      setCustom((current) => [...current, response.milestone]);
      setTitle('');
      setDate('');
      setIcon(ICONS[0]);
      setAdding(false);
      setMessage('Сануулга нэмэгдлээ');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сануулга нэмэхэд алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(item: ReminderItem) {
    Alert.alert('Сануулга устгах уу?', item.title, [
      { text: 'Болих', style: 'cancel' },
      { text: 'Устгах', style: 'destructive', onPress: () => void deleteReminder(item.id) },
    ]);
  }

  async function deleteReminder(id: string) {
    const existing = custom.find((item) => item._id === id);
    if (!existing) return;
    setCustom((current) => current.filter((item) => item._id !== id));
    try {
      await api(`/milestones/${id}`, { method: 'DELETE' });
    } catch (err) {
      setCustom((current) => [...current, existing]);
      setError(err instanceof Error ? err.message : 'Сануулга устгах алдаа гарлаа');
    }
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.entryRow, pressed && styles.pressed]}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>!</Text>
        </View>
        <View style={styles.entryText}>
          <Text style={styles.entryLabel}>Ойн сануулга</Text>
          <Text style={styles.entryValue}>Ой, төрсөн өдөр, чухал өдрүүд</Text>
        </View>
        <Text style={styles.badge}>Set</Text>
      </Pressable>

      <Modal animationType="slide" onRequestClose={() => setOpen(false)} visible={open}>
        <View style={styles.screen}>
          <View style={styles.header}>
            <View>
              <Text style={styles.titleText}>Ойн сануулга</Text>
              <Text style={styles.subtitle}>Чухал өдрүүдээ нэг дор</Text>
            </View>
            <Pressable onPress={() => setOpen(false)} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {message ? <Text style={styles.message}>{message}</Text> : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Анхны өдөр</Text>
              <Text style={styles.cardSub}>Ойн сануулга болон timeline үүнээс автоматаар үүснэ.</Text>
              <TextInput
                editable={!busy}
                keyboardType="numbers-and-punctuation"
                onChangeText={(value) => setAnniversary(cleanDate(value))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9b8a93"
                style={styles.input}
                value={anniversary}
              />
              <Pressable disabled={busy} onPress={saveAnniversary} style={[styles.primaryButton, busy && styles.disabled]}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Хадгалах</Text>}
              </Pressable>
            </View>

            <View style={styles.listHeader}>
              <View>
                <Text style={styles.cardTitle}>Ойрын сануулгууд</Text>
                <Text style={styles.cardSub}>Автомат + гараар нэмсэн өдрүүд</Text>
              </View>
              <Pressable onPress={() => setAdding((value) => !value)} style={styles.smallButton}>
                <Text style={styles.smallButtonText}>{adding ? 'Хаах' : '+ Нэмэх'}</Text>
              </Pressable>
            </View>

            {adding ? (
              <View style={styles.card}>
                <TextInput maxLength={120} onChangeText={setTitle} placeholder="Сануулгын нэр" placeholderTextColor="#9b8a93" style={styles.input} value={title} />
                <TextInput keyboardType="numbers-and-punctuation" onChangeText={(value) => setDate(cleanDate(value))} placeholder="YYYY-MM-DD" placeholderTextColor="#9b8a93" style={styles.input} value={date} />
                <View style={styles.iconRow}>
                  {ICONS.map((item) => (
                    <Pressable key={item} onPress={() => setIcon(item)} style={[styles.iconChoice, icon === item && styles.iconChoiceActive]}>
                      <Text style={styles.iconChoiceText}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable disabled={busy} onPress={addReminder} style={[styles.primaryButton, busy && styles.disabled]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Сануулга хадгалах</Text>}
                </Pressable>
              </View>
            ) : null}

            {loading ? (
              <ActivityIndicator color="#e8607a" style={styles.loading} />
            ) : reminders.length === 0 ? (
              <Text style={styles.empty}>Ойн өдрөө тохируулаад сануулгууд автоматаар гарна.</Text>
            ) : (
              reminders.map((item) => (
                <View key={item.id} style={styles.reminderRow}>
                  <View style={styles.reminderIcon}>
                    <Text style={styles.reminderIconText}>{item.icon}</Text>
                  </View>
                  <View style={styles.reminderText}>
                    <Text style={styles.reminderTitle}>{item.title}</Text>
                    <Text style={styles.reminderDate}>{formatDate(item.date)}</Text>
                  </View>
                  <Text style={styles.reminderBadge}>{item.badge}</Text>
                  {item.custom ? (
                    <Pressable onPress={() => confirmDelete(item)} style={styles.deleteButton}>
                      <Text style={styles.deleteText}>×</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  entryRow: { alignItems: 'center', backgroundColor: '#fff8f5', borderColor: '#f5c6ce', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, marginBottom: 10, padding: 14, shadowColor: '#2d1f2e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  iconBadge: { alignItems: 'center', backgroundColor: '#fdf6f0', borderRadius: 12, height: 48, justifyContent: 'center', width: 48 },
  iconText: { color: '#e8607a', fontSize: 22, fontWeight: '900' },
  entryText: { flex: 1 },
  entryLabel: { color: '#2d1f2e', fontSize: 15, fontWeight: '800' },
  entryValue: { color: '#9b8a93', fontSize: 13, lineHeight: 18, marginTop: 3 },
  badge: { backgroundColor: '#f9ede6', borderRadius: 8, color: '#e8607a', fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  screen: { backgroundColor: '#fdf6f0', flex: 1 },
  header: { alignItems: 'center', backgroundColor: '#fff8f5', borderBottomColor: '#f5c6ce', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 14, paddingHorizontal: 20, paddingTop: 58 },
  titleText: { color: '#2d1f2e', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#9b8a93', fontSize: 12, marginTop: 2 },
  closeButton: { alignItems: 'center', backgroundColor: '#f9ede6', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  closeText: { color: '#2d1f2e', fontSize: 28, lineHeight: 30 },
  content: { padding: 16, paddingBottom: 34 },
  card: { backgroundColor: '#fff8f5', borderColor: '#f5c6ce', borderRadius: 18, borderWidth: 1, gap: 10, marginBottom: 14, padding: 14 },
  cardTitle: { color: '#2d1f2e', fontSize: 16, fontWeight: '900' },
  cardSub: { color: '#9b8a93', fontSize: 13, lineHeight: 18, marginTop: 3 },
  input: { backgroundColor: '#fdf6f0', borderColor: '#f5c6ce', borderRadius: 14, borderWidth: 1, color: '#2d1f2e', fontSize: 15, paddingHorizontal: 12, paddingVertical: 11 },
  primaryButton: { alignItems: 'center', backgroundColor: '#e8607a', borderRadius: 14, minHeight: 48, justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  listHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 },
  smallButton: { backgroundColor: '#e8607a', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  smallButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChoice: { alignItems: 'center', backgroundColor: '#fdf6f0', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  iconChoiceActive: { backgroundColor: '#f9ede6', borderColor: '#e8607a', borderWidth: 1 },
  iconChoiceText: { color: '#e8607a', fontSize: 18, fontWeight: '900' },
  reminderRow: { alignItems: 'center', backgroundColor: '#fff8f5', borderColor: '#f5c6ce', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 10, marginBottom: 10, padding: 12 },
  reminderIcon: { alignItems: 'center', backgroundColor: '#fdf6f0', borderRadius: 12, height: 42, justifyContent: 'center', width: 42 },
  reminderIconText: { color: '#e8607a', fontSize: 18, fontWeight: '900' },
  reminderText: { flex: 1 },
  reminderTitle: { color: '#2d1f2e', fontSize: 14, fontWeight: '900' },
  reminderDate: { color: '#9b8a93', fontSize: 12, marginTop: 3 },
  reminderBadge: { backgroundColor: '#f9ede6', borderRadius: 8, color: '#e8607a', fontSize: 11, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  deleteButton: { alignItems: 'center', backgroundColor: '#f9ede6', borderRadius: 12, height: 32, justifyContent: 'center', width: 32 },
  deleteText: { color: '#e8607a', fontSize: 22, lineHeight: 24 },
  empty: { backgroundColor: '#fff8f5', borderRadius: 18, color: '#9b8a93', overflow: 'hidden', padding: 22, textAlign: 'center' },
  loading: { marginTop: 32 },
  error: { backgroundColor: '#f9ede6', borderRadius: 12, color: '#b9314f', marginBottom: 12, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 10, textAlign: 'center' },
  message: { backgroundColor: '#eef8ef', borderRadius: 12, color: '#2f7a45', marginBottom: 12, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 10, textAlign: 'center' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
});
