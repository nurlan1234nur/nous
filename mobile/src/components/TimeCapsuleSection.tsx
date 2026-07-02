import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { Capsule } from '../types';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function defaultUnlockValue(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalDateTime(value: string): Date {
  return new Date(value.replace(' ', 'T'));
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TimeCapsuleSection() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [text, setText] = useState('');
  const [unlockAt, setUnlockAt] = useState(defaultUnlockValue);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadCapsules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api<{ capsules: Capsule[] }>('/capsules');
      setCapsules(response.capsules);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load capsules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadCapsules();
  }, [loadCapsules, open]);

  async function createCapsule() {
    const message = text.trim();
    const date = parseLocalDateTime(unlockAt);
    if (!message || Number.isNaN(date.getTime())) {
      setError('Message and unlock date are required.');
      return;
    }
    if (date.getTime() <= Date.now()) {
      setError('Unlock date must be in the future.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api('/capsules', {
        method: 'POST',
        body: JSON.stringify({ text: message, unlockAt: date.toISOString() }),
      });
      setText('');
      setUnlockAt(defaultUnlockValue());
      setCreating(false);
      await loadCapsules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create capsule');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(id: string) {
    Alert.alert('Delete capsule?', 'This removes the time capsule for both of you.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteCapsule(id) },
    ]);
  }

  async function deleteCapsule(id: string) {
    const existing = capsules.find((capsule) => capsule.id === id);
    setCapsules((current) => current.filter((capsule) => capsule.id !== id));
    setError('');
    try {
      await api(`/capsules/${id}`, { method: 'DELETE' });
    } catch (err) {
      if (existing) setCapsules((current) => (current.some((capsule) => capsule.id === id) ? current : [...current, existing]));
      setError(err instanceof Error ? err.message : 'Could not delete capsule');
    }
  }

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((value) => !value)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>{'\u25f7'}</Text>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Time Capsule</Text>
          <Text style={styles.rowValue}>{capsules.length ? `${capsules.length} capsule` : 'Write a message for the future.'}</Text>
        </View>
        <Text style={styles.badge}>{open ? 'Close' : 'Open'}</Text>
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {creating ? (
            <View style={styles.form}>
              <TextInput
                editable={!busy}
                maxLength={8000}
                multiline
                onChangeText={setText}
                placeholder="Write a future message..."
                placeholderTextColor="#9b8a93"
                style={styles.textInput}
                value={text}
              />
              <Text style={styles.counter}>{text.length}/8000</Text>
              <Text style={styles.help}>Unlock time</Text>
              <TextInput
                editable={!busy}
                onChangeText={setUnlockAt}
                placeholder="YYYY-MM-DD HH:mm"
                placeholderTextColor="#9b8a93"
                style={styles.dateInput}
                value={unlockAt}
              />
              <View style={styles.actions}>
                <Pressable disabled={busy} onPress={() => setCreating(false)} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Back</Text>
                </Pressable>
                <Pressable disabled={busy || !text.trim() || !unlockAt.trim()} onPress={createCapsule} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (busy || !text.trim() || !unlockAt.trim()) && styles.disabled]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Lock</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Pressable onPress={() => setCreating(true)} style={styles.primaryButton}>
                <Text style={styles.primaryText}>New capsule</Text>
              </Pressable>
              {loading ? (
                <ActivityIndicator color="#e8607a" style={styles.loader} />
              ) : capsules.length === 0 ? (
                <Text style={styles.empty}>No capsules yet.</Text>
              ) : (
                capsules.map((capsule) => (
                  <View key={capsule.id} style={styles.capsuleCard}>
                    <View style={styles.capsuleHeader}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{capsule.author.name.slice(0, 1).toUpperCase()}</Text>
                      </View>
                      <View style={styles.meta}>
                        <Text style={styles.author}>{capsule.author.name}</Text>
                        <Text style={styles.date}>{capsule.unlocked ? 'Opened' : 'Opens'}: {formatDateTime(capsule.unlockAt)}</Text>
                      </View>
                      {capsule.author._id === user?.id ? (
                        <Pressable onPress={() => confirmDelete(capsule.id)} style={styles.deleteButton}>
                          <Text style={styles.deleteText}>Delete</Text>
                        </Pressable>
                      ) : (
                        <Text style={styles.lockState}>{capsule.unlocked ? 'Open' : 'Locked'}</Text>
                      )}
                    </View>
                    {capsule.unlocked && capsule.text ? (
                      <Text style={styles.capsuleText}>{capsule.text}</Text>
                    ) : (
                      <Text style={styles.lockedText}>The message will appear when the unlock time arrives.</Text>
                    )}
                  </View>
                ))
              )}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  row: {
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    shadowColor: '#2d1f2e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: '#fdf6f0',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  iconText: {
    color: '#e8607a',
    fontSize: 22,
    fontWeight: '900',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    color: '#2d1f2e',
    fontSize: 15,
    fontWeight: '800',
  },
  rowValue: {
    color: '#9b8a93',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  badge: {
    backgroundColor: '#f9ede6',
    borderRadius: 8,
    color: '#e8607a',
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  panel: {
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginTop: 10,
    padding: 14,
  },
  form: {
    gap: 10,
  },
  textInput: {
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    color: '#2d1f2e',
    fontSize: 15,
    minHeight: 120,
    padding: 12,
    textAlignVertical: 'top',
  },
  counter: {
    color: '#9b8a93',
    fontSize: 11,
    textAlign: 'right',
  },
  help: {
    color: '#9b8a93',
    fontSize: 12,
    fontWeight: '800',
  },
  dateInput: {
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    color: '#2d1f2e',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#e8607a',
    borderRadius: 12,
    flex: 1,
    minHeight: 46,
    justifyContent: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#e8607a',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minHeight: 46,
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#e8607a',
    fontSize: 14,
    fontWeight: '900',
  },
  capsuleCard: {
    borderTopColor: '#f5c6ce',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  capsuleHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#f9ede6',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  avatarText: {
    color: '#e8607a',
    fontSize: 15,
    fontWeight: '900',
  },
  meta: {
    flex: 1,
  },
  author: {
    color: '#2d1f2e',
    fontSize: 14,
    fontWeight: '900',
  },
  date: {
    color: '#9b8a93',
    fontSize: 11,
    marginTop: 2,
  },
  deleteButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  deleteText: {
    color: '#e8607a',
    fontSize: 12,
    fontWeight: '800',
  },
  lockState: {
    color: '#e8607a',
    fontSize: 12,
    fontWeight: '900',
  },
  capsuleText: {
    color: '#2d1f2e',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  lockedText: {
    color: '#9b8a93',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 12,
  },
  empty: {
    color: '#9b8a93',
    paddingVertical: 18,
    textAlign: 'center',
  },
  loader: {
    marginVertical: 18,
  },
  error: {
    backgroundColor: '#f9ede6',
    borderRadius: 12,
    color: '#b9314f',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.6,
  },
});
