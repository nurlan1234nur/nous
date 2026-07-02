import { useCallback, useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api, apiUpload, assetUrl } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { Moment } from '../types';

function monthLabel(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

type MemoryItem = { type: 'header'; id: string; label: string } | { type: 'moment'; id: string; moment: Moment };

export function MemoriesScreen() {
  const { user } = useAuth();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');

  const loadMoments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api<{ moments: Moment[] }>('/moments');
      setMoments(response.moments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load memories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMoments();
  }, [loadMoments]);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    void getSocket()
      .then((socket) => {
        if (!mounted) return;
        const onNew = (moment: Moment) => {
          setMoments((current) => (current.some((item) => item._id === moment._id) ? current : [moment, ...current]));
        };
        const onDeleted = ({ id }: { id: string }) => {
          setMoments((current) => current.filter((item) => item._id !== id));
        };
        const onReact = (moment: Moment) => {
          setMoments((current) => current.map((item) => (item._id === moment._id ? moment : item)));
        };
        socket.on('moment:new', onNew);
        socket.on('moment:deleted', onDeleted);
        socket.on('moment:react', onReact);
        cleanup = () => {
          socket.off('moment:new', onNew);
          socket.off('moment:deleted', onDeleted);
          socket.off('moment:react', onReact);
        };
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Socket connection failed'));

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  const items = useMemo<MemoryItem[]>(() => {
    const result: MemoryItem[] = [];
    let currentMonth = '';
    for (const moment of moments) {
      const label = monthLabel(moment.createdAt);
      if (label !== currentMonth) {
        currentMonth = label;
        result.push({ type: 'header', id: `header:${label}`, label });
      }
      result.push({ type: 'moment', id: moment._id, moment });
    }
    return result;
  }, [moments]);

  async function react(moment: Moment, emoji: string) {
    try {
      const response = await api<{ moment: Moment }>(`/moments/${moment._id}/react`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
      setMoments((current) => current.map((item) => (item._id === response.moment._id ? response.moment : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not react');
    }
  }

  async function addMemory() {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo permission is required.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets[0]) return;

    const asset = picked.assets[0];
    const form = new FormData();
    form.append('caption', caption);
    form.append('image', {
      uri: asset.uri,
      name: asset.fileName ?? `memory-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    } as unknown as Blob);

    setUploading(true);
    try {
      const response = await apiUpload<{ moment: Moment }>('/moments', form);
      setMoments((current) => (current.some((item) => item._id === response.moment._id) ? current : [response.moment, ...current]));
      setCaption('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload memory');
    } finally {
      setUploading(false);
    }
  }

  function confirmDeleteMemory(moment: Moment) {
    Alert.alert('Delete memory?', 'This memory will be removed for both of you.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteMemory(moment) },
    ]);
  }

  async function deleteMemory(moment: Moment) {
    setError('');
    try {
      setMoments((current) => current.filter((item) => item._id !== moment._id));
      await api(`/moments/${moment._id}`, { method: 'DELETE' });
    } catch (err) {
      setMoments((current) => (current.some((item) => item._id === moment._id) ? current : [moment, ...current]));
      setError(err instanceof Error ? err.message : 'Could not delete memory');
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Memories</Text>
        <Text style={styles.subtitle}>{moments.length} photos</Text>
      </View>

      <View style={styles.addBox}>
        <TextInput
          editable={!uploading}
          onChangeText={setCaption}
          placeholder="Caption for the next memory..."
          placeholderTextColor="#9b8a93"
          style={styles.captionInput}
          value={caption}
        />
        <Pressable
          disabled={uploading}
          onPress={addMemory}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed, uploading && styles.disabled]}
        >
          {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.addButtonText}>Add memory</Text>}
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#e8607a" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No memories yet.</Text>}
          renderItem={({ item }) => {
            if (item.type === 'header') return <Text style={styles.month}>{item.label}</Text>;
            const moment = item.moment;
            const mine = moment.author._id === user?.id;
            const myReaction = (emoji: string) => moment.reactions.some((reaction) => reaction.user === user?.id && reaction.emoji === emoji);
            const count = (emoji: string) => moment.reactions.filter((reaction) => reaction.emoji === emoji).length;
            return (
              <View style={styles.card}>
                <View>
                  <Image source={{ uri: assetUrl(moment.imageUrl) }} style={styles.image} />
                  {mine ? (
                    <Pressable onPress={() => confirmDeleteMemory(moment)} style={styles.deleteMemoryButton}>
                      <Text style={styles.deleteMemoryText}>Delete</Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.meta}>
                  <View style={styles.authorRow}>
                    <Text style={styles.author}>{moment.author.name}</Text>
                    <Text style={styles.date}>{new Date(moment.createdAt).toLocaleDateString()}</Text>
                  </View>
                  {moment.caption ? <Text style={styles.caption}>{moment.caption}</Text> : null}
                  <View style={styles.reactions}>
                    {['\u2665', '\u263a', '\u25cc', '\u2726'].map((emoji) => (
                      <Pressable
                        key={emoji}
                        onPress={() => void react(moment, emoji)}
                        style={[styles.reactionButton, myReaction(emoji) && styles.myReaction]}
                      >
                        <Text style={styles.reactionText}>{emoji}{count(emoji) ? ` ${count(emoji)}` : ''}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            );
          }}
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
  error: {
    backgroundColor: '#f9ede6',
    color: '#b9314f',
    marginHorizontal: 24,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlign: 'center',
  },
  addBox: {
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 12,
    shadowColor: '#2d1f2e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  captionInput: {
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    color: '#2d1f2e',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: '#e8607a',
    borderRadius: 12,
    minHeight: 46,
    justifyContent: 'center',
  },
  addButtonText: {
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
    padding: 16,
    paddingBottom: 28,
  },
  empty: {
    color: '#9b8a93',
    paddingTop: 48,
    textAlign: 'center',
  },
  month: {
    color: '#9b8a93',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#2d1f2e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  image: {
    aspectRatio: 1,
    backgroundColor: '#f5c6ce',
    width: '100%',
  },
  deleteMemoryButton: {
    backgroundColor: 'rgba(59,47,47,0.72)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    right: 10,
    top: 10,
  },
  deleteMemoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  meta: {
    padding: 14,
  },
  authorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  author: {
    color: '#2d1f2e',
    fontSize: 15,
    fontWeight: '800',
  },
  date: {
    color: '#9b8a93',
    fontSize: 12,
  },
  caption: {
    color: '#2d1f2e',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  reactionButton: {
    backgroundColor: '#fdf6f0',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  myReaction: {
    backgroundColor: '#f9ede6',
  },
  reactionText: {
    fontSize: 14,
  },
});
