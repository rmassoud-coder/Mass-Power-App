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

// Set to true to bring back the visible "View Sync Logs" button for debugging.
const SHOW_DEBUG_BUTTON = false;

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
      </TouchableOpacity>

      {SHOW_DEBUG_BUTTON && (
        <TouchableOpacity onPress={openLogs} style={styles.debugButton} activeOpacity={0.7}>
          <Ionicons name="bug-outline" size={14} color="#fff" />
          <Text style={styles.debugButtonText}>View Sync Logs</Text>
        </TouchableOpacity>
      )}

      <LogsModal
        visible={logsVisible}
        logs={logs}
        onClose={() => setLogsVisible(false)}
        onClear={handleClearLogs}
        onRefresh={openLogs}
      />
    </View>
  );
}

function LogsModal({
  visible,
  logs,
  onClose,
  onClear,
  onRefresh,
}: {
  visible: boolean;
  logs: DebugLogEntry[];
  onClose: () => void;
  onClear: () => void;
  onRefresh: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sync Debug Log</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.modalBtn}>
              <Text style={styles.modalBtnText}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClear} style={styles.modalBtn}>
              <Text style={styles.modalBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.modalBtn}>
              <Text style={styles.modalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 500 }}>
            {logs.length === 0 ? (
              <Text style={styles.logEmpty}>No log entries yet.</Text>
            ) : (
              logs.map((entry, i) => (
                <View key={i} style={styles.logRow}>
                  <Text style={styles.logMeta}>
                    {entry.time} · {entry.tag}
                  </Text>
                  <Text style={styles.logMessage}>{entry.message}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
    marginBottom: 6,
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

  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  debugButtonText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  modalTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16, flex: 1 },
  modalBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#1e293b', borderRadius: 6 },
  modalBtnText: { color: '#93c5fd', fontSize: 12, fontWeight: '600' },
  logEmpty: { color: '#64748b', textAlign: 'center', marginVertical: 20 },
  logRow: { marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingBottom: 8 },
  logMeta: { color: '#64748b', fontSize: 10, marginBottom: 2 },
  logMessage: { color: '#e2e8f0', fontSize: 12 },
});
