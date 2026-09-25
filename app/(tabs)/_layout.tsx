import { Tabs } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyleoutTheme } from '@/components/StyleoutTheme';
import { useCloset } from '@/lib/closet';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useStyleoutTheme();
  const { bodyPhoto } = useCloset();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.olive,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line, height: 64 + insets.bottom, paddingTop: 7, paddingBottom: Math.max(insets.bottom, 7) },
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
