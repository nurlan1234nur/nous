import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useCouple } from '../context/CoupleContext';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { NumberGuessAttempt, NumberGuessGame } from '../types';

function cleanCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}

export function NumberGuessSection() {
  const { user } = useAuth();
  const { partner } = useCouple();
  const [open, setOpen] = useState(false);
  const [game, setGame] = useState<NumberGuessGame | null>(null);
  const [secret, setSecret] = useState('');
  const [guess, setGuess] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadGame = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api<{ game: NumberGuessGame }>('/number-guess');
      setGame(response.game);
      setSecret(response.game.me.secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Тоглоом уншихад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadGame();
  }, [loadGame, open]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    let cleanup: (() => void) | undefined;
    void getSocket()
      .then((socket) => {
        if (!mounted) return;
        const changed = () => void loadGame();
        socket.on('number-guess:changed', changed);
        cleanup = () => socket.off('number-guess:changed', changed);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Socket connection failed'));
    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [loadGame, open]);

  const myTurn = game?.turnUserId === user?.id;
  const requestedByMe = Boolean(user?.id && game?.resetApprovals.includes(user.id));
  const requestedByPartner = Boolean(partner?._id && game?.resetApprovals.includes(partner._id));
  const myAttempts = useMemo(
    () => game?.attempts.filter((attempt) => attempt.userId === user?.id).slice().reverse() ?? [],
    [game?.attempts, user?.id],
  );
  const partnerAttempts = useMemo(
    () => game?.attempts.filter((attempt) => attempt.userId !== user?.id).slice().reverse() ?? [],
    [game?.attempts, user?.id],
  );
  const winnerName = game?.winnerUserId === user?.id ? 'Та' : partner?.name ?? 'Partner';

  function closeGame() {
    Alert.alert('Тоглоомоос гарах уу?', 'Явц хадгалагдана. Дараа нь буцаад үргэлжлүүлж болно.', [
      { text: 'Үгүй', style: 'cancel' },
      { text: 'Гарах', style: 'destructive', onPress: () => setOpen(false) },
    ]);
  }

  async function saveSecret() {
    if (secret.length !== 4) {
      setError('4 оронтой тоо оруулна уу');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await api<{ game: NumberGuessGame }>('/number-guess/secret', {
        method: 'POST',
        body: JSON.stringify({ code: secret }),
      });
      setGame(response.game);
      setSecret(response.game.me.secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Нууц тоо хадгалж чадсангүй');
    } finally {
      setBusy(false);
    }
  }

  async function submitGuess() {
    if (guess.length !== 4) {
      setError('4 оронтой таамаг оруулна уу');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await api<{ game: NumberGuessGame }>('/number-guess/guess', {
        method: 'POST',
        body: JSON.stringify({ code: guess }),
      });
      setGame(response.game);
      setGuess('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Таамаг илгээж чадсангүй');
    } finally {
      setBusy(false);
    }
  }

  async function requestReset() {
    setBusy(true);
    setError('');
    try {
      const response = await api<{ game: NumberGuessGame }>('/number-guess/reset-request', { method: 'POST' });
      setGame(response.game);
      if (response.game.status === 'setup') {
        setSecret('');
        setGuess('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Шинэ тоглоом хүсэж чадсангүй');
    } finally {
      setBusy(false);
    }
  }

  async function cancelReset() {
    setBusy(true);
    setError('');
    try {
      const response = await api<{ game: NumberGuessGame }>('/number-guess/reset-cancel', { method: 'POST' });
      setGame(response.game);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Хүсэлт цуцалж чадсангүй');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.entryRow, pressed && styles.pressed]}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>#</Text>
        </View>
        <View style={styles.entryText}>
          <Text style={styles.entryLabel}>Тоо олох</Text>
          <Text style={styles.entryValue}>4 оронтой нууц тоог alpha/betta-р таах</Text>
        </View>
        <Text style={styles.badge}>Play</Text>
      </Pressable>

      <Modal animationType="slide" onRequestClose={closeGame} visible={open}>
        <View style={styles.screen}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Тоо олох</Text>
              <Text style={styles.subtitle}>Alpha / Betta - 4 alpha бол ялна</Text>
            </View>
            <Pressable onPress={closeGame} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <FlatList
            contentContainerStyle={styles.content}
            data={[{ id: 'content' }]}
            keyExtractor={(item) => item.id}
            renderItem={() => (
              <>
                <View style={styles.toolbar}>
                  <View style={styles.toolbarText}>
                    <Text style={styles.cardTitle}>Alpha / Betta</Text>
                    <Text style={styles.cardSub}>Зөв байрлал alpha, буруу байрлал betta.</Text>
                  </View>
                  <View style={styles.toolActions}>
                    {game && game.status !== 'setup' ? (
                      <Pressable disabled={busy} onPress={requestedByMe ? cancelReset : requestReset} style={[styles.resetButton, busy && styles.disabled]}>
                        <Text style={styles.resetText}>{requestedByMe ? 'Цуцлах' : 'Шинэ'}</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => setRulesOpen((value) => !value)} style={styles.smallButton}>
                      <Text style={styles.smallButtonText}>!</Text>
                    </Pressable>
                  </View>
                </View>

                {rulesOpen ? (
                  <Text style={styles.rules}>
                    Хоёулаа 4 оронтой нууц тоо оруулна. Зөв цифр + зөв байрлал бол alpha, зөв цифр + буруу байрлал бол betta. 4 alpha түрүүлж олсон нь хожно.
                  </Text>
                ) : null}

                {error ? <Text style={styles.error}>{error}</Text> : null}

                {loading || !game ? (
                  <View style={styles.loading}>
                    <ActivityIndicator color="#e8607a" />
                  </View>
                ) : game.status === 'setup' ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Таны нууц тоо</Text>
                    <TextInput
                      editable={!busy}
                      keyboardType="number-pad"
                      maxLength={4}
                      onChangeText={(value) => setSecret(cleanCode(value))}
                      placeholder="1234"
                      placeholderTextColor="#9b8a93"
                      style={styles.codeInput}
                      value={secret}
                    />
                    <Pressable disabled={busy || secret.length !== 4} onPress={saveSecret} style={[styles.primaryButton, (busy || secret.length !== 4) && styles.disabled]}>
                      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{game.me.ready ? 'Нууц тоо шинэчлэх' : 'Бэлэн болох'}</Text>}
                    </Pressable>
                    <View style={styles.readyRow}>
                      <Text style={styles.readyBox}>Та: {game.me.ready ? 'Бэлэн' : 'Хүлээгдэж байна'}</Text>
                      <Text style={styles.readyBox}>{partner?.name ?? 'Partner'}: {game.opponent.ready ? 'Бэлэн' : 'Хүлээгдэж байна'}</Text>
                    </View>
                  </View>
                ) : (
                  <>
                    {game.status === 'finished' ? (
                      <View style={styles.winnerCard}>
                        <Text style={styles.winnerTitle}>{winnerName} хожлоо</Text>
                        <Text style={styles.winnerSub}>Partner-ийн нууц тоо: {game.opponent.secret}</Text>
                      </View>
                    ) : (
                      <Text style={[styles.turnBanner, myTurn ? styles.myTurn : styles.partnerTurn]}>
                        {myTurn ? 'Таны ээлж' : `${partner?.name ?? 'Partner'} тааж байна`}
                      </Text>
                    )}

                    {game.status === 'playing' ? (
                      <View style={styles.card}>
                        <Text style={styles.cardTitle}>Таамаг</Text>
                        <TextInput
                          editable={!busy}
                          keyboardType="number-pad"
                          maxLength={4}
                          onChangeText={(value) => setGuess(cleanCode(value))}
                          placeholder="0000"
                          placeholderTextColor="#9b8a93"
                          style={styles.codeInput}
                          value={guess}
                        />
                        <Pressable disabled={busy || !myTurn || guess.length !== 4} onPress={submitGuess} style={[styles.primaryButton, (busy || !myTurn || guess.length !== 4) && styles.disabled]}>
                          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Таах</Text>}
                        </Pressable>
                      </View>
                    ) : null}

                    {(requestedByMe || requestedByPartner) && (
                      <View style={styles.resetCard}>
                        <Text style={styles.cardTitle}>Шинэ тоглоомын хүсэлт</Text>
                        <Text style={styles.cardSub}>
                          {requestedByMe && requestedByPartner
                            ? 'Хоёулаа зөвшөөрсөн тул тоглоом шинэчлэгдэж байна.'
                            : requestedByMe
                              ? `${partner?.name ?? 'Partner'} зөвшөөрөхийг хүлээж байна.`
                              : `${partner?.name ?? 'Partner'} шинэ тоглоом эхлүүлэх хүсэлт илгээсэн.`}
                        </Text>
                        {requestedByPartner && !requestedByMe ? (
                          <Pressable disabled={busy} onPress={requestReset} style={styles.primaryButton}>
                            <Text style={styles.primaryText}>Зөвшөөрөөд эхлэх</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    )}

                    <AttemptList attempts={myAttempts} empty="Та одоогоор таагаагүй байна" title="Миний таамгууд" />
                    <AttemptList attempts={partnerAttempts} empty="Partner одоогоор таагаагүй байна" title={`${partner?.name ?? 'Partner'}-ийн таамгууд`} />

                    <Pressable disabled={busy} onPress={requestedByMe ? cancelReset : requestReset} style={styles.secondaryButton}>
                      <Text style={styles.secondaryText}>{requestedByMe ? 'Хүсэлт цуцлах' : 'Шинэ тоглоом хүсэх'}</Text>
                    </Pressable>
                  </>
                )}
              </>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

function AttemptList({ attempts, empty, title }: { attempts: NumberGuessAttempt[]; empty: string; title: string }) {
  return (
    <View style={styles.attemptBlock}>
      <Text style={styles.attemptTitle}>{title}</Text>
      {attempts.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        attempts.map((attempt) => (
          <View key={attempt.id} style={styles.attemptRow}>
            <Text style={styles.attemptCode}>{attempt.guess}</Text>
            <Text style={styles.attemptScore}>{attempt.alpha} alpha - {attempt.betta} betta</Text>
          </View>
        ))
      )}
    </View>
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
  toolActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  resetButton: {
    alignItems: 'center',
    borderColor: '#e8607a',
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  resetText: {
    color: '#e8607a',
    fontSize: 13,
    fontWeight: '900',
  },
  smallButton: {
    alignItems: 'center',
    backgroundColor: '#f9ede6',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  smallButtonText: {
    color: '#e8607a',
    fontSize: 20,
    fontWeight: '900',
  },
  rules: {
    backgroundColor: '#f9ede6',
    borderRadius: 16,
    color: '#2d1f2e',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
    padding: 14,
  },
  error: {
    backgroundColor: '#f9ede6',
    borderRadius: 12,
    color: '#b9314f',
    marginTop: 12,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
  loading: {
    paddingVertical: 48,
  },
  card: {
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginTop: 14,
    padding: 14,
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
  codeInput: {
    backgroundColor: '#fdf6f0',
    borderColor: '#f5c6ce',
    borderRadius: 14,
    borderWidth: 1,
    color: '#2d1f2e',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlign: 'center',
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
  readyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  readyBox: {
    backgroundColor: '#fdf6f0',
    borderRadius: 12,
    color: '#2d1f2e',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    padding: 10,
    textAlign: 'center',
  },
  winnerCard: {
    alignItems: 'center',
    backgroundColor: '#2d1f2e',
    borderRadius: 22,
    marginTop: 14,
    padding: 22,
  },
  winnerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  winnerSub: {
    color: '#f5c6ce',
    fontSize: 12,
    marginTop: 6,
  },
  turnBanner: {
    borderRadius: 16,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 14,
    overflow: 'hidden',
    padding: 14,
    textAlign: 'center',
  },
  myTurn: {
    backgroundColor: '#e8607a',
    color: '#fff',
  },
  partnerTurn: {
    backgroundColor: '#f9ede6',
    color: '#2d1f2e',
  },
  resetCard: {
    backgroundColor: '#f9ede6',
    borderColor: '#f5c6ce',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    marginTop: 14,
    padding: 14,
  },
  attemptBlock: {
    marginTop: 16,
  },
  attemptTitle: {
    color: '#9b8a93',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  empty: {
    backgroundColor: '#fff8f5',
    borderRadius: 14,
    color: '#9b8a93',
    overflow: 'hidden',
    padding: 13,
    textAlign: 'center',
  },
  attemptRow: {
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    padding: 13,
  },
  attemptCode: {
    color: '#2d1f2e',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
  },
  attemptScore: {
    color: '#9b8a93',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#e8607a',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#e8607a',
    fontSize: 15,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.8,
  },
});
