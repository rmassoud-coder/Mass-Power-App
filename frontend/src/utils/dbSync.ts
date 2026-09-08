import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import {
  exportFullDatabase,
  mergeCloudIntoLocal,
  replaceFullDatabase,
  type FullDbSnapshot,
  type MergeResult,
} from '../db/database';
import { uploadFileToGithub } from './githubUploader';
import type { AppSettings } from './settings';

const GITHUB_API = 'https://api.github.com';
const SYNC_FILE_NAME = 'mass-power-db.json';
const KEY_LAST_SYNC = 'mp_last_sync_at';
const LOCAL_SNAPSHOT_FILE = `${FileSystem.documentDirectory}pre-pull-snapshot.json`;

// ===== NEW: Timeout and retry configuration =====
const DEFAULT_TIMEOUT_MS = 60000; // 60 seconds (was 20s)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // 2 seconds between retries

// ===== NEW: Helper for fetch with timeout =====
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs / 1000}s`);
    }
    throw error;
  }
}

// ===== NEW: Retry wrapper =====
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelay: number = RETRY_DELAY_MS
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      // Don't retry if it's a 404 (file not found) or 401 (auth error)
      if (error.status === 404 || error.status === 401) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff: 2s, 4s, 8s
        console.log(`Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// ===== NEW: Check network connectivity =====
async function checkNetworkConnectivity(): Promise<boolean> {
  try {
    // Try to reach GitHub API with a simple request
    const response = await fetchWithTimeout('https://api.github.com/zen', {
      headers: { 'Accept': 'application/json' },
    }, 10000); // 10s timeout for connectivity check
    return response.ok;
  } catch {
    return false;
  }
}

export interface SyncResult {
  pulled: boolean;
  pushed: boolean;
  cloudExportedAt: string | null;
  localExportedAt: string;
  syncedAt: string;
  mergeResult?: MergeResult;
}

export async function getLastSyncAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY_LAST_SYNC);
  } catch {
    return null;
  }
}

