import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  exportFullDatabase,
  mergeCloudIntoLocal,
  type FullDbSnapshot,
  type MergeResult,
} from '../db/database';
import { uploadFileToGithub } from './githubUploader';
import type { AppSettings } from './settings';

const GITHUB_API = 'https://api.github.com';
const SYNC_FILE_NAME = 'mass-power-db.json';
const KEY_LAST_SYNC = 'mp_last_sync_at';

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
  const text = await res.text();
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

/** Upload-only: local → cloud. Overwrites mass-power-db.json. Never touches local data. */
export async function pushToCloud(settings: AppSettings): Promise<SyncResult> {
  assertConfigured(settings);
  const startedAt = new Date().toISOString();
  const snap = await exportFullDatabase();
  const json = JSON.stringify(snap, null, 2);
  await uploadFileToGithub(settings, SYNC_FILE_NAME, json, `Mass Power push ${startedAt}`);
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
 * snapshot. Safe to call even if the cloud copy is stale or incomplete.
 */
export async function pullFromCloud(settings: AppSettings): Promise<SyncResult> {
  assertConfigured(settings);
  const startedAt = new Date().toISOString();
  const cloud = await fetchCloudSnapshot(settings);
  if (!cloud) {
    throw new Error('No cloud snapshot found yet. Push from a device first.');
  }
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
