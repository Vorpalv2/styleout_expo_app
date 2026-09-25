import React from 'react';
import { Image, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useStyleoutTheme } from '@/components/StyleoutTheme';

export const palette = {
  ink: '#20211E',
  muted: '#77796F',
  line: '#E4E5DC',
  paper: '#F7F6F1',
  surface: '#FFFEFA',
  canvas: '#EEF0E8',
  olive: '#657057',
  oliveWash: '#E8EBE1',
  danger: '#A45B50',
};

export const spacing = { page: 24, section: 32, compact: 12 } as const;
export const radii = { control: 14, card: 20, stage: 26, pill: 999 } as const;
export const typeScale = { caption: 10, meta: 12, body: 14, section: 22, title: 30 } as const;

export const samplePieces = [
  { name: 'Tailored blazer', category: 'Outerwear', col: 1, row: 0 },
  { name: 'Linen camp shirt', category: 'Tops', col: 1, row: 0 },
  { name: 'Tortoise sunglasses', category: 'Accessories', col: 2, row: 0 },
  { name: 'Relaxed linen trouser', category: 'Bottoms', col: 0, row: 1 },
  { name: 'Raffia market tote', category: 'Bags', col: 1, row: 1 },
  { name: 'Leather slide sandal', category: 'Shoes', col: 2, row: 1 },
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
  const { colors } = useStyleoutTheme();
  return <View style={[styles.brandMark, { borderColor: inverted ? '#fff' : colors.ink }]}><Text style={[styles.brandMarkText, { color: inverted ? '#fff' : colors.ink }]}>S</Text></View>;
}

export function SmallCaps({ children, style }: { children: React.ReactNode; style?: object }) {
  const { colors } = useStyleoutTheme();
  return <Text style={[styles.smallCaps, { color: colors.muted }, style]}>{children}</Text>;
}

export function RoundAction({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  const { colors } = useStyleoutTheme();
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.roundAction, { backgroundColor: colors.canvas }, pressed && { opacity: 0.6 }]}>
      {children}
    </Pressable>
  );
}

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'soft' | 'outline';
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function ActionButton({ label, onPress, disabled = false, tone = 'primary', style, labelStyle }: ActionButtonProps) {
  const { colors } = useStyleoutTheme();
  const buttonTone = tone === 'primary'
    ? { backgroundColor: colors.ink }
    : tone === 'soft'
      ? { backgroundColor: colors.oliveWash }
      : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line };
  const textTone = { color: tone === 'primary' ? colors.paper : colors.ink };
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.actionButton, buttonTone, disabled && styles.actionButtonDisabled, pressed && !disabled && styles.actionButtonPressed, style]}
    >
      <Text style={[styles.actionButtonText, textTone, labelStyle]}>{label}</Text>
    </Pressable>
  );
}

export function AppHeader({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  const { colors } = useStyleoutTheme();
  return (
    <View style={[styles.header, { backgroundColor: colors.paper }]}>
      <View>
        <SmallCaps>{eyebrow}</SmallCaps>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  brandMark: { width: 32, height: 32, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' }, brandMarkText: { fontSize: 18, fontWeight: '700' },
  smallCaps: { fontSize: 10, fontWeight: '700', letterSpacing: 2.1 },
  roundAction: { width: 42, height: 42, borderRadius: 16, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' },
  actionButton: { minHeight: 50, borderRadius: radii.control, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  actionButtonDisabled: { opacity: 0.42 }, actionButtonPressed: { opacity: 0.72 },
  actionButtonText: { fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0.1 },
  header: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: palette.paper },
  headerTitle: { marginTop: 6, fontSize: 30, letterSpacing: -1.2, fontWeight: '600' },
});
