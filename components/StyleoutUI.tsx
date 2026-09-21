import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

export const palette = {
  ink: '#1B1B1A',
  muted: '#8A8A85',
  line: '#E8E8E5',
  paper: '#FFFFFF',
  canvas: '#F6F6F3',
  olive: '#6D745F',
};

export const samplePieces = [
  { name: 'Woven bucket hat', category: 'Accessories', price: '$74', col: 0, row: 0 },
  { name: 'Linen camp shirt', category: 'Tops', price: '$67', col: 1, row: 0 },
  { name: 'Tortoise sunglasses', category: 'Accessories', price: '$80', col: 2, row: 0 },
  { name: 'Relaxed linen trouser', category: 'Bottoms', price: '$49', col: 0, row: 1 },
  { name: 'Raffia market tote', category: 'Bags', price: '$115', col: 1, row: 1 },
  { name: 'Leather slide sandal', category: 'Shoes', price: '$115', col: 2, row: 1 },
] as const;

const productSheet = require('../assets/styleout/pieces.png');

export function SamplePieceImage({ col, row, size }: { col: number; row: number; size: number }) {
  return (
    <View style={{ width: size, height: size, overflow: 'hidden', backgroundColor: '#fff' }}>
      <Image
        source={productSheet}
        resizeMode="stretch"
        style={{ position: 'absolute', width: size * 3, height: size * 2, left: -col * size, top: -row * size }}
      />
    </View>
  );
}

export function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return <View style={[styles.brandMark, inverted && styles.brandMarkInverted]}><Text style={[styles.brandMarkText, inverted && styles.brandMarkTextInverted]}>S</Text></View>;
}

export function SmallCaps({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.smallCaps, style]}>{children}</Text>;
}

export function RoundAction({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.roundAction, pressed && { opacity: 0.6 }]}>
      {children}
    </Pressable>
  );
}

export function AppHeader({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View>
        <SmallCaps>{eyebrow}</SmallCaps>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  brandMark: { width: 32, height: 32, borderRadius: 11, borderWidth: 1.5, borderColor: palette.ink, alignItems: 'center', justifyContent: 'center' }, brandMarkInverted: { borderColor: '#fff' }, brandMarkText: { color: palette.ink, fontSize: 18, fontWeight: '700' }, brandMarkTextInverted: { color: '#fff' },
  smallCaps: { fontSize: 10, color: palette.muted, fontWeight: '700', letterSpacing: 2.1 },
  roundAction: { width: 42, height: 42, borderRadius: 16, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: palette.paper },
  headerTitle: { marginTop: 6, fontSize: 30, letterSpacing: -1.2, fontWeight: '600', color: palette.ink },
});
