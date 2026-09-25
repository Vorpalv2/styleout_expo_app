import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useStyleoutTheme } from '@/components/StyleoutTheme';

type Props = ImageProps & { containerStyle?: StyleProp<ViewStyle> };

export function LoadingImage({ containerStyle, style, ...props }: Props) {
  const { colors } = useStyleoutTheme();
  const [loading, setLoading] = useState(true);
  const sourceKey = typeof props.source === 'object' && props.source && 'uri' in props.source ? props.source.uri : String(props.source);
  useEffect(() => { setLoading(true); }, [sourceKey]);
  return (
    <View style={[styles.frame, { backgroundColor: colors.canvas }, containerStyle, style]}>
      {loading ? <View pointerEvents="none" style={[styles.skeleton, { backgroundColor: colors.canvas }]}><ActivityIndicator size="small" color={colors.muted} /></View> : null}
      <Image {...props} style={StyleSheet.absoluteFill} onLoad={() => setLoading(false)} onError={() => setLoading(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  skeleton: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
