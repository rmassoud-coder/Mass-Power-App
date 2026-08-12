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
  pushToCloud,
  pullFromCloud,
  getLastSyncAt,
  formatSyncedAt,
  restoreLocalSafetySnapshot,
  getLocalSafetySnapshotTime,
} from '../src/utils/dbSync';
import { getReport } from '../src/db/database';

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
    label: 'Price Stickers',
    icon: 'pricetags-outline',
    color: '#fff',
    bg: '#a855f7',
    route: '/price-stickers',
    testID: 'tile-price-stickers',
    description: 'Print 55mm price stickers for shelf / parts',
  },
  {
    label: 'Cat Printer (BLE)',
    icon: 'bluetooth-outline',
    color: '#fff',
    bg: '#0ea5e9',
    route: '/cat-printer',
    testID: 'tile-cat-printer',
    description: 'Pair & test-print with your PD01 over Bluetooth',
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
    label: 'Services and Reports',
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
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [cashFlow, setCashFlow] = useState<{
    revenue: number;
    outsource: number;
    net: number;
  } | null>(null);
  const [cashFlowLoading, setCashFlowLoading] = useState(false);

  const refreshLast = useCallback(async () => {
    setLastSyncAt(await getLastSyncAt());
    setSnapshotAt(await getLocalSafetySnapshotTime());
  }, []);

  const loadCashFlow = useCallback(async () => {
    setCashFlowLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const data = await getReport(
        `${today}T00:00:00`,
        `${today}T23:59:59`,
        undefined,
        undefined,
        undefined,
        false
      );
      setCashFlow({
        revenue: data.total_cost,
        outsource: data.outsource_total || 0,
        net: data.net_cash_flow || 0,
      });
    } catch (e) {
      // silently fail
    } finally {
      setCashFlowLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshLast();
  }, [refreshLast]);

  useEffect(() => {
    loadCashFlow();
  }, [loadCashFlow]);

  // Sync only ever runs when the user taps Push or Pull below.
  // There is no automatic/background/startup sync anywhere in the app.
  const performSync = useCallback(
    async (
      op: 'push' | 'pull',
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
        } else {
          const res = await pullFromCloud(settings);
          const mr = res.mergeResult;
          msg = mr
            ? `Merged from cloud: +${mr.customers.inserted} customers, +${mr.vehicles.inserted} vehicles, +${mr.services.inserted} services, +${mr.inventory.inserted} inventory items. Nothing was deleted.`
            : `Cloud snapshot merged into this device (${(res.cloudExportedAt || '').slice(0, 19)}Z).`;
        }
        await refreshLast();
        if (!silent) {
          Alert.alert(op === 'push' ? 'Push complete' : 'Pull complete', msg);
        }
      } catch (e: any) {
        if (!silent) {
          Alert.alert(
            op === 'push' ? 'Push failed' : 'Pull failed',
            e?.message || 'Unknown error'
          );
        } else {
          console.warn('Sync failed:', e?.message);
        }
      } finally {
        setSyncing(false);
      }
    },
    [refreshLast, syncing]
  );

  const confirmPull = () => {
    Alert.alert(
      'Pull from Cloud?',
      'This merges the cloud copy into this device — new records are added, existing local records are kept. Nothing on this device will be deleted. A local backup is saved automatically first, so this can be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pull & Merge',
          onPress: () => performSync('pull', false),
        },
      ]
    );
  };

  const confirmRestoreSnapshot = () => {
    Alert.alert(
      'Undo Last Pull?',
      'This restores this device\'s data to exactly how it was right before your last Pull — the cloud is not touched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              await restoreLocalSafetySnapshot();
              await refreshLast();
              Alert.alert('Restored', 'Local data restored to its pre-Pull state.');
            } catch (e: any) {
              Alert.alert('Restore failed', e?.message || 'Unknown error');
            }
          },
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
        {/* Cloud sync — two explicit buttons, nothing automatic */}
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
            Push uploads THIS device&apos;s data to the cloud. Pull merges the cloud
            copy into THIS device — additive only, nothing is ever deleted. Nothing
            syncs automatically — you control every sync.
          </Text>
          {snapshotAt ? (
            <TouchableOpacity onPress={confirmRestoreSnapshot} style={{ marginTop: 10 }} testID="undo-pull-button">
              <Text style={styles.undoLink}>
                Undo last Pull (restore local backup from {formatSyncedAt(snapshotAt)})
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Cash Flow Card */}
        <TouchableOpacity
          style={styles.cashFlowCard}
          onPress={() => router.push('/report')}
          activeOpacity={0.7}
          testID="cashflow-card"
        >
          <View style={styles.cashFlowHeader}>
            <Ionicons name="cash-outline" size={20} color="#6b21a8" />
            <Text style={styles.cashFlowTitle}>Today's Cash Flow</Text>
            {cashFlowLoading ? (
              <ActivityIndicator size="small" color="#6b21a8" style={{ marginLeft: 'auto' }} />
            ) : (
              <View style={styles.cashFlowBadge}>
                <Text style={styles.cashFlowBadgeText}>Tap to view</Text>
              </View>
            )}
          </View>
          <View style={styles.cashFlowRow}>
            <Text style={styles.cashFlowLabel}>Revenue</Text>
            <Text style={styles.cashFlowValue}>
              ${cashFlow ? cashFlow.revenue.toFixed(2) : '--'}
            </Text>
          </View>
          <View style={styles.cashFlowRow}>
            <Text style={[styles.cashFlowLabel, { color: '#dc2626' }]}>− Outsource</Text>
            <Text style={[styles.cashFlowValue, { color: '#dc2626' }]}>
              ${cashFlow ? cashFlow.outsource.toFixed(2) : '--'}
            </Text>
          </View>
          <View style={styles.cashFlowGrandRow}>
            <Text style={styles.cashFlowGrandLabel}>Net Cash</Text>
            <Text style={styles.cashFlowGrandValue}>
              ${cashFlow ? cashFlow.net.toFixed(2) : '--'}
            </Text>
          </View>
        </TouchableOpacity>

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
  undoLink: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  cashFlowCard: {
    backgroundColor: '#faf5ff',
    borderWidth: 1.5,
    borderColor: '#c4b5fd',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  cashFlowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cashFlowTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6b21a8',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cashFlowBadge: {
    backgroundColor: '#6b21a8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  cashFlowBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  cashFlowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  cashFlowLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  cashFlowValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  cashFlowGrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: '#c4b5fd',
  },
  cashFlowGrandLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#6b21a8',
  },
  cashFlowGrandValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#059669',
  },
});
