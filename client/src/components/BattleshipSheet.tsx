import { useCallback, useEffect, useState } from 'react';
import { Check, Crosshair, Grid3X3, Minus, Plus, RefreshCw, RotateCw, Trophy, X } from 'lucide-react';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { useCouple } from '../context/CoupleContext';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { BattleshipGame, BattleshipShot } from '../types';

interface Props { open: boolean; onClose: () => void }
type Cell = { x: number; y: number };
type Rotation = 0 | 90 | 180 | 270;

const cellKey = ({ x, y }: Cell) => `${x}:${y}`;

const BASE_PLANE: Cell[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
  { x: 1, y: 2 },
  { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 },
];

function PlanePreview({ rotation }: { rotation: Rotation }) {
  let cells = BASE_PLANE.map((cell) => ({ ...cell }));
  for (let angle = 0; angle < rotation; angle += 90) {
    cells = cells.map(({ x, y }) => ({ x: -y, y: x }));
    const minX = Math.min(...cells.map((cell) => cell.x));
    const minY = Math.min(...cells.map((cell) => cell.y));
    cells = cells.map(({ x, y }) => ({ x: x - minX, y: y - minY }));
  }
  const width = Math.max(...cells.map((cell) => cell.x)) + 1;
  const height = Math.max(...cells.map((cell) => cell.y)) + 1;
  const occupied = new Set(cells.map(cellKey));

  return (
    <div
      className="mx-auto mb-3 grid w-fit gap-1"
      style={{ gridTemplateColumns: `repeat(${width}, 18px)` }}
      aria-label={`Онгоцны чиглэл ${rotation} градус`}
    >
      {Array.from({ length: width * height }, (_, index) => {
        const cell = { x: index % width, y: Math.floor(index / width) };
        const filled = occupied.has(cellKey(cell));
        return <span key={index} className={`h-[18px] rounded text-center text-xs font-bold leading-[18px] ${filled ? 'bg-deep text-white' : 'text-blush'}`}>{filled ? 'X' : 'O'}</span>;
      })}
    </div>
  );
}

interface BoardProps {
  planeCells?: Cell[];
  shots: BattleshipShot[];
  selected?: Cell | null;
  interactive?: boolean;
  onSelect?: (cell: Cell) => void;
}

