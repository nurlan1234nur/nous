import { act, renderHook, waitFor } from '@testing-library/react-native';

type Fn = (...args: unknown[]) => void;
const mockListeners = new Map<string, Set<Fn>>();
const mockSocket = {
  on: (event: string, fn: Fn) => {
    if (!mockListeners.has(event)) mockListeners.set(event, new Set());
    mockListeners.get(event)!.add(fn);
  },
  off: (event: string, fn?: Fn) => {
    if (fn) mockListeners.get(event)?.delete(fn);
    else mockListeners.delete(event);
  },
  emit: (event: string, ...args: unknown[]) => mockListeners.get(event)?.forEach((fn) => fn(...args)),
};
jest.mock('../../lib/socket', () => ({ getSocket: () => Promise.resolve(mockSocket) }));

import { useSocketEvents } from '../useSocketEvents';

const count = (event: string) => mockListeners.get(event)?.size ?? 0;

describe('useSocketEvents', () => {
  beforeEach(() => mockListeners.clear());

  it("unmounting one screen does not remove another screen's listener", async () => {
    const home = jest.fn();
    const memories = jest.fn();
    const a = renderHook(() => useSocketEvents({ 'moment:new': home }));
    renderHook(() => useSocketEvents({ 'moment:new': memories }));
    await waitFor(() => expect(count('moment:new')).toBe(2));

    a.unmount();
    expect(count('moment:new')).toBe(1);

    act(() => mockSocket.emit('moment:new', { _id: '1' }));
    expect(memories).toHaveBeenCalledWith({ _id: '1' });
    expect(home).not.toHaveBeenCalled();
  });

  it('always calls the latest handler without re-subscribing', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(({ fn }: { fn: jest.Mock }) => useSocketEvents({ ping: fn }), { initialProps: { fn: first } });
    await waitFor(() => expect(count('ping')).toBe(1));
    rerender({ fn: second });
    expect(count('ping')).toBe(1);
    act(() => mockSocket.emit('ping'));
    expect(second).toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
  });
});
