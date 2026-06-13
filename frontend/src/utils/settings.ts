import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_GH_BASE_URL = 'mp_gh_base_url';
const KEY_GARAGE_NAME = 'mp_garage_name';
const KEY_GARAGE_PHONE = 'mp_garage_phone';

export interface AppSettings {
  githubBaseUrl: string;
  garageName: string;
  garagePhone: string;
}

// GitHub repo: https://github.com/rmassoud-coder/Mass-Power-App
// GitHub Pages URL (default branch + /docs or root): https://rmassoud-coder.github.io/Mass-Power-App/
// We host vehicle HTML files in the "vehicle profiles" subfolder.
export const DEFAULT_SETTINGS: AppSettings = {
  githubBaseUrl: 'https://rmassoud-coder.github.io/Mass-Power-App/vehicle%20profiles/',
  garageName: 'Mass Power Auto Services',
  garagePhone: '',
};

// Legacy placeholder that older versions of the app used; we auto-upgrade users
// who never changed the default URL so their QR codes start working immediately.
const LEGACY_PLACEHOLDER = 'https://username.github.io/repo/';

export async function loadSettings(): Promise<AppSettings> {
  const [url, name, phone] = await Promise.all([
    AsyncStorage.getItem(KEY_GH_BASE_URL),
    AsyncStorage.getItem(KEY_GARAGE_NAME),
    AsyncStorage.getItem(KEY_GARAGE_PHONE),
  ]);

  let effectiveUrl = url || DEFAULT_SETTINGS.githubBaseUrl;
  // One-time migration: replace legacy placeholder with the real GitHub Pages URL
  if (!url || url.trim() === LEGACY_PLACEHOLDER) {
    effectiveUrl = DEFAULT_SETTINGS.githubBaseUrl;
    try {
      await AsyncStorage.setItem(KEY_GH_BASE_URL, effectiveUrl);
    } catch {
      // ignore - not critical if migration write fails
    }
  }

  return {
    githubBaseUrl: effectiveUrl,
    garageName: name || DEFAULT_SETTINGS.garageName,
    garagePhone: phone || DEFAULT_SETTINGS.garagePhone,
  };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  let url = s.githubBaseUrl.trim();
  // Ensure trailing slash for cleaner URL building
  if (url && !url.endsWith('/')) url += '/';
  await Promise.all([
    AsyncStorage.setItem(KEY_GH_BASE_URL, url),
    AsyncStorage.setItem(KEY_GARAGE_NAME, s.garageName.trim()),
    AsyncStorage.setItem(KEY_GARAGE_PHONE, s.garagePhone.trim()),
  ]);
}

export function buildVehicleQrUrl(baseUrl: string, vehicleId: string): string {
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  return `${cleanBase}${vehicleId}.html`;
}

/** Suggested raw GitHub URL pattern for uploading the HTML file via the web UI. */
export function buildGithubUploadHelpUrl(): string {
  return 'https://github.com/rmassoud-coder/Mass-Power-App/upload/main/vehicle%20profiles';
}

