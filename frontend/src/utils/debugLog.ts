import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_KEY = '__sync_debug_log__';
const MAX_ENTRIES = 100;

export interface DebugLogEntry {
  time: string;
  tag: string;
  message: string;
}

let _cache: DebugLogEntry[] | null = null;

async function _load(): Promise<DebugLogEntry[]> {
  if (_cache) return _cache;
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    _cache = raw ? JSON.parse(raw) : [];
  } catch {
    _cache = [];
  }
  return _cache!;
}

async function _save() {
  try {
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(_cache ?? []));
  } catch {
    // ignore write failures — logging must never crash the app
  }
}

/** Append a log entry. Safe to call from anywhere — never throws. */
export async function logDebug(tag: string, message: string): Promise<void> {
  try {
    const list = await _load();
    list.push({ time: new Date().toLocaleString(), tag, message });
    while (list.length > MAX_ENTRIES) list.shift();
    _cache = list;
    await _save();
  } catch {
    // ignore — logging must never crash the app
  }
}

export async function getDebugLogs(): Promise<DebugLogEntry[]> {
  const list = await _load();
  return [...list].reverse(); // newest first
}

export async function clearDebugLogs(): Promise<void> {
  _cache = [];
  await _save();
}
