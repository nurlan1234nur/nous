import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { PlayfairDisplay_600SemiBold_Italic } from '@expo-google-fonts/playfair-display';
import { CoupleProvider } from './context/CoupleContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MainTabs } from './navigation/MainTabs';
import { AuthScreen } from './screens/AuthScreen';
import { CoupleSetupScreen } from './screens/CoupleSetupScreen';
import { applyTheme, themedStyles, colors } from './theme';

function AppContent() {
  const { user, loading } = useAuth();
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_600SemiBold_Italic,
  });

  // Хэрэглэгчийн сонгосон өнгийг хүүхэд дэлгэцүүд render хийхээс өмнө хэрэгжүүлнэ.
  // Нэвтрээгүй үед үндсэн (rose) өнгө.
  const theme = user?.theme ?? 'rose';
  applyTheme(theme);

  if (loading || !fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.rose} size="large" />
      </View>
    );
  }

  if (!user) return <AuthScreen />;
  if (!user.couple) return <CoupleSetupScreen />;

  return (
    <CoupleProvider>
      {/* Theme солигдоход бүх дэлгэцийг (FlatList мөр, modal) шинэ өнгөөр дахин зурна; идэвхтэй таб хадгалагдана. */}
      <MainTabs key={theme} />
    </CoupleProvider>
  );
}

export function AppShell() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = themedStyles({
  loading: {
    alignItems: 'center',
    backgroundColor: '#fdf6f0',
    flex: 1,
    justifyContent: 'center',
  },
});
