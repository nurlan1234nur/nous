import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCouple } from '../context/CoupleContext';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { WhoIsMoreQuestion, WhoIsMoreQuiz, WhoIsMoreQuizSummary } from '../types';

type Mode = 'list' | 'editor' | 'detail';
type DraftQuestion = { text: string; options: string[]; correctIndex: number };

function emptyQuestion(): DraftQuestion {
  return { text: '', options: ['', ''], correctIndex: 0 };
}

function optionText(question: WhoIsMoreQuestion, id: string | null): string {
  return question.options.find((option) => option.id === id)?.text ?? '-';
}

export function WhoIsMoreSection() {
  const { partner } = useCouple();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('list');
  const [quizzes, setQuizzes] = useState<WhoIsMoreQuizSummary[]>([]);
  const [quiz, setQuiz] = useState<WhoIsMoreQuiz | null>(null);
  const [title, setTitle] = useState('Бид хоёрын тест');
  const [drafts, setDrafts] = useState<DraftQuestion[]>([emptyQuestion(), emptyQuestion()]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api<{ quizzes: WhoIsMoreQuizSummary[] }>('/games');
      setQuizzes(response.quizzes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Тестүүдийг уншихад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadQuiz = useCallback(async (id: string) => {
    setError('');
    try {
      const response = await api<{ quiz: WhoIsMoreQuiz }>(`/games/quiz/${id}`);
      setQuiz(response.quiz);
      return response.quiz;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Тестийг нээж чадсангүй');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setMode('list');
    setQuiz(null);
    void loadList();
  }, [loadList, open]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    let cleanup: (() => void) | undefined;
    void getSocket()
      .then((socket) => {
        if (!mounted) return;
        const changed = () => {
          void loadList();
          if (quiz) void loadQuiz(quiz.id);
        };
        socket.on('game:changed', changed);
        cleanup = () => socket.off('game:changed', changed);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Socket connection failed'));
    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [loadList, loadQuiz, open, quiz]);

  const activeQuestion = quiz?.questions[quiz.answeredCount];
  const progress = useMemo(() => {
    if (!quiz?.questionCount) return 0;
    return Math.min(100, Math.round((quiz.answeredCount / quiz.questionCount) * 100));
  }, [quiz?.answeredCount, quiz?.questionCount]);

  function closeGame() {
    Alert.alert('Тоглоомоос гарах уу?', 'Тестүүд болон бөглөсөн явц хадгалагдана.', [
      { text: 'Үгүй', style: 'cancel' },
      { text: 'Гарах', style: 'destructive', onPress: () => setOpen(false) },
    ]);
  }

  function startNewQuiz() {
    setTitle('Бид хоёрын тест');
    setDrafts([emptyQuestion(), emptyQuestion()]);
    setQuiz(null);
    setError('');
    setMode('editor');
  }

  function updateDraft(index: number, patch: Partial<DraftQuestion>) {
    setDrafts((current) => current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...patch } : draft)));
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    const options = [...drafts[questionIndex].options];
    options[optionIndex] = value;
    updateDraft(questionIndex, { options });
  }

  async function openQuiz(id: string) {
    const selected = await loadQuiz(id);
    if (selected) setMode('detail');
  }

  async function saveQuiz() {
    if (!title.trim() || drafts.some((draft) => !draft.text.trim() || draft.options.some((option) => !option.trim()))) {
      setError('Тестийн нэр, асуулт болон бүх хариултыг бөглөнө үү');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await api<{ quiz: WhoIsMoreQuiz }>('/games/quiz', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), questions: drafts }),
      });
      setQuiz(response.quiz);
      setMode('detail');
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Тестийг хадгалж чадсангүй');
    } finally {
      setBusy(false);
    }
  }

  async function answer(questionId: string, optionId: string) {
    if (!quiz) return;
    setBusy(true);
    setError('');
    try {
      const response = await api<{ quiz: WhoIsMoreQuiz }>(`/games/quiz/${quiz.id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ questionId, optionId }),
      });
      setQuiz(response.quiz);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Хариулт хадгалахад алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuiz() {
    if (!quiz) return;
    Alert.alert('Тест устгах уу?', quiz.title, [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Устгах',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setError('');
          try {
            await api(`/games/quiz/${quiz.id}`, { method: 'DELETE' });
            setQuiz(null);
            setMode('list');
            await loadList();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Тестийг устгаж чадсангүй');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.entryRow, pressed && styles.pressed]}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>?</Text>
        </View>
        <View style={styles.entryText}>
          <Text style={styles.entryLabel}>Хэн нь илүү?</Text>
          <Text style={styles.entryValue}>Тест үүсгээд partner-аараа бөглүүлэх</Text>
        </View>
        <Text style={styles.badge}>Play</Text>
      </Pressable>

      <Modal animationType="slide" onRequestClose={closeGame} visible={open}>
        <View style={styles.screen}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Хэн нь илүү?</Text>
              <Text style={styles.subtitle}>Тест үүсгээд partner-аараа бөглүүлэх</Text>
            </View>
            <Pressable onPress={closeGame} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {mode === 'list' ? (
              <>
                <View style={styles.toolbar}>
                  <View style={styles.toolbarText}>
                    <Text style={styles.cardTitle}>Тестүүд</Text>
                    <Text style={styles.cardSub}>Нийт {quizzes.length} тест</Text>
                  </View>
                  <Pressable onPress={startNewQuiz} style={styles.primarySmall}>
                    <Text style={styles.primarySmallText}>+ Шинэ</Text>
                  </Pressable>
                </View>
                {loading ? (
                  <ActivityIndicator color="#e8607a" style={styles.loading} />
                ) : quizzes.length === 0 ? (
                  <Text style={styles.empty}>Одоогоор тест алга.</Text>
                ) : (
                  quizzes.map((item) => (
                    <Pressable key={item.id} onPress={() => void openQuiz(item.id)} style={styles.quizRow}>
                      <View style={styles.quizText}>
                        <Text numberOfLines={1} style={styles.quizTitle}>{item.title}</Text>
                        <Text style={styles.quizMeta}>
                          {item.questionCount} асуулт - {item.role === 'creator' ? 'Миний үүсгэсэн' : `${partner?.name ?? 'Partner'} үүсгэсэн`} - {item.status === 'completed' ? `${item.score}/${item.questionCount}` : `${item.answeredCount}/${item.questionCount}`}
                        </Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                  ))
                )}
              </>
            ) : mode === 'editor' ? (
              <>
                <Pressable onPress={() => setMode('list')} style={styles.backButton}>
                  <Text style={styles.backText}>‹ Тестүүд</Text>
                </Pressable>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Тестийн нэр</Text>
                  <TextInput onChangeText={setTitle} placeholder="Тестийн нэр" placeholderTextColor="#9b8a93" style={styles.input} value={title} />
                </View>
                {drafts.map((draft, questionIndex) => (
                  <View key={questionIndex} style={styles.card}>
                    <Text style={styles.cardTitle}>Асуулт {questionIndex + 1}</Text>
                    <TextInput
                      maxLength={160}
                      multiline
                      onChangeText={(value) => updateDraft(questionIndex, { text: value })}
                      placeholder="Асуултаа бичнэ үү"
                      placeholderTextColor="#9b8a93"
                      style={[styles.input, styles.questionInput]}
                      value={draft.text}
                    />
                    {draft.options.map((option, optionIndex) => (
                      <View key={optionIndex} style={styles.optionEditRow}>
                        <Pressable onPress={() => updateDraft(questionIndex, { correctIndex: optionIndex })} style={[styles.correctButton, draft.correctIndex === optionIndex && styles.correctActive]}>
                          <Text style={[styles.correctText, draft.correctIndex === optionIndex && styles.correctActiveText]}>{draft.correctIndex === optionIndex ? '✓' : optionIndex + 1}</Text>
                        </Pressable>
                        <TextInput
                          maxLength={80}
                          onChangeText={(value) => updateOption(questionIndex, optionIndex, value)}
                          placeholder={`Хариулт ${optionIndex + 1}`}
                          placeholderTextColor="#9b8a93"
                          style={[styles.input, styles.optionInput]}
                          value={option}
                        />
                      </View>
                    ))}
                  </View>
                ))}
                {drafts.length < 10 ? (
                  <Pressable onPress={() => setDrafts((current) => [...current, emptyQuestion()])} style={styles.secondaryButton}>
                    <Text style={styles.secondaryText}>+ Асуулт нэмэх</Text>
                  </Pressable>
                ) : null}
                <Pressable disabled={busy} onPress={saveQuiz} style={[styles.primaryButton, busy && styles.disabled]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Тест үүсгэх</Text>}
                </Pressable>
              </>
            ) : quiz ? (
              <>
                <Pressable onPress={() => setMode('list')} style={styles.backButton}>
                  <Text style={styles.backText}>‹ Тестүүд</Text>
                </Pressable>
                {quiz.status !== 'completed' && quiz.role === 'creator' ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{quiz.title}</Text>
                    <Text style={styles.cardSub}>{partner?.name ?? 'Partner'} хариулахыг хүлээж байна.</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progress}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{quiz.answeredCount}/{quiz.questionCount} асуулт</Text>
                    {quiz.canEdit ? (
                      <Pressable disabled={busy} onPress={deleteQuiz} style={styles.secondaryButton}>
                        <Text style={styles.secondaryText}>Тест устгах</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : quiz.status !== 'completed' && activeQuestion ? (
                  <>
                    <View style={styles.progressHead}>
                      <Text style={styles.progressLabel}>{quiz.title}</Text>
                      <Text style={styles.progressLabel}>{quiz.answeredCount + 1}/{quiz.questionCount}</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progress}%` }]} />
                    </View>
                    <Text style={styles.questionCard}>{activeQuestion.text}</Text>
                    {activeQuestion.options.map((option, index) => (
                      <Pressable disabled={busy} key={option.id} onPress={() => void answer(activeQuestion.id, option.id)} style={[styles.answerButton, busy && styles.disabled]}>
                        <Text style={styles.answerIndex}>{index + 1}</Text>
                        <Text style={styles.answerText}>{option.text}</Text>
                        <Text style={styles.chevron}>›</Text>
                      </Pressable>
                    ))}
                  </>
                ) : (
                  <>
                    <View style={styles.resultCard}>
                      <Text style={styles.resultTitle}>{quiz.title}</Text>
                      <Text style={styles.resultScore}>{quiz.score}/{quiz.questionCount}</Text>
                      <Text style={styles.resultSub}>зөв хариулт</Text>
                    </View>
                    {quiz.questions.map((question) => (
                      <View key={question.id} style={styles.resultRow}>
                        <Text style={styles.resultMark}>{question.correct ? '✓' : '×'}</Text>
                        <View style={styles.resultText}>
                          <Text style={styles.resultQuestion}>{question.text}</Text>
                          <Text style={styles.resultMeta}>Хариулсан: {optionText(question, question.selectedOptionId)}</Text>
                          {!question.correct ? <Text style={styles.correctAnswer}>Зөв: {optionText(question, question.correctOptionId)}</Text> : null}
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  entryRow: {
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
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
  entryText: {
    flex: 1,
  },
  entryLabel: {
    color: '#2d1f2e',
    fontSize: 15,
    fontWeight: '800',
  },
  entryValue: {
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
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 58,
  },
  title: {
    color: '#2d1f2e',
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    color: '#9b8a93',
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#f9ede6',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  closeText: {
    color: '#2d1f2e',
    fontSize: 28,
    lineHeight: 30,
  },
  content: {
    padding: 16,
    paddingBottom: 34,
  },
  error: {
    backgroundColor: '#f9ede6',
    borderRadius: 12,
    color: '#b9314f',
    marginBottom: 12,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
  toolbar: {
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  toolbarText: {
    flex: 1,
  },
  cardTitle: {
    color: '#2d1f2e',
    fontSize: 15,
    fontWeight: '900',
  },
  cardSub: {
    color: '#9b8a93',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  primarySmall: {
    backgroundColor: '#e8607a',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primarySmallText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  loading: {
    marginTop: 36,
  },
  empty: {
    backgroundColor: '#fff8f5',
    borderRadius: 18,
    color: '#9b8a93',
    marginTop: 14,
    overflow: 'hidden',
    padding: 22,
    textAlign: 'center',
  },
  quizRow: {
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    padding: 14,
  },
  quizText: {
    flex: 1,
  },
  quizTitle: {
    color: '#2d1f2e',
    fontSize: 15,
    fontWeight: '900',
  },
  quizMeta: {
    color: '#9b8a93',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  chevron: {
    color: '#9b8a93',
    fontSize: 26,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingVertical: 4,
  },
  backText: {
    color: '#9b8a93',
    fontSize: 13,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
    padding: 14,
  },
  input: {
    backgroundColor: '#fdf6f0',
    borderColor: '#f5c6ce',
    borderRadius: 14,
    borderWidth: 1,
    color: '#2d1f2e',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  questionInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  optionEditRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  correctButton: {
    alignItems: 'center',
    borderColor: '#f5c6ce',
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  correctActive: {
    backgroundColor: '#e8607a',
    borderColor: '#e8607a',
  },
  correctText: {
    color: '#9b8a93',
    fontWeight: '900',
  },
  correctActiveText: {
    color: '#fff',
  },
  optionInput: {
    flex: 1,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#e8607a',
    borderRadius: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#e8607a',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#e8607a',
    fontSize: 15,
    fontWeight: '900',
  },
  progressTrack: {
    backgroundColor: '#f9ede6',
    borderRadius: 999,
    height: 8,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#e8607a',
    borderRadius: 999,
    height: '100%',
  },
  progressText: {
    color: '#9b8a93',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    color: '#9b8a93',
    fontSize: 12,
    fontWeight: '800',
  },
  questionCard: {
    backgroundColor: '#2d1f2e',
    borderRadius: 22,
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 26,
    marginVertical: 16,
    overflow: 'hidden',
    padding: 22,
    textAlign: 'center',
  },
  answerButton: {
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    padding: 14,
  },
  answerIndex: {
    backgroundColor: '#f9ede6',
    borderRadius: 14,
    color: '#e8607a',
    fontSize: 13,
    fontWeight: '900',
    height: 28,
    lineHeight: 28,
    overflow: 'hidden',
    textAlign: 'center',
    width: 28,
  },
  answerText: {
    color: '#2d1f2e',
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  resultCard: {
    alignItems: 'center',
    backgroundColor: '#2d1f2e',
    borderRadius: 22,
    marginBottom: 16,
    padding: 22,
  },
  resultTitle: {
    color: '#f5c6ce',
    fontSize: 13,
    fontWeight: '800',
  },
  resultScore: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '900',
    marginTop: 4,
  },
  resultSub: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.82,
  },
  resultRow: {
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    padding: 14,
  },
  resultMark: {
    color: '#e8607a',
    fontSize: 20,
    fontWeight: '900',
    width: 22,
  },
  resultText: {
    flex: 1,
  },
  resultQuestion: {
    color: '#2d1f2e',
    fontSize: 14,
    fontWeight: '900',
  },
  resultMeta: {
    color: '#9b8a93',
    fontSize: 12,
    marginTop: 6,
  },
  correctAnswer: {
    color: '#2f7a45',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.8,
  },
});
