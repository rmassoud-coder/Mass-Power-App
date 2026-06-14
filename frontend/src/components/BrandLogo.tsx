import React, { useEffect, useState } from 'react';
import { Image, View, StyleSheet, ImageStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Car-brand-logo CDN.  This is the well-known `filippofilip95/car-logos-dataset`
// repo served via JSDelivr — has ~300 car-brand PNG logos and properly covers
// Mercedes-Benz, BMW, Audi, etc. which SimpleIcons dropped for trademark reasons.
const CDN = 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/thumb';

// Make name → dataset slug (lowercase, kebab-case full brand name)
const SLUG_MAP: Record<string, string> = {
  bmw: 'bmw',
  'bmw m': 'bmw',
  'bmw i': 'bmw',
  'mercedes-benz': 'mercedes-benz',
  mercedes: 'mercedes-benz',
  audi: 'audi',
  volkswagen: 'volkswagen',
  vw: 'volkswagen',
  porsche: 'porsche',
  toyota: 'toyota',
  lexus: 'lexus',
  honda: 'honda',
  acura: 'acura',
  nissan: 'nissan',
  infiniti: 'infiniti',
  mazda: 'mazda',
  mitsubishi: 'mitsubishi',
  'mitsubishi motors': 'mitsubishi',
  subaru: 'subaru',
  hyundai: 'hyundai',
  kia: 'kia',
  genesis: 'genesis',
  ford: 'ford',
  lincoln: 'lincoln',
  chevrolet: 'chevrolet',
  gmc: 'gmc',
  cadillac: 'cadillac',
  buick: 'buick',
  jeep: 'jeep',
  dodge: 'dodge',
  chrysler: 'chrysler',
  ram: 'ram',
  'land rover': 'land-rover',
  jaguar: 'jaguar',
  volvo: 'volvo',
  tesla: 'tesla',
  fiat: 'fiat',
  'alfa romeo': 'alfa-romeo',
  peugeot: 'peugeot',
  renault: 'renault',
  citroen: 'citroen',
  dacia: 'dacia',
  mini: 'mini',
  smart: 'smart',
};

function slugFor(make?: string | null): string | undefined {
  if (!make) return undefined;
  return SLUG_MAP[make.trim().toLowerCase()];
}

interface Props {
  make?: string | null;
  size?: number;
  fallbackColor?: string;
  style?: StyleProp<ImageStyle>;
}

/** Brand logo with disk caching via React Native's built-in Image cache.
 *  Falls back to a generic car icon if the brand is unknown OR if the image
 *  fails to load (e.g. offline AND not previously cached). */
export default function BrandLogo({ make, size = 28, fallbackColor = '#2563eb', style }: Props) {
  const slug = slugFor(make);
  const uri = slug ? `${CDN}/${slug}.png` : undefined;

  const [errored, setErrored] = useState(false);

  // Reset error state if the make changes
  useEffect(() => {
    setErrored(false);
  }, [make]);

  if (uri && !errored) {
    return (
      <Image
        source={{ uri, cache: 'force-cache' }}
        style={[{ width: size, height: size }, styles.logo, style]}
        resizeMode="contain"
        accessibilityLabel={`${make} logo`}
        onError={() => setErrored(true)}
      />
    );
  }

  // Unknown brand OR network failure → generic car icon
  return (
    <View style={[{ width: size, height: size }, styles.fallback]}>
      <Ionicons name="car" size={Math.round(size * 0.8)} color={fallbackColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {},
  fallback: { justifyContent: 'center', alignItems: 'center' },
});
