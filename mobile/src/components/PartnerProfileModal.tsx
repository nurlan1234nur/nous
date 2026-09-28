import { useState } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCouple } from '../context/CoupleContext';
import { assetUrl } from '../lib/api';
import { daysSince, formatDate, isImageAvatar, presenceLabel } from '../lib/format';
import { AvatarView } from './AvatarView';
import { themedStyles } from '../theme';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Хамтрагчийн профайл (web-ийн PartnerProfileSheet-ийн native хувилбар).
export function PartnerProfileModal({ open, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { couple, partner, onlineIds, lastSeen } = useCouple();
  const [zoom, setZoom] = useState(false);
  if (!partner) return null;

  const online = onlineIds.includes(partner._id);
  const days = daysSince(couple?.anniversary);
  const canZoom = isImageAvatar(partner.avatar);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <Pressable accessibilityLabel="Хаах" onPress={onClose} style={styles.backdrop} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />
        <Pressable disabled={!canZoom} onPress={() => setZoom(true)} style={styles.avatar}>
          <AvatarView avatar={partner.avatar} name={partner.name} size={96} textStyle={styles.avatarText} />
        </Pressable>
        <Text style={styles.name}>{partner.name}</Text>
        <Text style={[styles.presence, online && styles.online]}>
          {online ? '● ' : ''}
          {presenceLabel(online, lastSeen[partner._id] ?? partner.lastSeenAt)}
        </Text>
        {partner.status ? <Text style={styles.status}>“{partner.status}”</Text> : null}

        <View style={styles.rows}>
          {couple?.anniversary ? <Row icon="🌙" label="Хамтдаа" value={`${days} хоног`} /> : null}
          {partner.birthday ? <Row icon="🎂" label="Төрсөн өдөр" value={formatDate(partner.birthday)} /> : null}
          {couple?.anniversary ? <Row icon="💞" label="Ойн өдөр" value={formatDate(couple.anniversary)} /> : null}
        </View>
      </View>

      <Modal animationType="fade" onRequestClose={() => setZoom(false)} transparent visible={zoom}>
        <Pressable onPress={() => setZoom(false)} style={styles.zoom}>
          {canZoom ? <Image resizeMode="contain" source={{ uri: assetUrl(partner.avatar) }} style={styles.zoomImage} /> : null}
        </Pressable>
      </Modal>
    </Modal>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = themedStyles({
  backdrop: { backgroundColor: 'rgba(45,31,46,0.35)', flex: 1 },
  sheet: {
    alignItems: 'center',
    backgroundColor: '#fdf6f0',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  handle: { backgroundColor: '#f5c6ce', borderRadius: 3, height: 5, marginBottom: 18, width: 44 },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#f9ede6',
    borderColor: '#f5c6ce',
    borderRadius: 48,
    borderWidth: 2,
    height: 96,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 96,
  },
  avatarText: { color: '#e8607a', fontSize: 40, fontWeight: '800' },
  name: { color: '#2d1f2e', fontSize: 24, fontWeight: '800', marginTop: 12 },
  presence: { color: '#9b8a93', fontSize: 13, fontWeight: '700', marginTop: 4 },
  online: { color: '#3a9d6a' },
  status: { color: '#6b5a63', fontSize: 15, fontStyle: 'italic', marginTop: 10, textAlign: 'center' },
  rows: { alignSelf: 'stretch', gap: 8, marginTop: 20 },
  row: {
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    borderColor: '#f5c6ce',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  rowIcon: { fontSize: 18 },
  rowLabel: { color: '#9b8a93', flex: 1, fontSize: 14, fontWeight: '700' },
  rowValue: { color: '#2d1f2e', fontSize: 15, fontWeight: '800' },
  zoom: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.92)', flex: 1, justifyContent: 'center' },
  zoomImage: { height: '80%', width: '100%' },
});
