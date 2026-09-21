import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { palette } from '@/components/StyleoutUI';

type Props = ImageProps & { containerStyle?: StyleProp<ViewStyle> };

export function LoadingImage({ containerStyle, style, ...props }: Props) {
  const [loading, setLoading] = useState(true);
  const sourceKey = typeof props.source === 'object' && props.source && 'uri' in props.source ? props.source.uri : String(props.source);
  useEffect(() => { setLoading(true); }, [sourceKey]);
  return (
    <View style={[styles.frame, containerStyle, style]}>
      {loading ? <View pointerEvents="none" style={styles.skeleton}><ActivityIndicator size="small" color={palette.muted} /></View> : null}
      <Image {...props} style={StyleSheet.absoluteFill} onLoad={() => setLoading(false)} onError={() => setLoading(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: palette.canvas },
  skeleton: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas },
});
