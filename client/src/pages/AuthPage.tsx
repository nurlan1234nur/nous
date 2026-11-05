import { useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import PasswordInput from '../components/PasswordInput';
import { api } from '../lib/api';

type Screen = 'login' | 'register' | 'forgot' | 'done';

// Жижиг тусгай-зориулалтын UI хэсгүүд ----------------------------------------

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-blush/60 bg-white/70 px-4 py-3 text-deep outline-none transition-colors focus:border-rose"
    />
  );
}

function CodeField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      inputMode="numeric"
      maxLength={6}
      className="w-full rounded-xl border border-blush/60 bg-white/70 px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-deep outline-none transition-colors focus:border-rose"
    />
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose py-3 font-medium text-white shadow-[0_6px_18px_rgba(232,96,122,0.35)] transition-all active:scale-[0.97] disabled:opacity-60 disabled:shadow-none"
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------

export default function AuthPage() {
  const { login } = useAuth();
  const toast = useToast();

  const [screen, setScreen] = useState<Screen>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // login
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // register
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [regEmail, setRegEmail] = useState('');
  const [regCode, setRegCode] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');
  const [doneUsername, setDoneUsername] = useState('');

  // forgot
  const [fgStep, setFgStep] = useState<1 | 2>(1);
  const [fgUser, setFgUser] = useState('');
  const [fgCode, setFgCode] = useState('');
  const [fgPass, setFgPass] = useState('');
  const [fgSentTo, setFgSentTo] = useState('');

  function go(next: Screen) {
    setError('');
    setScreen(next);
  }

  // dev горимд буцсан кодыг автоматаар бөглөж тестлэхэд хялбар болгоно
  function applyDevCode(devCode: string | undefined, set: (v: string) => void) {
    if (devCode) {
      set(devCode);
      toast(`Туршилтын код: ${devCode}`);
    }
  }

  async function run(fn: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  }

  // --- handlers ---

  const submitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await login(loginUser, loginPass);
      // амжилттай бол App автоматаар дотогш оруулна
    });
  };

  const submitRegEmail = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { devCode } = await api<{ devCode?: string }>('/auth/register/request-otp', {
        method: 'POST',
        body: JSON.stringify({ recoveryEmail: regEmail }),
      });
      setRegStep(2);
      toast('Код илгээлээ 📩');
      applyDevCode(devCode, setRegCode);
    });
  };

  const submitRegVerify = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { username } = await api<{ username: string; changed: boolean }>('/auth/register/verify', {
        method: 'POST',
        body: JSON.stringify({ recoveryEmail: regEmail, code: regCode, username: regUser, password: regPass }),
      });
      setDoneUsername(username);
      setLoginUser(username);
      go('done');
    });
  };

  const submitForgotUser = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { sentTo, devCode } = await api<{ sentTo: string; devCode?: string }>('/auth/forgot/request-otp', {
        method: 'POST',
        body: JSON.stringify({ username: fgUser }),
      });
      setFgSentTo(sentTo);
      setFgStep(2);
      toast('Код илгээлээ 📩');
      applyDevCode(devCode, setFgCode);
    });
  };

  const submitForgotReset = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api('/auth/forgot/verify', {
        method: 'POST',
        body: JSON.stringify({ username: fgUser, code: fgCode, password: fgPass }),
      });
      toast('Нууц үг шинэчлэгдлээ ✓');
      setLoginUser(fgUser.replace(/@.*/, ''));
      setFgStep(1);
      setFgCode('');
      setFgPass('');
      go('login');
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-warm to-cream p-6">
      <div className="w-full max-w-sm rounded-[28px] bg-card p-8 shadow-[0_18px_50px_rgba(45,31,46,0.12)]">
        <h1 className="text-center font-serif text-4xl italic text-rose">nous</h1>
        <p className="mb-6 mt-1 text-center text-sm text-muted">хосуудын ертөнц</p>

        {error && (
          <p className="mb-3 rounded-xl bg-rose/10 px-3 py-2 text-center text-sm text-rose">{error}</p>
        )}

        {/* ---------- НЭВТРЭХ ---------- */}
        {screen === 'login' && (
          <form onSubmit={submitLogin} className="space-y-3">
            <Field
              placeholder="Нэр"
              autoCapitalize="none"
              value={loginUser}
              onChange={(e) => setLoginUser(e.target.value)}
              required
            />
            <PasswordInput
              placeholder="Нууц үг"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              required
            />
            <SubmitButton busy={busy}>Нэвтрэх</SubmitButton>

            <div className="flex items-center justify-between pt-1 text-sm">
              <button type="button" className="text-muted" onClick={() => go('forgot')}>
                Нууц үг мартсан?
              </button>
              <button type="button" className="font-medium text-rose" onClick={() => { setRegStep(1); go('register'); }}>
                Бүртгүүлэх
              </button>
            </div>
          </form>
        )}

        {/* ---------- БҮРТГҮҮЛЭХ ---------- */}
        {screen === 'register' && regStep === 1 && (
          <form onSubmit={submitRegEmail} className="space-y-3">
            <p className="text-center text-sm text-muted">
              Gmail хаягаа оруулна уу — баталгаажуулах код илгээнэ.
            </p>
            <Field
              type="email"
              placeholder="name@gmail.com"
              autoCapitalize="none"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              required
            />
            <SubmitButton busy={busy}>Код илгээх</SubmitButton>
            <button type="button" className="w-full pt-1 text-center text-sm text-muted" onClick={() => go('login')}>
              ← Нэвтрэх рүү буцах
            </button>
          </form>
        )}

        {screen === 'register' && regStep === 2 && (
          <form onSubmit={submitRegVerify} className="space-y-3">
            <p className="text-center text-sm text-muted">
              <span className="font-medium text-deep">{regEmail}</span> руу илгээсэн кодыг оруулна уу.
            </p>
            <CodeField placeholder="••••••" value={regCode} onChange={(e) => setRegCode(e.target.value.replace(/\D/g, ''))} required />
            <Field
              placeholder="Нэр сонгох"
              autoCapitalize="none"
              value={regUser}
              onChange={(e) => setRegUser(e.target.value)}
              required
            />
            <PasswordInput
              placeholder="Нууц үг (6+ тэмдэгт)"
              value={regPass}
              onChange={(e) => setRegPass(e.target.value)}
              required
            />
            <SubmitButton busy={busy}>Бүртгүүлэх</SubmitButton>
            <button type="button" className="w-full pt-1 text-center text-sm text-muted" onClick={() => setRegStep(1)}>
              ← Имэйл солих
            </button>
          </form>
        )}

        {/* ---------- БҮРТГЭЛ АМЖИЛТТАЙ ---------- */}
        {screen === 'done' && (
          <div className="space-y-4 text-center">
            <div className="text-5xl">🎉</div>
            <p className="text-deep">Бүртгэл амжилттай боллоо!</p>
            <div className="rounded-2xl bg-warm px-4 py-3">
              <div className="text-xs text-muted">Таны нэвтрэх нэр</div>
              <div className="mt-1 text-xl font-bold text-rose">{doneUsername}</div>
            </div>
            <p className="text-xs text-muted">Цаашид энэ нэр болон нууц үгээрээ нэвтэрнэ.</p>
            <button
              onClick={() => go('login')}
              className="w-full rounded-xl bg-rose py-3 font-medium text-white shadow-[0_6px_18px_rgba(232,96,122,0.35)] transition-all active:scale-[0.97]"
            >
              Нэвтрэх
            </button>
          </div>
        )}

        {/* ---------- НУУЦ ҮГ СЭРГЭЭХ ---------- */}
        {screen === 'forgot' && fgStep === 1 && (
          <form onSubmit={submitForgotUser} className="space-y-3">
            <p className="text-center text-sm text-muted">
              Нэрээ оруулна уу — холбоотой Gmail руу код илгээнэ.
            </p>
            <Field
              placeholder="Нэр"
              autoCapitalize="none"
              value={fgUser}
              onChange={(e) => setFgUser(e.target.value)}
              required
            />
            <SubmitButton busy={busy}>Код илгээх</SubmitButton>
            <button type="button" className="w-full pt-1 text-center text-sm text-muted" onClick={() => go('login')}>
              ← Нэвтрэх рүү буцах
            </button>
          </form>
        )}

        {screen === 'forgot' && fgStep === 2 && (
          <form onSubmit={submitForgotReset} className="space-y-3">
            <p className="text-center text-sm text-muted">
              <span className="font-medium text-deep">{fgSentTo}</span> руу илгээсэн кодыг оруулна уу.
            </p>
            <CodeField placeholder="••••••" value={fgCode} onChange={(e) => setFgCode(e.target.value.replace(/\D/g, ''))} required />
            <PasswordInput
              placeholder="Шинэ нууц үг (6+ тэмдэгт)"
              value={fgPass}
              onChange={(e) => setFgPass(e.target.value)}
              required
            />
            <SubmitButton busy={busy}>Нууц үг шинэчлэх</SubmitButton>
            <button type="button" className="w-full pt-1 text-center text-sm text-muted" onClick={() => setFgStep(1)}>
              ← Буцах
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
