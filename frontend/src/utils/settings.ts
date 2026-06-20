import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_GH_BASE_URL = 'mp_gh_base_url';
const KEY_GARAGE_NAME = 'mp_garage_name';
const KEY_GARAGE_PHONE = 'mp_garage_phone';
const KEY_GH_TOKEN = 'mp_gh_token';
const KEY_GH_OWNER = 'mp_gh_owner';
const KEY_GH_REPO = 'mp_gh_repo';
const KEY_GH_BRANCH = 'mp_gh_branch';
const KEY_GH_FOLDER = 'mp_gh_folder';
const KEY_DEFAULT_COUNTRY = 'mp_default_country';

export interface AppSettings {
  githubBaseUrl: string;
  garageName: string;
  garagePhone: string;
  // GitHub API auto-upload config
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  githubFolder: string;
  // Country code (digits only, no +) used to prefix customer phone numbers
  // missing an explicit country code when building WhatsApp links.
  defaultCountryCode: string;
}

// Defaults tied to the user's repo
export const DEFAULT_SETTINGS: AppSettings = {
  githubBaseUrl: 'https://rmassoud-coder.github.io/Mass-Power-App/vehicle%20profiles/',
  garageName: 'Mass Power Auto Services',
  garagePhone: '',
  githubToken: '',
  githubOwner: 'rmassoud-coder',
  githubRepo: 'Mass-Power-App',
  githubBranch: 'main',
  githubFolder: 'vehicle profiles',
  defaultCountryCode: '961', // Lebanon
};

// Legacy placeholder; auto-upgrade users who never changed the default URL
const LEGACY_PLACEHOLDER = 'https://username.github.io/repo/';

export async function loadSettings(): Promise<AppSettings> {
  const [url, name, phone, token, owner, repo, branch, folder, country] = await Promise.all([
    AsyncStorage.getItem(KEY_GH_BASE_URL),
    AsyncStorage.getItem(KEY_GARAGE_NAME),
    AsyncStorage.getItem(KEY_GARAGE_PHONE),
    AsyncStorage.getItem(KEY_GH_TOKEN),
    AsyncStorage.getItem(KEY_GH_OWNER),
    AsyncStorage.getItem(KEY_GH_REPO),
    AsyncStorage.getItem(KEY_GH_BRANCH),
    AsyncStorage.getItem(KEY_GH_FOLDER),
    AsyncStorage.getItem(KEY_DEFAULT_COUNTRY),
  ]);

  let effectiveUrl = url || DEFAULT_SETTINGS.githubBaseUrl;
  if (!url || url.trim() === LEGACY_PLACEHOLDER) {
    effectiveUrl = DEFAULT_SETTINGS.githubBaseUrl;
    try {
      await AsyncStorage.setItem(KEY_GH_BASE_URL, effectiveUrl);
    } catch {
      // ignore
    }
  }

  return {
    githubBaseUrl: effectiveUrl,
    garageName: name || DEFAULT_SETTINGS.garageName,
    garagePhone: phone || DEFAULT_SETTINGS.garagePhone,
    githubToken: token || '',
    githubOwner: owner || DEFAULT_SETTINGS.githubOwner,
    githubRepo: repo || DEFAULT_SETTINGS.githubRepo,
    githubBranch: branch || DEFAULT_SETTINGS.githubBranch,
    githubFolder: folder || DEFAULT_SETTINGS.githubFolder,
    defaultCountryCode:
      country !== null && country !== undefined
        ? country
        : DEFAULT_SETTINGS.defaultCountryCode,
  };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  let url = s.githubBaseUrl.trim();
  if (url && !url.endsWith('/')) url += '/';
  const cc = (s.defaultCountryCode || '').replace(/[^\d]/g, '');
  await Promise.all([
    AsyncStorage.setItem(KEY_GH_BASE_URL, url),
    AsyncStorage.setItem(KEY_GARAGE_NAME, s.garageName.trim()),
    AsyncStorage.setItem(KEY_GARAGE_PHONE, s.garagePhone.trim()),
    AsyncStorage.setItem(KEY_GH_TOKEN, s.githubToken.trim()),
    AsyncStorage.setItem(KEY_GH_OWNER, s.githubOwner.trim()),
    AsyncStorage.setItem(KEY_GH_REPO, s.githubRepo.trim()),
    AsyncStorage.setItem(KEY_GH_BRANCH, s.githubBranch.trim() || 'main'),
    AsyncStorage.setItem(KEY_GH_FOLDER, s.githubFolder.trim() || 'vehicle profiles'),
    AsyncStorage.setItem(KEY_DEFAULT_COUNTRY, cc),
  ]);
}

export function buildVehicleQrUrl(baseUrl: string, vehicleId: string): string {
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  return `${cleanBase}${vehicleId}.html`;
}

export function buildGithubUploadHelpUrl(): string {
  return 'https://github.com/rmassoud-coder/Mass-Power-App/upload/main/vehicle%20profiles';
}

/** Returns true if all required GitHub auto-upload settings are present. */
export function isGithubConfigured(s: AppSettings): boolean {
  return !!(
    s.githubToken &&
    s.githubOwner &&
    s.githubRepo &&
    s.githubBranch &&
    s.githubFolder
  );
}
