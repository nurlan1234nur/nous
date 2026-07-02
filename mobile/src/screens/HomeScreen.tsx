import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useCouple } from '../context/CoupleContext';
import { api, assetUrl } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { DailyQuestion, Moment, Mood } from '../types';

const moodOptions = [
  { emoji: '\u263a', text: 'Happy' },
  { emoji: '\u2665', text: 'Loved' },
  { emoji: '\u25cb', text: 'Calm' },
  { emoji: '\u2639', text: 'Low' },
];

function daysSince(date: string | null | undefined): number {
  if (!date) return 0;
  const start = new Date(date);
  if (Number.isNaN(start.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
}

export function HomeScreen() {
  const { user } = useAuth();
  const { couple, me, partner, loading: coupleLoading } = useCouple();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [daily, setDaily] = useState<DailyQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHome = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [momentResponse, moodResponse, dailyResponse] = await Promise.all([
        api<{ moments: Moment[] }>('/moments'),
        api<{ moods: Mood[] }>('/moods'),
        api<DailyQuestion>('/daily'),
      ]);
      setMoments(momentResponse.moments);
      setMoods(moodResponse.moods);
      setDaily(dailyResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load home');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  useEffect(() => {
    let active = true;
    void getSocket()
      .then((socket) => {
        if (!active) return;
        socket.on('moment:new', (moment: Moment) => setMoments((current) => (current.some((item) => item._id === moment._id) ? current : [moment, ...current])));
        socket.on('moment:react', (moment: Moment) => setMoments((current) => current.map((item) => (item._id === moment._id ? moment : item))));
        socket.on('moment:deleted', ({ id }: { id: string }) => setMoments((current) => current.filter((item) => item._id !== id)));
        socket.on('mood:new', (mood: Mood) => setMoods((current) => [mood, ...current]));
        socket.on('daily:answer', () => void api<DailyQuestion>('/daily').then(setDaily));
      })
      .catch(() => undefined);

    return () => {
      active = false;
      void getSocket()
        .then((socket) => {
          socket.off('moment:new');
          socket.off('moment:react');
          socket.off('moment:deleted');
          socket.off('mood:new');
          socket.off('daily:answer');
        })
        .catch(() => undefined);
    };
  }, []);

  const myMood = useMemo(() => moods.find((mood) => mood.user._id === me?._id), [me?._id, moods]);
  const partnerMood = useMemo(() => moods.find((mood) => mood.user._id === partner?._id), [partner?._id, moods]);
  const myAnswer = useMemo(() => daily?.answers.find((item) => item.user._id === me?._id), [daily?.answers, me?._id]);
  const partnerAnswer = useMemo(() => daily?.answers.find((item) => item.user._id === partner?._id), [daily?.answers, partner?._id]);
  const latestMoment = moments[0];

  async function submitAnswer() {
    const text = answer.trim();
    if (!text) return;
    setBusy(true);
    setError('');
    try {
      await api('/daily', { method: 'POST', body: JSON.stringify({ text }) });
      setAnswer('');
      setDaily(await api<DailyQuestion>('/daily'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save answer');
    } finally {
      setBusy(false);
    }
  }

  async function setMood(option: (typeof moodOptions)[number]) {
    setBusy(true);
    setError('');
    try {
      const response = await api<{ mood: Mood }>('/moods', {
        method: 'POST',
        body: JSON.stringify(option),
      });
      setMoods((current) => [response.mood, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save mood');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {me?.name ?? user?.name ?? 'You'} <Text style={styles.heart}>{'\u2665'}</Text> {partner?.name ?? 'Partner'}
          </Text>
          <View style={styles.daysPill}>
            <Text style={styles.daysPillText}>{daysSince(couple?.anniversary)} days together</Text>
          </View>
        </View>
        {coupleLoading ? <ActivityIndicator color="#e8607a" /> : null}
      </View>

      <View style={styles.statsRow}>
        <Stat value={moments.length} label="Memories" />
        <Stat value={user?.streak ?? 0} label="Streak" />
        <Stat value={couple?.inviteCode ?? '-'} label="Invite" selectable />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#e8607a" style={styles.sectionLoader} /> : null}

      <View style={styles.dailyCard}>
        <Text style={styles.dailyEyebrow}>Daily question</Text>
        <Text style={styles.dailyQuestion}>{daily?.question ? `"${daily.question}"` : 'No question loaded yet.'}</Text>
        <View style={styles.answerRow}>
          <AnswerBox dark name={me?.name ?? 'Me'} text={myAnswer?.text} />
          <AnswerBox dark name={partner?.name ?? 'Partner'} text={partnerAnswer?.text} />
        </View>
        {!myAnswer ? (
          <View style={styles.inputRow}>
            <TextInput
              editable={!busy}
              onChangeText={setAnswer}
              placeholder="Write your answer..."
              placeholderTextColor="#9b8a93"
              style={styles.dailyInput}
              value={answer}
            />
            <Pressable disabled={busy || !answer.trim()} onPress={submitAnswer} style={({ pressed }) => [styles.sendButton, pressed && styles.pressed, (busy || !answer.trim()) && styles.disabled]}>
              <Text style={styles.sendButtonText}>Send</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today mood</Text>
        <View style={styles.moodRow}>
          <MoodBox name={me?.name ?? 'Me'} mood={myMood} />
          <MoodBox name={partner?.name ?? 'Partner'} mood={partnerMood} />
        </View>
        <View style={styles.moodOptions}>
          {moodOptions.map((option) => (
            <Pressable disabled={busy} key={option.text} onPress={() => setMood(option)} style={({ pressed }) => [styles.moodOption, pressed && styles.pressed]}>
              <Text style={styles.moodEmoji}>{option.emoji}</Text>
              <Text style={styles.moodOptionText}>{option.text}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Latest memory</Text>
        {latestMoment ? (
          <View>
            <Image source={{ uri: assetUrl(latestMoment.imageUrl) }} style={styles.memoryImage} />
            <Text style={styles.memoryCaption}>{latestMoment.caption || 'No caption'}</Text>
          </View>
        ) : (
          <Text style={styles.empty}>No memories yet. Add one from Memories tab.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function Stat({ value, label, selectable }: { value: number | string; label: string; selectable?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text selectable={selectable} style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AnswerBox({ name, text, dark }: { name: string; text?: string; dark?: boolean }) {
  return (
    <View style={[styles.answerBox, dark && styles.darkAnswerBox]}>
      <Text style={[styles.answerName, dark && styles.darkAnswerName]}>{name}</Text>
      <Text style={[styles.answerText, dark && styles.darkAnswerText, !text && styles.muted]}>{text ?? 'Waiting...'}</Text>
    </View>
  );
}

function MoodBox({ name, mood }: { name: string; mood?: Mood }) {
  return (
    <View style={styles.moodBox}>
      <Text style={styles.answerName}>{name}</Text>
      <Text style={styles.currentMood}>{mood?.emoji ?? '--'}</Text>
      <Text style={[styles.answerText, !mood && styles.muted]}>{mood?.text ?? 'Not set'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#fdf6f0',
    flex: 1,
  },
  content: {
    padding: 18,
    paddingTop: 28,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  title: {
    color: '#2d1f2e',
    fontSize: 25,
    fontWeight: '800',
  },
  heart: {
    color: '#e8607a',
    fontSize: 18,
  },
  subtitle: {
    color: '#9b8a93',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  daysPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8607a',
    borderRadius: 999,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    shadowColor: '#e8607a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  daysPillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  stat: {
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minHeight: 72,
    justifyContent: 'center',
    padding: 10,
  },
  dailyCard: {
    backgroundColor: '#2d1f2e',
    borderRadius: 24,
    marginTop: 14,
    padding: 18,
    shadowColor: '#2d1f2e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 7,
  },
  dailyEyebrow: {
    color: '#f5c6ce',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  dailyQuestion: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: 9,
  },
  statValue: {
    color: '#2d1f2e',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  statLabel: {
    color: '#9b8a93',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  error: {
    backgroundColor: '#f9ede6',
    color: '#b9314f',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlign: 'center',
  },
  sectionLoader: {
    marginTop: 18,
  },
  card: {
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  cardTitle: {
    color: '#2d1f2e',
    fontSize: 16,
    fontWeight: '900',
  },
  question: {
    color: '#2d1f2e',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 8,
  },
  answerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  answerBox: {
    backgroundColor: '#fdf6f0',
    borderRadius: 12,
    flex: 1,
    padding: 12,
  },
  darkAnswerBox: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
  },
  answerName: {
    color: '#9b8a93',
    fontSize: 12,
    fontWeight: '800',
  },
  darkAnswerName: {
    color: '#f5c6ce',
  },
  answerText: {
    color: '#2d1f2e',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
  },
  darkAnswerText: {
    color: '#fff',
  },
  muted: {
    color: '#9b8a93',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  input: {
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    color: '#2d1f2e',
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 12,
  },
  dailyInput: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    borderWidth: 1,
    color: '#fff',
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 12,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#e8607a',
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.55,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  moodBox: {
    alignItems: 'center',
    backgroundColor: '#fdf6f0',
    borderRadius: 12,
    flex: 1,
    padding: 12,
  },
  currentMood: {
    color: '#2d1f2e',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 6,
  },
  moodOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  moodOption: {
    alignItems: 'center',
    backgroundColor: '#f9ede6',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  moodEmoji: {
    color: '#e8607a',
    fontSize: 13,
    fontWeight: '900',
  },
  moodOptionText: {
    color: '#e8607a',
    fontSize: 12,
    fontWeight: '800',
  },
  memoryImage: {
    backgroundColor: '#f9ede6',
    borderRadius: 12,
    height: 190,
    marginTop: 12,
    width: '100%',
  },
  memoryCaption: {
    color: '#2d1f2e',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  empty: {
    color: '#9b8a93',
    fontSize: 14,
    marginTop: 10,
  },
});
