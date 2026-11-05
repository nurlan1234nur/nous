import { api } from './api';

export type NotificationStatus = 'unsupported' | NotificationPermission;
const ENABLED_KEY = 'nous-push-enabled';

export function notificationStatus(): NotificationStatus {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return localStorage.getItem(ENABLED_KEY) === 'true' ? 'granted' : 'default';
  }
  return Notification.permission;
}

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new Uint8Array(bytes.buffer);
}

export async function enableNotifications(): Promise<void> {
  if (notificationStatus() === 'unsupported') throw new Error('Энэ browser push notification дэмжихгүй байна');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission зөвшөөрөгдсөнгүй');

  const config = await api<{ enabled: boolean; publicKey: string }>('/notifications/config');
  if (!config.enabled || !config.publicKey) throw new Error('Server notification тохируулагдаагүй байна');

  let registration = await navigator.serviceWorker.getRegistration();
  if (!registration) registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(config.publicKey),
    }));

  await api('/notifications/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription.toJSON()),
  });
  localStorage.setItem(ENABLED_KEY, 'true');
}

export async function disableNotifications(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) {
    localStorage.removeItem(ENABLED_KEY);
    return;
  }

  await api('/notifications/subscribe', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
  localStorage.removeItem(ENABLED_KEY);
}
