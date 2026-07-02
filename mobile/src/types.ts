export type Theme = 'rose' | 'sunset' | 'ocean' | 'violet' | 'forest';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  status: string;
  theme: Theme;
  couple: string | null;
  recoveryEmail: string | null;
  streak: number;
  birthday: string;
}

export interface Member {
  _id: string;
  name: string;
  avatar: string;
  status?: string;
  email?: string;
  birthday?: string;
  lastSeenAt?: string | null;
  lastReadAt?: string | null;
}

export interface Couple {
  _id?: string;
  id?: string;
  inviteCode: string;
  members: Member[] | string[];
  anniversary?: string | null;
}

export interface Message {
  _id: string;
  couple: string;
  sender: Member;
  text: string;
  imageUrl?: string;
  deleted?: boolean;
  special: boolean;
  createdAt: string;
}

export interface Reaction {
  user: string;
  emoji: string;
}

export interface Moment {
  _id: string;
  couple: string;
  author: Member;
  imageUrl: string;
  caption: string;
  reactions: Reaction[];
  createdAt: string;
}

export interface Milestone {
  _id: string;
  couple: string;
  title: string;
  date: string;
  icon: string;
}

export interface Mood {
  _id: string;
  couple: string;
  user: Member;
  emoji: string;
  text: string;
  createdAt: string;
}

export interface DailyAnswer {
  _id: string;
  user: Member;
  date: string;
  questionIndex: number;
  text: string;
  createdAt?: string;
}

export interface DailyQuestion {
  date: string;
  question: string;
  questionIndex: number;
  answers: DailyAnswer[];
}

export interface LoveNote {
  _id: string;
  couple: string;
  author: Member;
  recipient: Member;
  text: string | null;
  openedAt?: string | null;
  createdAt: string;
}

export interface Capsule {
  id: string;
  author: Member;
  unlockAt: string;
  createdAt: string;
  unlocked: boolean;
  text: string | null;
}

export interface WeeklySong {
  _id: string;
  couple: string;
  weekStart: string;
  title: string;
  artist: string;
  url: string;
  thumbnailUrl?: string;
  selectedBy: Member;
  createdAt: string;
}

export interface Wish {
  _id: string;
  couple: string;
  author: Member;
  text: string;
  completed: boolean;
  completedAt?: string | null;
  completionApprovals: string[];
  deletionApprovals: string[];
  createdAt: string;
}

export interface NumberGuessAttempt {
  id: string;
  userId: string;
  guess: string;
  alpha: number;
  betta: number;
  createdAt: string;
}

export interface NumberGuessGame {
  id: string;
  status: 'setup' | 'playing' | 'finished';
  turnUserId: string | null;
  winnerUserId: string | null;
  resetApprovals: string[];
  me: {
    ready: boolean;
    secret: string;
  };
  opponent: {
    ready: boolean;
    secret: string;
  };
  attempts: NumberGuessAttempt[];
}

export interface WhoIsMoreQuestion {
  id: string;
  index: number;
  text: string;
  options: Array<{ id: string; text: string }>;
  correctOptionId: string | null;
  selectedOptionId: string | null;
  correct: boolean | null;
}

export interface WhoIsMoreQuizSummary {
  id: string;
  title: string;
  creatorId: string;
  playerId: string;
  role: 'creator' | 'player';
  status: 'waiting' | 'playing' | 'completed';
  answeredCount: number;
  questionCount: number;
  score: number | null;
  canEdit: boolean;
  createdAt: string;
}

export interface WhoIsMoreQuiz extends WhoIsMoreQuizSummary {
  questions: WhoIsMoreQuestion[];
}

export interface BattleshipShot {
  x: number;
  y: number;
  result: 'hit' | 'miss' | 'sunk' | 'head';
  sunkShip?: string;
}

export interface BattleshipGame {
  id: string;
  status: 'placement' | 'playing' | 'finished';
  turnUserId: string | null;
  winnerUserId: string | null;
  me: {
    ready: boolean;
    plane: { x: number; y: number; rotation: 0 | 90 | 180 | 270; cells: Array<{ x: number; y: number }> } | null;
    incomingShots: BattleshipShot[];
  };
  opponent: {
    ready: boolean;
    shots: BattleshipShot[];
  };
}
