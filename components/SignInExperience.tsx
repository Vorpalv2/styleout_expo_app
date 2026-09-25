import { useSSO } from '@clerk/expo';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, palette, SmallCaps } from '@/components/StyleoutUI';

const editorialTiles = [
  require('../assets/styleout/signin-editorial-01.jpg'),
  require('../assets/styleout/signin-editorial-02.jpg'),
  require('../assets/styleout/signin-editorial-03.jpg'),
  require('../assets/styleout/signin-editorial-04.jpg'),
  require('../assets/styleout/signin-editorial-05.jpg'),
  require('../assets/styleout/signin-editorial-06.jpg'),
  require('../assets/styleout/signin-editorial-07.jpg'),
  require('../assets/styleout/signin-editorial-08.jpg'),
  require('../assets/styleout/signin-editorial-09.jpg'),
  require('../assets/styleout/signin-editorial-10.jpg'),
  require('../assets/styleout/signin-editorial-11.jpg'),
  require('../assets/styleout/signin-editorial-12.jpg'),
];

const collageColumns = [
  [editorialTiles[0], editorialTiles[3], editorialTiles[6], editorialTiles[9]],
  [editorialTiles[1], editorialTiles[4], editorialTiles[7], editorialTiles[10]],
  [editorialTiles[2], editorialTiles[5], editorialTiles[8], editorialTiles[11]],
];

function EditorialTile({ source, size }: { source: number; size: number }) {
  return <Image source={source} resizeMode="cover" style={[styles.tileImage, { height: size }]} />;
}

function AnimatedFashionCollage() {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const size = Math.max(160, Math.min(width / 3, height * 0.38));
  const loopDistance = size * collageColumns[0].length;
  return <View pointerEvents="none" style={styles.collage}>
    {collageColumns.map((tiles, columnIndex) => <CollageColumn key={columnIndex} tiles={tiles} size={size} loopDistance={loopDistance} direction={columnIndex === 1 ? 'up' : 'down'} reduceMotion={reduceMotion} />)}
  </View>;
}

function CollageColumn({ tiles, size, loopDistance, direction, reduceMotion }: {
  tiles: number[];
  size: number;
  loopDistance: number;
  direction: 'up' | 'down';
  reduceMotion: boolean;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    if (!reduceMotion) {
      progress.value = withRepeat(withTiming(1, { duration: 30000, easing: Easing.linear }), -1, false);
    }
  }, [progress, reduceMotion, loopDistance]);
  const motionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (direction === 'up' ? -progress.value : -1 + progress.value) * loopDistance }],
  }), [direction, loopDistance]);
  return <View style={styles.collageColumn}>
    <Animated.View style={[styles.tileTrack, motionStyle]}>
      {[0, 1].map((copy) => <View key={copy}>
        {tiles.map((tile, index) => <EditorialTile key={`${copy}-${index}`} source={tile} size={size} />)}
      </View>)}
    </Animated.View>
  </View>;
}

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
        <AnimatedFashionCollage />
        <View pointerEvents="none" style={styles.overlay} />
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
  screen: { flex: 1, backgroundColor: palette.ink }, background: { flex: 1, justifyContent: 'space-between', overflow: 'hidden' }, collage: { ...StyleSheet.absoluteFill, flexDirection: 'row', overflow: 'hidden' }, collageColumn: { flex: 1, overflow: 'hidden', borderRightWidth: 2, borderColor: palette.paper }, tileTrack: { width: '100%' }, tile: { overflow: 'hidden', backgroundColor: '#D8D5CB' }, tileImage: { width: '100%', height: '100%' }, overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(24,25,23,0.67)' }, top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24 }, wordmark: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  copy: { paddingHorizontal: 24, marginTop: 'auto', marginBottom: 34 }, caps: { color: '#fff', opacity: 0.82 }, title: { color: '#fff', fontSize: 43, lineHeight: 44, fontWeight: '600', letterSpacing: -1.8, marginTop: 10 }, body: { color: '#fff', opacity: 0.84, fontSize: 14, lineHeight: 21, maxWidth: 315, marginTop: 15 },
  bottom: { paddingHorizontal: 24 }, prompt: { color: '#fff', opacity: 0.72, fontSize: 10, fontWeight: '700', letterSpacing: 1.8, textAlign: 'center', marginBottom: 14 }, actions: { flexDirection: 'row', justifyContent: 'center', gap: 15 }, action: { width: 68, height: 68, borderRadius: 34, borderWidth: 1, borderColor: '#FFFFFF85', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(101,112,87,0.22)' }, apple: { color: '#fff', fontSize: 31, lineHeight: 34 }, google: { color: '#fff', fontSize: 25, fontWeight: '700' }, email: { color: '#fff', fontSize: 25 }, legal: { color: '#fff', opacity: 0.68, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 23 },
});
