import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

// Бүртгэл бүрмөсөн устгах — App Store (5.1.1(v)) болон Google Play-ийн шаардлага.
export function DeleteAccountSection() {
  const { deleteAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function confirm() {
    Alert.alert(
      'Бүртгэлээ устгах уу?',
      'Таны профайл бүрмөсөн устана. Хосын дурсамж, зурвасууд хамтрагчид тань үлдэнэ. Хоёулаа устгавал бүх өгөгдөл устна. Энэ үйлдлийг буцаах боломжгүй.',
      [
        { text: 'Болих', style: 'cancel' },
        { text: 'Устгах', style: 'destructive', onPress: () => void submit() },
      ],
    );
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await deleteAccount(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Устгаж чадсангүй');
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.link}>
        <Text style={styles.linkText}>Бүртгэл устгах</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Бүртгэл устгах</Text>
      <Text style={styles.body}>Баталгаажуулахын тулд нууц үгээ оруулна уу.</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="current-password"
        onChangeText={setPassword}
        placeholder="Нууц үг"
        placeholderTextColor="#b8a8b0"
        secureTextEntry
        style={styles.input}
        value={password}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            setOpen(false);
            setPassword('');
            setError('');
          }}
          style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Болих</Text>
        </Pressable>
        <Pressable
          disabled={busy || !password}
          onPress={confirm}
          style={({ pressed }) => [styles.danger, pressed && styles.pressed, (busy || !password) && styles.disabled]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.dangerText}>Бүрмөсөн устгах</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  link: { alignItems: 'center', marginTop: 14, paddingVertical: 10 },
  linkText: { color: '#9b8a93', fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  card: {
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginTop: 18,
    padding: 16,
  },
  title: { color: '#c0392b', fontSize: 17, fontWeight: '800' },
  body: { color: '#6b5a63', fontSize: 14, lineHeight: 20 },
  input: {
    backgroundColor: '#fff',
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    color: '#2d1f2e',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: { color: '#c0392b', fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  cancel: {
    alignItems: 'center',
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  cancelText: { color: '#6b5a63', fontSize: 15, fontWeight: '800' },
  danger: { alignItems: 'center', backgroundColor: '#c0392b', borderRadius: 12, flex: 1, paddingVertical: 12 },
  dangerText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});
