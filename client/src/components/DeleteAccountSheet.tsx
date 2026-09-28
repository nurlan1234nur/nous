import { useState } from 'react';
import Sheet from './Sheet';
import PasswordInput from './PasswordInput';
import { useAuth } from '../context/AuthContext';

// Бүртгэл бүрмөсөн устгах (mobile app-тай ижил endpoint: DELETE /api/auth/me).
export default function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { deleteAccount } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!window.confirm('Бүртгэлээ бүрмөсөн устгах уу? Энэ үйлдлийг буцаах боломжгүй.')) return;
    setBusy(true);
    setError('');
    try {
      await deleteAccount(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Устгаж чадсангүй');
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Бүртгэл устгах">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Таны профайл бүрмөсөн устана. Хосын дурсамж, зурвасууд хамтрагчид тань үлдэнэ. Хоёулаа устгавал бүх өгөгдөл
          устна.
        </p>
        <PasswordInput
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Нууц үгээ оруулна уу"
          value={password}
        />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button
          disabled={busy || !password}
          onClick={() => void submit()}
          className="w-full rounded-2xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? '...' : 'Бүрмөсөн устгах'}
        </button>
      </div>
    </Sheet>
  );
}
