import * as FileSystem from 'expo-file-system/legacy';
import type { Customer, Service, Vehicle } from '../db/database';
import { buildVehicleHistoryHtml } from './htmlBuilder';
import type { AppSettings } from './settings';

const GITHUB_API = 'https://api.github.com';

interface FetchFileResponse {
  sha?: string;
  message?: string;
}

/** Convert a UTF-8 string to base64 reliably across platforms by going through
 *  a temp cache file (works on RN, no TextEncoder polyfill needed). */
async function utf8ToBase64(html: string): Promise<string> {
  const tmp = `${FileSystem.cacheDirectory}gh-upload-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
  try {
    await FileSystem.writeAsStringAsync(tmp, html, { encoding: 'utf8' });
    const b64 = await FileSystem.readAsStringAsync(tmp, { encoding: 'base64' });
    return b64;
  } finally {
    try {
      await FileSystem.deleteAsync(tmp, { idempotent: true });
    } catch {
      // ignore
    }
  }
}

/** URL-encode a path segment while preserving the slash separator between segments. */
function encodePath(path: string): string {
  return path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function buildContentsUrl(settings: AppSettings, fileName: string, ref?: string): string {
  const owner = encodeURIComponent(settings.githubOwner);
  const repo = encodeURIComponent(settings.githubRepo);
  const path = encodePath(`${settings.githubFolder}/${fileName}`);
  const refSuffix = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  return `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}${refSuffix}`;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** Wrap fetch with a hard timeout so a hung request becomes a visible error
 *  instead of an indefinite spinner. */
async function timedFetch(url: string, init: RequestInit, timeoutMs = 20000): Promise<Response> {
  // eslint-disable-next-line no-undef
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`Network timeout after ${Math.round(timeoutMs / 1000)}s - check your internet and GitHub status`);
    }
    throw new Error(e?.message || 'Network error reaching GitHub');
  } finally {
    clearTimeout(id);
  }
}

/** GETs the current file's SHA so we can overwrite. Returns undefined if file doesn't exist. */
async function fetchCurrentSha(settings: AppSettings, fileName: string): Promise<string | undefined> {
  const url = buildContentsUrl(settings, fileName, settings.githubBranch);
  const res = await timedFetch(url, { method: 'GET', headers: authHeaders(settings.githubToken) });
  if (res.status === 404) return undefined;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as FetchFileResponse;
    throw new Error(`GitHub fetch failed (${res.status}): ${body.message || res.statusText}`);
  }
  const body = (await res.json()) as FetchFileResponse;
  return body.sha;
}

/** Create or update a single file on GitHub. Last-write-wins (we always overwrite). */
export async function uploadFileToGithub(
  settings: AppSettings,
  fileName: string,
  html: string,
  commitMessage: string
): Promise<{ commitUrl: string; pagesUrl: string }> {
  if (!settings.githubToken) {
    throw new Error('GitHub token not configured. Open Settings to add one.');
  }
  const base64 = await utf8ToBase64(html);
  // Look up existing SHA so we overwrite (otherwise GitHub rejects with 422)
  const sha = await fetchCurrentSha(settings, fileName);

  const url = buildContentsUrl(settings, fileName);
  const res = await timedFetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(settings.githubToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: commitMessage,
      content: base64,
      branch: settings.githubBranch,
      ...(sha ? { sha } : {}),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const msg = body?.message || res.statusText;
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Authorisation failed (${res.status}). Check that the token has 'repo' or 'public_repo' scope and isn't expired.`);
    }
    if (res.status === 404) {
      throw new Error(`Repo or path not found (${res.status}). Check owner/repo/branch/folder in Settings.`);
    }
    throw new Error(`Upload failed (${res.status}): ${msg}`);
  }
  const commitUrl: string = body?.commit?.html_url || '';
  const pagesUrl = `https://${settings.githubOwner}.github.io/${settings.githubRepo}/${encodePath(
    settings.githubFolder
  )}/${encodeURIComponent(fileName)}`;
  return { commitUrl, pagesUrl };
}

/** Generates the vehicle profile HTML and uploads it as <vehicleId>.html. */
export async function uploadVehicleProfile(
  customer: Customer,
  vehicle: Vehicle,
  services: Service[],
  settings: AppSettings
): Promise<{ commitUrl: string; pagesUrl: string }> {
  const html = buildVehicleHistoryHtml(customer, vehicle, services, settings);
  const fileName = `${vehicle.id}.html`;
  const message = `Update ${vehicle.year || ''} ${vehicle.make} ${vehicle.model} (${vehicle.plate_number})`.trim();
  return uploadFileToGithub(settings, fileName, html, message);
}

/** Lightweight token+repo health check so users can verify their settings before bulk upload. */
export async function testGithubConnection(
  settings: AppSettings
): Promise<{ ok: true; user: string } | { ok: false; message: string }> {
  try {
    if (!settings.githubToken) return { ok: false, message: 'No token configured' };
    // 1. Validate the token itself
    const meRes = await timedFetch(`${GITHUB_API}/user`, { method: 'GET', headers: authHeaders(settings.githubToken) });
    if (!meRes.ok) {
      const body = await meRes.json().catch(() => ({}));
      return { ok: false, message: `Token check failed (${meRes.status}): ${body.message || meRes.statusText}` };
    }
    const me = (await meRes.json()) as { login: string };
    // 2. Validate repo + branch are reachable
    const repoUrl = `${GITHUB_API}/repos/${encodeURIComponent(settings.githubOwner)}/${encodeURIComponent(
      settings.githubRepo
    )}/branches/${encodeURIComponent(settings.githubBranch)}`;
    const repoRes = await timedFetch(repoUrl, { method: 'GET', headers: authHeaders(settings.githubToken) });
    if (!repoRes.ok) {
      const body = await repoRes.json().catch(() => ({}));
      return { ok: false, message: `Repo/branch check failed (${repoRes.status}): ${body.message || repoRes.statusText}` };
    }
    return { ok: true, user: me.login };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Network error' };
  }
}

/** Bulk upload all vehicle profiles. onProgress is called between files (1-based index). */
export async function uploadAllVehicleProfiles(
  items: { customer: Customer; vehicle: Vehicle; services: Service[] }[],
  settings: AppSettings,
  onProgress?: (i: number, total: number, label: string) => void
): Promise<{ uploaded: number; failed: { vehicleId: string; label: string; error: string }[] }> {
  let uploaded = 0;
  const failed: { vehicleId: string; label: string; error: string }[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const label = `${it.vehicle.year || ''} ${it.vehicle.make} ${it.vehicle.model}`.trim();
    onProgress?.(i + 1, items.length, label);
    try {
      await uploadVehicleProfile(it.customer, it.vehicle, it.services, settings);
      uploaded++;
    } catch (e: any) {
      failed.push({ vehicleId: it.vehicle.id, label, error: e?.message || 'Unknown error' });
    }
  }
  return { uploaded, failed };
}
