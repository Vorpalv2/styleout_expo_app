import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { StyleoutThemeProvider, useStyleoutTheme } from '@/components/StyleoutTheme';
import { ToastProvider } from '@/components/Toast';
import { ClosetProvider } from '@/lib/closet';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function AppNavigator() {
  const { colors } = useStyleoutTheme();
  const { isLoaded, isSignedIn, userId } = useAuth();
  if (!isLoaded) return <View style={[styles.center, { backgroundColor: colors.paper }]}><ActivityIndicator color={colors.ink} /></View>;

  const app = (
    <ClosetProvider key={userId || 'signed-out'} userId={userId || null}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={!!isSignedIn}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
    </ClosetProvider>
  );
  return isSignedIn ? <SafeAreaView edges={['top', 'right', 'left']} style={[styles.safeArea, { backgroundColor: colors.paper }]}>{app}</SafeAreaView> : app;
}

function AppShell() {
  const { colors, isDark } = useStyleoutTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {publishableKey ? (
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <AppNavigator />
        </ClerkProvider>
      ) : (
        <View style={[styles.center, { backgroundColor: colors.paper }]}>
          <Text style={[styles.setupTitle, { color: colors.ink }]}>Clerk key needed</Text>
          <Text style={[styles.setupText, { color: colors.muted }]}>Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local and restart Expo.</Text>
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}><StyleoutThemeProvider><ToastProvider><AppShell /></ToastProvider></StyleoutThemeProvider></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  setupTitle: { fontSize: 24, fontWeight: '600' },
  setupText: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 10 },
});
