import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiUpload, assetUrl } from '../lib/api';
import { compressImage } from '../lib/image';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { useCouple } from '../context/CoupleContext';
import { useToast } from '../components/Toast';
import Avatar from '../components/Avatar';
import ChatMenuSheet, { type ChatMenuAction } from '../components/ChatMenuSheet';
import PartnerProfileSheet from '../components/PartnerProfileSheet';
import SharedMediaSheet from '../components/SharedMediaSheet';
import WallpaperSheet from '../components/WallpaperSheet';
import Sheet from '../components/Sheet';
import { formatDateTime } from '../lib/date';
import { getWallpaper, setWallpaper as saveWallpaper, wallpaperCss } from '../lib/wallpaper';
import type { Message } from '../types';

export default function Chat() {
  const { user } = useAuth();
  const { partner, onlineIds, lastSeen } = useCouple();
  const toast = useToast();
  const navigate = useNavigate();
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, active: false });
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [partnerReadAt, setPartnerReadAt] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [wallpaper, setWallpaperState] = useState(getWallpaper());
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  // Урт дарвал (own зурвас) "Устгах?" гарна. Богино дарвал цаг харагдана.
  function pressStart(m: Message) {
    longPressed.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      if (m.sender._id === user?.id && !m.deleted) {
        setConfirmId(m._id);
        setOpenId(null);
      }
    }, 450);
  }
  function pressEnd() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }
  function tap(m: Message) {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    setConfirmId(null);
    setOpenId((o) => (o === m._id ? null : m._id));
  }

  function markRead() {
    void api('/messages/read', { method: 'POST' }).catch(() => {});
  }

  useEffect(() => {
    void api<{ messages: Message[]; hasMore?: boolean }>('/messages?limit=100').then((r) => {
      setMessages(r.messages);
      setHasMore(Boolean(r.hasMore));
    });
    markRead();

    const socket = getSocket();
    socket.on('message:new', (msg: Message) => {
      setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
      if (msg.sender._id !== user?.id) markRead();
    });
    socket.on('partner:typing', (t: boolean) => setPartnerTyping(t));
    socket.on('message:read', (p: { userId: string; at: string }) => {
      if (p.userId !== user?.id) setPartnerReadAt(p.at);
    });
    socket.on('message:update', (msg: Message) =>
      setMessages((prev) => prev.map((m) => (m._id === msg._id ? msg : m))),
    );
    socket.on('messages:cleared', () => setMessages([]));
    return () => {
      socket.off('message:new');
      socket.off('partner:typing');
      socket.off('message:read');
      socket.off('message:update');
      socket.off('messages:cleared');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Партнёрын анхны уншсан үе (couple-аас).
  useEffect(() => {
    if (partner?.lastReadAt) setPartnerReadAt((prev) => prev ?? partner.lastReadAt ?? null);
  }, [partner?.lastReadAt]);

  // Зөвхөн зурвасны контейнерийг доош гүйлгэнэ (scrollIntoView нь PhoneFrame-ийг
  // дээш түрдэг тул ашиглахгүй — энэ нь ancestor-уудад тархахгүй).
  // Шинэ зурвас ирэх үед л доош гүйлгэнэ — хуучин зурвас ачаалахад байрлал хадгалагдана.
  const lastId = messages[messages.length - 1]?._id;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId, partnerTyping]);

  async function loadOlder() {
    const oldest = messages[0];
    const el = listRef.current;
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const r = await api<{ messages: Message[]; hasMore?: boolean }>(
        `/messages?limit=100&before=${encodeURIComponent(oldest.createdAt)}`,
      );
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m._id));
        return [...r.messages.filter((m) => !seen.has(m._id)), ...prev];
      });
      setHasMore(Boolean(r.hasMore));
      // Уншиж байсан газраа үлдэнэ (дээрээс нэмэгдсэн өндрийг нөхнө).
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } catch {
      toast('Өмнөх зурвасуудыг ачаалж чадсангүй');
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(value: string) {
    const v = value.trim();
    if (!v) return;
    setText('');
    getSocket().emit('typing', false);
    const { message } = await api<{ message: Message }>('/messages', {
      method: 'POST',
      body: JSON.stringify({ text: v }),
    });
    setMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [...prev, message]));
  }

  async function unsend(id: string) {
    setOpenId(null);
    setConfirmId(null);
    try {
      const { message } = await api<{ message: Message }>(`/messages/${id}`, { method: 'DELETE' });
      setMessages((prev) => prev.map((m) => (m._id === message._id ? message : m)));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Алдаа гарлаа');
    }
  }

  async function sendImage(file: File) {
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append('image', compressed);
      const { message } = await apiUpload<{ message: Message }>('/messages/image', form);
      setMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [...prev, message]));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Зураг илгээхэд алдаа гарлаа');
    }
  }

  const partnerOnline = partner ? onlineIds.includes(partner._id) : false;
  const seenIso = partner ? lastSeen[partner._id] ?? partner.lastSeenAt ?? null : null;

  // Хайлт идэвхтэй үед зөвхөн таарсан зурвасуудыг харуулна.
  const q = search.trim().toLowerCase();
  const shown = q ? messages.filter((m) => !m.deleted && m.text?.toLowerCase().includes(q)) : messages;

  function handleMenu(action: ChatMenuAction) {
    setMenuOpen(false);
    if (action === 'profile') setProfileOpen(true);
    else if (action === 'media') setMediaOpen(true);
    else if (action === 'search') setSearchOpen(true);
    else if (action === 'wallpaper') setWallpaperOpen(true);
    else if (action === 'clear') setClearConfirm(true);
  }

  function chooseWallpaper(id: string) {
    saveWallpaper(id);
    setWallpaperState(id);
    setWallpaperOpen(false);
  }

  async function clearChat() {
    setClearConfirm(false);
    try {
      await api('/messages', { method: 'DELETE' });
      setMessages([]);
      toast('Чат цэвэрлэгдлээ');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Алдаа гарлаа');
    }
  }

  // Зүүн ирмэгээс баруун тийш чирэхэд (Instagram шиг) буцна.
  function onPointerDown(e: ReactPointerEvent) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, active: e.clientX < 32 };
  }
  function onPointerMove(e: ReactPointerEvent) {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (dx < 0) return;
    if (!dragging && Math.abs(dy) > Math.abs(dx)) {
      d.active = false;
      return;
    }
    if (!dragging) setDragging(true);
    setDragX(Math.min(dx, 420));
  }
  function onPointerUp() {
    const d = dragRef.current;
    d.active = false;
    setDragging(false);
    if (dragX > 90) navigate('/');
    else setDragX(0);
  }

  // "Үзсэн"-ийг зөвхөн миний хамгийн сүүлийн зурвас дээр харуулна.
  const myMsgs = messages.filter((m) => m.sender._id === user?.id && !m.deleted);
  const lastMine = myMsgs[myMsgs.length - 1];
  const partnerSawLast =
    !!lastMine && !!partnerReadAt && new Date(partnerReadAt).getTime() >= new Date(lastMine.createdAt).getTime();

  return (
    <div
      className="absolute inset-0 flex flex-col bg-cream"
      style={{
        transform: dragX ? `translateX(${dragX}px)` : undefined,
        transition: dragging ? 'none' : 'transform 0.25s ease-out',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-rose/10 px-4 py-3">
        <button
          onClick={() => navigate('/')}
          aria-label="Буцах"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-2xl text-deep transition-transform active:scale-90"
        >
          ‹
        </button>
        <button
          onClick={() => setProfileOpen(true)}
          className="flex flex-1 items-center gap-3 text-left transition-opacity active:opacity-70"
        >
          <div className="relative">
            <Avatar value={partner?.avatar} className="h-11 w-11 shadow-md" emojiClassName="text-xl" />
            {partnerOnline && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-cream bg-green-500" />
            )}
          </div>
          <div className="text-base font-semibold text-deep">{partner?.name ?? 'Хайрт'}</div>
        </button>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Цэс"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xl text-deep transition-transform active:scale-90"
        >
          ⋮
        </button>
      </header>

      {searchOpen && (
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-rose/10 px-4 py-2">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Зурвас хайх…"
            className="flex-1 rounded-full bg-card px-4 py-2 text-sm text-deep outline-none ring-1 ring-blush/60 focus:ring-rose"
          />
          <button
            onClick={() => {
              setSearchOpen(false);
              setSearch('');
            }}
            className="text-[13px] font-medium text-muted"
          >
            Болих
          </button>
        </div>
      )}

      <div
        ref={listRef}
        className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3"
        style={{ background: wallpaperCss(wallpaper) || undefined }}
      >
        {/* Зурвас цөөн үед доош input дээр наалдуулна (дээшээ бөөгнөрөхгүй). */}
        <div className="mt-auto" />
        {hasMore && !q && (
          <button
            onClick={() => void loadOlder()}
            disabled={loadingOlder}
            className="mx-auto mb-2 rounded-full bg-card px-4 py-1.5 text-xs font-bold text-rose shadow-sm disabled:opacity-50"
          >
            {loadingOlder ? '…' : 'Өмнөх зурвасууд'}
          </button>
        )}
        {q && shown.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">"{search}" олдсонгүй</p>
        )}
        {shown.map((m, i) => {
          const mine = m.sender._id === user?.id;
          const prev = shown[i - 1];
          const next = shown[i + 1];
          const sameAsPrev = prev && prev.sender._id === m.sender._id;
          const lastOfGroup = !next || next.sender._id !== m.sender._id;
          const open = openId === m._id;
          return (
            <div
              key={m._id}
              className={`flex flex-col ${mine ? 'items-end' : 'items-start'} ${sameAsPrev ? 'mt-0.5' : 'mt-2.5'}`}
            >
              <div className={`flex max-w-[82%] items-end gap-2 ${mine ? 'self-end' : 'self-start'}`}>
                {!mine &&
                  (lastOfGroup ? (
                    <Avatar
                      value={partner?.avatar}
                      className="h-7 w-7 flex-shrink-0 shadow-sm"
                      emojiClassName="text-sm"
                    />
                  ) : (
                    <div className="h-7 w-7 flex-shrink-0" />
                  ))}
                {m.deleted ? (
                  <div className="rounded-[18px] border border-blush/50 px-3.5 py-2 text-[12.5px] italic text-muted">
                    🚫 {m.sender.name} зурвасаа устгалаа
                  </div>
                ) : (
                  <div
                    onClick={() => tap(m)}
                    onPointerDown={() => pressStart(m)}
                    onPointerUp={pressEnd}
                    onPointerLeave={pressEnd}
                    onPointerCancel={pressEnd}
                    onContextMenu={(e) => e.preventDefault()}
                    className="min-w-0 cursor-pointer select-none"
                  >
                    {m.imageUrl ? (
                      <img src={assetUrl(m.imageUrl)} alt="" className="max-h-64 rounded-2xl object-cover shadow-sm" />
                    ) : (
                      <div
                        className={`break-words rounded-[18px] px-3.5 py-2 text-[13.5px] leading-snug ${
                          m.special
                            ? 'bg-gradient-to-br from-[#f7d4da] to-[#f0d4e8] italic text-deep'
                            : mine
                              ? 'bg-gradient-to-br from-rose to-[#b83456] text-white'
                              : 'bg-card text-deep shadow-sm'
                        } ${mine ? 'rounded-br-md' : 'rounded-bl-md'}`}
                      >
                        {m.text}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {open && !m.deleted && (
                <div className={`mt-0.5 px-1 text-[10px] text-muted ${mine ? 'self-end' : 'self-start ml-9'}`}>
                  {formatDateTime(m.createdAt)}
                </div>
              )}
              {confirmId === m._id && !m.deleted && (
                <div className={`mt-1 flex items-center gap-2 px-1 ${mine ? 'self-end' : 'self-start ml-9'}`}>
                  <button
                    onClick={() => void unsend(m._id)}
                    className="rounded-full bg-rose px-3 py-1 text-[11px] font-semibold text-white transition-transform active:scale-95"
                  >
                    🗑 Устгах?
                  </button>
                  <button onClick={() => setConfirmId(null)} className="text-[11px] text-muted">
                    Болих
                  </button>
                </div>
              )}
              {mine && !m.deleted && m._id === lastMine?._id && partnerSawLast && (
                <div className="mt-0.5 px-1 text-[10px] font-medium text-rose">✓ Үзсэн</div>
              )}
            </div>
          );
        })}
        {partnerTyping && !q && (
          <div className="mt-2.5 flex items-end gap-2 self-start">
            <Avatar
              value={partner?.avatar}
              className="h-7 w-7 flex-shrink-0 shadow-sm"
              emojiClassName="text-sm"
            />
            <div className="rounded-[18px] rounded-bl-md bg-card px-3.5 py-2.5 shadow-sm">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-blink rounded-full bg-muted" />
                <span className="h-1.5 w-1.5 animate-blink rounded-full bg-muted [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 animate-blink rounded-full bg-muted [animation-delay:0.4s]" />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void sendImage(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-warm text-lg transition-transform active:scale-90"
            aria-label="Зураг илгээх"
          >
            📷
          </button>
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              getSocket().emit('typing', e.target.value.length > 0);
            }}
            onBlur={() => getSocket().emit('typing', false)}
            placeholder="Бичих…"
            className="flex-1 rounded-full bg-card px-4 py-2.5 text-sm text-deep outline-none ring-1 ring-blush/60 focus:ring-rose"
          />
          <button
            type="submit"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose to-[#b83456] text-lg text-white shadow-md transition-transform active:scale-90"
          >
            ↑
          </button>
        </form>
      </div>

      <ChatMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} onSelect={handleMenu} />
      <PartnerProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        partner={partner}
        online={partnerOnline}
        seenIso={seenIso}
      />
      <SharedMediaSheet open={mediaOpen} onClose={() => setMediaOpen(false)} messages={messages} />
      <WallpaperSheet
        open={wallpaperOpen}
        onClose={() => setWallpaperOpen(false)}
        current={wallpaper}
        onSelect={chooseWallpaper}
      />
      <Sheet open={clearConfirm} onClose={() => setClearConfirm(false)} title="Чат цэвэрлэх үү?">
        <p className="mb-4 text-center text-sm text-muted">
          Бүх зурвас хоёуланд тань устгагдана. Энэ үйлдлийг буцаах боломжгүй.
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={() => setClearConfirm(false)}
            className="flex-1 rounded-xl border border-blush/60 py-3 text-sm font-medium text-deep"
          >
            Болих
          </button>
          <button
            onClick={() => void clearChat()}
            className="flex-1 rounded-xl bg-rose py-3 text-sm font-medium text-white transition-transform active:scale-[0.97]"
          >
            Цэвэрлэх
          </button>
        </div>
      </Sheet>
    </div>
  );
}
