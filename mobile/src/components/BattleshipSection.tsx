import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useCouple } from '../context/CoupleContext';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { BattleshipGame, BattleshipShot } from '../types';

type Cell = { x: number; y: number };
type Rotation = 0 | 90 | 180 | 270;

const cellKey = ({ x, y }: Cell) => `${x}:${y}`;
const BASE_PLANE: Cell[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
  { x: 1, y: 2 },
  { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 },
];

function planePreviewCells(rotation: Rotation): Cell[] {
  let cells = BASE_PLANE.map((cell) => ({ ...cell }));
  for (let angle = 0; angle < rotation; angle += 90) {
    cells = cells.map(({ x, y }) => ({ x: -y, y: x }));
    const minX = Math.min(...cells.map((cell) => cell.x));
    const minY = Math.min(...cells.map((cell) => cell.y));
    cells = cells.map(({ x, y }) => ({ x: x - minX, y: y - minY }));
  }
  return cells;
}

export function BattleshipSection() {
  const { user } = useAuth();
  const { partner } = useCouple();
  const [open, setOpen] = useState(false);
  const [game, setGame] = useState<BattleshipGame | null>(null);
  const [view, setView] = useState<'target' | 'mine'>('target');
  const [selected, setSelected] = useState<Cell | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadGame = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api<{ game: BattleshipGame }>('/battleship');
      setGame(response.game);
      if (response.game.me.plane) setRotation(response.game.me.plane.rotation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Тоглоомыг уншихад алдаа гарлаа');
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
        socket.on('battleship:changed', changed);
        cleanup = () => socket.off('battleship:changed', changed);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Socket connection failed'));
    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [loadGame, open]);

  async function post(path: string, body?: unknown) {
    setBusy(true);
    setError('');
    try {
      const response = await api<{ game: BattleshipGame }>(`/battleship${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      setGame(response.game);
      setSelected(null);
      return response.game;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Үйлдэл амжилтгүй боллоо');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function place(cell: Cell) {
    const width = rotation % 180 === 0 ? 3 : 4;
    const height = rotation % 180 === 0 ? 4 : 3;
    const x = Math.max(1, Math.min(11 - width, cell.x - Math.floor(width / 2)));
    const y = Math.max(1, Math.min(11 - height, cell.y - Math.floor(height / 2)));
    await post('/place', { x, y, rotation });
  }

  async function fire() {
    if (!selected) return;
    await post('/fire', selected);
  }

  function resetGame() {
    Alert.alert('Шинэ тоглоом эхлүүлэх үү?', 'Одоогийн байрлал болон буудалтууд цэвэрлэгдэнэ.', [
      { text: 'Үгүй', style: 'cancel' },
      { text: 'Эхлүүлэх', style: 'destructive', onPress: () => void post('/reset') },
    ]);
  }

  function closeGame() {
    Alert.alert('Тоглоомоос гарах уу?', 'Таны байрлал болон тоглолтын явц хадгалагдана.', [
      { text: 'Үгүй', style: 'cancel' },
      { text: 'Гарах', style: 'destructive', onPress: () => setOpen(false) },
    ]);
  }

  const myTurn = game?.status === 'playing' && game.turnUserId === user?.id;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.entryRow, pressed && styles.pressed]}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>^</Text>
        </View>
        <View style={styles.entryText}>
          <Text style={styles.entryLabel}>Онгоц буудах</Text>
          <Text style={styles.entryValue}>Дүрст онгоцоо байрлуулаад ээлжээр буудах</Text>
        </View>
        <Text style={styles.badge}>Play</Text>
      </Pressable>

      <Modal animationType="slide" onRequestClose={closeGame} visible={open}>
        <View style={styles.screen}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Онгоц буудах</Text>
              <Text style={styles.subtitle}>Толгойг нь оновол ялна</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable disabled={busy || loading || !game} onPress={resetGame} style={[styles.resetButton, (busy || loading || !game) && styles.disabled]}>
                <Text style={styles.resetText}>Шинэ</Text>
              </Pressable>
              <Pressable onPress={closeGame} style={styles.closeButton}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {loading || !game ? (
              <ActivityIndicator color="#e8607a" style={styles.loading} />
            ) : game.status === 'placement' ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Онгоцоо байрлуул</Text>
                  <Text style={styles.cardSub}>Талбай дээр дарж байрлуулаад, хэрэгтэй бол эргүүлнэ.</Text>
                  <PlanePreview rotation={rotation} />
                </View>
                <BattleBoard
                  interactive={!busy && !game.me.ready}
                  onSelect={(cell) => void place(cell)}
                  planeCells={game.me.plane?.cells}
                  shots={game.me.incomingShots}
                />
                <View style={styles.actionRow}>
                  <Pressable disabled={busy || game.me.ready} onPress={() => setRotation((current) => ((current + 90) % 360) as Rotation)} style={[styles.secondaryButton, (busy || game.me.ready) && styles.disabled]}>
                    <Text style={styles.secondaryText}>Эргүүлэх {rotation}°</Text>
                  </Pressable>
                  <Pressable disabled={busy || (!game.me.ready && !game.me.plane)} onPress={() => void post(game.me.ready ? '/unready' : '/ready')} style={[styles.primaryButton, (busy || (!game.me.ready && !game.me.plane)) && styles.disabled]}>
                    <Text style={styles.primaryText}>{game.me.ready ? 'Бэлэн цуцлах' : 'Бэлэн болох'}</Text>
                  </Pressable>
                </View>
                {game.me.ready ? <Text style={styles.waiting}>{game.opponent.ready ? 'Тоглоом эхэлж байна...' : `${partner?.name ?? 'Partner'}-ийг хүлээж байна...`}</Text> : null}
              </>
            ) : (
              <>
                <View style={styles.segment}>
                  <Pressable onPress={() => setView('target')} style={[styles.segmentButton, view === 'target' && styles.segmentActive]}>
                    <Text style={[styles.segmentText, view === 'target' && styles.segmentActiveText]}>Буудах</Text>
                  </Pressable>
                  <Pressable onPress={() => setView('mine')} style={[styles.segmentButton, view === 'mine' && styles.segmentActive]}>
                    <Text style={[styles.segmentText, view === 'mine' && styles.segmentActiveText]}>Миний талбай</Text>
                  </Pressable>
                </View>
                <Text style={styles.statusText}>
                  {game.status === 'finished'
                    ? game.winnerUserId === user?.id ? 'Та яллаа!' : `${partner?.name ?? 'Partner'} яллаа`
                    : myTurn ? 'Таны ээлж - буудах нүдээ сонгоно уу' : `${partner?.name ?? 'Partner'}-ийн ээлж`}
                </Text>
                {view === 'target' ? (
                  <BattleBoard interactive={myTurn && !busy} onSelect={setSelected} selected={selected} shots={game.opponent.shots} />
                ) : (
                  <BattleBoard planeCells={game.me.plane?.cells} shots={game.me.incomingShots} />
                )}
                {game.status === 'playing' && view === 'target' && selected ? (
                  <Pressable disabled={busy} onPress={fire} style={[styles.fireButton, busy && styles.disabled]}>
                    <Text style={styles.primaryText}>{selected.y}-р мөр, {selected.x}-р багана руу буудах</Text>
                  </Pressable>
                ) : null}
                {game.status === 'finished' ? (
                  <Pressable disabled={busy} onPress={() => void post('/reset')} style={[styles.fireButton, busy && styles.disabled]}>
                    <Text style={styles.primaryText}>Дахин тоглох</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function PlanePreview({ rotation }: { rotation: Rotation }) {
  const cells = planePreviewCells(rotation);
  const width = Math.max(...cells.map((cell) => cell.x)) + 1;
  const height = Math.max(...cells.map((cell) => cell.y)) + 1;
  const occupied = new Set(cells.map(cellKey));
  return (
    <View style={[styles.previewGrid, { width: width * 22 }]}>
      {Array.from({ length: width * height }, (_, index) => {
        const cell = { x: index % width, y: Math.floor(index / width) };
        return <Text key={index} style={[styles.previewCell, occupied.has(cellKey(cell)) && styles.previewFilled]}>{occupied.has(cellKey(cell)) ? 'X' : ''}</Text>;
      })}
    </View>
  );
}

function BattleBoard({ interactive, onSelect, planeCells = [], selected, shots }: { interactive?: boolean; onSelect?: (cell: Cell) => void; planeCells?: Cell[]; selected?: Cell | null; shots: BattleshipShot[] }) {
  const plane = new Set(planeCells.map(cellKey));
  const shotMap = new Map(shots.map((shot) => [cellKey(shot), shot]));
  return (
    <View style={styles.board}>
      {Array.from({ length: 100 }, (_, index) => {
        const cell = { x: (index % 10) + 1, y: Math.floor(index / 10) + 1 };
        const shot = shotMap.get(cellKey(cell));
        const chosen = selected?.x === cell.x && selected?.y === cell.y;
        return (
          <Pressable disabled={!interactive || Boolean(shot)} key={cellKey(cell)} onPress={() => onSelect?.(cell)} style={[styles.cell, plane.has(cellKey(cell)) && styles.planeCell, chosen && styles.selectedCell, shot?.result === 'miss' && styles.missCell, shot && shot.result !== 'miss' && styles.hitCell, shot?.result === 'head' && styles.headCell]}>
            <Text style={styles.cellText}>{shot?.result === 'miss' ? '•' : shot?.result === 'head' ? '*' : shot ? '×' : ''}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  entryRow: { alignItems: 'center', backgroundColor: '#fff8f5', borderColor: '#f5c6ce', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, marginBottom: 10, padding: 14, shadowColor: '#2d1f2e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  iconBadge: { alignItems: 'center', backgroundColor: '#fdf6f0', borderRadius: 12, height: 48, justifyContent: 'center', width: 48 },
  iconText: { color: '#e8607a', fontSize: 22, fontWeight: '900' },
  entryText: { flex: 1 },
  entryLabel: { color: '#2d1f2e', fontSize: 15, fontWeight: '800' },
  entryValue: { color: '#9b8a93', fontSize: 13, lineHeight: 18, marginTop: 3 },
  badge: { backgroundColor: '#f9ede6', borderRadius: 8, color: '#e8607a', fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  screen: { backgroundColor: '#fdf6f0', flex: 1 },
  header: { alignItems: 'center', backgroundColor: '#fff8f5', borderBottomColor: '#f5c6ce', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 14, paddingHorizontal: 20, paddingTop: 58 },
  title: { color: '#2d1f2e', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#9b8a93', fontSize: 12, marginTop: 2 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  resetButton: { alignItems: 'center', borderColor: '#e8607a', borderRadius: 14, borderWidth: 1, height: 40, justifyContent: 'center', paddingHorizontal: 12 },
  resetText: { color: '#e8607a', fontSize: 13, fontWeight: '900' },
  closeButton: { alignItems: 'center', backgroundColor: '#f9ede6', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  closeText: { color: '#2d1f2e', fontSize: 28, lineHeight: 30 },
  content: { padding: 16, paddingBottom: 34 },
  error: { backgroundColor: '#f9ede6', borderRadius: 12, color: '#b9314f', marginBottom: 12, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 10, textAlign: 'center' },
  loading: { marginTop: 48 },
  card: { backgroundColor: '#fff8f5', borderColor: '#f5c6ce', borderRadius: 18, borderWidth: 1, marginBottom: 14, padding: 14 },
  cardTitle: { color: '#2d1f2e', fontSize: 16, fontWeight: '900' },
  cardSub: { color: '#9b8a93', fontSize: 13, lineHeight: 18, marginTop: 3 },
  previewGrid: { alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 12 },
  previewCell: { backgroundColor: '#f9ede6', borderRadius: 4, color: '#fff', height: 20, lineHeight: 20, overflow: 'hidden', textAlign: 'center', width: 20 },
  previewFilled: { backgroundColor: '#2d1f2e' },
  board: { alignSelf: 'center', backgroundColor: '#f5c6ce', borderRadius: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 5, width: 330 },
  cell: { alignItems: 'center', backgroundColor: '#fff8f5', borderRadius: 4, height: 30, justifyContent: 'center', width: 30 },
  planeCell: { backgroundColor: '#2d1f2e' },
  selectedCell: { backgroundColor: '#e8607a' },
  missCell: { backgroundColor: '#dceefa' },
  hitCell: { backgroundColor: '#e8607a' },
  headCell: { backgroundColor: '#f5a524' },
  cellText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primaryButton: { alignItems: 'center', backgroundColor: '#e8607a', borderRadius: 14, flex: 1, minHeight: 48, justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  secondaryButton: { alignItems: 'center', borderColor: '#e8607a', borderRadius: 14, borderWidth: 1, flex: 1, minHeight: 48, justifyContent: 'center' },
  secondaryText: { color: '#e8607a', fontSize: 14, fontWeight: '900' },
  waiting: { color: '#9b8a93', fontSize: 13, marginTop: 12, textAlign: 'center' },
  segment: { backgroundColor: '#f9ede6', borderRadius: 16, flexDirection: 'row', gap: 4, marginBottom: 12, padding: 4 },
  segmentButton: { alignItems: 'center', borderRadius: 12, flex: 1, paddingVertical: 10 },
  segmentActive: { backgroundColor: '#fff8f5' },
  segmentText: { color: '#9b8a93', fontSize: 13, fontWeight: '900' },
  segmentActiveText: { color: '#2d1f2e' },
  statusText: { color: '#2d1f2e', fontSize: 15, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  fireButton: { alignItems: 'center', backgroundColor: '#e8607a', borderRadius: 14, marginTop: 14, minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
});
