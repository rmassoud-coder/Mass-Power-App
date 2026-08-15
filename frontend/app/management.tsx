import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getWeeklyCashSummary } from '../src/db/database';

export default function ManagementScreen() {
  const router = useRouter();

  const [revenue, setRevenue] = useState(0);
  const [netCash, setNetCash] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFinances = async () => {
      try {
        setLoading(true);
        const summary = await getWeeklyCashSummary();
        setRevenue(summary.revenue);
        setNetCash(summary.netDrawer);
        setTotalDebt(summary.totalOutstandingDebt);
      } catch (e) {
        console.warn("Failed to load finances:", e);
      } finally {
        setLoading(false);
      }
    };
    loadFinances();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Backend Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {/* Cloud Sync Section */}
        <View style={styles.syncCard}>
          <Text style={styles.syncTitle}>Cloud Sync</Text>
          <View style={styles.syncButtonsRow}>
            <TouchableOpacity style={styles.pushBtn}>
              <Ionicons name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.syncBtnText}>Push</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pullBtn}>
              <Ionicons name="cloud-download" size={20} color="#fff" />
              <Text style={styles.syncBtnText}>Pull</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.syncHint}>Push uploads data. Pull merges cloud copy.</Text>
        </View>

        {/* Weekly Cash Flow */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5b21b6" />
            <Text style={styles.loadingText}>Calculating weekly cash...</Text>
          </View>
        ) : (
          <View style={styles.cashCard}>
            <View style={styles.cashHeaderRow}>
              <Ionicons name="cash-outline" size={22} color="#5b21b6" />
              <Text style={styles.cashHeader}>WEEKLY CASH FLOW</Text>
              <TouchableOpacity style={styles.viewBtn} onPress={() => router.push('/report')}>
                <Text style={styles.viewBtnText}>Details</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cashRow}>
              <Text style={styles.cashLabel}>Revenue</Text>
              <Text style={styles.cashValue}>${revenue.toFixed(2)}</Text>
            </View>
            <View style={styles.cashRow}>
              <Text style={[styles.cashLabel, { color: '#dc2626' }]}>− Outstanding Debt</Text>
              <Text style={[styles.cashValue, { color: '#dc2626' }]}>- ${totalDebt.toFixed(2)}</Text>
            </View>
            <View style={styles.cashDivider} />
            <View style={styles.cashRow}>
              <Text style={[styles.cashLabel, { fontWeight: '800', color: '#5b21b6' }]}>
                Net Cash Drawer
              </Text>
              <Text style={[styles.cashValue, { fontWeight: '900', color: netCash >= 0 ? '#059669' : '#dc2626' }]}>
                ${netCash.toFixed(2)}
              </Text>
            </View>
            <Text style={styles.cashSubtext}>
              *Outstanding debt is deducted from your weekly revenue.
            </Text>
          </View>
        )}

        {/* ===== FULL BUTTON GRID (6 BUTTONS) ===== */}
        <View style={styles.dashboardGrid}>
          <TouchableOpacity style={[styles.dashCard, styles.reportCard]} onPress={() => router.push('/report')}>
            <Ionicons name="document-text-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Report</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.dashCard, styles.settingsCard]} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Settings</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dashboardGrid}>
          <TouchableOpacity style={[styles.dashCard, styles.warrantyCard]} onPress={() => router.push('/warranty-stickers')}>
            <Ionicons name="shield-checkmark-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Warranty Stickers</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.dashCard, styles.catPrinterCard]} onPress={() => router.push('/cat-printer')}>
            <Ionicons name="print-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Cat Printer</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dashboardGrid}>
          <TouchableOpacity style={[styles.dashCard, styles.inventoryCard]} onPress={() => router.push('/inventory')}>
            <Ionicons name="cube-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Inventory</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.dashCard, styles.stickerCard]} onPress={() => router.push('/price-stickers')}>
            <Ionicons name="pricetag-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Price Stickers</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },

  syncCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  syncTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  syncButtonsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  pushBtn: {
    flex: 1, backgroundColor: '#22c55e', paddingVertical: 12, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  pullBtn: {
    flex: 1, backgroundColor: '#3b82f6', paddingVertical: 12, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  syncBtnText: { color: '#fff', fontWeight: '700', marginLeft: 6 },
  syncHint: { color: '#94a3b8', fontSize: 12, marginTop: 6 },

  loadingContainer: { alignItems: 'center', padding: 20 },
  loadingText: { color: '#64748b', marginTop: 8 },

  cashCard: {
    backgroundColor: '#f3e8ff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d8b4fe',
  },
  cashHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cashHeader: {
    fontSize: 16, fontWeight: '800', color: '#5b21b6', marginLeft: 8, flex: 1,
  },
  viewBtn: {
    backgroundColor: '#7c3aed', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
  },
  viewBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cashRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4,
  },
  cashLabel: { fontSize: 15, color: '#1e293b', fontWeight: '500' },
  cashValue: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  cashDivider: { height: 1, backgroundColor: '#c4b5fd', marginVertical: 8 },
  cashSubtext: { fontSize: 11, color: '#6b21a8', fontStyle: 'italic', marginTop: 8 },

  dashboardGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  dashCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  dashTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 8, textAlign: 'center' },

  // 🔥 ALL 6 BUTTON COLORS RESTORED
  reportCard: { backgroundColor: '#10b981' },
  settingsCard: { backgroundColor: '#2563eb' },
  warrantyCard: { backgroundColor: '#d97706' },
  catPrinterCard: { backgroundColor: '#0ea5e9' },
  inventoryCard: { backgroundColor: '#0f766e' },
  stickerCard: { backgroundColor: '#9333ea' },
});
