import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from './api';

// App нээлттэй үед ч notification харуулна (чат дэлгэц дээр биш бол).
let suppressChatNotifications = false;

export function setChatVisible(visible: boolean): void {
  suppressChatNotifications = visible;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isChat = (notification.request.content.data as { type?: string } | undefined)?.type === 'message';
    const show = !(isChat && suppressChatNotifications);
    return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
  },
});

let registeredToken: string | null = null;

function projectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

// Зөвшөөрөл асууж Expo push token авч server-т бүртгэнэ. Амжилтгүй бол чимээгүй null буцаана.
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulator/emulator push авахгүй

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Зурвас',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#e8607a',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted' && current.canAskAgain) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  const id = projectId();
  if (!id) {
    console.warn('[push] EAS projectId тохируулаагүй — `eas init` ажиллуулна уу');
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  await api('/notifications/expo', {
    method: 'POST',
    body: JSON.stringify({ token, platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown' }),
  });
  registeredToken = token;
  return token;
}

// Logout үед энэ төхөөрөмжийг хэрэглэгчээс салгана (өөр хүн нэвтэрвэл түүний push ирэхгүй).
export async function unregisterPushNotifications(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await api('/notifications/expo', { method: 'DELETE', body: JSON.stringify({ token }) }).catch(() => {});
}

// Notification дээр дарахад дуудагдана (app хаалттай байхад дарсан бол эхлэхэд нэг удаа).
export function addNotificationTapListener(onTap: (data: Record<string, unknown>) => void): () => void {
  let cancelled = false;
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!cancelled && response) onTap((response.notification.request.content.data ?? {}) as Record<string, unknown>);
  });
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    onTap((response.notification.request.content.data ?? {}) as Record<string, unknown>);
  });
  return () => {
    cancelled = true;
    sub.remove();
  };
}
