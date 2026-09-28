import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useCouple } from '../context/CoupleContext';
import { api, apiUpload, assetUrl } from '../lib/api';
import { getSocket } from '../lib/socket';
import { partnerSawMessage, prependUnique, presenceLabel, upsertById } from '../lib/format';
import { imageFormData, pickImage } from '../lib/image';
import { useResync } from '../hooks/useResync';
import { AvatarView } from '../components/AvatarView';
import { SharedMediaModal } from '../components/SharedMediaModal';
import { PartnerProfileModal } from '../components/PartnerProfileModal';
import type { Message } from '../types';
import { themedStyles, colors } from '../theme';

export function ChatScreen() {
  const { user } = useAuth();
  const { partner, onlineIds, lastSeen } = useCouple();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerReadAt, setPartnerReadAt] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await api<{ messages: Message[]; hasMore?: boolean }>('/messages?limit=50');
      setMessages(response.messages);
      setHasMore(Boolean(response.hasMore));
      await api('/messages/read', { method: 'POST' }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  // Background-оос буцах / socket дахин холбогдоход алдсан зурвасуудыг татна.
  useResync(() => void loadMessages(true));

  async function loadOlder() {
    const oldest = messages[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const response = await api<{ messages: Message[]; hasMore?: boolean }>(
        `/messages?limit=50&before=${encodeURIComponent(oldest.createdAt)}`,
      );
      setMessages((current) => prependUnique(response.messages, current));
      setHasMore(Boolean(response.hasMore));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load messages');
    } finally {
      setLoadingOlder(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    void getSocket()
      .then((socket) => {
        if (!mounted) return;
        const onMessage = (message: Message) => {
          setMessages((current) => upsertById(current, message));
          if (message.sender._id !== user?.id) void api('/messages/read', { method: 'POST' }).catch(() => {});
        };
        const onUpdate = (message: Message) => {
          setMessages((current) => current.map((item) => (item._id === message._id ? message : item)));
        };
        const onCleared = () => setMessages([]);
        const onTyping = (typing: boolean) => setPartnerTyping(typing);
        const onRead = (payload: { userId: string; at: string }) => {
          if (payload.userId !== user?.id) setPartnerReadAt(payload.at);
        };

        socket.on('message:new', onMessage);
        socket.on('message:update', onUpdate);
        socket.on('messages:cleared', onCleared);
        socket.on('partner:typing', onTyping);
        socket.on('message:read', onRead);
        cleanup = () => {
          socket.off('message:new', onMessage);
          socket.off('message:update', onUpdate);
          socket.off('messages:cleared', onCleared);
          socket.off('partner:typing', onTyping);
          socket.off('message:read', onRead);
        };
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Socket connection failed'));

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [user?.id]);

  // Шинэ зурвас ирэхэд л доош гүйлгэнэ (хуучныг ачаалахад биш).
  const lastId = messages[messages.length - 1]?._id;
  useEffect(() => {
    if (lastId) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [lastId]);

  async function send() {
    const value = text.trim();
    if (!value) return;
    setText('');
    setBusy(true);
    setError('');
    try {
      const response = await api<{ message: Message }>('/messages', {
        method: 'POST',
        body: JSON.stringify({ text: value }),
      });
      setMessages((current) => upsertById(current, response.message));
      void getSocket().then((socket) => socket.emit('typing', false)).catch(() => {});
    } catch (err) {
      setText(value);
      setError(err instanceof Error ? err.message : 'Could not send message');
    } finally {
      setBusy(false);
    }
  }

  async function sendImage() {
    setError('');
    try {
      const part = await pickImage('chat');
      if (!part) return;
      setBusy(true);
      const caption = text.trim();
      const response = await apiUpload<{ message: Message }>('/messages/image', imageFormData(part, caption ? { caption } : {}));
      if (caption) setText('');
      setMessages((current) => upsertById(current, response.message));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send image');
    } finally {
      setBusy(false);
    }
  }

  function openMenu() {
    Alert.alert('Чат', undefined, [
      { text: 'Хуваалцсан зургууд', onPress: () => setMediaOpen(true) },
      {
        text: 'Чат цэвэрлэх',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Чатыг бүхэлд нь цэвэрлэх үү?', 'Хоёулангийн бүх зурвас, зураг устна. Буцаах боломжгүй.', [
            { text: 'Болих', style: 'cancel' },
            { text: 'Цэвэрлэх', style: 'destructive', onPress: () => void clearChat() },
          ]),
      },
      { text: 'Болих', style: 'cancel' },
    ]);
  }

  async function clearChat() {
    setError('');
    try {
      await api('/messages', { method: 'DELETE' });
      setMessages([]);
      setHasMore(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear chat');
    }
  }

  async function unsend(messageId: string) {
    setConfirmDeleteId(null);
    setError('');
    try {
      const response = await api<{ message: Message }>(`/messages/${messageId}`, { method: 'DELETE' });
      setMessages((current) => current.map((item) => (item._id === response.message._id ? response.message : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete message');
    }
  }

  const myMessages = messages.filter((message) => message.sender._id === user?.id && !message.deleted);
  const lastMine = myMessages[myMessages.length - 1];
  const partnerSawLast = partnerSawMessage(partnerReadAt ?? partner?.lastReadAt, lastMine?.createdAt);
  const partnerOnline = Boolean(partner && onlineIds.includes(partner._id));
  const partnerStatus = partner
    ? presenceLabel(partnerOnline, lastSeen[partner._id] ?? partner.lastSeenAt)
    : 'Хамтрагч хараахан нэгдээгүй';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Хамтрагчийн профайл"
          disabled={!partner}
          onPress={() => setProfileOpen(true)}
          style={styles.headerProfile}
        >
          <View style={styles.avatar}>
            <AvatarView avatar={partner?.avatar} name={partner?.name} size={44} textStyle={styles.avatarText} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>{partner?.name ?? 'Chat'}</Text>
            <Text style={[styles.subtitle, partnerOnline && styles.onlineText]}>{partnerStatus}</Text>
          </View>
        </Pressable>
        <Pressable accessibilityLabel="Чатын цэс" hitSlop={8} onPress={openMenu} style={styles.menuButton}>
          <Text style={styles.menuText}>⋯</Text>
        </Pressable>
      </View>
      <PartnerProfileModal onClose={() => setProfileOpen(false)} open={profileOpen} />
      <SharedMediaModal onClose={() => setMediaOpen(false)} open={mediaOpen} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.rose} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={messages}
          ListFooterComponent={
            partnerTyping ? (
              <View style={styles.typingRow}>
                <View style={styles.typingBubble}>
                  <Text style={styles.typingText}>{partner?.name ?? 'Partner'} is typing...</Text>
                </View>
              </View>
            ) : null
          }
          ListHeaderComponent={
            hasMore ? (
              <Pressable disabled={loadingOlder} onPress={() => void loadOlder()} style={styles.olderButton}>
                {loadingOlder ? (
                  <ActivityIndicator color={colors.rose} />
                ) : (
                  <Text style={styles.olderText}>Өмнөх зурвасууд</Text>
                )}
              </Pressable>
            ) : null
          }
          keyExtractor={(item) => item._id}
          ref={listRef}
          renderItem={({ item }) => {
            const mine = item.sender._id === user?.id;
            const seen = mine && item._id === lastMine?._id && partnerSawLast;
            return (
              <View style={[styles.messageRow, mine ? styles.mineRow : styles.partnerRow]}>
                <Pressable
                  disabled={!mine || item.deleted}
                  onPress={() => setConfirmDeleteId((current) => (current === item._id ? null : item._id))}
                  style={[styles.bubble, mine ? styles.mineBubble : styles.partnerBubble, item.deleted && styles.deletedBubble]}
                >
                  {!item.deleted && item.imageUrl ? (
                    <Image
                      accessibilityLabel="Зураг"
                      resizeMode="cover"
                      source={{ uri: assetUrl(item.imageUrl) }}
                      style={styles.messageImage}
                    />
                  ) : null}
                  {item.deleted || item.text ? (
                    <Text style={[styles.messageText, mine && !item.deleted && styles.mineText]}>
                      {item.deleted ? `${item.sender.name} deleted a message` : item.text}
                    </Text>
                  ) : null}
                </Pressable>
                {confirmDeleteId === item._id && mine && !item.deleted ? (
                  <View style={styles.deleteConfirm}>
                    <Pressable onPress={() => void unsend(item._id)} style={styles.deleteButton}>
                      <Text style={styles.deleteButtonText}>Unsend?</Text>
                    </Pressable>
                    <Pressable onPress={() => setConfirmDeleteId(null)} style={styles.cancelDeleteButton}>
                      <Text style={styles.cancelDeleteText}>Cancel</Text>
                    </Pressable>
                  </View>
                ) : null}
                {seen ? <Text style={styles.seenText}>Seen</Text> : null}
              </View>
            );
          }}
        />
      )}

      <View style={styles.composer}>
        <Pressable
          accessibilityLabel="Зураг илгээх"
          disabled={busy}
          onPress={() => void sendImage()}
          style={({ pressed }) => [styles.attachButton, pressed && styles.pressed, busy && styles.disabled]}
        >
          <Text style={styles.attachText}>+</Text>
        </Pressable>
        <TextInput
          editable={!busy}
          onBlur={() => void getSocket().then((socket) => socket.emit('typing', false)).catch(() => {})}
          onChangeText={(value) => {
            setText(value);
            void getSocket().then((socket) => socket.emit('typing', value.length > 0)).catch(() => {});
          }}
          onSubmitEditing={send}
          placeholder="Message..."
          placeholderTextColor="#9b8a93"
          returnKeyType="send"
          style={styles.input}
          value={text}
        />
        <Pressable
          disabled={busy || !text.trim()}
          onPress={send}
          style={({ pressed }) => [
            styles.sendButton,
            pressed && styles.pressed,
            (busy || !text.trim()) && styles.disabled,
          ]}
        >
          <Text style={styles.sendText}>{busy ? '...' : '\u2192'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = themedStyles({
  headerProfile: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  menuButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  menuText: {
    color: '#e8607a',
    fontSize: 24,
    fontWeight: '900',
  },
  onlineText: {
    color: '#3a9d6a',
  },
  olderButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  olderText: {
    color: '#e8607a',
    fontSize: 13,
    fontWeight: '800',
  },
  messageImage: {
    borderRadius: 14,
    height: 220,
    marginBottom: 4,
    width: 220,
  },
  attachButton: {
    alignItems: 'center',
    backgroundColor: '#f9ede6',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  attachText: {
    color: '#e8607a',
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 28,
  },
  screen: {
    backgroundColor: '#fdf6f0',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    borderBottomColor: '#f5c6ce',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 14,
    shadowColor: '#2d1f2e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#f9ede6',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: {
    color: '#e8607a',
    fontSize: 20,
    fontWeight: '800',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#2d1f2e',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9b8a93',
    fontSize: 12,
    marginTop: 2,
  },
  error: {
    backgroundColor: '#f9ede6',
    color: '#b9314f',
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlign: 'center',
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: 14,
  },
  messageRow: {
    alignItems: 'flex-end',
    marginVertical: 3,
  },
  mineRow: {
    justifyContent: 'flex-end',
  },
  partnerRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    maxWidth: '82%',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  mineBubble: {
    backgroundColor: '#e8607a',
    borderBottomRightRadius: 5,
  },
  partnerBubble: {
    backgroundColor: '#fff8f5',
    borderBottomLeftRadius: 5,
    borderColor: '#f5c6ce',
    borderWidth: 1,
  },
  deletedBubble: {
    backgroundColor: 'transparent',
    borderColor: '#f5c6ce',
    borderWidth: 1,
  },
  messageText: {
    color: '#2d1f2e',
    fontSize: 15,
    lineHeight: 20,
  },
  seenText: {
    color: '#e8607a',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
    paddingHorizontal: 4,
  },
  deleteConfirm: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 5,
  },
  deleteButton: {
    backgroundColor: '#e8607a',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  cancelDeleteButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  cancelDeleteText: {
    color: '#9b8a93',
    fontSize: 12,
    fontWeight: '700',
  },
  typingRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 6,
  },
  typingBubble: {
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  typingText: {
    color: '#9b8a93',
    fontSize: 13,
    fontStyle: 'italic',
  },
  mineText: {
    color: '#fff',
  },
  composer: {
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    borderTopColor: '#f5c6ce',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 10,
  },
  input: {
    backgroundColor: '#fdf6f0',
    borderColor: '#f5c6ce',
    borderRadius: 22,
    borderWidth: 1,
    color: '#2d1f2e',
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#e8607a',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sendText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.55,
  },
});
