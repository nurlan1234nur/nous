import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

type AuthMode = 'login' | 'forgot-request' | 'forgot-reset' | 'register-email' | 'register-verify';

export function AuthScreen() {
  const { login } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerCode, setRegisterCode] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
    setMessage('');
  }

  async function submitLogin() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function requestResetCode() {
    setError('');
    setMessage('');
    setDevCode('');
    setBusy(true);
    try {
      const response = await api<{ sentTo: string; devCode?: string }>('/auth/forgot/request-otp', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim() }),
      });
      setSentTo(response.sentTo);
      setDevCode(response.devCode ?? '');
      setResetCode(response.devCode ?? '');
      setMode('forgot-reset');
      setMessage('Reset code sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset code');
    } finally {
      setBusy(false);
    }
  }

  async function resetForgotPassword() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await api('/auth/forgot/verify', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          code: resetCode.trim(),
          password: resetPassword,
        }),
      });
      setPassword(resetPassword);
      setResetPassword('');
      setResetCode('');
      setDevCode('');
      setSentTo('');
      setMode('login');
      setMessage('Password changed. You can log in now.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setBusy(false);
    }
  }

  async function requestRegisterCode() {
    setError('');
    setMessage('');
    setDevCode('');
    setBusy(true);
    try {
      const response = await api<{ devCode?: string }>('/auth/register/request-otp', {
        method: 'POST',
        body: JSON.stringify({ recoveryEmail: registerEmail.trim() }),
      });
      setDevCode(response.devCode ?? '');
      setRegisterCode(response.devCode ?? '');
      setMode('register-verify');
      setMessage('Registration code sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send registration code');
    } finally {
      setBusy(false);
    }
  }

  async function verifyRegisterCode() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const response = await api<{ username: string; changed: boolean }>('/auth/register/verify', {
        method: 'POST',
        body: JSON.stringify({
          recoveryEmail: registerEmail.trim(),
          code: registerCode.trim(),
          username: registerUsername.trim(),
          password: registerPassword,
        }),
      });
      setUsername(response.username);
      setPassword(registerPassword);
      setRegisterEmail('');
      setRegisterCode('');
      setRegisterUsername('');
      setRegisterPassword('');
      setDevCode('');
      setMode('login');
      setMessage(response.changed ? `Username changed to ${response.username}. You can log in now.` : 'Account created. You can log in now.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.panel} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.logo}>nous</Text>
          <Text style={styles.subtitle}>хосуудын ертөнц</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor="#9b8a93"
            style={styles.input}
            value={username}
          />

          {mode === 'login' ? (
          <>
            <View style={styles.passwordRow}>
              <TextInput
                editable={!busy}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#9b8a93"
                secureTextEntry={!showPassword}
                style={styles.passwordInput}
                value={password}
              />
              <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.showButton}>
                <Text style={styles.showButtonText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>

            <Pressable
              disabled={busy || !username.trim() || !password}
              onPress={submitLogin}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                (busy || !username.trim() || !password) && styles.buttonDisabled,
              ]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log in</Text>}
            </Pressable>

            <Pressable onPress={() => switchMode('forgot-request')} style={styles.textButton}>
              <Text style={styles.textButtonLabel}>Forgot password?</Text>
            </Pressable>
            <Pressable onPress={() => switchMode('register-email')} style={styles.textButton}>
              <Text style={styles.secondaryTextButtonLabel}>Create account</Text>
            </Pressable>
          </>
          ) : null}

          {mode === 'forgot-request' ? (
          <>
            <Text style={styles.helpText}>Enter your username. We will send a reset code to the recovery email.</Text>
            <Pressable
              disabled={busy || !username.trim()}
              onPress={requestResetCode}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                (busy || !username.trim()) && styles.buttonDisabled,
              ]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send reset code</Text>}
            </Pressable>
            <Pressable onPress={() => switchMode('login')} style={styles.textButton}>
              <Text style={styles.textButtonLabel}>Back to login</Text>
            </Pressable>
          </>
          ) : null}

          {mode === 'forgot-reset' ? (
          <>
            <Text style={styles.helpText}>Code sent to {sentTo}. Enter it with your new password.</Text>
            {devCode ? <Text style={styles.devCode}>Dev code: {devCode}</Text> : null}
            <TextInput
              editable={!busy}
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) => setResetCode(value.replace(/\D/g, ''))}
              placeholder="Reset code"
              placeholderTextColor="#9b8a93"
              style={styles.codeInput}
              value={resetCode}
            />
            <View style={styles.passwordRow}>
              <TextInput
                editable={!busy}
                onChangeText={setResetPassword}
                placeholder="New password"
                placeholderTextColor="#9b8a93"
                secureTextEntry={!showResetPassword}
                style={styles.passwordInput}
                value={resetPassword}
              />
              <Pressable onPress={() => setShowResetPassword((value) => !value)} style={styles.showButton}>
                <Text style={styles.showButtonText}>{showResetPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
            <Pressable
              disabled={busy || resetCode.length !== 6 || resetPassword.length < 6}
              onPress={resetForgotPassword}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                (busy || resetCode.length !== 6 || resetPassword.length < 6) && styles.buttonDisabled,
              ]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Change password</Text>}
            </Pressable>
            <Pressable onPress={() => switchMode('forgot-request')} style={styles.textButton}>
              <Text style={styles.textButtonLabel}>Change username</Text>
            </Pressable>
          </>
          ) : null}

          {mode === 'register-email' ? (
          <>
            <Text style={styles.helpText}>Enter your Gmail. We will send a code to confirm the account.</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              keyboardType="email-address"
              onChangeText={setRegisterEmail}
              placeholder="your@gmail.com"
              placeholderTextColor="#9b8a93"
              style={styles.input}
              value={registerEmail}
            />
            <Pressable
              disabled={busy || !registerEmail.trim()}
              onPress={requestRegisterCode}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                (busy || !registerEmail.trim()) && styles.buttonDisabled,
              ]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
            </Pressable>
            <Pressable onPress={() => switchMode('login')} style={styles.textButton}>
              <Text style={styles.textButtonLabel}>Back to login</Text>
            </Pressable>
          </>
          ) : null}

          {mode === 'register-verify' ? (
          <>
            <Text style={styles.helpText}>Code sent to {registerEmail}. Choose your username and password.</Text>
            {devCode ? <Text style={styles.devCode}>Dev code: {devCode}</Text> : null}
            <TextInput
              editable={!busy}
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) => setRegisterCode(value.replace(/\D/g, ''))}
              placeholder="Code"
              placeholderTextColor="#9b8a93"
              style={styles.codeInput}
              value={registerCode}
            />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              onChangeText={setRegisterUsername}
              placeholder="Username"
              placeholderTextColor="#9b8a93"
              style={styles.input}
              value={registerUsername}
            />
            <View style={styles.passwordRow}>
              <TextInput
                editable={!busy}
                onChangeText={setRegisterPassword}
                placeholder="Password"
                placeholderTextColor="#9b8a93"
                secureTextEntry={!showRegisterPassword}
                style={styles.passwordInput}
                value={registerPassword}
              />
              <Pressable onPress={() => setShowRegisterPassword((value) => !value)} style={styles.showButton}>
                <Text style={styles.showButtonText}>{showRegisterPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
            <Pressable
              disabled={busy || registerCode.length !== 6 || !registerUsername.trim() || registerPassword.length < 6}
              onPress={verifyRegisterCode}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                (busy || registerCode.length !== 6 || !registerUsername.trim() || registerPassword.length < 6) && styles.buttonDisabled,
              ]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create account</Text>}
            </Pressable>
            <Pressable onPress={() => switchMode('register-email')} style={styles.textButton}>
              <Text style={styles.textButtonLabel}>Change email</Text>
            </Pressable>
          </>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fdf6f0',
  },
  panel: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff8f5',
    borderRadius: 28,
    gap: 12,
    padding: 28,
    shadowColor: '#2d1f2e',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 8,
  },
  logo: {
    color: '#e8607a',
    fontFamily: 'PlayfairDisplay_600SemiBold_Italic',
    fontSize: 44,
    fontStyle: 'italic',
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    color: '#9b8a93',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  error: {
    backgroundColor: '#f9ede6',
    borderRadius: 12,
    color: '#b9314f',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
  message: {
    backgroundColor: '#eef8ef',
    borderRadius: 12,
    color: '#2f7a45',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    color: '#2d1f2e',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  passwordRow: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
  },
  passwordInput: {
    color: '#2d1f2e',
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  showButton: {
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  showButtonText: {
    color: '#e8607a',
    fontSize: 13,
    fontWeight: '800',
  },
  helpText: {
    color: '#9b8a93',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  codeInput: {
    backgroundColor: '#fff',
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    color: '#2d1f2e',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
    paddingHorizontal: 14,
    paddingVertical: 13,
    textAlign: 'center',
  },
  devCode: {
    color: '#e8607a',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#e8607a',
    borderRadius: 12,
    marginTop: 4,
    minHeight: 50,
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  textButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  textButtonLabel: {
    color: '#e8607a',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryTextButtonLabel: {
    color: '#9b8a93',
    fontSize: 14,
    fontWeight: '800',
  },
});