function BattleBoard({ planeCells = [], shots, selected, interactive, onSelect }: BoardProps) {
  const plane = new Set(planeCells.map(cellKey));
  const shotMap = new Map(shots.map((shot) => [cellKey(shot), shot]));
  const cells = Array.from({ length: 100 }, (_, index) => ({
    x: (index % 10) + 1,
    y: Math.floor(index / 10) + 1,
  }));

  return (
    <div className="grid w-full grid-cols-[18px_repeat(10,minmax(0,1fr))] gap-px rounded-xl bg-blush/70 p-1 shadow-inner">
      <div />
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="flex aspect-square items-center justify-center text-[8px] font-semibold text-muted">{index + 1}</div>
      ))}
      {cells.map((cell) => {
        const shot = shotMap.get(cellKey(cell));
        const chosen = selected?.x === cell.x && selected?.y === cell.y;
        return (
          <div key={cellKey(cell)} className="contents">
            {cell.x === 1 && <div className="flex aspect-square items-center justify-center text-[8px] font-semibold text-muted">{cell.y}</div>}
            <button
              type="button"
              onClick={() => onSelect?.(cell)}
              disabled={!interactive || Boolean(shot)}
              aria-label={`${cell.y}-р мөр ${cell.x}-р багана`}
              className={`relative aspect-square min-w-0 cursor-pointer touch-manipulation rounded-[2px] transition-colors disabled:cursor-not-allowed ${
                chosen ? 'bg-rose ring-2 ring-deep' : shot?.result === 'miss' ? 'bg-sky-100' : shot?.result === 'head' ? 'bg-amber-400 ring-2 ring-red-600' : shot ? 'bg-red-500' : plane.has(cellKey(cell)) ? 'bg-deep' : 'bg-white/90'
              }`}
            >
              {shot?.result === 'miss' && <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500" />}
              {shot && shot.result !== 'miss' && <span className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-bold text-white ${shot.result === 'head' ? 'text-[9px]' : 'h-1.5 w-1.5 rotate-45 bg-white'}`}>{shot.result === 'head' ? '★' : ''}</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function BattleshipSheet({ open, onClose }: Props) {
  const { user } = useAuth();
  const { partner } = useCouple();
  const toast = useToast();
  const [game, setGame] = useState<BattleshipGame | null>(null);
  const [view, setView] = useState<'target' | 'mine'>('target');
  const [selected, setSelected] = useState<Cell | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [selectedPlaneIndex, setSelectedPlaneIndex] = useState<number | null>(null);
  const [proposedCount, setProposedCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  const loadGame = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ game: BattleshipGame }>('/battleship');
      setGame(result.game);
      setProposedCount(result.game.planeCount);
      if (result.game.me.planes[0]) setRotation(result.game.me.planes[0].rotation);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Тоглоомыг уншихад алдаа гарлаа');
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void loadGame(), 0);
    return () => window.clearTimeout(timer);
  }, [loadGame, open]);

  useEffect(() => {
    const changed = () => void loadGame();
    const socket = getSocket();
    socket.on('battleship:changed', changed);
    return () => { socket.off('battleship:changed', changed); };
  }, [loadGame]);

  async function post(path: string, body?: unknown) {
    setBusy(true);
    try {
      const result = await api<{ game: BattleshipGame }>(`/battleship${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      setGame(result.game);
      setSelected(null);
      setProposedCount(result.game.planeCount);
      return result.game;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Үйлдэл амжилтгүй боллоо');
      return null;
    } finally { setBusy(false); }
  }

  async function place(cell: Cell) {
    const width = rotation % 180 === 0 ? 3 : 4;
    const height = rotation % 180 === 0 ? 4 : 3;
    const x = Math.max(1, Math.min(11 - width, cell.x - Math.floor(width / 2)));
    const y = Math.max(1, Math.min(11 - height, cell.y - Math.floor(height / 2)));
    await post('/place', { x, y, rotation, index: selectedPlaneIndex ?? game?.me.planes.length ?? 0 });
    setSelectedPlaneIndex(null);
  }

  async function fire() {
    if (!selected) return;
    const target = selected;
    const updated = await post('/fire', target);
    const shot = updated?.opponent.shots.find((item) => item.x === target.x && item.y === target.y);
    if (shot) toast(shot.result === 'miss' ? 'Оносонгүй' : shot.result === 'head' ? 'Онгоцны толгойг онолоо — та яллаа!' : shot.result === 'sunk' ? 'Онгоц бүрэн сөнөлөө!' : 'Оносон!');
  }

  async function proposePlaneCount() {
    await post('/plane-count/propose', { count: proposedCount });
  }

  async function approvePlaneCount() {
    await post('/plane-count/approve');
  }

  async function cancelPlaneCount() {
    await post('/plane-count/cancel');
  }

  const myTurn = game?.status === 'playing' && game.turnUserId === user?.id;
  const placedCount = game?.me.planes.length ?? 0;
  const proposal = game?.planeCountProposal;
  const proposalByMe = Boolean(proposal && user?.id && proposal.proposedBy === user.id);
  const proposalApprovedByMe = Boolean(proposal && user?.id && proposal.approvals.includes(user.id));
  const canReady = Boolean(game && game.me.planes.length === game.planeCount);
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-cream">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-blush/60 bg-white/90 px-5 backdrop-blur">
        <div>
          <div className="text-lg font-semibold text-deep">Онгоц буудах</div>
          <div className="text-[11px] text-muted">Толгойг нь оновол ялна</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void post('/reset')}
            disabled={busy || loading || !game}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-rose/40 px-3 text-xs font-semibold text-rose disabled:opacity-50"
            title="Шинэ тоглоом"
          >
            <RefreshCw size={15} /> Шинэ
          </button>
          <button
            type="button"
            onClick={() => setConfirmExit(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-warm text-deep"
            aria-label="Тоглоомоос гарах"
          >
            <X size={20} />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-4">
        {loading || !game ? <p className="py-12 text-center text-sm text-muted">Уншиж байна…</p> : game.status === 'placement' ? (
          <div>
            <p className="mb-2 text-center text-sm font-medium text-deep">Онгоцоо талбай дээр байрлуул</p>
            <p className="mb-3 text-center text-xs text-muted">Онгоцны төв байрлах нүдээ дарна · X нь онгоцны хэсэг</p>
            <div className="mb-3 rounded-xl border border-blush/70 bg-white p-4">
              <div className="text-sm font-semibold text-deep">Онгоцны тоо</div>
              <div className="mt-1 text-xs text-muted">Нөгөө хүн зөвшөөрвөл тоглоом шинэ тоогоор эхэлнэ.</div>
              <div className="mt-3 flex items-center gap-2">
                <button type="button" onClick={() => setProposedCount((value) => Math.max(1, value - 1))} disabled={busy || proposedCount <= 1} className="flex h-10 w-10 items-center justify-center rounded-xl bg-warm text-deep disabled:opacity-50" aria-label="Бууруулах"><Minus size={16} /></button>
                <div className="min-w-10 text-center text-xl font-bold text-deep">{proposedCount}</div>
                <button type="button" onClick={() => setProposedCount((value) => Math.min(5, value + 1))} disabled={busy || proposedCount >= 5} className="flex h-10 w-10 items-center justify-center rounded-xl bg-warm text-deep disabled:opacity-50" aria-label="Нэмэх"><Plus size={16} /></button>
                <button type="button" onClick={() => void proposePlaneCount()} disabled={busy || proposedCount === game.planeCount} className="ml-auto rounded-xl border border-rose/40 px-3 py-2 text-xs font-semibold text-rose disabled:opacity-50">Санал болгох</button>
              </div>
              {proposal ? (
                <div className="mt-3 rounded-xl bg-warm px-4 py-3 text-sm text-deep">
                  <div className="font-semibold">Шинэ тоглоомын санал</div>
                  <div className="mt-1 text-xs text-muted">
                    {proposalByMe ? `${proposal.count} онгоцтой болгох саналыг зөвшөөрөхийг хүлээж байна.` : `${partner?.name ?? 'Partner'} ${proposal.count} онгоцтой болгох санал илгээсэн.`}
                  </div>
                  <div className="mt-3">
                    {proposalByMe ? (
                      <button type="button" onClick={() => void cancelPlaneCount()} disabled={busy} className="w-full rounded-xl border border-rose/40 py-3 text-sm font-semibold text-rose disabled:opacity-50">Санал цуцлах</button>
                    ) : (
                      <button type="button" onClick={() => void approvePlaneCount()} disabled={busy || proposalApprovedByMe} className="w-full rounded-xl bg-rose py-3 text-sm font-semibold text-white disabled:opacity-50">Зөвшөөрөх</button>
                    )}
                  </div>
                </div>
              ) : null}
              {game.me.planes.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {game.me.planes.map((plane, index) => (
                    <button key={index} type="button" onClick={() => { setSelectedPlaneIndex(index); setRotation(plane.rotation); }} disabled={busy || game.me.ready} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${selectedPlaneIndex === index ? 'border-rose bg-rose text-white' : 'border-blush text-deep'} disabled:opacity-50`}>
                      #{index + 1}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 text-center text-xs text-muted">
                {selectedPlaneIndex !== null ? `${selectedPlaneIndex + 1}-р онгоцыг сольж байрлуулна` : canReady ? `${placedCount}/${game.planeCount} байрласан` : `${placedCount + 1}-р онгоцыг байрлуулна`}
              </div>
            </div>
            <PlanePreview rotation={rotation} />
            <BattleBoard
              planeCells={game.me.planes.flatMap((plane) => plane.cells)}
              shots={game.me.incomingShots}
              interactive={!busy && !game.me.ready && (game.me.planes.length < game.planeCount || selectedPlaneIndex !== null)}
              onSelect={(cell) => void place(cell)}
            />
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => setRotation((current) => ((current + 90) % 360) as Rotation)}
                disabled={busy || game.me.ready}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-blush py-3 text-sm font-medium text-deep disabled:opacity-50"
              >
                <RotateCw size={17} /> Эргүүлэх ({rotation}°)
              </button>
              <button
                type="button"
                onClick={() => void post(game.me.ready ? '/unready' : '/ready')}
                disabled={busy || (!game.me.ready && !canReady)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium disabled:opacity-50 ${game.me.ready ? 'border border-blush bg-white text-deep' : 'bg-rose text-white'}`}
              >
                <Check size={17} /> {game.me.ready ? 'Бэлэн цуцлах' : 'Бэлэн болох'}
              </button>
            </div>
            {game.me.ready && <p className="mt-3 text-center text-sm text-muted">{game.opponent.ready ? 'Тоглоом эхэлж байна…' : `${partner?.name ?? 'Partner'}-ийг хүлээж байна…`}</p>}
          </div>
        ) : (
          <div>
            <div className="mb-3 grid grid-cols-2 rounded-xl bg-warm p-1">
              <button type="button" onClick={() => setView('target')} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold ${view === 'target' ? 'bg-white text-deep shadow-sm' : 'text-muted'}`}><Crosshair size={15} /> Буудах талбай</button>
              <button type="button" onClick={() => setView('mine')} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold ${view === 'mine' ? 'bg-white text-deep shadow-sm' : 'text-muted'}`}><Grid3X3 size={15} /> Миний талбай</button>
            </div>
            <div className="mb-3 text-center text-sm font-medium text-deep">
              {game.status === 'finished' ? (game.winnerUserId === user?.id ? 'Та яллаа!' : `${partner?.name ?? 'Partner'} яллаа`) : myTurn ? 'Таны ээлж — буудах нүдээ сонгоно уу' : `${partner?.name ?? 'Partner'}-ийн ээлж`}
            </div>
            {view === 'target' ? (
              <BattleBoard shots={game.opponent.shots} selected={selected} interactive={myTurn && !busy} onSelect={setSelected} />
            ) : (
              <BattleBoard planeCells={game.me.planes.flatMap((plane) => plane.cells)} shots={game.me.incomingShots} />
            )}
            {game.status === 'playing' && view === 'target' && selected && (
              <button type="button" onClick={() => void fire()} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-rose py-3 text-sm font-medium text-white disabled:opacity-60"><Crosshair size={17} /> {selected.y}-р мөр, {selected.x}-р багана руу буудах</button>
            )}
            {game.status === 'finished' && (
              <button type="button" onClick={() => void post('/reset')} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-rose py-3 text-sm font-medium text-white disabled:opacity-60"><RefreshCw size={17} /> Дахин тоглох</button>
            )}
            {game.status === 'finished' && game.winnerUserId === user?.id && <div className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-rose"><Trophy size={18} /> Онгоцны толгойг онолоо</div>}
          </div>
        )}
      </div>

      {confirmExit && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-deep/55 px-6">
          <div className="w-full rounded-2xl bg-white p-5 text-center shadow-2xl">
            <div className="text-lg font-semibold text-deep">Тоглоомоос гарах уу?</div>
            <p className="mt-2 text-sm leading-relaxed text-muted">Таны байрлал болон тоглолтын явц хадгалагдана. Дараа нь үргэлжлүүлж болно.</p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => setConfirmExit(false)} className="rounded-xl border border-blush py-3 text-sm font-semibold text-deep">Үгүй</button>
              <button type="button" onClick={() => { setConfirmExit(false); onClose(); }} className="rounded-xl bg-rose py-3 text-sm font-semibold text-white">Тийм, гарах</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
