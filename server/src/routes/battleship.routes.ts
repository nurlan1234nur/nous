import { Router } from 'express';
import { z } from 'zod';
import { Couple } from '../models/Couple.js';
import { BattleshipGame } from '../models/BattleshipGame.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCouple } from '../middleware/couple.js';
import { emitToCouple } from '../realtime/socket.js';

export const battleshipRouter = Router();
battleshipRouter.use(requireAuth, requireCouple);

type Rotation = 0 | 90 | 180 | 270;
type Plane = { x?: number | null; y?: number | null; rotation?: number | null };

const BASE_PLANE: Array<{ x: number; y: number }> = [
  { x: 1, y: 0 },
  { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
  { x: 1, y: 2 },
  { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 },
];

function relativePlaneCells(rotation: Rotation) {
  let cells: Array<{ x: number; y: number }> = BASE_PLANE.map((cell) => ({ ...cell }));
  for (let angle = 0; angle < rotation; angle += 90) {
    cells = cells.map(({ x, y }) => ({ x: -y, y: x }));
    const minX = Math.min(...cells.map((cell) => cell.x));
    const minY = Math.min(...cells.map((cell) => cell.y));
    cells = cells.map(({ x, y }) => ({ x: x - minX, y: y - minY }));
  }
  return cells;
}

function planeCells(plane: Plane) {
  const x = plane.x;
  const y = plane.y;
  const rotation = plane.rotation as Rotation | undefined;
  if (x == null || y == null || rotation === undefined) return [];
  return relativePlaneCells(rotation).map((cell) => ({ x: x + cell.x, y: y + cell.y }));
}

function isValidPlane(plane: Plane): boolean {
  const cells = planeCells(plane);
  return cells.length === 8 && cells.every(({ x, y }) => x >= 1 && x <= 10 && y >= 1 && y <= 10);
}

async function getGame(coupleId: string) {
  const couple = await Couple.findById(coupleId).select('members');
  let game = await BattleshipGame.findOne({ couple: coupleId });
  if (!game) {
    game = await BattleshipGame.findOneAndUpdate(
      { couple: coupleId },
      { $setOnInsert: { players: couple?.members.map((user) => ({ user })) ?? [] } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  if (!game) throw new Error('Онгоцны тоглоом үүсгэж чадсангүй');

  let changed = false;
  for (const member of couple?.members ?? []) {
    if (!game.players.some((player) => player.user.toString() === member.toString())) {
      game.players.push({ user: member } as never);
      changed = true;
    }
  }

  // Хуучин 5-усан-онгоцны идэвхтэй тоглолтыг шинэ дүрст онгоцны төлөв рүү цэвэр шилжүүлнэ.
  if (game.status !== 'placement' && game.players.some((player) => !isValidPlane(player.plane ?? {}))) {
    game.status = 'placement';
    game.turn = null;
    game.winner = null;
    for (const player of game.players) {
      player.ready = false;
      player.plane = undefined;
      player.shots.splice(0, player.shots.length);
    }
    changed = true;
  }
  if (changed) await game.save();
  return game;
}

function gamePayload(game: Awaited<ReturnType<typeof getGame>>, viewerId: string) {
  const me = game.players.find((player) => player.user.toString() === viewerId);
  const opponent = game.players.find((player) => player.user.toString() !== viewerId);
  if (!me || !opponent) throw new Error('Хоёр тоглогч бүрэн холбогдоогүй байна');

  return {
    id: game._id,
    status: game.status,
    turnUserId: game.turn?.toString() ?? null,
    winnerUserId: game.winner?.toString() ?? null,
    me: {
      ready: me.ready,
      plane: me.plane && isValidPlane(me.plane) ? {
        x: me.plane.x,
        y: me.plane.y,
        rotation: me.plane.rotation,
        cells: planeCells(me.plane),
      } : null,
      incomingShots: opponent.shots.map(({ x, y, result, sunkShip }) => ({ x, y, result, sunkShip })),
    },
    opponent: {
      ready: opponent.ready,
      shots: me.shots.map(({ x, y, result, sunkShip }) => ({ x, y, result, sunkShip })),
    },
  };
}

function notifyChanged(coupleId: string): void {
  emitToCouple(coupleId, 'battleship:changed', { at: Date.now() });
}

battleshipRouter.get('/', asyncHandler(async (req, res) => {
  const game = await getGame(req.coupleId!);
  res.json({ game: gamePayload(game, req.userId!) });
}));

const placementSchema = z.object({
  x: z.number().int().min(1).max(10),
  y: z.number().int().min(1).max(10),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
});

battleshipRouter.post('/place', asyncHandler(async (req, res) => {
  const placement = placementSchema.parse(req.body);
  const game = await getGame(req.coupleId!);
  const player = game.players.find((item) => item.user.toString() === req.userId);
  if (!player || game.status !== 'placement' || player.ready) {
    res.status(409).json({ error: 'Одоо онгоц байрлуулах боломжгүй' });
    return;
  }
  if (!isValidPlane(placement)) {
    res.status(400).json({ error: 'Онгоц талбайгаас гарч байна. Дотогш байрлуулна уу' });
    return;
  }
  player.plane = placement;
  await game.save();
  res.json({ game: gamePayload(game, req.userId!) });
}));

battleshipRouter.post('/ready', asyncHandler(async (req, res) => {
  const game = await getGame(req.coupleId!);
  const player = game.players.find((item) => item.user.toString() === req.userId);
  if (!player || !isValidPlane(player.plane ?? {})) {
    res.status(409).json({ error: 'Эхлээд онгоцоо талбайд байрлуулна уу' });
    return;
  }
  player.ready = true;
  if (game.players.length === 2 && game.players.every((item) => item.ready)) {
    game.status = 'playing';
    game.turn = game.players[Math.floor(Math.random() * 2)].user;
  }
  await game.save();
  notifyChanged(req.coupleId!);
  res.json({ game: gamePayload(game, req.userId!) });
}));

battleshipRouter.post('/unready', asyncHandler(async (req, res) => {
  const game = await getGame(req.coupleId!);
  const player = game.players.find((item) => item.user.toString() === req.userId);
  if (!player || game.status !== 'placement') {
    res.status(409).json({ error: 'Тоглоом эхэлсэн тул бэлэн төлөвийг цуцлах боломжгүй' });
    return;
  }
  player.ready = false;
  await game.save();
  notifyChanged(req.coupleId!);
  res.json({ game: gamePayload(game, req.userId!) });
}));

const fireSchema = z.object({ x: z.number().int().min(1).max(10), y: z.number().int().min(1).max(10) });

battleshipRouter.post('/fire', asyncHandler(async (req, res) => {
  const { x, y } = fireSchema.parse(req.body);
  const game = await getGame(req.coupleId!);
  if (game.status !== 'playing' || game.turn?.toString() !== req.userId) {
    res.status(409).json({ error: 'Одоо таны ээлж биш байна' });
    return;
  }
  const attacker = game.players.find((item) => item.user.toString() === req.userId)!;
  const defender = game.players.find((item) => item.user.toString() !== req.userId)!;
  if (attacker.shots.some((shot) => shot.x === x && shot.y === y)) {
    res.status(409).json({ error: 'Энэ нүд рүү аль хэдийн буудсан' });
    return;
  }

  const targetCells = planeCells(defender.plane ?? {});
  const hit = targetCells.some((cell) => cell.x === x && cell.y === y);
  // BASE_PLANE-ийн эхний нүд нь онгоцны хамар; эргэхэд дараалал хадгалагдана.
  const head = targetCells[0];
  const hitHead = Boolean(head && head.x === x && head.y === y);
  attacker.shots.push({
    x,
    y,
    result: hitHead ? 'head' : hit ? 'hit' : 'miss',
    sunkShip: hitHead ? 'plane' : '',
  });

  if (hitHead) {
    game.status = 'finished';
    game.winner = attacker.user;
    game.turn = null;
  } else {
    game.turn = defender.user;
  }
  await game.save();
  notifyChanged(req.coupleId!);
  res.json({ game: gamePayload(game, req.userId!) });
}));

battleshipRouter.post('/reset', asyncHandler(async (req, res) => {
  const game = await getGame(req.coupleId!);
  if (!game.players.some((player) => player.user.toString() === req.userId)) {
    res.status(403).json({ error: 'Тоглогч олдсонгүй' });
    return;
  }
  game.status = 'placement';
  game.turn = null;
  game.winner = null;
  for (const player of game.players) {
    player.ready = false;
    player.plane = undefined;
    player.shots.splice(0, player.shots.length);
  }
  await game.save();
  notifyChanged(req.coupleId!);
  res.json({ game: gamePayload(game, req.userId!) });
}));
