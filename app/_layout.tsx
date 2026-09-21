import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { palette } from '@/components/StyleoutUI';
import { ClosetProvider } from '@/lib/closet';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function AppNavigator() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  if (!isLoaded) return <View style={styles.center}><ActivityIndicator color={palette.ink} /></View>;

  const app = (
    <ClosetProvider key={userId || 'signed-out'} userId={userId || null}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.paper } }}>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={!!isSignedIn}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
    </ClosetProvider>
  );
  return isSignedIn ? <SafeAreaView edges={['top', 'right', 'left']} style={styles.safeArea}>{app}</SafeAreaView> : app;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="dark" />
      {publishableKey ? (
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <AppNavigator />
        </ClerkProvider>
      ) : (
        <View style={styles.center}>
          <Text style={styles.setupTitle}>Clerk key needed</Text>
          <Text style={styles.setupText}>Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local and restart Expo.</Text>
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: palette.paper },
  setupTitle: { color: palette.ink, fontSize: 24, fontWeight: '600' },
  setupText: { color: palette.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 10 },
});
