/**
 * autoSync — automatic push + automatic MERGE-pull.
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

// ===== NEW: Add runAutoPush for direct push without debounce =====
export async function runAutoPush(): Promise<void> {
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
