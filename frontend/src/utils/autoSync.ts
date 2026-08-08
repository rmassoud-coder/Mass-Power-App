/**
 * autoSync — fire-and-forget cloud sync driven by local mutations.
 *
 * Design:
 *   • `runStartupPull()`   → called once during app init. Pulls the cloud
 *                            snapshot if it's newer than our last-sync marker.
 *                            Never pushes, so a stale local copy on the first
 *                            device coming online can't overwrite a fresher
 *                            cloud snapshot.
 *   • `triggerAutoPush()`  → called after every add / edit / delete. Debounces
 *                            (~1200 ms) so a burst of rapid mutations coalesces
 *                            into a single upload. Push-only — pull happens on
 *                            startup — so a mutation we just made can never be
 *                            clobbered by an incoming pull.
 *   • Status is exposed as a tiny FSM ('idle' | 'syncing' | 'ok' | 'error')
 *     via `subscribeAutoSyncStatus()` so the home screen can render a badge.
 *
 * If GitHub isn't configured (no token / owner / repo) every call is a silent
 * no-op — the app continues to work purely offline.
 *
 * *** runStartupPull() TEMPORARILY DISABLED (2026-08-08) ***
 * A silent startup pull overwrote real local data on a device with a stale
 * cloud snapshot, with no confirmation step. Disabled until a safer version
 * (confirm before overwrite, or a real merge instead of last-write-wins) is
 * built. triggerAutoPush() (push-only) is untouched and still runs normally.
 */
import { pushToCloud, pullFromCloud, getLastSyncAt, applyCloudIfNewer } from './dbSync';
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

/** Subscribe to sync status changes. Returns unsubscribe. */
export function subscribeAutoSyncStatus(cb: (s: AutoSyncState) => void): () => void {
  _listeners.add(cb);
  // Fire once immediately so subscribers pick up current state
  cb({ ..._state });
  return () => { _listeners.delete(cb); };
}

export function getAutoSyncState(): AutoSyncState {
  return { ..._state };
}

/* -------------------------------------------------------------------------- */
/*                              Startup pull                                  */
/* -------------------------------------------------------------------------- */

let _startupPullDone = false;

/**
 * TEMPORARILY DISABLED — see file header. Returns immediately and does
 * nothing. Re-enable only after adding a confirmation step / smarter merge
 * logic than plain last-write-wins-by-timestamp.
 */
export async function runStartupPull(): Promise<void> {
  return;

  // --- Original implementation, kept for reference, currently unreachable ---
  // eslint-disable-next-line no-unreachable
  if (_startupPullDone) return;
  _startupPullDone = true;

  try {
    const settings = await loadSettings();
    if (!isGithubConfigured(settings)) return;

    _setState({ status: 'syncing', lastError: null });
    const lastLocal = await getLastSyncAt();
    if (!lastLocal) {
      try {
        await pullFromCloud(settings);
      } catch {
        // "No cloud snapshot found yet" is fine — nothing to seed.
      }
      _setState({ status: 'ok', lastSyncedAt: new Date().toISOString() });
      return;
    }

    const applied = await applyCloudIfNewer(settings, lastLocal);
    _setState({
      status: applied ? 'ok' : 'idle',
      lastSyncedAt: applied ? new Date().toISOString() : _state.lastSyncedAt,
    });
  } catch (e: any) {
    _setState({ status: 'error', lastError: e?.message || 'Startup pull failed' });
  }
}

/* -------------------------------------------------------------------------- */
/*                          Debounced auto-push                               */
/* -------------------------------------------------------------------------- */

let _pushTimer: any = null;
let _pushInFlight: Promise<void> | null = null;
let _pendingWhileRunning = false;

const PUSH_DEBOUNCE_MS = 1200;

/**
 * Schedule a push to cloud after a short quiet period. Multiple calls within
 * the debounce window collapse into a single upload. If a push is already
 * running, one more is queued and fires as soon as the current one finishes
 * so the very-latest state always makes it up.
 */
export function triggerAutoPush(): void {
  if (_pushInFlight) {
    // Another push is running — mark that we need one more after it settles.
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
        // Chain another debounced push for any mutations that arrived while
        // the previous push was in-flight.
        triggerAutoPush();
      }
    });
  }, PUSH_DEBOUNCE_MS);
}

async function _runPushNow(): Promise<void> {
  try {
    const settings = await loadSettings();
    if (!isGithubConfigured(settings)) return; // silent no-op
    _setState({ status: 'syncing', lastError: null });
    const res = await pushToCloud(settings);
    _setState({
      status: 'ok',
      lastSyncedAt: res.syncedAt,
      lastError: null,
    });
  } catch (e: any) {
    _setState({
      status: 'error',
      lastError: e?.message || 'Auto-sync failed',
    });
  }
}

/** For tests / imperative flows — flush any pending debounced push right now. */
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
