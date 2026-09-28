import { Linking, Modal, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_ORIGIN } from '../config/env';
import { youtubeVideoId } from '../lib/format';
import { themedStyles } from '../theme';
import type { WeeklySong } from '../types';

interface Props {
  song: WeeklySong | null;
  onClose: () => void;
}

function embedHtml(videoId: string): string {
  // YouTube embed нь Referer шаарддаг тул iframe-ийг https baseUrl-тэй HTML дотор ачаална.
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0"
allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></body></html>`;
}

// "Бидний дуу"-г апп дотор тоглуулна (өмнө нь YouTube-ийг гадна нээдэг байсан).
export function SongPlayerModal({ song, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const videoId = youtubeVideoId(song?.url);

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={Boolean(song)}>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <View style={styles.meta}>
            <Text numberOfLines={1} style={styles.title}>{song?.title}</Text>
            <Text numberOfLines={1} style={styles.artist}>{song?.artist}</Text>
          </View>
          <Pressable accessibilityLabel="Хаах" onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        {videoId ? (
          <View style={styles.player}>
            <WebView
              allowsFullscreenVideo
              allowsInlineMediaPlayback
              javaScriptEnabled
              mediaPlaybackRequiresUserAction={false}
              originWhitelist={['*']}
              source={{ html: embedHtml(videoId), baseUrl: API_ORIGIN || 'https://nous.app' }}
              style={styles.webview}
            />
          </View>
        ) : (
          <Text style={styles.unsupported}>Энэ линкийг апп дотор тоглуулах боломжгүй байна.</Text>
        )}

        {song?.url ? (
          <Pressable onPress={() => void Linking.openURL(song.url)} style={styles.external}>
            <Text style={styles.externalText}>YouTube-д нээх</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = themedStyles({
  screen: { backgroundColor: '#2d1f2e', flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  meta: { flex: 1 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  artist: { color: '#f5c6ce', fontSize: 14, marginTop: 2 },
  close: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  closeText: { color: '#fff', fontSize: 24, fontWeight: '700', lineHeight: 26 },
  player: { aspectRatio: 16 / 9, backgroundColor: '#000', marginTop: 24, width: '100%' },
  webview: { backgroundColor: '#000', flex: 1 },
  unsupported: { color: '#f5c6ce', marginTop: 40, paddingHorizontal: 24, textAlign: 'center' },
  external: { alignSelf: 'center', borderColor: '#f5c6ce', borderRadius: 14, borderWidth: 1, marginTop: 24, paddingHorizontal: 18, paddingVertical: 12 },
  externalText: { color: '#f5c6ce', fontSize: 14, fontWeight: '800' },
});
