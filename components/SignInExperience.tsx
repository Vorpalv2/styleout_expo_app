import { useSSO } from '@clerk/expo';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, palette, SmallCaps } from '@/components/StyleoutUI';

const backgroundImage = require('../assets/styleout/look.png');
const femaleBackgroundImage = require('../assets/styleout/female-dress.png');

export default function SignInExperience() {
  const { startHostedAuth } = useHostedAuth();
  const { startSSOFlow } = useSSO();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  async function continueWith(strategy: 'oauth_google' | 'oauth_apple') {
    if (busy) return;
    setBusy(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy });
      if (createdSessionId && setActive) await setActive({ session: createdSessionId });
    } catch (error) { Alert.alert('Sign-in unavailable', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  async function continueWithEmail() {
    if (busy) return;
    setBusy(true);
    try { await startHostedAuth({ mode: 'sign-in' }); }
    catch (error) { Alert.alert('Sign-in unavailable', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <SafeAreaView edges={[]} style={styles.screen}>
      <View style={styles.background}>
        {Platform.OS === 'web' ? <View style={styles.splitBackground}><ImageBackground source={backgroundImage} resizeMode="cover" style={styles.splitPanel} /><ImageBackground source={femaleBackgroundImage} resizeMode="cover" style={styles.splitPanel} /></View> : <ImageBackground source={backgroundImage} resizeMode="cover" style={styles.mobileBackground} />}
        <View style={styles.overlay} />
        <View style={[styles.top, { paddingTop: insets.top + 18 }]}><BrandMark inverted /><Text style={styles.wordmark}>STYLEOUT</Text></View>
        <View style={styles.copy}><SmallCaps style={styles.caps}>YOUR DIGITAL DRESSING ROOM</SmallCaps><Text style={styles.title}>Wear what you own.{ '\n' }Make it yours.</Text><Text style={styles.body}>Create outfits from your wardrobe and discover new ways to style every piece.</Text></View>
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}><Text style={styles.prompt}>CONTINUE WITH</Text><View style={styles.actions}>
          <Pressable disabled={busy} onPress={() => continueWith('oauth_apple')} accessibilityLabel="Sign in with Apple" style={styles.action}><Text style={styles.apple}></Text></Pressable>
          <Pressable disabled={busy} onPress={() => continueWith('oauth_google')} accessibilityLabel="Sign in with Google" style={styles.action}><Text style={styles.google}>G</Text></Pressable>
          <Pressable disabled={busy} onPress={continueWithEmail} accessibilityLabel="Sign in with email" style={styles.action}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.email}>✉</Text>}</Pressable>
        </View><Text style={styles.legal}>By continuing, you agree to our{ '\n' }Terms of Service and Privacy Policy.</Text></View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink }, background: { flex: 1, justifyContent: 'space-between' }, splitBackground: { ...StyleSheet.absoluteFill, flexDirection: 'row' }, splitPanel: { flex: 1 }, mobileBackground: { ...StyleSheet.absoluteFill }, overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(32,33,30,0.68)' }, top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24 }, wordmark: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  copy: { paddingHorizontal: 24, marginTop: 'auto', marginBottom: 34 }, caps: { color: '#fff', opacity: 0.82 }, title: { color: '#fff', fontSize: 43, lineHeight: 44, fontWeight: '600', letterSpacing: -1.8, marginTop: 10 }, body: { color: '#fff', opacity: 0.84, fontSize: 14, lineHeight: 21, maxWidth: 315, marginTop: 15 },
  bottom: { paddingHorizontal: 24 }, prompt: { color: '#fff', opacity: 0.72, fontSize: 10, fontWeight: '700', letterSpacing: 1.8, textAlign: 'center', marginBottom: 14 }, actions: { flexDirection: 'row', justifyContent: 'center', gap: 15 }, action: { width: 68, height: 68, borderRadius: 34, borderWidth: 1, borderColor: '#FFFFFF85', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(101,112,87,0.22)' }, apple: { color: '#fff', fontSize: 31, lineHeight: 34 }, google: { color: '#fff', fontSize: 25, fontWeight: '700' }, email: { color: '#fff', fontSize: 25 }, legal: { color: '#fff', opacity: 0.68, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 23 },
});
