import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from './AuthContext';
import type { Couple, Member } from '../types';

interface CoupleState {
  couple: Couple | null;
  me: Member | null;
  partner: Member | null;
  onlineIds: string[];
  lastSeen: Record<string, string>;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CoupleContext = createContext<CoupleState | null>(null);

function isMember(value: unknown): value is Member {
  return Boolean(value && typeof value === 'object' && '_id' in value);
}

export function CoupleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [couple, setCouple] = useState<Couple | null>(null);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const response = await api<{ couple: Couple | null }>('/couples/me');
      setCouple(response.couple);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [user?.couple]);

  // Онлайн төлөв: listener бүртгэсний дараа болон дахин холбогдох бүрт одоогийн төлвийг асууна.
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let mounted = true;
    void getSocket()
      .then((socket) => {
        if (!mounted) return;
        const onPresence = (p: { online: string[]; lastSeen: Record<string, string> }) => {
          setOnlineIds(p.online);
          setLastSeen((prev) => ({ ...prev, ...p.lastSeen }));
        };
        const ask = () => socket.emit('presence:get');
        const onMemberLeft = () => void refresh().catch(() => {});
        socket.on('presence', onPresence);
        socket.on('connect', ask);
        socket.on('couple:member-left', onMemberLeft);
        if (socket.connected) ask();
        cleanup = () => {
          socket.off('presence', onPresence);
          socket.off('connect', ask);
          socket.off('couple:member-left', onMemberLeft);
        };
      })
      .catch(() => {});
    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  const members = useMemo(() => couple?.members.filter(isMember) ?? [], [couple?.members]);
  const me = members.find((member) => member._id === user?.id) ?? null;
  const partner = members.find((member) => member._id !== user?.id) ?? null;

  const value = useMemo<CoupleState>(
    () => ({ couple, me, partner, onlineIds, lastSeen, loading, refresh }),
    [couple, me, partner, onlineIds, lastSeen, loading],
  );

  return <CoupleContext.Provider value={value}>{children}</CoupleContext.Provider>;
}

export function useCouple(): CoupleState {
  const ctx = useContext(CoupleContext);
  if (!ctx) throw new Error('useCouple must be used within CoupleProvider');
  return ctx;
}
