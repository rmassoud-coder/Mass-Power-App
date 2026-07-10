import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from './storage';

const KEY_GH_BASE_URL = 'mp_gh_base_url';
const KEY_GARAGE_NAME = 'mp_garage_name';
const KEY_GARAGE_PHONE = 'mp_garage_phone';
// SEC-001: Token key is now backed by SecureStore (Android Keystore / iOS Keychain)
// via `storage.secure*`. The value is JSON-encoded by the storage helper. On web,
// there is no secure enclave so it falls back to AsyncStorage under a DIFFERENT
// key so the legacy-plaintext cleanup below can never wipe the freshly-stored
// secure value.
const KEY_GH_TOKEN_LEGACY = 'mp_gh_token';      // plaintext (deprecated, wiped after migration)
const KEY_GH_TOKEN = 'mp_gh_token_secure_v1';   // SecureStore key (native) or JSON in AsyncStorage (web)
const KEY_GH_OWNER = 'mp_gh_owner';
const KEY_GH_REPO = 'mp_gh_repo';
const KEY_GH_BRANCH = 'mp_gh_branch';
const KEY_GH_FOLDER = 'mp_gh_folder';
const KEY_DEFAULT_COUNTRY = 'mp_default_country';

// One-shot flag so we only run the AsyncStorage -> SecureStore migration once.
const KEY_TOKEN_MIGRATED = 'mp_gh_token_migrated_v1';

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

/**
 * One-time migration: pull any GitHub PAT that was previously saved in
 * AsyncStorage (plaintext, legacy key) into SecureStore (native) or the
 * JSON-encoded secure key on web, then wipe the plaintext copy.
 * Runs at most once per install (guarded by KEY_TOKEN_MIGRATED).
 */
async function migrateTokenToSecureStore(): Promise<void> {
  try {
    const alreadyMigrated = await AsyncStorage.getItem(KEY_TOKEN_MIGRATED);
    if (alreadyMigrated === '1') return;

    const legacy = await AsyncStorage.getItem(KEY_GH_TOKEN_LEGACY);
    if (legacy && legacy.trim()) {
      await storage.secureSet(KEY_GH_TOKEN, legacy);
    }
    // Always drop the plaintext copy — even if it was empty or malformed.
    if (legacy !== null) {
      await AsyncStorage.removeItem(KEY_GH_TOKEN_LEGACY);
    }
    await AsyncStorage.setItem(KEY_TOKEN_MIGRATED, '1');
  } catch {
    // Silent — a failed migration must not break the app.
  }
}

export async function loadSettings(): Promise<AppSettings> {
  // Ensure any pre-existing plaintext token is moved to the secure enclave first.
  await migrateTokenToSecureStore();

  const [url, name, phone, secureToken, owner, repo, branch, folder, country] =
    await Promise.all([
      AsyncStorage.getItem(KEY_GH_BASE_URL),
      AsyncStorage.getItem(KEY_GARAGE_NAME),
      AsyncStorage.getItem(KEY_GARAGE_PHONE),
      storage.secureGet<string>(KEY_GH_TOKEN, ''),
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
    githubToken: secureToken || '',
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
  const token = s.githubToken.trim();

  // Persist non-secrets in AsyncStorage as before.
  await Promise.all([
    AsyncStorage.setItem(KEY_GH_BASE_URL, url),
    AsyncStorage.setItem(KEY_GARAGE_NAME, s.garageName.trim()),
    AsyncStorage.setItem(KEY_GARAGE_PHONE, s.garagePhone.trim()),
    AsyncStorage.setItem(KEY_GH_OWNER, s.githubOwner.trim()),
    AsyncStorage.setItem(KEY_GH_REPO, s.githubRepo.trim()),
    AsyncStorage.setItem(KEY_GH_BRANCH, s.githubBranch.trim() || 'main'),
    AsyncStorage.setItem(KEY_GH_FOLDER, s.githubFolder.trim() || 'vehicle profiles'),
    AsyncStorage.setItem(KEY_DEFAULT_COUNTRY, cc),
  ]);

  // SEC-001: Store the GitHub PAT in the secure enclave. If cleared, wipe it.
  if (token) {
    await storage.secureSet(KEY_GH_TOKEN, token);
  } else {
    await storage.secureRemove(KEY_GH_TOKEN);
  }
  // Belt-and-suspenders: make sure any leftover legacy plaintext key never lingers.
  try {
    await AsyncStorage.removeItem(KEY_GH_TOKEN_LEGACY);
  } catch {
    // ignore
  }
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
