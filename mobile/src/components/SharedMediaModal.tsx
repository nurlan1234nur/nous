import { useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assetUrl } from '../lib/api';
import type { Message } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  messages: Message[];
}

// Чатад хуваалцсан зургууд (шинэ нь эхэнд), дарвал томоор харна.
export function SharedMediaModal({ open, onClose, messages }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [preview, setPreview] = useState<string | null>(null);
  const images = messages.filter((m) => !m.deleted && m.imageUrl).reverse();
  const size = (width - 4 * 4) / 3;

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={open}>
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text style={styles.title}>Хуваалцсан зургууд</Text>
          <Pressable accessibilityLabel="Хаах" onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>
        <FlatList
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 16 }]}
          data={images}
          keyExtractor={(m) => m._id}
          ListEmptyComponent={<Text style={styles.empty}>Одоохондоо зураг алга.</Text>}
          numColumns={3}
          renderItem={({ item }) => (
            <Pressable onPress={() => setPreview(assetUrl(item.imageUrl as string))}>
              <Image source={{ uri: assetUrl(item.imageUrl as string) }} style={{ height: size, width: size }} />
            </Pressable>
          )}
        />
      </View>
      <Modal animationType="fade" onRequestClose={() => setPreview(null)} transparent visible={Boolean(preview)}>
        <Pressable onPress={() => setPreview(null)} style={styles.previewBackdrop}>
          {preview ? <Image resizeMode="contain" source={{ uri: preview }} style={styles.previewImage} /> : null}
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#fdf6f0', flex: 1 },
  header: {
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    borderBottomColor: '#f5c6ce',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: 20,
  },
  title: { color: '#2d1f2e', fontSize: 20, fontWeight: '800' },
  close: { alignItems: 'center', backgroundColor: '#f9ede6', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  closeText: { color: '#e8607a', fontSize: 24, fontWeight: '700', lineHeight: 26 },
  grid: { gap: 4, padding: 4 },
  row: { gap: 4 },
  empty: { color: '#9b8a93', marginTop: 40, textAlign: 'center' },
  previewBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.92)', flex: 1, justifyContent: 'center' },
  previewImage: { height: '80%', width: '100%' },
});
