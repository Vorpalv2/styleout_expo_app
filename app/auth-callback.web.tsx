import { useClerk } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export default function AuthCallback() {
  const clerk = useClerk();
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void clerk.handleRedirectCallback({
      signInUrl: '/sign-in',
      signUpUrl: '/sign-in',
      signInFallbackRedirectUrl: '/',
      signUpFallbackRedirectUrl: '/',
    }).catch((reason: unknown) => {
      console.error('Clerk web OAuth callback failed', reason);
      setError(reason instanceof Error ? reason.message : 'Please return to sign in and try again.');
    });
  }, [clerk]);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.title}>Sign in couldn’t finish</Text>
          <Text style={styles.message}>{error}</Text>
          <Pressable onPress={() => router.replace('/sign-in')} style={styles.button}>
            <Text style={styles.buttonText}>Return to sign in</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color="#20211F" />
          <Text style={styles.message}>Finishing sign in…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: '#F6F6F3' },
  title: { color: '#20211F', fontSize: 20, fontWeight: '700' },
  message: { color: '#66675F', fontSize: 14, textAlign: 'center' },
  button: { marginTop: 8, borderRadius: 24, backgroundColor: '#20211F', paddingHorizontal: 20, paddingVertical: 12 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
