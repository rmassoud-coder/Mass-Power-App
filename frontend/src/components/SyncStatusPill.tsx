import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  subscribeAutoSyncStatus,
  type AutoSyncState,
  getAutoSyncState,
} from '../utils/autoSync';
import * as dbSync from '../utils/dbSync';
import { loadSettings, isGithubConfigured } from '../utils/settings';
import { getDebugLogs, clearDebugLogs, type DebugLogEntry } from '../utils/debugLog';

// ============================================================
// DEBUG MODE — set to true to bring back the visible "View Sync
// Logs" button if you ever need to diagnose a sync issue again.
// ============================================================
const SHOW_DEBUG_BUTTON = false;
// ============================================================

function fallbackFormatSyncedAt(iso: string | null): string {
  if (!iso) return 'Not synced yet';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Not synced yet';
  const diffMs = Date.now() - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Synced just now';
  if (diffMin < 60) return `Synced ${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Synced ${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `Synced ${diffDay}d ago`;
}

function safeFormatSyncedAt(iso: string | null): string {
  if (typeof dbSync.formatSyncedAt === 'function') {
    try {
      return dbSync.formatSyncedAt(iso);
    } catch (e) {
      console.warn('SyncStatusPill: formatSyncedAt threw', e);
    }
  }
  return fallbackFormatSyncedAt(iso);
}

async function safeGetLastSyncAt(): Promise<string | null> {
  if (typeof dbSync.getLastSyncAt === 'function') {
    try {
      return await dbSync.getLastSyncAt();
    } catch (e) {
      console.warn('SyncStatusPill: getLastSyncAt threw', e);
      return null;
    }
  }
  return null;
}

export default function SyncStatusPill(): React.ReactElement | null {
  const [state, setState] = useState<AutoSyncState>(getAutoSyncState());
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [lastSyncFallback, setLastSyncFallback] = useState<string | null>(null);

  // Debug log modal state
  const [logsVisible, setLogsVisible] = useState(false);
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await loadSettings();
        if (alive) setEnabled(isGithubConfigured(s));
      } catch (e) {
        console.warn('SyncStatusPill: loadSettings/isGithubConfigured failed', e);
        if (alive) setEnabled(false);
      }
      const last = await safeGetLastSyncAt();
      if (alive) setLastSyncFallback(last);
    })();
    const unsub = subscribeAutoSyncStatus((s) => setState(s));
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const openLogs = async () => {
    const entries = await getDebugLogs();
    setLogs(entries);
    setLogsVisible(true);
  };

  const handleClearLogs = async () => {
    await clearDebugLogs();
    setLogs([]);
  };

  const isSyncing = state.status === 'syncing';
  const isError = state.status === 'error';
  const shownIso = state.lastSyncedAt || lastSyncFallback;
  const label = isSyncing
    ? 'Syncing…'
    : isError
      ? 'Sync failed'
      : safeFormatSyncedAt(shownIso);

  if (enabled !== true) return null;

  return (
    <View>
      {/* Pill itself — long-press still opens the debug log even with the
          button hidden, so you can check it later without a rebuild. */}
      <TouchableOpacity onLongPress={openLogs} activeOpacity={0.7}>
        <View
          style={[
            styles.pill,
            isError && styles.pillError,
            isSyncing && styles.pillSyncing,
          ]}
          testID="sync-status-pill"
        >
          {isSyncing ? (
            <Activi
