import { Tabs } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlatformPressable } from 'expo-router/build/react-navigation/elements';
import { useStyleoutTheme } from '@/components/StyleoutTheme';
import { useCloset } from '@/lib/closet';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useStyleoutTheme();
  const { bodyPhoto } = useCloset();
  const glassFill = isDark ? 'rgba(32, 35, 31, 0.88)' : 'rgba(255, 254, 250, 0.86)';
  const glassStroke = isDark ? 'rgba(241, 240, 233, 0.12)' : 'rgba(32, 33, 30, 0.10)';
  return (
    <Tabs screenOptions={{
      headerShown: false,
      // Keep native tab changes immediate. Sliding the whole screen can expose
      // an empty frame while image-heavy routes are being laid out on phones.
      animation: 'none',
      // Mount a tab when first opened instead of loading every image grid at
      // startup, then suspend inactive tabs so they do not keep re-rendering.
      lazy: true,
      freezeOnBlur: true,
      tabBarActiveTintColor: colors.olive,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { position: 'relative', backgroundColor: 'transparent', borderTopWidth: 0, height: 80 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 8, paddingHorizontal: 20, elevation: 0 },
      tabBarBackground: () => <View pointerEvents="none" style={[StyleSheet.absoluteFill, { marginHorizontal: 16, marginTop: 5, marginBottom: insets.bottom + 7, borderRadius: 36, borderWidth: 1, borderColor: glassStroke, backgroundColor: glassFill, shadowColor: '#000', shadowOpacity: isDark ? 0.28 : 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 }]} />,
      tabBarItemStyle: { marginHorizontal: 4, marginVertical: 5, borderRadius: 28, overflow: 'hidden' },
      tabBarButton: ({ style, ...props }) => <PlatformPressable {...props} style={[style, { borderRadius: 28, overflow: 'hidden' }]} />,
      tabBarActiveBackgroundColor: colors.oliveWash,
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Style', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 25, lineHeight: 29 }}>✦</Text> }} />
      <Tabs.Screen name="wardrobe" options={{ title: 'Wardrobe', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 25, lineHeight: 29 }}>▦</Text> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => (
        <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
          {bodyPhoto
            ? <Image source={{ uri: bodyPhoto }} resizeMode="cover" style={{ width: 23, height: 23, borderRadius: 11.5 }} />
            : <Text style={{ color, fontSize: 21, lineHeight: 25 }}>◯</Text>}
        </View>
      ) }} />
      <Tabs.Screen name="looks" options={{ href: null }} />
    </Tabs>
  );
}
