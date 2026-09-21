import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '@/components/StyleoutUI';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: palette.ink,
      tabBarInactiveTintColor: '#A3A39D',
      tabBarStyle: { backgroundColor: '#fff', borderTopColor: palette.line, height: 64 + insets.bottom, paddingTop: 7, paddingBottom: Math.max(insets.bottom, 7) },
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Style', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 25, lineHeight: 29 }}>✦</Text> }} />
      <Tabs.Screen name="wardrobe" options={{ title: 'Wardrobe', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 25, lineHeight: 29 }}>▦</Text> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 25, lineHeight: 29 }}>◯</Text> }} />
      <Tabs.Screen name="looks" options={{ href: null }} />
    </Tabs>
  );
}
