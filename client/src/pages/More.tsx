import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  Camera,
  Check,
  Clock3,
  Gamepad2,
  Gift,
  Heart,
  KeyRound,
  Lock,
  Mail,
  MapPinned,
  MessageCircle,
  Music2,
  NotebookPen,
  Palette,
  Plane,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCouple } from '../context/CoupleContext';
import { useToast } from '../components/Toast';
import Sheet from '../components/Sheet';
import TimeCapsuleSheet from '../components/TimeCapsuleSheet';
import DreamJarSheet from '../components/DreamJarSheet';
import SongOfUsSheet from '../components/SongOfUsSheet';
import LoveNotesSheet from '../components/LoveNotesSheet';
import AnniversaryReminderSheet from '../components/AnniversaryReminderSheet';
import CoupleGameSheet from '../components/CoupleGameSheet';
import BattleshipSheet from '../components/BattleshipSheet';
import NumberGuessSheet from '../components/NumberGuessSheet';
import PasswordInput from '../components/PasswordInput';
import { api } from '../lib/api';
import DeleteAccountSheet from '../components/DeleteAccountSheet';
import {
  disableNotifications,
  enableNotifications,
  notificationStatus,
  type NotificationStatus,
} from '../lib/notifications';

type FeatureAction = 'capsule' | 'dream-jar' | 'song-of-us' | 'love-notes' | 'couple-game' | 'anniversary-reminder';

interface Feat {
  id: string;
  icon: LucideIcon;
  name: string;
  desc: string;
  badge?: string;
  toast: string;
  action?: FeatureAction;
}

interface FeatureStyle {
  icon?: string;
  bg?: string;
}

const FEATURE_STYLE_KEY = 'nous-more-feature-styles';

const ICON_OPTIONS: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: 'gift', label: 'Gift', icon: Gift },
  { key: 'music', label: 'Music', icon: Music2 },
  { key: 'clock', label: 'Clock', icon: Clock3 },
  { key: 'map', label: 'Map', icon: MapPinned },
  { key: 'game', label: 'Game', icon: Gamepad2 },
  { key: 'note', label: 'Note', icon: NotebookPen },
  { key: 'bell', label: 'Bell', icon: Bell },
  { key: 'heart', label: 'Heart', icon: Heart },
  { key: 'chat', label: 'Chat', icon: MessageCircle },
  { key: 'camera', label: 'Camera', icon: Camera },
  { key: 'lock', label: 'Lock', icon: Lock },
  { key: 'palette', label: 'Palette', icon: Palette },
];

const BG_OPTIONS = [
  { key: 'warm', label: 'Default', className: 'bg-warm' },
  { key: 'rose', label: 'Rose', className: 'bg-rose/10' },
  { key: 'blush', label: 'Blush', className: 'bg-blush/45' },
  { key: 'cream', label: 'Cream', className: 'bg-cream' },
  { key: 'purple', label: 'Purple', className: 'bg-purple/12' },
  { key: 'gold', label: 'Gold', className: 'bg-gold/15' },
];

const ICONS_BY_KEY = Object.fromEntries(ICON_OPTIONS.map((option) => [option.key, option.icon])) as Record<string, LucideIcon>;
const BG_BY_KEY = Object.fromEntries(BG_OPTIONS.map((option) => [option.key, option.className])) as Record<string, string>;

const SECTIONS: { title: string; items: Feat[] }[] = [
  {
    title: 'Тусгай зүйлс',
    items: [
      { id: 'dream-jar', icon: Gift, name: 'Dream Jar', desc: 'Хамтдаа биелүүлэх хүслийн сан', toast: '', action: 'dream-jar' },
      { id: 'song-of-us', icon: Music2, name: 'Song of Us', desc: 'Долоо хоног бүрийн хамтын дуу', toast: '', action: 'song-of-us' },
      { id: 'capsule', icon: Clock3, name: 'Цаг Капсул', desc: 'Ирээдүйд нээгдэх нууц захидал', toast: '', action: 'capsule' },
    ],
  },
  {
    title: 'Хамтын газрууд',
    items: [
      { id: 'memory-map', icon: MapPinned, name: 'Memory Map', desc: 'Дурсамжтай газруудаа тэмдэглэх', toast: 'Memory Map удахгүй!' },
    ],
  },
  {
    title: 'Хоёулаа',
    items: [
      { id: 'couple-game', icon: Gamepad2, name: 'Хосуудын тоглоом', desc: 'Хоёулаа хариулж, бодлоо тааруулах', badge: 'Шинэ', toast: '', action: 'couple-game' },
      { id: 'love-notes', icon: NotebookPen, name: 'Love Notes', desc: 'Нуугдсан тэмдэглэл үлдээх', toast: '', action: 'love-notes' },
      { id: 'anniversary-reminder', icon: Bell, name: 'Ойн сануулга', desc: 'Чухал өдрүүдийн автомат сануулга', toast: '', action: 'anniversary-reminder' },
    ],
  },
];

