import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, SectionList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { dayLabel, groupByMonth } from '../lib/format';
import type { DailyHistoryDay } from '../types';
import { themedStyles, colors } from '../theme';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Өдрийн асуултын түүх — сараар бүлэглэсэн жагсаалт (web-ийн DailyArchive-ийн native хувилбар).
export function DailyArchiveModal({ open, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [days, setDays] = useState<DailyHistoryDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    api<{ days: DailyHistoryDay[] }>('/daily/history')
      .then((r) => setDays(r.days))
      .catch((err) => setError(err instanceof Error ? err.message : 'Ачаалж чадсангүй'))
      .finally(() => setLoading(false));
  }, [open]);

  const sections = useMemo(
    () => groupByMonth(days).map((g) => ({ key: g.key, title: g.title, data: g.items })),
    [days],
  );

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={open}>
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View>
            <Text style={styles.title}>Бидний өдрүүд</Text>
            <Text style={styles.subtitle}>Өдрийн асуултын түүх</Text>
          </View>
          <Pressable accessibilityLabel="Хаах" onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <ActivityIndicator color={colors.rose} style={styles.loader} />
        ) : (
          <SectionList
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
            keyExtractor={(item) => item.date}
            ListEmptyComponent={<Text style={styles.empty}>Одоохондоо хариулсан асуулт алга.</Text>}
            renderItem={({ item }) => {
              const mine = item.answers.find((a) => a.user?._id === user?.id);
              const theirs = item.answers.find((a) => a.user?._id !== user?.id);
              return (
                <View style={styles.card}>
                  <Text style={styles.date}>{dayLabel(item.date)}</Text>
                  <Text style={styles.question}>{item.question}</Text>
                  <Answer name={mine?.user.name ?? user?.name ?? 'Би'} text={mine?.text} />
                  <Answer name={theirs?.user.name ?? 'Хамтрагч'} text={theirs?.text} />
                </View>
              );
            }}
            renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
            sections={sections}
            stickySectionHeadersEnabled={false}
          />
        )}
      </View>
    </Modal>
  );
}

function Answer({ name, text }: { name: string; text?: string }) {
  return (
    <View style={styles.answer}>
      <Text style={styles.answerName}>{name}</Text>
      <Text style={[styles.answerText, !text && styles.answerMissing]}>{text || 'Хариулаагүй'}</Text>
    </View>
  );
}

const styles = themedStyles({
  screen: { backgroundColor: '#fdf6f0', flex: 1 },
  header: {
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    borderBottomColor: '#f5c6ce',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: 20,
  },
  title: { color: '#2d1f2e', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#9b8a93', fontSize: 13, marginTop: 2 },
  close: { alignItems: 'center', backgroundColor: '#f9ede6', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  closeText: { color: '#e8607a', fontSize: 24, fontWeight: '700', lineHeight: 26 },
  loader: { marginTop: 40 },
  error: { color: '#b9314f', fontWeight: '700', margin: 16 },
  list: { padding: 16 },
  empty: { color: '#9b8a93', marginTop: 40, textAlign: 'center' },
  section: { color: '#9b8a93', fontSize: 12, fontWeight: '900', marginBottom: 8, marginTop: 12, textTransform: 'uppercase' },
  card: {
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
    padding: 16,
  },
  date: { color: '#e8607a', fontSize: 12, fontWeight: '800' },
  question: { color: '#2d1f2e', fontSize: 16, fontWeight: '700', lineHeight: 22 },
  answer: { backgroundColor: '#fdf6f0', borderRadius: 12, padding: 10 },
  answerName: { color: '#9b8a93', fontSize: 11, fontWeight: '800', marginBottom: 2 },
  answerText: { color: '#2d1f2e', fontSize: 14, lineHeight: 20 },
  answerMissing: { color: '#b8a8b0', fontStyle: 'italic' },
});
