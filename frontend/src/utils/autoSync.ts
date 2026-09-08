/**
 * autoSync — automatic push + automatic MERGE-pull.
 */
import { pushToCloud, pullFromCloud } from './dbSync';
import { loadSettings, isGithubConfigured } from './settings';
import { logDebug } from './debugLog';

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
 * only ever add/update, never delete.
 */
export async function runAutoPull(): Promise<void> {
  logDebug('runAutoPull', 'ENTERED runAutoPull()');
  if (_autoPullInFlight) {
    logDebug('runAutoPull', 'Skipped — already in flight');
    return _autoPullInFlight;
  }
  const now = Date.now();
  if (now - _lastAutoPullAt < AUTO_PULL_MIN_INTERVAL_MS) {
    logDebug('runAutoPull', `Skipped — throttled (${Math.round((now - _lastAutoPullAt) / 1000)}s since last, needs ${AUTO_PULL_MIN_INTERVAL_MS / 1000}s)`);
    return;
  }
  _lastAutoPullAt = now;

  _autoPullInFlight = (async () => {
    try {
      const settings = await loadSettings();
      logDebug('runAutoPull', `loadSettings() -> ${JSON.stringify(settings)}`);
      if (!isGithubConfigured(settings)) {
        logDebug('runAutoPull', 'isGithubConfigured() returned false — skipping pull');
        return;
      }
      _setState({ status: 'syncing', lastError: null });
      logDebug('runAutoPull', 'Calling pullFromCloud()...');
      const res = await pullFromCloud(settings);
      logDebug('runAutoPull', `pullFromCloud() succeeded -> ${JSON.stringify(res)}`);
      _setState({ status: 'ok', lastSyncedAt: res.syncedAt, lastError: null });
    } catch (e: any) {
      const msg = e?.message || String(e);
      logDebug('runAutoPull', `FAILED: ${msg}`);
      if (msg.includes('No cloud snapshot')) {
        _setState({ status: 'idle' });
      } else {
        _setState({ status: 'error', lastError: msg || 'Auto-pull failed' });
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

/** Call this after every add/edit/delete so changes reach the cloud */
export function triggerAutoPush(): void {
  logDebug('triggerAutoPush', 'ENTERED triggerAutoPush()');
  if (_pushInFlight) {
    _pendingWhileRunning = true;
    logDebug('triggerAutoPush', 'Push in flight — queued for after it finishes');
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
  logDebug('_runPushNow', 'ENTERED _runPushNow()');
  try {
    const settings = await loadSettings();
    logDebug('_runPushNow', `loadSettings() -> ${JSON.stringify(settings)}`);
    if (!isGithubConfigured(settings)) {
      logDebug('_runPushNow', 'isGithubConfigured() returned false — skipping push');
      return;
    }
    _setState({ status: 'syncing', lastError: null });
    logDebug('_runPushNow', 'Calling pushToCloud()...');
    const res = await pushToCloud(settings);
    logDebug('_runPushNow', `pushToCloud() succeeded -> ${JSON.stringify(res)}`);
    _setState({ status: 'ok', lastSyncedAt: res.syncedAt, lastError: null });
  } catch (e: any) {
    const msg = e?.message || String(e);
    logDebug('_runPushNow', `FAILED: ${msg}`);
    _setState({ status: 'error', lastError: msg || 'Auto-push failed' });
  }
}

export async function flushAutoPush(): Promise<void> {
  logDebug('flushAutoPush', 'ENTERED flushAutoPush()');
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

// ===== runAutoPush: direct push without debounce =====
export async function runAutoPush(): Promise<void> {
  logDebug('runAutoPush', 'ENTERED runAutoPush()');
  try {
    const settings = await loadSettings();
    logDebug('runAutoPush', `loadSettings() -> ${JSON.stringify(settings)}`);
    if (!isGithubConfigured(settings)) {
      logDebug('runAutoPush', 'isGithubConfigured() returned false — skipping push');
      return;
    }
    _setState({ status: 'syncing', lastError: null });
    logDebug('runAutoPush', 'Calling pushToCloud()...');
    const res = await pushToCloud(settings);
    logDebug('runAutoPush', `pushToCloud() succeeded -> ${JSON.stringify(res)}`);
    _setState({ status: 'ok', lastSyncedAt: res.syncedAt, lastError: null });
  } catch (e: any) {
    const msg = e?.message || String(e);
    logDebug('runAutoPush', `FAILED: ${msg}`);
    _setState({ status: 'error', lastError: msg || 'Auto-push failed' });
  }
}
