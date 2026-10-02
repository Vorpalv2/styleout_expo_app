import React from 'react';
import { Image, Modal, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
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

export function RoundAction({ label, onPress, children, disabled = false }: { label: string; onPress: () => void; children: React.ReactNode; disabled?: boolean }) {
  const { colors } = useStyleoutTheme();
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.roundAction, { backgroundColor: colors.canvas }, pressed && { opacity: 0.6 }, disabled && { opacity: 0.45 }]}>
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

export function SignOutConfirmationModal({ visible, onCancel, onConfirm, busy = false }: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const { colors } = useStyleoutTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <Pressable style={styles.signOutBackdrop} onPress={onCancel} accessibilityLabel="Cancel sign out">
        <Pressable style={[styles.signOutCard, { backgroundColor: colors.paper, borderColor: colors.line }]} onPress={(event) => event.stopPropagation()}>
          <SmallCaps>STYLEOUT ACCOUNT</SmallCaps>
          <Text style={[styles.signOutTitle, { color: colors.ink }]}>Log out?</Text>
          <Text style={[styles.signOutCopy, { color: colors.muted }]}>Are you sure you want to log out of Styleout?</Text>
          <View style={styles.signOutActions}>
            <Pressable accessibilityRole="button" onPress={onCancel} disabled={busy} style={[styles.signOutCancel, { backgroundColor: colors.canvas }, busy && styles.signOutBusy]}>
              <Text style={[styles.signOutCancelText, { color: colors.ink }]}>Cancel</Text>
            </Pressable>
            <ActionButton onPress={onConfirm} disabled={busy} label={busy ? 'Logging out…' : 'Log out'} style={styles.signOutConfirm} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function AppHeader({ title, right, compact = false }: { title: string; right?: React.ReactNode; compact?: boolean }) {
  const { colors } = useStyleoutTheme();
  return (
    <View style={[styles.header, compact && styles.headerCompact, { backgroundColor: colors.paper }]}>
      <Text style={[styles.headerTitle, compact && styles.headerTitleCompact, { color: colors.ink }]}>{title}</Text>
      {right}
    </View>
  );
}

export function SignOutIcon() {
  const { colors } = useStyleoutTheme();
  return <View style={styles.signOutIcon} accessibilityElementsHidden>
    <View style={[styles.signOutDoorTop, { backgroundColor: colors.ink }]} />
    <View style={[styles.signOutDoorBottom, { backgroundColor: colors.ink }]} />
    <View style={[styles.signOutDoorSide, { backgroundColor: colors.ink }]} />
    {/*<View style={[styles.signOutArrow, { backgroundColor: colors.ink }]} />*/}
    <View style={[styles.signOutArrowTop, { backgroundColor: colors.ink }]} />
    <View style={[styles.signOutArrowBottom, { backgroundColor: colors.ink }]} />
  </View>;
}

const styles = StyleSheet.create({
  signOutBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.46)' }, signOutCard: { width: '100%', maxWidth: 400, alignSelf: 'center', padding: 23, borderRadius: 24, borderWidth: 1 }, signOutTitle: { fontSize: 25, lineHeight: 31, fontWeight: '700', letterSpacing: -0.7, marginTop: 8 }, signOutCopy: { fontSize: 13, lineHeight: 19, marginTop: 6 }, signOutActions: { flexDirection: 'row', gap: 10, marginTop: 22 }, signOutCancel: { flex: 1, minHeight: 50, borderRadius: radii.control, alignItems: 'center', justifyContent: 'center' }, signOutCancelText: { fontSize: 13, fontWeight: '700' }, signOutConfirm: { flex: 1 }, signOutBusy: { opacity: 0.5 },
  brandMark: { width: 32, height: 32, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' }, brandMarkText: { fontSize: 18, fontWeight: '700' },
  smallCaps: { fontSize: 10, fontWeight: '700', letterSpacing: 2.1 },
  roundAction: { width: 42, height: 42, borderRadius: 16, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' },
  actionButton: { minHeight: 50, borderRadius: radii.control, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  actionButtonDisabled: { opacity: 0.42 }, actionButtonPressed: { opacity: 0.72 },
  actionButtonText: { fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0.1 },
  header: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: palette.paper }, headerCompact: { paddingHorizontal: 20, paddingTop: 9, paddingBottom: 8 },
  headerTitle: { fontSize: 32, lineHeight: 38, letterSpacing: -1.25, fontWeight: '800' }, headerTitleCompact: { fontSize: 29, lineHeight: 35 },
  signOutIcon: { width: 24, height: 24, justifyContent: 'center' }, signOutDoorTop: { position: 'absolute', left: 2, top: 3, width: 10, height: 2, borderRadius: 1 }, signOutDoorBottom: { position: 'absolute', left: 2, bottom: 3, width: 10, height: 2, borderRadius: 1 }, signOutDoorSide: { position: 'absolute', left: 2, top: 3, width: 2, height: 18, borderRadius: 1 }, signOutArrow: { position: 'absolute', left: 2, top: 11, width: 13, height: 2, borderRadius: 1 }, signOutArrowTop: { position: 'absolute', left: 11, top: 6, width: 2, height: 8, borderRadius: 1, transform: [{ rotate: '45deg' }] }, signOutArrowBottom: { position: 'absolute', left: 11, top: 10, width: 2, height: 8, borderRadius: 1, transform: [{ rotate: '-45deg' }] },
});
