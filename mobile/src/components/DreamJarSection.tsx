import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { Wish } from '../types';

function sortWishes(wishes: Wish[]): Wish[] {
  return [...wishes].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function DreamJarSection() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const activeCount = useMemo(() => wishes.filter((wish) => !wish.completed).length, [wishes]);

  const loadWishes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api<{ wishes: Wish[] }>('/wishes');
      setWishes(sortWishes(response.wishes));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load wishes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadWishes();
  }, [loadWishes, open]);

  useEffect(() => {
    let active = true;
    void getSocket()
      .then((socket) => {
        if (!active) return;
        socket.on('wish:new', (wish: Wish) => {
          setWishes((current) => sortWishes(current.some((item) => item._id === wish._id) ? current : [...current, wish]));
        });
        socket.on('wish:update', (wish: Wish) => {
          setWishes((current) => sortWishes(current.map((item) => (item._id === wish._id ? wish : item))));
        });
        socket.on('wish:deleted', ({ id }: { id: string }) => {
          setWishes((current) => current.filter((item) => item._id !== id));
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
      void getSocket()
        .then((socket) => {
          socket.off('wish:new');
          socket.off('wish:update');
          socket.off('wish:deleted');
        })
        .catch(() => undefined);
    };
  }, []);

  async function addWish() {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    setError('');
    try {
      const response = await api<{ wish: Wish }>('/wishes', {
        method: 'POST',
        body: JSON.stringify({ text: value }),
      });
      setWishes((current) => sortWishes(current.some((wish) => wish._id === response.wish._id) ? current : [...current, response.wish]));
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add wish');
    } finally {
      setBusy(false);
    }
  }

  async function toggleWish(wish: Wish) {
    setBusyId(wish._id);
    setError('');
    try {
      const response = await api<{ wish: Wish }>(`/wishes/${wish._id}/toggle`, { method: 'PATCH' });
      setWishes((current) => sortWishes(current.map((item) => (item._id === wish._id ? response.wish : item))));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update wish');
    } finally {
      setBusyId(null);
    }
  }

  async function requestDelete(wish: Wish) {
    setBusyId(wish._id);
    setError('');
    try {
      const response = await api<{ deleted: boolean; id?: string; wish?: Wish }>(`/wishes/${wish._id}/delete-approval`, { method: 'PATCH' });
      if (response.deleted) {
        setWishes((current) => current.filter((item) => item._id !== wish._id));
      } else if (response.wish) {
        setWishes((current) => sortWishes(current.map((item) => (item._id === wish._id ? response.wish! : item))));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update delete approval');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((value) => !value)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>{'\u2726'}</Text>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Dream Jar</Text>
          <Text style={styles.rowValue}>{activeCount ? `${activeCount} active wish` : 'Collect dreams to do together.'}</Text>
        </View>
        <Text style={styles.badge}>{open ? 'Close' : 'Open'}</Text>
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.addRow}>
            <TextInput editable={!busy} maxLength={500} onChangeText={setText} placeholder="Add a dream..." placeholderTextColor="#9b8a93" style={styles.input} value={text} />
            <Pressable disabled={busy || !text.trim()} onPress={addWish} style={({ pressed }) => [styles.addButton, pressed && styles.pressed, (busy || !text.trim()) && styles.disabled]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.addText}>Add</Text>}
            </Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color="#e8607a" style={styles.loader} />
          ) : wishes.length === 0 ? (
            <Text style={styles.empty}>No wishes yet.</Text>
          ) : (
            wishes.map((wish) => {
              const approvedComplete = wish.completionApprovals.includes(user?.id ?? '');
              const approvedDelete = wish.deletionApprovals.includes(user?.id ?? '');
              return (
                <View key={wish._id} style={[styles.wishCard, wish.completed && styles.completedCard]}>
                  <View style={styles.wishMain}>
                    <Pressable disabled={busyId === wish._id} onPress={() => toggleWish(wish)} style={[styles.checkButton, wish.completed && styles.checkDone, approvedComplete && !wish.completed && styles.checkPending]}>
                      <Text style={styles.checkText}>{wish.completed ? '\u2713' : approvedComplete ? '1/2' : ''}</Text>
                    </Pressable>
                    <View style={styles.wishTextWrap}>
                      <Text style={[styles.wishText, wish.completed && styles.completedText]}>{wish.text}</Text>
                      <Text style={styles.meta}>
                        {wish.author.name} - Completion {wish.completionApprovals.length}/2
                        {wish.deletionApprovals.length ? ` - Delete ${wish.deletionApprovals.length}/2` : ''}
                      </Text>
                    </View>
                  </View>
                  <Pressable disabled={busyId === wish._id} onPress={() => requestDelete(wish)} style={styles.deleteApproval}>
                    <Text style={[styles.deleteApprovalText, approvedDelete && styles.deleteApproved]}>{approvedDelete ? 'Cancel delete approval' : 'Approve delete'}</Text>
                  </Pressable>
                </View>
              );
            })
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
  addRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    color: '#2d1f2e',
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 12,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: '#e8607a',
    borderRadius: 12,
    justifyContent: 'center',
    minWidth: 64,
    paddingHorizontal: 12,
  },
  addText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  wishCard: {
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  completedCard: {
    backgroundColor: '#fdf6f0',
  },
  wishMain: {
    flexDirection: 'row',
    gap: 10,
  },
  checkButton: {
    alignItems: 'center',
    borderColor: '#e8607a',
    borderRadius: 15,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  checkPending: {
    backgroundColor: '#f9ede6',
  },
  checkDone: {
    backgroundColor: '#e8607a',
  },
  checkText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  wishTextWrap: {
    flex: 1,
  },
  wishText: {
    color: '#2d1f2e',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  completedText: {
    color: '#9b8a93',
    textDecorationLine: 'line-through',
  },
  meta: {
    color: '#9b8a93',
    fontSize: 11,
    marginTop: 5,
  },
  deleteApproval: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 4,
  },
  deleteApprovalText: {
    color: '#9b8a93',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteApproved: {
    color: '#e8607a',
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
