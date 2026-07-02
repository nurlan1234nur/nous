import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { Couple } from '../types';

export function CoupleSetupScreen() {
  const { logout, refresh } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [created, setCreated] = useState<Couple | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function createCouple() {
    void run(async () => {
      const response = await api<{ couple: Couple }>('/couples/create', { method: 'POST' });
      setCreated(response.couple);
      await refresh();
    });
  }

  function joinCouple() {
    void run(async () => {
      await api('/couples/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
      });
      await refresh();
    });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.panel}>
        <Text style={styles.title}>Connect your couple</Text>
        <Text style={styles.subtitle}>Create a private space or join with an invite code.</Text>

        {created ? (
          <View style={styles.inviteBox}>
            <Text style={styles.label}>Invite code</Text>
            <Text selectable style={styles.code}>
              {created.inviteCode}
            </Text>
            <Text style={styles.help}>Send this code to your partner. The app will continue after they join.</Text>
          </View>
        ) : (
          <>
            <Pressable
              disabled={busy}
              onPress={createCouple}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create couple</Text>}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!busy}
              maxLength={12}
              onChangeText={(value) => setInviteCode(value.toUpperCase())}
              placeholder="Invite code"
              placeholderTextColor="#9b8a93"
              style={styles.input}
              value={inviteCode}
            />
            <Pressable
              disabled={busy || !inviteCode.trim()}
              onPress={joinCouple}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
                (busy || !inviteCode.trim()) && styles.disabled,
              ]}
            >
              <Text style={styles.secondaryText}>Join with code</Text>
            </Pressable>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable disabled={busy} onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fdf6f0',
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    gap: 12,
  },
  title: {
    color: '#2d1f2e',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#9b8a93',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#e8607a',
    borderRadius: 12,
    minHeight: 50,
    justifyContent: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginVertical: 2,
  },
  divider: {
    backgroundColor: '#f5c6ce',
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: '#9b8a93',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    color: '#2d1f2e',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    paddingHorizontal: 14,
    paddingVertical: 13,
    textAlign: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#e8607a',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 50,
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#e8607a',
    fontSize: 16,
    fontWeight: '700',
  },
  inviteBox: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    padding: 18,
  },
  label: {
    color: '#9b8a93',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  code: {
    color: '#e8607a',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: 6,
  },
  help: {
    color: '#9b8a93',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  error: {
    color: '#b9314f',
    textAlign: 'center',
  },
  logoutButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  logoutText: {
    color: '#9b8a93',
    fontSize: 13,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
});
