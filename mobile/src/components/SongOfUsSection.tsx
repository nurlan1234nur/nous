import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { WeeklySong } from '../types';

function weekLabel(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function SongOfUsSection() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [current, setCurrent] = useState<WeeklySong | null>(null);
  const [songs, setSongs] = useState<WeeklySong[]>([]);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [url, setUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sortSongs = useCallback((next: WeeklySong[]) => {
    setSongs([...next].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, []);

  const loadSongs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api<{ current: WeeklySong | null; songs: WeeklySong[] }>('/songs');
      setCurrent(response.current);
      sortSongs(response.songs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load songs');
    } finally {
      setLoading(false);
    }
  }, [sortSongs]);

  useEffect(() => {
    if (open) void loadSongs();
  }, [loadSongs, open]);

  useEffect(() => {
    let active = true;
    void getSocket()
      .then((socket) => {
        if (!active) return;
        socket.on('song:update', (song: WeeklySong) => {
          setCurrent(song);
          setSongs((existing) => [song, ...existing.filter((item) => item._id !== song._id)]);
        });
        socket.on('song:delete', ({ id }: { id: string }) => {
          setSongs((existing) => {
            const next = existing.filter((song) => song._id !== id);
            setCurrent((value) => (value?._id === id ? next[0] ?? null : value));
            return next;
          });
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
      void getSocket()
        .then((socket) => {
          socket.off('song:update');
          socket.off('song:delete');
        })
        .catch(() => undefined);
    };
  }, []);

  const headline = useMemo(() => current ? `${current.title} - ${current.artist}` : 'Pick your weekly song.', [current]);

  function resetForm() {
    setEditing(false);
    setEditingId(null);
    setTitle('');
    setArtist('');
    setUrl('');
    setThumbnailUrl('');
  }

  function editSong(song: WeeklySong | null) {
    setEditing(true);
    setEditingId(song?._id ?? null);
    setTitle(song?.title ?? '');
    setArtist(song?.artist ?? '');
    setUrl(song?.url ?? '');
    setThumbnailUrl(song?.thumbnailUrl ?? '');
  }

  async function previewYoutube() {
    if (!url.trim()) return;
    setBusy(true);
    setError('');
    try {
      const preview = await api<{ title: string; artist: string; thumbnailUrl: string }>('/songs/youtube-preview', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() }),
      });
      setTitle((value) => value || preview.title);
      setArtist((value) => value || preview.artist);
      setThumbnailUrl(preview.thumbnailUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not preview YouTube link');
    } finally {
      setBusy(false);
    }
  }

  async function saveSong() {
    if (!title.trim() || !artist.trim() || !url.trim()) {
      setError('Title, artist and URL are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await api<{ song: WeeklySong }>(editingId ? `/songs/${editingId}` : '/songs', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
          url: url.trim(),
          thumbnailUrl: thumbnailUrl.trim(),
        }),
      });
      setCurrent(response.song);
      sortSongs([response.song, ...songs.filter((song) => song._id !== response.song._id)]);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save song');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(song: WeeklySong) {
    Alert.alert('Delete song?', `"${song.title}" will be removed from the list.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteSong(song) },
    ]);
  }

  async function deleteSong(song: WeeklySong) {
    const previous = songs;
    const next = songs.filter((item) => item._id !== song._id);
    sortSongs(next);
    setCurrent((value) => (value?._id === song._id ? next[0] ?? null : value));
    setError('');
    try {
      await api(`/songs/${song._id}`, { method: 'DELETE' });
    } catch (err) {
      sortSongs(previous);
      setError(err instanceof Error ? err.message : 'Could not delete song');
    }
  }

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((value) => !value)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>{'\u266b'}</Text>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Song of Us</Text>
          <Text style={styles.rowValue}>{headline}</Text>
        </View>
        <Text style={styles.badge}>{open ? 'Close' : current ? 'Active' : 'Open'}</Text>
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {editing ? (
            <View style={styles.form}>
              <TextInput autoCapitalize="none" editable={!busy} onChangeText={setUrl} placeholder="YouTube or song URL" placeholderTextColor="#9b8a93" style={styles.input} value={url} />
              <Pressable disabled={busy || !url.trim()} onPress={previewYoutube} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, (busy || !url.trim()) && styles.disabled]}>
                {busy ? <ActivityIndicator color="#e8607a" /> : <Text style={styles.secondaryText}>Preview YouTube</Text>}
              </Pressable>
              <TextInput editable={!busy} onChangeText={setTitle} placeholder="Song title" placeholderTextColor="#9b8a93" style={styles.input} value={title} />
              <TextInput editable={!busy} onChangeText={setArtist} placeholder="Artist" placeholderTextColor="#9b8a93" style={styles.input} value={artist} />
              <TextInput autoCapitalize="none" editable={!busy} onChangeText={setThumbnailUrl} placeholder="Thumbnail URL (optional)" placeholderTextColor="#9b8a93" style={styles.input} value={thumbnailUrl} />
              <View style={styles.actions}>
                <Pressable disabled={busy} onPress={resetForm} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
                <Pressable disabled={busy || !title.trim() || !artist.trim() || !url.trim()} onPress={saveSong} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (busy || !title.trim() || !artist.trim() || !url.trim()) && styles.disabled]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Pressable onPress={() => editSong(current)} style={styles.primaryButton}>
                <Text style={styles.primaryText}>{current ? 'Edit current song' : 'Add song'}</Text>
              </Pressable>
              {loading ? (
                <ActivityIndicator color="#e8607a" style={styles.loader} />
              ) : songs.length === 0 ? (
                <Text style={styles.empty}>No songs yet.</Text>
              ) : (
                songs.map((song) => (
                  <Pressable key={song._id} onPress={() => setCurrent(song)} style={({ pressed }) => [styles.songCard, current?._id === song._id && styles.activeSongCard, pressed && styles.pressed]}>
                    <View style={styles.songTop}>
                      {song.thumbnailUrl ? <Image source={{ uri: song.thumbnailUrl }} style={styles.thumb} /> : <View style={styles.thumbPlaceholder}><Text style={styles.thumbText}>{'\u266a'}</Text></View>}
                      <View style={styles.songMeta}>
                        <Text style={styles.songTitle}>{song.title}</Text>
                        <Text style={styles.songArtist}>{song.artist} - {weekLabel(song.weekStart)}</Text>
                        <Text style={styles.selectedBy}>{song.selectedBy.name} selected</Text>
                      </View>
                    </View>
                    <View style={styles.songActions}>
                      <Pressable onPress={() => void Linking.openURL(song.url)} style={styles.smallButton}>
                        <Text style={styles.smallButtonText}>Open link</Text>
                      </Pressable>
                      <Pressable onPress={() => editSong(song)} style={styles.smallButton}>
                        <Text style={styles.smallButtonText}>Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => confirmDelete(song)} style={styles.smallButton}>
                        <Text style={styles.deleteText}>Delete</Text>
                      </Pressable>
                    </View>
                  </Pressable>
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
  input: {
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
  songCard: {
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  activeSongCard: {
    backgroundColor: '#fdf6f0',
    borderColor: '#e8607a',
  },
  songTop: {
    flexDirection: 'row',
    gap: 10,
  },
  thumb: {
    backgroundColor: '#f9ede6',
    borderRadius: 10,
    height: 58,
    width: 82,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#f9ede6',
    borderRadius: 10,
    height: 58,
    justifyContent: 'center',
    width: 82,
  },
  thumbText: {
    color: '#e8607a',
    fontSize: 22,
    fontWeight: '900',
  },
  songMeta: {
    flex: 1,
  },
  songTitle: {
    color: '#2d1f2e',
    fontSize: 15,
    fontWeight: '900',
  },
  songArtist: {
    color: '#9b8a93',
    fontSize: 12,
    marginTop: 3,
  },
  selectedBy: {
    color: '#9b8a93',
    fontSize: 11,
    marginTop: 5,
  },
  songActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  smallButton: {
    backgroundColor: '#f9ede6',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  smallButtonText: {
    color: '#e8607a',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteText: {
    color: '#b9314f',
    fontSize: 12,
    fontWeight: '800',
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
