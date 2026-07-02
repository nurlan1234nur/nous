import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { PlayfairDisplay_600SemiBold_Italic } from '@expo-google-fonts/playfair-display';
import { CoupleProvider } from './context/CoupleContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MainTabs } from './navigation/MainTabs';
import { AuthScreen } from './screens/AuthScreen';
import { CoupleSetupScreen } from './screens/CoupleSetupScreen';

function AppContent() {
  const { user, loading } = useAuth();
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_600SemiBold_Italic,
  });

  if (loading || !fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#e8607a" size="large" />
      </View>
    );
  }

  if (!user) return <AuthScreen />;
  if (!user.couple) return <CoupleSetupScreen />;

  return (
    <CoupleProvider>
      <MainTabs />
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

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: '#fdf6f0',
    flex: 1,
    justifyContent: 'center',
  },
});
