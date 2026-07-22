import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  subscribeAutoSyncStatus,
  type AutoSyncState,
  getAutoSyncState,
} from '../utils/autoSync';
import { getLastSyncAt, formatSyncedAt } from '../utils/dbSync';
import { loadSettings, isGithubConfigured } from '../utils/settings';

/**
 * Tiny pill that renders auto-sync status in the app chrome. Silently hides
 * itself when GitHub isn't configured so the offline-only user isn't
 * confused. Otherwise shows:
 *   • spinner + "Syncing…" while an upload is in flight
 *   • cloud check + "Synced 3 min ago" once done
 *   • red warning when the last sync failed
 */
export default function SyncStatusPill(): React.ReactElement | null {
  const [state, setState] = useState<AutoSyncState>(getAutoSyncState());
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [lastSyncFallback, setLastSyncFallback] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await loadSettings();
      if (alive) setEnabled(isGithubConfigured(s));
      const last = await getLastSyncAt();
      if (alive) setLastSyncFallback(last);
    })();
    const unsub = subscribeAutoSyncStatus((s) => setState(s));
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  if (enabled !== true) return null;

  const isSyncing = state.status === 'syncing';
  const isError = state.status === 'error';
  const shownIso = state.lastSyncedAt || lastSyncFallback;
  const label = isSyncing
    ? 'Syncing…'
    : isError
      ? 'Sync failed'
      : formatSyncedAt(shownIso);

  return (
    <View
      style={[
        styles.pill,
        isError && styles.pillError,
        isSyncing && styles.pillSyncing,
      ]}
      testID="sync-status-pill"
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color="#1e40af" />
      ) : isError ? (
        <Ionicons name="alert-circle" size={13} color="#b91c1c" />
      ) : (
        <Ionicons name="cloud-done-outline" size={13} color="#047857" />
      )}
      <Text
        style={[
          styles.pillText,
          isError && styles.pillTextError,
          isSyncing && styles.pillTextSyncing,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  pillSyncing: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  pillError: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065f46',
    maxWidth: 130,
  },
  pillTextSyncing: { color: '#1e40af' },
  pillTextError: { color: '#b91c1c' },
});
