import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useCouple } from '../context/CoupleContext';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { Message } from '../types';

export function ChatScreen() {
  const { user } = useAuth();
  const { partner } = useCouple();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerReadAt, setPartnerReadAt] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api<{ messages: Message[] }>('/messages');
      setMessages(response.messages);
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

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    void getSocket()
      .then((socket) => {
        if (!mounted) return;
        const onMessage = (message: Message) => {
          setMessages((current) => (current.some((item) => item._id === message._id) ? current : [...current, message]));
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

  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

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
      setMessages((current) => (current.some((item) => item._id === response.message._id) ? current : [...current, response.message]));
      void getSocket().then((socket) => socket.emit('typing', false)).catch(() => {});
    } catch (err) {
      setText(value);
      setError(err instanceof Error ? err.message : 'Could not send message');
    } finally {
      setBusy(false);
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
  const partnerSawLast =
    Boolean(lastMine && partnerReadAt) &&
    new Date(partnerReadAt as string).getTime() >= new Date(lastMine?.createdAt ?? 0).getTime();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{partner?.avatar || partner?.name?.slice(0, 1).toUpperCase() || '?'}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{partner?.name ?? 'Chat'}</Text>
          <Text style={styles.subtitle}>Text chat migration</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#e8607a" />
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
                  <Text style={[styles.messageText, mine && !item.deleted && styles.mineText]}>
                    {item.deleted ? `${item.sender.name} deleted a message` : item.text}
                  </Text>
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

const styles = StyleSheet.create({
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
    paddingTop: 58,
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
