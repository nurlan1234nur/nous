import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { LoveNote } from '../types';

type NoteView = 'received' | 'sent';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LoveNotesSection() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<LoveNote[]>([]);
  const [view, setView] = useState<NoteView>('received');
  const [open, setOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sortNotes = useCallback((next: LoveNote[]) => {
    setNotes([...next].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, []);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api<{ notes: LoveNote[] }>('/love-notes');
      sortNotes(response.notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Love Notes');
    } finally {
      setLoading(false);
    }
  }, [sortNotes]);

  useEffect(() => {
    if (open) void loadNotes();
  }, [loadNotes, open]);

  useEffect(() => {
    let active = true;
    void getSocket()
      .then((socket) => {
        if (!active) return;
        socket.on('love-note:new', (note: LoveNote) => {
          if (note.author._id === user?.id) return;
          setNotes((current) => (current.some((item) => item._id === note._id) ? current : [note, ...current]));
        });
        socket.on('love-note:opened', (note: LoveNote) => {
          setNotes((current) => current.map((item) => (item._id === note._id ? note : item)));
        });
        socket.on('love-note:deleted', ({ id }: { id: string }) => {
          setNotes((current) => current.filter((item) => item._id !== id));
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
      void getSocket()
        .then((socket) => {
          socket.off('love-note:new');
          socket.off('love-note:opened');
          socket.off('love-note:deleted');
        })
        .catch(() => undefined);
    };
  }, [user?.id]);

  const unreadCount = useMemo(
    () => notes.filter((note) => note.recipient._id === user?.id && !note.openedAt).length,
    [notes, user?.id],
  );

  const shown = useMemo(
    () => notes.filter((note) => (view === 'received' ? note.recipient._id === user?.id : note.author._id === user?.id)),
    [notes, user?.id, view],
  );

  async function sendNote() {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    setError('');
    try {
      const response = await api<{ note: LoveNote }>('/love-notes', {
        method: 'POST',
        body: JSON.stringify({ text: value }),
      });
      sortNotes([response.note, ...notes.filter((note) => note._id !== response.note._id)]);
      setText('');
      setComposing(false);
      setView('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send Love Note');
    } finally {
      setBusy(false);
    }
  }

  async function openNote(id: string) {
    setBusy(true);
    setError('');
    try {
      const response = await api<{ note: LoveNote }>(`/love-notes/${id}/open`, { method: 'PATCH' });
      sortNotes(notes.map((note) => (note._id === id ? response.note : note)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open Love Note');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(id: string) {
    Alert.alert('Delete Love Note?', 'Only unopened sent notes can be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteNote(id) },
    ]);
  }

  async function deleteNote(id: string) {
    const existing = notes.find((note) => note._id === id);
    setNotes((current) => current.filter((note) => note._id !== id));
    setError('');
    try {
      await api(`/love-notes/${id}`, { method: 'DELETE' });
    } catch (err) {
      if (existing) sortNotes([...notes, existing]);
      setError(err instanceof Error ? err.message : 'Could not delete Love Note');
    }
  }

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((value) => !value)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>{'\u270e'}</Text>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Love Notes</Text>
          <Text style={styles.rowValue}>{unreadCount ? `${unreadCount} unread note` : 'Send private notes to your partner.'}</Text>
        </View>
        <Text style={styles.badge}>{open ? 'Close' : 'Open'}</Text>
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {composing ? (
            <View style={styles.form}>
              <TextInput
                editable={!busy}
                multiline
                maxLength={3000}
                onChangeText={setText}
                placeholder="Write a private note..."
                placeholderTextColor="#9b8a93"
                style={styles.noteInput}
                value={text}
              />
              <Text style={styles.counter}>{text.length}/3000</Text>
              <View style={styles.actions}>
                <Pressable disabled={busy} onPress={() => setComposing(false)} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
                <Pressable disabled={busy || !text.trim()} onPress={sendNote} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (busy || !text.trim()) && styles.disabled]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Send</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Pressable onPress={() => setComposing(true)} style={styles.primaryButton}>
                <Text style={styles.primaryText}>New Love Note</Text>
              </Pressable>
              <View style={styles.tabs}>
                {(['received', 'sent'] as const).map((tab) => (
                  <Pressable key={tab} onPress={() => setView(tab)} style={[styles.tab, view === tab && styles.activeTab]}>
                    <Text style={[styles.tabText, view === tab && styles.activeTabText]}>{tab === 'received' ? 'Received' : 'Sent'}</Text>
                  </Pressable>
                ))}
              </View>
              {loading ? (
                <ActivityIndicator color="#e8607a" style={styles.loader} />
              ) : shown.length === 0 ? (
                <Text style={styles.empty}>No notes yet.</Text>
              ) : (
                shown.map((note) => {
                  const received = note.recipient._id === user?.id;
                  const locked = received && !note.openedAt;
                  return (
                    <View key={note._id} style={styles.noteCard}>
                      <View style={styles.noteHeader}>
                        <View style={styles.noteAvatar}>
                          <Text style={styles.noteAvatarText}>{(received ? note.author.name : note.recipient.name).slice(0, 1).toUpperCase()}</Text>
                        </View>
                        <View style={styles.noteMeta}>
                          <Text style={styles.noteName}>{received ? note.author.name : note.recipient.name}</Text>
                          <Text style={styles.noteDate}>{formatDateTime(note.createdAt)}</Text>
                        </View>
                        {!received && !note.openedAt ? (
                          <Pressable onPress={() => confirmDelete(note._id)} style={styles.deleteButton}>
                            <Text style={styles.deleteText}>Delete</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {locked ? (
                        <Pressable disabled={busy} onPress={() => openNote(note._id)} style={styles.openButton}>
                          <Text style={styles.openButtonText}>Open note</Text>
                        </Pressable>
                      ) : (
                        <Text style={styles.noteText}>{note.text}</Text>
                      )}
                      {!received ? (
                        <Text style={styles.status}>{note.openedAt ? 'Opened' : 'Waiting to be opened'}</Text>
                      ) : null}
                    </View>
                  );
                })
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
  noteInput: {
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
  tabs: {
    backgroundColor: '#fdf6f0',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    paddingVertical: 9,
  },
  activeTab: {
    backgroundColor: '#fff',
  },
  tabText: {
    color: '#9b8a93',
    fontSize: 12,
    fontWeight: '800',
  },
  activeTabText: {
    color: '#2d1f2e',
  },
  noteCard: {
    borderTopColor: '#f5c6ce',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  noteHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  noteAvatar: {
    alignItems: 'center',
    backgroundColor: '#f9ede6',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  noteAvatarText: {
    color: '#e8607a',
    fontSize: 15,
    fontWeight: '900',
  },
  noteMeta: {
    flex: 1,
  },
  noteName: {
    color: '#2d1f2e',
    fontSize: 14,
    fontWeight: '900',
  },
  noteDate: {
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
  openButton: {
    alignItems: 'center',
    backgroundColor: '#f9ede6',
    borderRadius: 12,
    marginTop: 12,
    paddingVertical: 12,
  },
  openButtonText: {
    color: '#e8607a',
    fontSize: 14,
    fontWeight: '900',
  },
  noteText: {
    color: '#2d1f2e',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  status: {
    color: '#9b8a93',
    fontSize: 11,
    marginTop: 8,
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
