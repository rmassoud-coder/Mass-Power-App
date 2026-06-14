import React, { useEffect, useState } from 'react';
import { Image, View, StyleSheet, ImageStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBrandLogo } from '../utils/brandLogos';

interface Props {
  make?: string | null;
  size?: number;
  /** Tint color for the fallback generic car icon. */
  fallbackColor?: string;
  style?: StyleProp<ImageStyle>;
}

/** Shows the brand logo for the given make. Falls back to a generic car icon
 *  while loading or if the brand is unknown / offline. */
export default function BrandLogo({ make, size = 28, fallbackColor = '#2563eb', style }: Props) {
  const [uri, setUri] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    setTried(false);
    (async () => {
      const result = await getBrandLogo(make || undefined);
      if (!cancelled) {
        setUri(result);
        setTried(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [make]);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size }, styles.logo, style]}
        resizeMode="contain"
        accessibilityLabel={`${make} logo`}
      />
    );
  }

  // While loading OR after failure → generic car icon
  return (
    <View style={[{ width: size, height: size }, styles.fallback]}>
      <Ionicons name="car" size={Math.round(size * 0.8)} color={fallbackColor} />
    </View>
  );
  // Note: `tried` is kept for future use if we want to distinguish loading vs missing
  void tried;
}

const styles = StyleSheet.create({
  logo: {},
  fallback: { justifyContent: 'center', alignItems: 'center' },
});
