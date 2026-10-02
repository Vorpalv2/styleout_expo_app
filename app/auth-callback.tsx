import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

// The native SSO flow returns directly to its initiating browser session.
// This fallback exists because Expo Router requires a non-platform route file
// alongside auth-callback.web.tsx.
export default function AuthCallbackFallback() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color="#20211F" />
      <Text style={styles.label}>Finishing sign in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#F6F6F3' },
  label: { color: '#20211F', fontSize: 14 },
});
