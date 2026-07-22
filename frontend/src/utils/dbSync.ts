import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  exportFullDatabase,
  replaceFullDatabase,
  type FullDbSnapshot,
} from '../db/database';
import { uploadFileToGithub } from './githubUploader';
import type { AppSettings } from './settings';

const GITHUB_API = 'https://api.github.com';
const SYNC_FILE_NAME = 'mass-power-db.json';
const KEY_LAST_SYNC = 'mp_last_sync_at'; // ISO timestamp of last successful sync

export interface SyncResult {
  pulled: boolean;   // true when cloud snapshot replaced local
  pushed: boolean;   // true when local was uploaded to cloud
  cloudExportedAt: string | null;
  localExportedAt: string;
  syncedAt: string;  // ISO timestamp of THIS sync operation
}

/** Read the ISO timestamp of the last successful sync, or null if none. */
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

/** URL-encode a path segment preserving slashes. */
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

/**
 * Fetch the JSON snapshot from GitHub. Returns null if the file doesn't exist
 * yet (first-time sync).
 */
async function fetchCloudSnapshot(settings: AppSettings): Promise<FullDbSnapshot | null> {
  const url = buildContentsUrl(settings);
  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(settings.githubToken),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sync fetch failed (${res.status}): ${body.slice(0, 200)}`);
  }
  // With Accept: application/vnd.github.raw+json we get the raw file body.
  const text = await res.text();
  try {
    return JSON.parse(text) as FullDbSnapshot;
  } catch (e: any) {
    // Fallback: some GitHub setups still return the JSON envelope with base64 content
    try {
      const wrapper = JSON.parse(text);
      if (wrapper?.content && typeof wrapper.content === 'string') {
        const clean = wrapper.content.replace(/\s+/g, '');
        // Decode base64 → UTF-8 string
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
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

/* -------------------------------------------------------------------------- */
/*                        Helpers used by autoSync                            */
/* -------------------------------------------------------------------------- */

/** Fetch cloud snapshot without applying it. Returns null if the file
 *  doesn't exist yet. Bubbles up 401/403 so autoSync can surface bad tokens. */
export async function fetchCloudSnapshotForCheck(
  settings: AppSettings
): Promise<FullDbSnapshot | null> {
  assertConfigured(settings);
  return fetchCloudSnapshot(settings);
}

/**
 * Read cloud snapshot; if its `exported_at` is strictly newer than the caller's
 * `lastLocalIso` marker, replace the local DB with it and return true. Returns
 * false otherwise (cloud missing / same-or-older). Never pushes.
 */
export async function applyCloudIfNewer(
  settings: AppSettings,
  lastLocalIso: string,
  _fetch?: (s: AppSettings) => Promise<FullDbSnapshot | null>
): Promise<boolean> {
  const cloud = await (_fetch || fetchCloudSnapshotForCheck)(settings);
  if (!cloud) return false;
  const cloudTs = cloud.exported_at ? Date.parse(cloud.exported_at) : 0;
  const localTs = lastLocalIso ? Date.parse(lastLocalIso) : 0;
  if (cloudTs > 0 && cloudTs > localTs) {
    await replaceFullDatabase(cloud);
    await setLastSyncAt(new Date().toISOString());
    return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*                                  runSync                                   */
/* -------------------------------------------------------------------------- */

/**
 * Runs a full sync cycle:
 *   1. PULL: fetch cloud snapshot. If it exists AND its `exported_at` is newer
 *      than the local last-sync marker, replace local DB with cloud (cloud wins).
 *   2. PUSH: export local DB (which may have been replaced by cloud in step 1
 *      or may contain uncommitted local edits) and upload to GitHub.
 *   3. Update `lastSyncAt` marker.
 *
 * Design note: The user asked for "cloud wins". By pushing AFTER a pull, the
 * cloud is always kept up-to-date with the most recently-synced device. When
 * two devices both hold unsynced edits, whichever syncs LAST becomes the truth
 * — which matches the "cloud wins" semantics they chose.
 */
export async function runSync(settings: AppSettings): Promise<SyncResult> {
  if (!settings.githubToken) {
    throw new Error('GitHub token is missing. Add it in Settings → Cloud Backup.');
  }
  if (!settings.githubOwner || !settings.githubRepo) {
    throw new Error('GitHub owner/repo not configured. Update Settings.');
  }

  const startedAt = new Date().toISOString();
  const lastLocal = (await getLastSyncAt()) || '';
  let pulled = false;
  let cloudExportedAt: string | null = null;

  // 1) Pull
  try {
    const cloud = await fetchCloudSnapshot(settings);
    if (cloud) {
      cloudExportedAt = cloud.exported_at || null;
      // Only replace local if cloud is newer than our last known sync
      const cloudTs = cloudExportedAt ? Date.parse(cloudExportedAt) : 0;
      const localTs = lastLocal ? Date.parse(lastLocal) : 0;
      if (cloudTs > 0 && cloudTs > localTs) {
        await replaceFullDatabase(cloud);
        pulled = true;
      }
    }
  } catch (e: any) {
    // If pull fails but token is valid, we still try to push so at least the
    // first device seeds the cloud file.
    if (String(e?.message || '').startsWith('Authorisation') || String(e?.message || '').includes('401')) {
      throw e; // fatal — bad token
    }
  }

  // 2) Push local snapshot up (this becomes the new cloud master)
  const snap = await exportFullDatabase();
  const json = JSON.stringify(snap, null, 2);
  await uploadFileToGithub(
    settings,
    SYNC_FILE_NAME,
    json,
    `Mass Power sync ${startedAt}`
  );

  // 3) Record
  await setLastSyncAt(startedAt);

  return {
    pulled,
    pushed: true,
    cloudExportedAt,
    localExportedAt: snap.exported_at,
    syncedAt: startedAt,
  };
}

function assertConfigured(settings: AppSettings) {
  if (!settings.githubToken) {
    throw new Error('GitHub token is missing. Add it in Settings → Cloud Backup.');
  }
  if (!settings.githubOwner || !settings.githubRepo) {
    throw new Error('GitHub owner/repo not configured. Update Settings.');
  }
}

/** Upload-only: local → cloud. Overwrites `mass-power-db.json` in the configured repo. */
export async function pushToCloud(settings: AppSettings): Promise<SyncResult> {
  assertConfigured(settings);
  const startedAt = new Date().toISOString();
  const snap = await exportFullDatabase();
  const json = JSON.stringify(snap, null, 2);
  await uploadFileToGithub(
    settings,
    SYNC_FILE_NAME,
    json,
    `Mass Power push ${startedAt}`
  );
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
 * Download-only: cloud → local. **Unconditionally overwrites the local DB** with
 * the cloud snapshot. Throws if no cloud file exists yet. Caller should confirm
 * with the user before invoking — this is destructive to any unpushed local edits.
 */
export async function pullFromCloud(settings: AppSettings): Promise<SyncResult> {
  assertConfigured(settings);
  const startedAt = new Date().toISOString();
  const cloud = await fetchCloudSnapshot(settings);
  if (!cloud) {
    throw new Error('No cloud snapshot found yet. Push from a device first.');
  }
  await replaceFullDatabase(cloud);
  await setLastSyncAt(startedAt);
  return {
    pulled: true,
    pushed: false,
    cloudExportedAt: cloud.exported_at || null,
    localExportedAt: cloud.exported_at || startedAt,
    syncedAt: startedAt,
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
