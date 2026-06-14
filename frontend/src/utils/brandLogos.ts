import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_PREFIX = 'mp_brand_logo_v1_';
const NEGATIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Make name → SimpleIcons slug.  SimpleIcons hosts crisp, single-color SVG/PNG logos.
const SLUG_MAP: Record<string, string> = {
  bmw: 'bmw',
  'bmw m': 'bmw',
  'bmw i': 'bmw',
  'mercedes-benz': 'mercedes',
  mercedes: 'mercedes',
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
  mitsubishi: 'mitsubishimotors',
  'mitsubishi motors': 'mitsubishimotors',
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
  'land rover': 'landrover',
  jaguar: 'jaguar',
  volvo: 'volvocars',
  tesla: 'tesla',
  fiat: 'fiat',
  'alfa romeo': 'alfaromeo',
  peugeot: 'peugeot',
  renault: 'renault',
  citroen: 'citroen',
  dacia: 'dacia',
  mini: 'mini',
  smart: 'smart',
};

function slugFor(make: string): string | undefined {
  const key = make.trim().toLowerCase();
  return SLUG_MAP[key];
}

/** Returns a data URL for the brand logo. Result is cached in AsyncStorage
 *  so the second call is instant and offline. Returns null if the make is
 *  unknown or fetch fails while offline. */
export async function getBrandLogo(make: string | undefined | null): Promise<string | null> {
  if (!make) return null;
  const slug = slugFor(make);
  if (!slug) return null;

  const cacheKey = `${CACHE_KEY_PREFIX}${slug}`;
  // Check cache first
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      // Negative cache entry?
      if (cached === '__none__') return null;
      // Positive cache entry — return it
      if (cached.startsWith('data:')) return cached;
    }
  } catch {
    // ignore
  }

  // Not cached → fetch
  // SimpleIcons CDN returns a black SVG. We fetch as text and convert to data URL.
  // Using a black logo so it looks neutral on light backgrounds.
  const url = `https://cdn.simpleicons.org/${slug}/000000`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      try {
        await AsyncStorage.setItem(cacheKey, '__none__');
        // Allow retry after TTL — schedule expiry timestamp under a sibling key
        await AsyncStorage.setItem(cacheKey + '_neg_ts', String(Date.now() + NEGATIVE_TTL_MS));
      } catch {
        // ignore
      }
      return null;
    }
    const svg = await res.text();
    // Encode SVG to a data URL (use base64 to avoid URI-encoding edge cases)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = globalThis as any;
    let dataUrl: string;
    if (typeof g.btoa === 'function' && typeof g.TextEncoder !== 'undefined') {
      const bytes = new g.TextEncoder().encode(svg);
      let binary = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
        binary += String.fromCharCode.apply(null, Array.from(slice) as number[]);
      }
      dataUrl = 'data:image/svg+xml;base64,' + g.btoa(binary);
    } else {
      dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }
    try {
      await AsyncStorage.setItem(cacheKey, dataUrl);
    } catch {
      // ignore — still return data URL even if caching fails
    }
    return dataUrl;
  } catch {
    return null;
  }
}

export function getKnownSlugs(): string[] {
  return Array.from(new Set(Object.values(SLUG_MAP)));
}
