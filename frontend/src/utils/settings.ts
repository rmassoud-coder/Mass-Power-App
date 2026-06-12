import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_GH_BASE_URL = 'mp_gh_base_url';
const KEY_GARAGE_NAME = 'mp_garage_name';
const KEY_GARAGE_PHONE = 'mp_garage_phone';

export interface AppSettings {
  githubBaseUrl: string;
  garageName: string;
  garagePhone: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  githubBaseUrl: 'https://username.github.io/repo/',
  garageName: 'Mass Power Auto Services',
  garagePhone: '',
};

export async function loadSettings(): Promise<AppSettings> {
  const [url, name, phone] = await Promise.all([
    AsyncStorage.getItem(KEY_GH_BASE_URL),
    AsyncStorage.getItem(KEY_GARAGE_NAME),
    AsyncStorage.getItem(KEY_GARAGE_PHONE),
  ]);
  return {
    githubBaseUrl: url || DEFAULT_SETTINGS.githubBaseUrl,
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
