/**
 * autoSync — automatic push + automatic MERGE-pull.
 *
 * *** History note (2026-08-08) ***
 * An earlier version silently pulled on every app open using a destructive
 * REPLACE — that overwrote real local data with a stale cloud snapshot and
 * caused real data loss. It was disabled entirely afterward.
 *
 * Auto-pull is reintroduced here, but it is now safe by construction:
 * dbSync.ts's pullFromCloud() uses mergeCloudIntoLocal(), which only ever
 * ADDS or UPDATES records (newer updated_at wins) and NEVER deletes local
 * rows or wipes a table missing from the cloud payload. A local safety
 * snapshot is also saved automatically before every merge (see dbSync.ts),
 * so even an unwanted merge can be undone on-device.
 *
 * Limitation to know: vehicles/services/suppliers have no updated_at
 * column, so an EDIT to an already-synced record on one device will not
 * auto-propagate to the other — only brand-new records sync automatically.
 * Use the manual Push/Pull buttons in Backend Management for edits.
 */
import { pushToCloud, pullFromCloud } from './dbSync';
import { loadSettings, isGithubConfigured } from './settings';

export type AutoSyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

export interface AutoSyncState {
  status: AutoSyncStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
}

let _state: AutoSyncState = {
  status: 'idle',
  lastSyncedAt: null,
  lastError: null,
};

const _listeners = new Set<(s: AutoSyncState) => void>();

function _emit() {
  const snapshot: AutoSyncState = { ..._state };
  _listeners.forEach((cb) => {
    try { cb(snapshot); } catch { /* ignore */ }
  });
}

function _setState(patch: Partial<AutoSyncState>) {
  _state = { ..._state, ...patch };
  _emit();
}

export function subscribeAutoSyncStatus(cb: (s: AutoSyncState) => void): () => void {
  _listeners.add(cb);
  cb({ ..._state });
  return () => { _listeners.delete(cb); };
}

export function getAutoSyncState(): AutoSyncState {
  return { ..._state };
}

/* -------------------------------------------------------------------------- */
/*                    Automatic MERGE-pull (safe, additive-only)              */
/* -------------------------------------------------------------------------- */

const AUTO_PULL_MIN_INTERVAL_MS = 2 * 60 * 1000; // don't hammer the API
let _lastAutoPullAt = 0;
let _autoPullInFlight: Promise<void> | null = null;

/**
 * Safe to call as often as you like — throttled internally, and merges
 * only ever add/update, never delete. Call on app launch and on every
 * foreground transition for near-real-time visibility across devices.
 */
export async function runAutoPull(): Promise<void> {
  if (_autoPullInFlight) return _autoPullInFlight;
  const now = Date.now();
  if (now - _lastAutoPullAt < AUTO_PULL_MIN_INTERVAL_MS) return;
  _lastAutoPullAt = now;

  _autoPullInFlight = (async () => {
    try {
      const settings = await loadSettings();
      if (!isGithubConfigured(settings)) return;
      _setState({ status: 'syncing', lastError: null });
      const res = await pullFromCloud(settings);
      _setState({ status: 'ok', lastSyncedAt: res.syncedAt, lastError: null });
    } catch (e: any) {
      // "No cloud snapshot found yet" just means nothing to pull — not an error.
      if (String(e?.message || '').includes('No cloud snapshot')) {
        _setState({ status: 'idle' });
      } else {
        _setState({ status: 'error', lastError: e?.message || 'Auto-pull failed' });
      }
    } finally {
      _autoPullInFlight = null;
    }
  })();
  return _autoPullInFlight;
}

/* -------------------------------------------------------------------------- */
/*                          Debounced auto-push                               */
/* -------------------------------------------------------------------------- */

let _pushTimer: any = null;
let _pushInFlight: Promise<void> | null = null;
let _pendingWhileRunning = false;

const PUSH_DEBOUNCE_MS = 1200;

/** Call this after every add/edit/delete so changes reach the cloud
 *  (and from there, the other device's next auto-pull) automatically. */
export function triggerAutoPush(): void {
  if (_pushInFlight) {
    _pendingWhileRunning = true;
    return;
  }
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    _pushTimer = null;
    _pushInFlight = _runPushNow().finally(() => {
      _pushInFlight = null;
      if (_pendingWhileRunning) {
        _pendingWhileRunning = false;
        triggerAutoPush();
      }
    });
  }, PUSH_DEBOUNCE_MS);
}

async function _runPushNow(): Promise<void> {
  try {
    const settings = await loadSettings();
    if (!isGithubConfigured(settings)) return;
    _setState({ status: 'syncing', lastError: null });
    const res = await pushToCloud(settings);
    _setState({ status: 'ok', lastSyncedAt: res.syncedAt, lastError: null });
  } catch (e: any) {
    _setState({ status: 'error', lastError: e?.message || 'Auto-push failed' });
  }
}

export async function flushAutoPush(): Promise<void> {
  if (_pushTimer) {
    clearTimeout(_pushTimer);
    _pushTimer = null;
  }
  if (_pushInFlight) {
    await _pushInFlight;
  } else {
    await _runPushNow();
  }
}
