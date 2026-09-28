import { useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handlers = Record<string, (...args: any[]) => void>;

// Socket event-үүдийг component-ийн амьдралын хугацаанд бүртгэнэ.
// Handler бүрийг нэрээр нь `off` хийдэг тул өөр дэлгэцийн ижил event-ийн listener-ийг устгахгүй
// (өмнө нь `socket.off('moment:new')` бусад таб-ын listener-ийг ч арилгадаг байсан).
// Handler-ууд ref-ээр дамждаг тул хамгийн сүүлийн state/props-ийг харна.
export function useSocketEvents(handlers: Handlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  const eventKey = Object.keys(handlers).sort().join('|');

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let active = true;
    const events = eventKey.split('|').filter(Boolean);

    void getSocket()
      .then((socket) => {
        if (!active) return;
        const bound = events.map((event) => {
          const fn = (...args: unknown[]) => ref.current[event]?.(...args);
          socket.on(event, fn);
          return [event, fn] as const;
        });
        cleanup = () => bound.forEach(([event, fn]) => socket.off(event, fn));
      })
      .catch(() => undefined);

    return () => {
      active = false;
      cleanup?.();
    };
  }, [eventKey]);
}
