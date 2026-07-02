import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useCouple } from '../context/CoupleContext';
import { api } from '../lib/api';
import { DreamJarSection } from '../components/DreamJarSection';
import { LoveNotesSection } from '../components/LoveNotesSection';
import { AnniversaryReminderSection } from '../components/AnniversaryReminderSection';
import { BattleshipSection } from '../components/BattleshipSection';
import { NumberGuessSection } from '../components/NumberGuessSection';
import { SongOfUsSection } from '../components/SongOfUsSection';
import { TimeCapsuleSection } from '../components/TimeCapsuleSection';
import { WhoIsMoreSection } from '../components/WhoIsMoreSection';

const THEME_OPTIONS = ['rose', 'sunset', 'ocean', 'violet', 'forest'] as const;

export function MoreScreen() {
  const { user, logout, refresh } = useAuth();
  const { couple, partner, loading: coupleLoading } = useCouple();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [profileBirthday, setProfileBirthday] = useState('');
  const [profileTheme, setProfileTheme] = useState<(typeof THEME_OPTIONS)[number]>('rose');
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<1 | 2>(1);
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function cleanDate(value: string): string {
    return value.replace(/[^\d-]/g, '').slice(0, 10);
  }

  function toggleProfileForm() {
    const next = !profileOpen;
    setProfileOpen(next);
    setEmailOpen(false);
    setPasswordOpen(false);
    setError('');
    setMessage('');
    if (next && user) {
      setProfileName(user.name ?? '');
      setProfileAvatar(user.avatar ?? '');
      setProfileStatus(user.status ?? '');
      setProfileBirthday(user.birthday ?? '');
      setProfileTheme(user.theme ?? 'rose');
    }
  }

  function toggleEmailForm() {
    setEmailOpen((value) => !value);
    setPasswordOpen(false);
    setEmailStep(1);
    setNewEmail('');
    setEmailCode('');
    setDevCode('');
    setError('');
    setMessage('');
  }

  async function requestEmailCode() {
    setError('');
    setMessage('');
    setDevCode('');
    setBusy(true);
    try {
      const response = await api<{ devCode?: string }>('/auth/recovery-email/request-otp', {
        method: 'POST',
        body: JSON.stringify({ newEmail: newEmail.trim() }),
      });
      setDevCode(response.devCode ?? '');
      setEmailCode(response.devCode ?? '');
      setEmailStep(2);
      setMessage('Recovery email code sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send recovery email code');
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmailCode() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await api('/auth/recovery-email/verify', {
        method: 'POST',
        body: JSON.stringify({ code: emailCode.trim() }),
      });
      await refresh();
      setEmailOpen(false);
      setEmailStep(1);
      setNewEmail('');
      setEmailCode('');
      setDevCode('');
      setMessage('Recovery email updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify recovery email');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    setError('');
    setMessage('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await api('/auth/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordOpen(false);
      setMessage('Password changed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setError('');
    setMessage('');
    if (!profileName.trim()) {
      setError('Name is required.');
      return;
    }
    if (profileBirthday && !/^\d{4}-\d{2}-\d{2}$/.test(profileBirthday)) {
      setError('Birthday must be YYYY-MM-DD.');
      return;
    }

    setBusy(true);
    try {
      await api('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profileName.trim(),
          avatar: profileAvatar.trim() || profileName.trim().slice(0, 1).toUpperCase(),
          status: profileStatus.trim(),
          theme: profileTheme,
          birthday: profileBirthday,
        }),
      });
      await refresh();
      setProfileOpen(false);
      setMessage('Profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update profile');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Text style={styles.title}>{'\u0418\u043b\u04af\u04af...'}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{'\u0422\u0443\u0441\u0433\u0430\u0439 \u0437\u04af\u0439\u043b\u0441'}</Text>
        <DreamJarSection />
        <SongOfUsSection />
        <TimeCapsuleSection />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{'\u0425\u043e\u0451\u0443\u043b\u0430\u0430'}</Text>
        <WhoIsMoreSection />
        <BattleshipSection />
        <NumberGuessSection />
        <LoveNotesSection />
        <AnniversaryReminderSection />
        <View style={styles.row}>
          <View style={styles.iconBadge}>
            <Text style={styles.iconText}>{'\u2605'}</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{'\u0423\u0440\u0438\u043b\u0433\u044b\u043d \u043a\u043e\u0434'}</Text>
            <Text selectable style={styles.codeValue}>{couple?.inviteCode ?? '-'}</Text>
          </View>
          {coupleLoading ? <ActivityIndicator color="#e8607a" /> : <Text style={styles.badge}>Active</Text>}
        </View>
        <View style={styles.row}>
          <View style={styles.iconBadge}>
            <Text style={styles.iconText}>{'\u2665'}</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Partner</Text>
            <Text style={styles.rowValue}>{partner?.name ?? 'Waiting for partner to join'}</Text>
          </View>
          <Text style={styles.badge}>{partner ? 'Connected' : 'Open'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{'\u0411\u04af\u0440\u0442\u0433\u044d\u043b'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.avatar || user?.name?.slice(0, 1).toUpperCase() || 'N'}</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <Pressable onPress={toggleProfileForm} style={styles.profileEditButton}>
            <Text style={styles.profileEditText}>{profileOpen ? 'Close' : 'Edit'}</Text>
          </Pressable>
        </View>
        {profileOpen ? (
          <View style={styles.form}>
            <TextInput editable={!busy} onChangeText={setProfileName} placeholder="Name" placeholderTextColor="#9b8a93" style={styles.passwordInput} value={profileName} />
            <TextInput editable={!busy} onChangeText={setProfileAvatar} placeholder="Avatar text or emoji" placeholderTextColor="#9b8a93" style={styles.passwordInput} value={profileAvatar} />
            <TextInput editable={!busy} maxLength={120} onChangeText={setProfileStatus} placeholder="Status" placeholderTextColor="#9b8a93" style={styles.passwordInput} value={profileStatus} />
            <TextInput
              editable={!busy}
              keyboardType="numbers-and-punctuation"
              onChangeText={(value) => setProfileBirthday(cleanDate(value))}
              placeholder="Birthday YYYY-MM-DD"
              placeholderTextColor="#9b8a93"
              style={styles.passwordInput}
              value={profileBirthday}
            />
            <View style={styles.themeRow}>
              {THEME_OPTIONS.map((theme) => (
                <Pressable key={theme} onPress={() => setProfileTheme(theme)} style={[styles.themeButton, profileTheme === theme && styles.themeButtonActive]}>
                  <Text style={[styles.themeText, profileTheme === theme && styles.themeTextActive]}>{theme}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable disabled={busy} onPress={saveProfile} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, busy && styles.disabled]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save profile</Text>}
            </Pressable>
          </View>
        ) : null}
        <Pressable onPress={toggleEmailForm} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <View style={styles.iconBadge}>
            <Text style={styles.iconText}>{'\u2709'}</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Recovery email</Text>
            <Text style={styles.rowValue}>{user?.recoveryEmail || 'Not connected'}</Text>
          </View>
          <Text style={styles.badge}>{emailOpen ? 'Close' : user?.recoveryEmail ? 'Change' : 'Add'}</Text>
        </Pressable>
        {emailOpen ? (
          <View style={styles.form}>
            {emailStep === 1 ? (
              <>
                <Text style={styles.formHelp}>Enter a Gmail address. We will send a confirmation code.</Text>
                <TextInput
                  autoCapitalize="none"
                  editable={!busy}
                  keyboardType="email-address"
                  onChangeText={setNewEmail}
                  placeholder="your@gmail.com"
                  placeholderTextColor="#9b8a93"
                  style={styles.passwordInput}
                  value={newEmail}
                />
                <Pressable
                  disabled={busy || !newEmail.trim()}
                  onPress={requestEmailCode}
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.pressed,
                    (busy || !newEmail.trim()) && styles.disabled,
                  ]}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Send code</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.formHelp}>Enter the 6-digit code sent to {newEmail}.</Text>
                {devCode ? <Text style={styles.devCode}>Dev code: {devCode}</Text> : null}
                <TextInput
                  editable={!busy}
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={(value) => setEmailCode(value.replace(/\D/g, ''))}
                  placeholder="000000"
                  placeholderTextColor="#9b8a93"
                  style={styles.codeInput}
                  value={emailCode}
                />
                <Pressable
                  disabled={busy || emailCode.length !== 6}
                  onPress={verifyEmailCode}
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.pressed,
                    (busy || emailCode.length !== 6) && styles.disabled,
                  ]}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Verify email</Text>}
                </Pressable>
                <Pressable onPress={() => setEmailStep(1)} style={styles.inlineButton}>
                  <Text style={styles.inlineButtonText}>Change email</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
        <Pressable
          onPress={() => {
            setPasswordOpen((value) => !value);
            setEmailOpen(false);
            setError('');
            setMessage('');
          }}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.iconBadge}>
            <Text style={styles.iconText}>{'\u26bf'}</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Password</Text>
            <Text style={styles.rowValue}>Change your login password.</Text>
          </View>
          <Text style={styles.badge}>{passwordOpen ? 'Close' : 'Change'}</Text>
        </Pressable>
        {passwordOpen ? (
          <View style={styles.form}>
            <View style={styles.passwordRow}>
              <TextInput
                editable={!busy}
                onChangeText={setCurrentPassword}
                placeholder="Current password"
                placeholderTextColor="#9b8a93"
                secureTextEntry={!showPasswords}
                style={styles.passwordInput}
                value={currentPassword}
              />
            </View>
            <View style={styles.passwordRow}>
              <TextInput
                editable={!busy}
                onChangeText={setNewPassword}
                placeholder="New password"
                placeholderTextColor="#9b8a93"
                secureTextEntry={!showPasswords}
                style={styles.passwordInput}
                value={newPassword}
              />
            </View>
            <View style={styles.passwordRow}>
              <TextInput
                editable={!busy}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor="#9b8a93"
                secureTextEntry={!showPasswords}
                style={styles.passwordInput}
                value={confirmPassword}
              />
            </View>
            <Pressable onPress={() => setShowPasswords((value) => !value)} style={styles.inlineButton}>
              <Text style={styles.inlineButtonText}>{showPasswords ? 'Hide passwords' : 'Show passwords'}</Text>
            </Pressable>
            <Pressable
              disabled={busy || !currentPassword || !newPassword || !confirmPassword}
              onPress={changePassword}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.pressed,
                (busy || !currentPassword || !newPassword || !confirmPassword) && styles.disabled,
              ]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save password</Text>}
            </Pressable>
          </View>
        ) : null}
      </View>

      <Pressable onPress={logout} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#fdf6f0',
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 32,
    paddingTop: 72,
  },
  title: {
    color: '#2d1f2e',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9b8a93',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginTop: 22,
    padding: 16,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#f9ede6',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: '#e8607a',
    fontSize: 22,
    fontWeight: '800',
  },
  profileText: {
    flex: 1,
  },
  name: {
    color: '#2d1f2e',
    fontSize: 18,
    fontWeight: '800',
  },
  email: {
    color: '#9b8a93',
    fontSize: 13,
    marginTop: 2,
  },
  profileEditButton: {
    backgroundColor: '#f9ede6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  profileEditText: {
    color: '#e8607a',
    fontSize: 12,
    fontWeight: '900',
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    color: '#9b8a93',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  row: {
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    padding: 14,
    shadowColor: '#2d1f2e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: '#fdf6f0',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  iconText: {
    color: '#e8607a',
    fontSize: 22,
    fontWeight: '900',
  },
  form: {
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  passwordRow: {
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 16,
    borderWidth: 1,
  },
  passwordInput: {
    color: '#2d1f2e',
    fontSize: 16,
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  formHelp: {
    color: '#9b8a93',
    fontSize: 13,
    lineHeight: 18,
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeButton: {
    backgroundColor: '#fdf6f0',
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  themeButtonActive: {
    backgroundColor: '#e8607a',
    borderColor: '#e8607a',
  },
  themeText: {
    color: '#9b8a93',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  themeTextActive: {
    color: '#fff',
  },
  codeInput: {
    borderColor: '#f5c6ce',
    borderRadius: 12,
    borderWidth: 1,
    color: '#2d1f2e',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlign: 'center',
  },
  devCode: {
    color: '#e8607a',
    fontSize: 13,
    fontWeight: '800',
  },
  inlineButton: {
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  inlineButtonText: {
    color: '#e8607a',
    fontSize: 13,
    fontWeight: '800',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#e8607a',
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    backgroundColor: '#f9ede6',
    borderRadius: 12,
    color: '#b9314f',
    marginBottom: 10,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
  message: {
    backgroundColor: '#eef8ef',
    borderRadius: 12,
    color: '#2f7a45',
    marginBottom: 10,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    color: '#2d1f2e',
    fontSize: 15,
    fontWeight: '800',
  },
  rowValue: {
    color: '#9b8a93',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  codeValue: {
    color: '#e8607a',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 3,
  },
  badge: {
    backgroundColor: '#f9ede6',
    borderRadius: 8,
    color: '#e8607a',
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: '#e8607a',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 18,
    paddingVertical: 14,
  },
  logoutText: {
    color: '#e8607a',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
  },
});
