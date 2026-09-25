import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ThemeColors = {
  ink: string;
  muted: string;
  line: string;
  paper: string;
  surface: string;
  canvas: string;
  olive: string;
  oliveWash: string;
  danger: string;
};

const STORAGE_KEY = 'styleout.appearance';
const lightColors: ThemeColors = {
  ink: '#20211E', muted: '#77796F', line: '#E4E5DC', paper: '#F7F6F1',
  surface: '#FFFEFA', canvas: '#EEF0E8', olive: '#657057', oliveWash: '#E8EBE1', danger: '#A45B50',
};
const darkColors: ThemeColors = {
  ink: '#F1F0E9', muted: '#A7AA9E', line: '#393D34', paper: '#171915',
  surface: '#20231F', canvas: '#292D27', olive: '#B9C9A0', oliveWash: '#343B2F', danger: '#E49A8D',
};

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => Promise<void>;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function StyleoutThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (mounted && (stored === 'system' || stored === 'light' || stored === 'dark')) setPreferenceState(stored);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const setPreference = useCallback(async (next: ThemePreference) => {
    setPreferenceState(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, next); } catch { /* Keep the in-memory choice for this session. */ }
  }, []);
  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';
  const colors = isDark ? darkColors : lightColors;
  const value = useMemo(() => ({ colors, isDark, preference, setPreference }), [colors, isDark, preference, setPreference]);

  useEffect(() => {
    if (typeof document !== 'undefined') document.body.style.backgroundColor = colors.paper;
  }, [colors]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useStyleoutTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useStyleoutTheme must be used inside StyleoutThemeProvider');
  return value;
}
