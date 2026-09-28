import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { getSocket } from '../lib/socket';

// App foreground болох эсвэл socket дахин холбогдох үед өгөгдлийг дахин татна —
// тасарсан хооронд ирсэн event-үүдийг алдахгүйн тулд.
export function useResync(callback: () => void): void {
  const ref = useRef(callback);
  ref.current = callback;

  useEffect(() => {
    let lastBackgroundAt = 0;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') lastBackgroundAt = Date.now();
      // Богино хугацаанд (жнь notification шторк) гарч орсон бол дахин татахгүй.
      if (state === 'active' && lastBackgroundAt && Date.now() - lastBackgroundAt > 5_000) ref.current();
    });

    let cleanup: (() => void) | undefined;
    let mounted = true;
    void getSocket()
      .then((socket) => {
        if (!mounted) return;
        const onReconnect = () => ref.current();
        socket.io.on('reconnect', onReconnect);
        cleanup = () => socket.io.off('reconnect', onReconnect);
      })
      .catch(() => {});

    return () => {
      mounted = false;
      sub.remove();
      cleanup?.();
    };
  }, []);
}
