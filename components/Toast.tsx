import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors, useStyleoutTheme } from '@/components/StyleoutTheme';

type ToastTone = 'success' | 'info' | 'error';
type ToastPayload = { id: number; message: string; tone: ToastTone; persistent: boolean };
type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
  showPersistentToast: (message: string, tone?: ToastTone) => void;
  clearPersistentToast: () => void;
};
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useStyleoutTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const nextToastId = useRef(0);
  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    setToast({ id: ++nextToastId.current, message, tone, persistent: false });
  }, []);
  const showPersistentToast = useCallback((message: string, tone: ToastTone = 'info') => {
    setToast((current) => current?.persistent && current.message === message && current.tone === tone
      ? current
      : { id: ++nextToastId.current, message, tone, persistent: true });
  }, []);
  const clearPersistentToast = useCallback(() => {
    setToast((current) => current?.persistent ? null : current);
  }, []);
  useEffect(() => {
    if (!toast || toast.persistent) return;
    const timer = setTimeout(() => setToast((current) => current?.id === toast.id ? null : current), 3400);
    return () => clearTimeout(timer);
  }, [toast]);
  const value = useMemo(() => ({ showToast, showPersistentToast, clearPersistentToast }), [showToast, showPersistentToast, clearPersistentToast]);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <ToastContext.Provider value={value}>
    {children}
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {toast ? <Pressable accessibilityRole="alert" accessibilityLiveRegion="polite" onPress={() => setToast(null)} style={[styles.toast, { top: insets.top + 12 }]}>
        <View style={[styles.icon, toast.tone === 'error' && styles.errorIcon, toast.tone === 'info' && styles.infoIcon]}>
          <Text style={[styles.iconText, toast.tone === 'error' && styles.errorIconText]}>{toast.tone === 'success' ? '✓' : toast.tone === 'error' ? '!' : '✦'}</Text>
        </View>
        <Text style={styles.message}>{toast.message}</Text>
        <Text style={styles.dismiss}>×</Text>
      </Pressable> : null}
    </View>
  </ToastContext.Provider>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  toast: { position: 'absolute', left: 16, right: 16, maxWidth: 520, alignSelf: 'center', minHeight: 58, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.17, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12, gap: 11 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.oliveWash },
  errorIcon: { backgroundColor: colors.danger }, infoIcon: { backgroundColor: colors.canvas },
  iconText: { color: colors.olive, fontSize: 15, fontWeight: '800' }, errorIconText: { color: colors.paper },
  message: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '600' }, dismiss: { color: colors.muted, fontSize: 21, lineHeight: 24, paddingLeft: 4 },
});