function readFeatureStyles(): Record<string, FeatureStyle> {
  try {
    return JSON.parse(localStorage.getItem(FEATURE_STYLE_KEY) ?? '{}') as Record<string, FeatureStyle>;
  } catch {
    return {};
  }
}

export default function More() {
  const { user, logout, refresh } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { couple } = useCouple();
  const toast = useToast();
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  const [featureStyles, setFeatureStyles] = useState<Record<string, FeatureStyle>>(() => readFeatureStyles());
  const [customizing, setCustomizing] = useState<Feat | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [capsuleOpen, setCapsuleOpen] = useState(false);
  const [capsuleCount, setCapsuleCount] = useState<number | null>(null);
  const [dreamJarOpen, setDreamJarOpen] = useState(false);
  const [wishCount, setWishCount] = useState<number | null>(null);
  const [songOpen, setSongOpen] = useState(false);
  const [hasCurrentSong, setHasCurrentSong] = useState(false);
  const [loveNotesOpen, setLoveNotesOpen] = useState(false);
  const [unreadLoveNotes, setUnreadLoveNotes] = useState(0);
  const [anniversaryReminderOpen, setAnniversaryReminderOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [battleshipOpen, setBattleshipOpen] = useState(false);
  const [numberGuessOpen, setNumberGuessOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [notifications, setNotifications] = useState<NotificationStatus>(notificationStatus);
  const [notificationBusy, setNotificationBusy] = useState(false);

  useEffect(() => {
    function openSongSheet() {
      sessionStorage.removeItem('open-song-of-us');
      setSongOpen(true);
    }

    if (sessionStorage.getItem('open-song-of-us') === '1') openSongSheet();
    window.addEventListener('open-song-of-us', openSongSheet);
    return () => window.removeEventListener('open-song-of-us', openSongSheet);
  }, []);

  function saveFeatureStyle(featureId: string, patch: FeatureStyle) {
    setFeatureStyles((existing) => {
      const next = { ...existing, [featureId]: { ...existing[featureId], ...patch } };
      localStorage.setItem(FEATURE_STYLE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function startLongPress(feature: Feat) {
    longPressTriggered.current = false;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      setCustomizing(feature);
    }, 550);
  }

  function clearLongPress() {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  function handleFeatureClick(feature: Feat) {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    openFeature(feature);
  }

  function openFeature(feature: Feat) {
    if (feature.action === 'couple-game') return setGameMenuOpen(true);
    if (feature.action === 'love-notes') return setLoveNotesOpen(true);
    if (feature.action === 'anniversary-reminder') return setAnniversaryReminderOpen(true);
    if (feature.action === 'song-of-us') return setSongOpen(true);
    if (feature.action === 'dream-jar') return setDreamJarOpen(true);
    if (feature.action === 'capsule') return setCapsuleOpen(true);
    toast(feature.toast);
  }

  function openSheet() {
    setStep(1);
    setNewEmail('');
    setCode('');
    setSheetOpen(true);
  }

  function openPasswordSheet() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordOpen(true);
  }

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { devCode } = await api<{ devCode?: string }>('/auth/recovery-email/request-otp', {
        method: 'POST',
        body: JSON.stringify({ newEmail }),
      });
      setStep(2);
      toast('Код илгээлээ');
      if (devCode) {
        setCode(devCode);
        toast(`Туршилтын код: ${devCode}`);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/auth/recovery-email/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      await refresh();
      toast('Сэргээх Gmail шинэчлэгдлээ');
      setSheetOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) return toast('Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байна');
    if (newPassword !== confirmPassword) return toast('Шинэ нууц үгүүд таарахгүй байна');

    setPasswordBusy(true);
    try {
      await api('/auth/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Нууц үг шинэчлэгдлээ');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Нууц үг шинэчлэхэд алдаа гарлаа');
    } finally {
      setPasswordBusy(false);
    }
  }

  async function toggleNotifications() {
    setNotificationBusy(true);
    try {
      if (notifications === 'granted') {
        await disableNotifications();
        setNotifications('default');
        toast('Chat notification унтарлаа');
      } else {
        await enableNotifications();
        setNotifications('granted');
        toast('Chat notification аслаа');
      }
    } catch (err) {
      setNotifications(notificationStatus());
      toast(err instanceof Error ? err.message : 'Notification тохируулахад алдаа гарлаа');
    } finally {
      setNotificationBusy(false);
    }
  }

  function renderFeature(feature: Feat) {
    const style = featureStyles[feature.id] ?? {};
    const Icon = (style.icon && ICONS_BY_KEY[style.icon]) || feature.icon;
    const bgClass = (style.bg && BG_BY_KEY[style.bg]) || 'bg-warm';

    return (
      <button
        key={feature.id}
        onClick={() => handleFeatureClick(feature)}
        onPointerDown={() => startLongPress(feature)}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onPointerLeave={clearLongPress}
        className="mb-2.5 flex w-full items-center gap-3.5 rounded-2xl bg-card px-3.5 py-3.5 text-left shadow-[0_2px_14px_rgba(45,31,46,0.07)] transition-transform active:scale-[0.97]"
      >
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-rose ${bgClass}`}>
          <Icon size={23} strokeWidth={2.1} aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-deep">{feature.name}</div>
          <div className="mt-0.5 text-xs leading-snug text-muted">{feature.desc}</div>
        </div>
        {feature.action === 'love-notes' && unreadLoveNotes > 0 ? (
          <span className="rounded-lg bg-rose px-2 py-0.5 text-[10px] font-bold text-white">{unreadLoveNotes}</span>
        ) : feature.action === 'song-of-us' && hasCurrentSong ? (
          <span className="rounded-lg bg-purple px-2 py-0.5 text-[10px] font-bold text-white">Сонгосон</span>
        ) : feature.action === 'dream-jar' && wishCount !== null ? (
          <span className="rounded-lg bg-rose/10 px-2 py-0.5 text-[10px] font-bold text-rose">{wishCount}</span>
        ) : feature.action === 'capsule' && capsuleCount !== null ? (
          <span className="rounded-lg bg-rose/10 px-2 py-0.5 text-[10px] font-bold text-rose">{capsuleCount}</span>
        ) : feature.badge ? (
          <span className="rounded-lg bg-purple px-2 py-0.5 text-[10px] font-bold text-white">{feature.badge}</span>
        ) : (
          <span className="text-xl text-muted">›</span>
        )}
      </button>
    );
  }

  return (
    <>
      <header className="flex-shrink-0 px-6 pt-3">
        <div className="text-2xl font-bold text-deep">Илүү...</div>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-[90px] pt-3.5">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-5">
            <div className="mb-2.5 pl-1 text-[11px] font-bold uppercase tracking-wider text-muted">{section.title}</div>
            {section.items.map(renderFeature)}
          </div>
        ))}

        <div className="mb-5">
          <div className="mb-2.5 pl-1 text-[11px] font-bold uppercase tracking-wider text-muted">Бүртгэл</div>
          <div className="rounded-2xl bg-card px-3.5 py-3.5 shadow-[0_2px_14px_rgba(45,31,46,0.07)]">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-warm text-rose">
                <Mail size={22} aria-hidden="true" />
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-deep">Сэргээх Gmail</div>
                <div className="mt-0.5 text-xs leading-snug text-muted">
                  {user?.recoveryEmail ? user.recoveryEmail : 'Холбоогүй, нууц үг сэргээхэд хэрэгтэй'}
                </div>
              </div>
              <button onClick={openSheet} className="rounded-lg bg-rose/10 px-3 py-1.5 text-xs font-bold text-rose transition-transform active:scale-95">
                {user?.recoveryEmail ? 'Солих' : 'Холбох'}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3.5 border-t border-blush/60 pt-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-warm text-rose">
                <KeyRound size={22} aria-hidden="true" />
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-deep">Нууц үг</div>
                <div className="mt-0.5 text-xs leading-snug text-muted">Нэвтрэх нууц үгээ шинэчлэх</div>
              </div>
              <button onClick={openPasswordSheet} className="rounded-lg bg-rose/10 px-3 py-1.5 text-xs font-bold text-rose transition-transform active:scale-95">
                Солих
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3.5 border-t border-blush/60 pt-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-warm text-rose">
                {notifications === 'granted' ? <Bell size={22} /> : <BellOff size={22} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-deep">Chat notification</div>
                <div className="mt-0.5 text-xs leading-snug text-muted">
                  {notifications === 'unsupported'
                    ? 'Энэ browser дэмжихгүй байна'
                    : notifications === 'denied'
                      ? 'Browser settings-ээс зөвшөөрнө үү'
                      : notifications === 'granted'
                        ? 'Энэ төхөөрөмж дээр асаалттай'
                        : 'Шинэ зурвас ирэхэд мэдэгдэнэ'}
                </div>
              </div>
              <button
                onClick={() => void toggleNotifications()}
                disabled={notificationBusy || notifications === 'unsupported' || notifications === 'denied'}
                className="rounded-lg bg-rose/10 px-3 py-1.5 text-xs font-bold text-rose transition-transform active:scale-95 disabled:opacity-45"
              >
                {notificationBusy ? '...' : notifications === 'granted' ? 'Унтраах' : 'Асаах'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2 rounded-2xl bg-card px-4 py-3 text-center text-xs text-muted shadow-sm">
          Урилгын код: <span className="font-mono font-bold text-rose">{couple?.inviteCode}</span>
        </div>

        <button onClick={logout} className="mt-3 w-full rounded-2xl border border-rose/40 py-3 text-sm font-medium text-rose">
          Гарах
        </button>
        <div className="mt-2 flex justify-center gap-5 py-2 text-xs text-muted">
          <a href="/privacy.html" target="_blank" rel="noreferrer" className="underline">
            Нууцлалын бодлого
          </a>
          <button onClick={() => setDeleteOpen(true)} className="underline">
            Бүртгэл устгах
          </button>
        </div>
        <DeleteAccountSheet open={deleteOpen} onClose={() => setDeleteOpen(false)} />
      </div>

      <Sheet open={Boolean(customizing)} onClose={() => setCustomizing(null)} title={customizing?.name ?? 'Icon'}>
        {customizing && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-semibold text-muted">Icon</div>
              <div className="grid grid-cols-4 gap-2">
                {ICON_OPTIONS.map((option) => {
                  const selected = featureStyles[customizing.id]?.icon === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => saveFeatureStyle(customizing.id, { icon: option.key })}
                      className={`relative flex h-12 items-center justify-center rounded-xl bg-warm text-rose ${selected ? 'ring-2 ring-rose' : ''}`}
                      title={option.label}
                      aria-label={option.label}
                    >
                      <option.icon size={21} aria-hidden="true" />
                      {selected && <Check size={13} className="absolute right-1.5 top-1.5" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-muted">Background</div>
              <div className="grid grid-cols-3 gap-2">
                {BG_OPTIONS.map((option) => {
                  const selected = (featureStyles[customizing.id]?.bg ?? 'warm') === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => saveFeatureStyle(customizing.id, { bg: option.key })}
                      className={`relative h-12 rounded-xl border border-blush/70 ${option.className} ${selected ? 'ring-2 ring-rose' : ''}`}
                      title={option.label}
                      aria-label={option.label}
                    >
                      {selected && <Check size={14} className="absolute right-2 top-2 text-rose" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Сэргээх Gmail солих">
        {step === 1 ? (
          <form onSubmit={requestCode} className="space-y-3">
            <p className="text-center text-sm text-muted">Шинэ Gmail хаягаа оруулна уу. Баталгаажуулах код илгээнэ.</p>
            <input
              type="email"
              autoCapitalize="none"
              placeholder="shine@gmail.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-blush/60 bg-white px-4 py-3 text-deep outline-none focus:border-rose"
            />
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-rose py-3 font-medium text-white transition-all active:scale-[0.97] disabled:opacity-60">
              {busy ? 'Илгээж байна...' : 'Код илгээх'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-3">
            <p className="text-center text-sm text-muted">
              <span className="font-medium text-deep">{newEmail}</span> руу илгээсэн кодыг оруулна уу.
            </p>
            <input
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              className="w-full rounded-xl border border-blush/60 bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-deep outline-none focus:border-rose"
            />
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-rose py-3 font-medium text-white transition-all active:scale-[0.97] disabled:opacity-60">
              {busy ? 'Шалгаж байна...' : 'Баталгаажуулах'}
            </button>
            <button type="button" className="w-full text-center text-sm text-muted" onClick={() => setStep(1)}>
              Имэйл солих
            </button>
          </form>
        )}
      </Sheet>

      <Sheet open={passwordOpen} onClose={() => setPasswordOpen(false)} title="Нууц үг солих">
        <form onSubmit={changePassword} className="space-y-3">
          <PasswordInput placeholder="Одоогийн нууц үг" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          <PasswordInput placeholder="Шинэ нууц үг (6+ тэмдэгт)" autoComplete="new-password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          <PasswordInput placeholder="Шинэ нууц үг давтах" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          <button type="submit" disabled={passwordBusy} className="w-full rounded-xl bg-rose py-3 font-medium text-white transition-all active:scale-[0.97] disabled:opacity-60">
            {passwordBusy ? 'Шинэчилж байна...' : 'Нууц үг шинэчлэх'}
          </button>
        </form>
      </Sheet>

      <TimeCapsuleSheet open={capsuleOpen} onClose={() => setCapsuleOpen(false)} onCountChange={setCapsuleCount} />
      <DreamJarSheet open={dreamJarOpen} onClose={() => setDreamJarOpen(false)} onCountChange={setWishCount} />
      <SongOfUsSheet open={songOpen} onClose={() => setSongOpen(false)} onCurrentChange={setHasCurrentSong} />
      <LoveNotesSheet open={loveNotesOpen} onClose={() => setLoveNotesOpen(false)} onUnreadChange={setUnreadLoveNotes} />
      <AnniversaryReminderSheet open={anniversaryReminderOpen} onClose={() => setAnniversaryReminderOpen(false)} />
      <CoupleGameSheet open={gameOpen} onClose={() => setGameOpen(false)} />
      <BattleshipSheet open={battleshipOpen} onClose={() => setBattleshipOpen(false)} />
      <NumberGuessSheet open={numberGuessOpen} onClose={() => setNumberGuessOpen(false)} />

      <Sheet open={gameMenuOpen} onClose={() => setGameMenuOpen(false)} title="Хосуудын тоглоом">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              setGameMenuOpen(false);
              setGameOpen(true);
            }}
            className="flex w-full items-center gap-3.5 rounded-xl bg-white px-4 py-3.5 text-left shadow-sm"
          >
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-warm text-rose">
              <MessageCircle size={22} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-deep">Хэн нь илүү?</span>
              <span className="mt-0.5 block text-xs text-muted">Тест үүсгээд partner-аараа тоглуулах</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setGameMenuOpen(false);
              setBattleshipOpen(true);
            }}
            className="flex w-full items-center gap-3.5 rounded-xl bg-white px-4 py-3.5 text-left shadow-sm"
          >
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-warm text-rose">
              <Plane size={22} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-deep">Онгоц буудах</span>
              <span className="mt-0.5 block text-xs text-muted">Дүрст онгоцоо байрлуулаад ээлжээр буудах</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setGameMenuOpen(false);
              setNumberGuessOpen(true);
            }}
            className="flex w-full items-center gap-3.5 rounded-xl bg-white px-4 py-3.5 text-left shadow-sm"
          >
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-warm text-rose">
              <KeyRound size={22} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-deep">Тоо олох</span>
              <span className="mt-0.5 block text-xs text-muted">4 оронтой нууц тоог alpha/betta-р таах</span>
            </span>
          </button>
        </div>
      </Sheet>
    </>
  );
}
