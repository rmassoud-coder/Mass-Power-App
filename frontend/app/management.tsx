import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { loadSettings } from '../src/utils/settings';
import {
  runSync,
  pushToCloud,
  pullFromCloud,
  getLastSyncAt,
  formatSyncedAt,
} from '../src/utils/dbSync';

type Tile = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  route: string;
  testID: string;
  description?: string;
};

const TILES: Tile[] = [
  {
    label: 'Inventory',
    icon: 'cube-outline',
    color: '#fff',
    bg: '#0f766e',
    route: '/inventory',
    testID: 'tile-inventory',
    description: 'Manage parts, oil filters, stock & prices',
  },
  {
    label: 'Oil Change Reminders',
    icon: 'logo-whatsapp',
    color: '#fff',
    bg: '#25D366',
    route: '/reminders',
    testID: 'tile-reminders',
    description: 'WhatsApp customers when service is due',
  },
  {
    label: 'Services Report',
    icon: 'document-text-outline',
    color: '#fff',
    bg: '#2563eb',
    route: '/report',
    testID: 'tile-report',
    description: 'View / export all services',
  },
  {
    label: 'Backup & Restore',
    icon: 'cloud-download-outline',
    color: '#0f172a',
    bg: '#e2e8f0',
    route: '/backup',
    testID: 'tile-backup',
    description: 'Save & restore your database',
  },
  {
    label: 'Settings',
    icon: 'settings-outline',
    color: '#0f172a',
    bg: '#e2e8f0',
    route: '/settings',
    testID: 'tile-settings',
    description: 'Garage profile, GitHub, country code',
  },
  {
    label: 'Monthly Code',
    icon: 'apps-outline',
    color: '#fff',
    bg: '#7c3aed',
    route: '/qr-generate',
    testID: 'tile-qr-generate',
    description: 'Print this month\'s 10×10 Data Matrix guarantee sticker',
  },
];

export default function ManagementScreen() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const refreshLast = useCallback(async () => {
    setLastSyncAt(await getLastSyncAt());
  }, []);

  useEffect(() => {
    refreshLast();
  }, [refreshLast]);

  const performSync = useCallback(
    async (
      op: 'auto' | 'push' | 'pull',
      silent: boolean
    ) => {
      if (syncing) return;
      setSyncing(true);
      try {
        const settings = await loadSettings();
        if (!settings.githubToken) {
          if (!silent) {
            Alert.alert(
              'Sync not configured',
              'Add a GitHub Personal Access Token in Settings → Cloud Backup, then try again.'
            );
          }
          return;
        }
        let msg = '';
        if (op === 'push') {
          const res = await pushToCloud(settings);
          msg = `Local database uploaded to cloud (${res.localExportedAt.slice(0, 19)}Z).`;
        } else if (op === 'pull') {
          const res = await pullFromCloud(settings);
          msg = `Cloud snapshot pulled to this device (${(res.cloudExportedAt || '').slice(0, 19)}Z).`;
        } else {
          const res = await runSync(settings);
          msg = res.pulled
            ? 'Pulled newer data from cloud and pushed local changes.'
            : 'Local changes pushed to cloud.';
        }
        await refreshLast();
        if (!silent) {
          Alert.alert(op === 'push' ? 'Push complete' : op === 'pull' ? 'Pull complete' : 'Sync complete', msg);
        }
      } catch (e: any) {
        if (!silent) {
          Alert.alert(
            op === 'push' ? 'Push failed' : op === 'pull' ? 'Pull failed' : 'Sync failed',
            e?.message || 'Unknown error'
          );
        } else {
          console.warn('Auto-sync failed:', e?.message);
        }
      } finally {
        setSyncing(false);
      }
    },
    [refreshLast, syncing]
  );

  // Auto-sync on launch has been intentionally REMOVED.
  // Cloud sync now runs ONLY when the user taps Push or Pull explicitly.

  const confirmPull = () => {
    Alert.alert(
      'Pull from Cloud?',
      'This will REPLACE the local database with the online copy. Any local changes not yet pushed will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pull & Overwrite',
          style: 'destructive',
          onPress: () => performSync('pull', false),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>Backend Management</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Cloud sync — two explicit buttons */}
        <View style={styles.syncCard}>
          <Text style={styles.syncCardTitle}>Cloud Sync</Text>
          <Text style={styles.syncCardSub}>
            Last synced: {formatSyncedAt(lastSyncAt)}
          </Text>
          <View style={styles.syncBtnRow}>
            <TouchableOpacity
              style={[styles.syncBtn, styles.syncBtnPush, syncing && styles.syncBtnDisabled]}
              onPress={() => performSync('push', false)}
              disabled={syncing}
              activeOpacity={0.85}
              testID="sync-push-button"
            >
              {syncing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color="#fff" />
                  <Text style={styles.syncBtnText}>Push</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.syncBtn, styles.syncBtnPull, syncing && styles.syncBtnDisabled]}
              onPress={confirmPull}
              disabled={syncing}
              activeOpacity={0.85}
              testID="sync-pull-button"
            >
              {syncing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-download" size={20} color="#fff" />
                  <Text style={styles.syncBtnText}>Pull</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.syncHint}>
            Push uploads THIS device&apos;s data to the cloud. Pull replaces THIS device&apos;s data
            with the cloud copy. Auto-pull+push runs once per day when you open the app.
          </Text>
        </View>

        <View style={styles.grid}>
          {TILES.map((t) => (
            <TouchableOpacity
              key={t.route}
              style={[styles.tile, { backgroundColor: t.bg }]}
              onPress={() => router.push(t.route as never)}
              activeOpacity={0.85}
              testID={t.testID}
            >
              <View style={styles.iconBubble}>
                <Ionicons name={t.icon} size={28} color={t.color} />
              </View>
              <Text style={[styles.tileLabel, { color: t.color }]}>{t.label}</Text>
              {t.description ? (
                <Text style={[styles.tileDesc, { color: t.color, opacity: 0.85 }]}>
                  {t.description}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  scroll: { padding: 16, paddingBottom: 32 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    width: '48%',
    minHeight: 140,
    borderRadius: 16,
    padding: 14,
    justifyContent: 'space-between',
    elevation: 2,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 6,
  },
  tileDesc: { fontSize: 11, marginTop: 4, lineHeight: 14 },
  syncCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  syncCardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  syncCardSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  syncBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  syncBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  syncBtnPush: { backgroundColor: '#16a34a' },
  syncBtnPull: { backgroundColor: '#2563eb' },
  syncBtnDisabled: { backgroundColor: '#475569' },
  syncBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  syncHint: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 10,
    lineHeight: 15,
  },
});