async function setLastSyncAt(iso: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_LAST_SYNC, iso);
  } catch {
    // ignore
  }
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.raw+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function buildContentsUrl(settings: AppSettings): string {
  const owner = encodeURIComponent(settings.githubOwner);
  const repo = encodeURIComponent(settings.githubRepo);
  const path = encodePath(`${settings.githubFolder}/${SYNC_FILE_NAME}`);
  const branch = encodeURIComponent(settings.githubBranch || 'main');
  return `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
}

// ===== UPDATED: fetchCloudSnapshot with retry and timeout =====
async function fetchCloudSnapshot(settings: AppSettings): Promise<FullDbSnapshot | null> {
  const url = buildContentsUrl(settings);
  
  // Check connectivity first
  const isConnected = await checkNetworkConnectivity();
  if (!isConnected) {
    throw new Error('Network error: Cannot reach GitHub. Check your internet connection.');
  }
  
  const response = await retryWithBackoff(async () => {
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: authHeaders(settings.githubToken),
    }, DEFAULT_TIMEOUT_MS);
    
    if (res.status === 404) return res;
    if (!res.ok) {
      const error = new Error(`Sync fetch failed (${res.status})`);
      (error as any).status = res.status;
      throw error;
    }
    return res;
  });
  
  if (response.status === 404) return null;
  
  const text = await response.text();
  try {
    return JSON.parse(text) as FullDbSnapshot;
  } catch (e: any) {
    try {
      const wrapper = JSON.parse(text);
      if (wrapper?.content && typeof wrapper.content === 'string') {
        const clean = wrapper.content.replace(/\s+/g, '');
        const bin = (globalThis as any).atob
          ? (globalThis as any).atob(clean)
          : Buffer.from(clean, 'base64').toString('binary');
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const utf8 =
          typeof (globalThis as any).TextDecoder !== 'undefined'
            ? new (globalThis as any).TextDecoder('utf-8').decode(bytes)
            : bin;
        return JSON.parse(utf8) as FullDbSnapshot;
      }
    } catch {
      // fall through
    }
    throw new Error(`Sync snapshot is not valid JSON: ${e?.message || 'parse error'}`);
  }
}

export function formatSyncedAt(iso: string | null): string {
  if (!iso) return 'Never synced';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const diffMs = Date.now() - d.getTime();
    const min = Math.round(diffMs / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return `${min} min ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr} h ago`;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function assertConfigured(settings: AppSettings) {
  if (!settings.githubToken) {
    throw new Error('GitHub token is missing. Add it in Settings → Cloud Backup.');
  }
  if (!settings.githubOwner || !settings.githubRepo) {
    throw new Error('GitHub owner/repo not configured. Update Settings.');
  }
}

/* -------------------------------------------------------------------------- */
/*              Local safety snapshot — written before every Pull            */
/* -------------------------------------------------------------------------- */

async function saveLocalSafetySnapshot(): Promise<void> {
  const snap = await exportFullDatabase();
  await FileSystem.writeAsStringAsync(LOCAL_SNAPSHOT_FILE, JSON.stringify(snap), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function hasLocalSafetySnapshot(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(LOCAL_SNAPSHOT_FILE);
    return info.exists;
  } catch {
    return false;
  }
}

export async function getLocalSafetySnapshotTime(): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(LOCAL_SNAPSHOT_FILE);
    if (!info.exists) return null;
    const text = await FileSystem.readAsStringAsync(LOCAL_SNAPSHOT_FILE, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const snap = JSON.parse(text) as FullDbSnapshot;
    return snap.exported_at || null;
  } catch {
    return null;
  }
}

export async function restoreLocalSafetySnapshot(): Promise<void> {
  const info = await FileSystem.getInfoAsync(LOCAL_SNAPSHOT_FILE);
  if (!info.exists) {
    throw new Error('No local safety snapshot found — nothing to restore.');
  }
  const text = await FileSystem.readAsStringAsync(LOCAL_SNAPSHOT_FILE, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const snap = JSON.parse(text) as FullDbSnapshot;
  await replaceFullDatabase(snap);
}

/* -------------------------------------------------------------------------- */
/*         Versioned cloud backups — written on every Push, never pruned      */
/* -------------------------------------------------------------------------- */

/** Timestamped copy filename, safe for use as a path segment (no colons). */
function backupFileName(iso: string): string {
  return `backups/mass-power-db-${iso.replace(/[:.]/g, '-')}.json`;
}

/** Uploads a dated copy of the snapshot to vehicle profiles/backups/.
 *  Failures here are logged but never block the main push — the primary
 *  mass-power-db.json upload is what matters most and must still succeed
 *  even if this secondary copy fails for some reason (e.g. rare rate limit). */
async function uploadVersionedBackup(
  settings: AppSettings,
  json: string,
  startedAt: string
): Promise<void> {
  try {
    await uploadFileToGithub(
      settings,
      backupFileName(startedAt),
      json,
      `Backup snapshot ${startedAt}`
    );
  } catch (e: any) {
    console.warn('Versioned backup upload failed (main push still succeeded):', e?.message);
  }
}

/* -------------------------------------------------------------------------- */
/*                                Push / Pull                                 */
/* -------------------------------------------------------------------------- */

/** Upload-only: local → cloud. Overwrites mass-power-db.json AND writes a
 *  timestamped copy to backups/ so history is never lost even if a bad
 *  push happens later. Never touches local data. */
export async function pushToCloud(settings?: AppSettings): Promise<SyncResult> {
  // 🔥 FIX: Auto-load settings if they weren't passed in
  if (!settings) {
    const { loadSettings } = require('./settings');
    settings = await loadSettings();
  }
  
  assertConfigured(settings);
  
  // Check connectivity first
  const isConnected = await checkNetworkConnectivity();
  if (!isConnected) {
    throw new Error('Network error: Cannot reach GitHub. Check your internet connection and try again.');
  }
  
  const startedAt = new Date().toISOString();
  const snap = await exportFullDatabase();
  const json = JSON.stringify(snap);  // ← no spaces (much smaller)
  
  // Upload with retry logic
  await retryWithBackoff(async () => {
    await uploadFileToGithub(settings, SYNC_FILE_NAME, json, `Mass Power push ${startedAt}`);
  });
  
  // Backup upload (non-critical, don't retry)
  await uploadVersionedBackup(settings, json, startedAt);
  
  await setLastSyncAt(startedAt);
  return {
    pulled: false,
    pushed: true,
    cloudExportedAt: null,
    localExportedAt: snap.exported_at,
    syncedAt: startedAt,
  };
}

/**
 * Download + MERGE: cloud → local. Non-destructive — adds/updates records,
 * never deletes local rows, never wipes a table missing from the cloud
 * snapshot. Always saves a full local safety snapshot FIRST, so the merge
 * can be undone on-device via restoreLocalSafetySnapshot() if it ever
 * pulls something unwanted.
 */
export async function pullFromCloud(settings?: AppSettings): Promise<SyncResult> {
  // 🔥 FIX: Auto-load settings if they weren't passed in
  if (!settings) {
    const { loadSettings } = require('./settings');
    settings = await loadSettings();
  }
  
  assertConfigured(settings);
  
  // Check connectivity first
  const isConnected = await checkNetworkConnectivity();
  if (!isConnected) {
    throw new Error('Network error: Cannot reach GitHub. Check your internet connection and try again.');
  }
  
  const startedAt = new Date().toISOString();
  const cloud = await retryWithBackoff(async () => {
    return await fetchCloudSnapshot(settings);
  });
  
  if (!cloud) {
    throw new Error('No cloud snapshot found yet. Push from a device first.');
  }
  
  await saveLocalSafetySnapshot();
  const mergeResult = await mergeCloudIntoLocal(cloud);
  await setLastSyncAt(startedAt);
  return {
    pulled: true,
    pushed: false,
    cloudExportedAt: cloud.exported_at || null,
    localExportedAt: cloud.exported_at || startedAt,
    syncedAt: startedAt,
    mergeResult,
  };
}

/** True when the last successful sync was more than 24h ago (or never). */
export async function isDailyDue(): Promise<boolean> {
  const last = await getLastSyncAt();
  if (!last) return true;
  const lastMs = Date.parse(last);
  if (Number.isNaN(lastMs)) return true;
  return Date.now() - lastMs >= 24 * 60 * 60 * 1000;
}

// ===== NEW: Export for testing/debugging =====
export async function testGitHubConnection(settings: AppSettings): Promise<{ success: boolean; message: string }> {
  try {
    const isConnected = await checkNetworkConnectivity();
    if (!isConnected) {
      return { success: false, message: 'Cannot reach GitHub. Check your internet connection.' };
    }
    
    // Test with a simple API call
    const response = await fetchWithTimeout('https://api.github.com/zen', {
      headers: { 'Accept': 'application/json' },
    }, 10000);
    
    if (response.ok) {
      return { success: true, message: 'GitHub connection successful!' };
    } else {
      return { success: false, message: `GitHub API returned: ${response.status}` };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Connection test failed' };
  }
}
