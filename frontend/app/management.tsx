import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getWeeklyCashSummary, getReport } from '../src/db/database';
import { pushToCloud, pullFromCloud } from '../src/utils/dbSync';

export default function ManagementScreen() {
  const router = useRouter();

  // INCOME STATES (from getReport)
  const [todayIncome, setTodayIncome] = useState(0);
  const [wtdIncome, setWtdIncome] = useState(0);
  const [weeklyNetIncome, setWeeklyNetIncome] = useState(0);

  // DEBT & WAGES STATES (from getWeeklyCashSummary)
  const [totalDebt, setTotalDebt] = useState(0);
  const [paidToday, setPaidToday] = useState(0);
  const [wages, setWages] = useState(0);
  const [netDrawer, setNetDrawer] = useState(0);

  const [loading, setLoading] = useState(true);
  const [wagesInput, setWagesInput] = useState('');

  // SECURITY
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const SECRET_PIN = '3945';

  useEffect(() => {
    const loadFinances = async () => {
      try {
        setLoading(true);
        
        const today = new Date().toISOString().slice(0, 10);
        const dayOfWeek = today.getDay();
        const diffToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
        const monday = new Date();
        monday.setDate(monday.getDate() - diffToMonday);
        const mondayIso = monday.toISOString().slice(0, 10);

        // 1. INCOME (Using getReport - NO DB CHANGES)
        const todayReport = await getReport(`${today}T00:00:00`, `${today}T23:59:59`);
        setTodayIncome(todayReport.total_cost);

        const wtdReport = await getReport(`${mondayIso}T00:00:00`, `${today}T23:59:59`);
        setWtdIncome(wtdReport.total_cost);
        setWeeklyNetIncome(wtdReport.net_cash_flow);

        // 2. DEBTS, PAID TODAY, WAGES (Using getWeeklyCashSummary)
        const summary = await getWeeklyCashSummary();
        setTotalDebt(summary.totalOutstandingDebt);
        setPaidToday(summary.paidTowardsDebtToday);
        setWages(summary.wages);
        setNetDrawer(summary.netDrawer);

      } catch (e) {
        console.warn("Failed to load finances:", e);
      } finally {
        setLoading(false);
      }
    };
    loadFinances();
  }, []);

  const handlePinAuth = () => {
    if (pinInput === SECRET_PIN) {
      setIsAuthenticated(true);
      setPinModalVisible(false);
      setPinInput('');
      Alert.alert('Success', 'Access granted!');
    } else {
      Alert.alert('Error', 'Incorrect PIN. Please try again.');
      setPinInput('');
    }
  };

  const handlePush = async () => {
    try {
      Alert.alert('Syncing', 'Pushing local data to cloud...');
      await pushToCloud();
      Alert.alert('Success', 'Push completed!');
    } catch (e: any) {
      Alert.alert('Error', 'Push failed: ' + e.message);
    }
  };

  const handlePull = async () => {
    try {
      Alert.alert('Syncing', 'Pulling cloud data to device...');
      await pullFromCloud();
      Alert.alert('Success', 'Pull completed!');
    } catch (e: any) {
      Alert.alert('Error', 'Pull failed: ' + e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Backend Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        
        {/* Cloud Sync */}
        <View style={styles.syncCard}>
          <Text style={styles.syncTitle}>Cloud Sync</Text>
          <View style={styles.syncButtonsRow}>
            <TouchableOpacity style={styles.pushBtn} onPress={handlePush}>
              <Ionicons name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.syncBtnText}>Push</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pullBtn} onPress={handlePull}>
              <Ionicons name="cloud-download" size={20} color="#fff" />
              <Text style={styles.syncBtnText}>Pull</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.syncHint}>Push uploads data. Pull merges cloud copy.</Text>
        </View>

        {/* Lock */}
        {!isAuthenticated && (
          <TouchableOpacity style={styles.lockButton} onPress={() => setPinModalVisible(true)}>
            <Ionicons name="lock-closed" size={24} color="#fff" />
            <Text style={styles.lockButtonText}>🔒 Tap to Unlock Backend</Text>
          </TouchableOpacity>
        )}

        {!isAuthenticated ? (
          <View style={styles.lockedCard}>
            <Ionicons name="lock-closed" size={32} color="#94a3b8" />
            <Text style={styles.lockedText}>Backend is locked. Tap the button above to unlock.</Text>
          </View>
        ) : (
          <>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#5b21b6" />
                <Text style={styles.loadingText}>Calculating cash...</Text>
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

                {/* Today's Income */}
                <View style={styles.cashRow}>
                  <Text style={styles.cashLabel}>Today's Income</Text>
                  <Text style={styles.cashValue}>${todayIncome.toFixed(2)}</Text>
                </View>

                {/* Week to Date Income */}
                <View style={styles.cashRow}>
                  <Text style={styles.cashLabel}>Week-to-Date Income</Text>
                  <Text style={styles.cashValue}>${wtdIncome.toFixed(2)}</Text>
                </View>

                {/* Total Supplier Debt */}
                <View style={styles.cashRow}>
                  <Text style={[styles.cashLabel, { color: '#dc2626' }]}>− Supplier Debt Total</Text>
                  <Text style={[styles.cashValue, { color: '#dc2626' }]}>- ${totalDebt.toFixed(2)}</Text>
                </View>

                {/* Paid Towards Debt Today */}
                <View style={styles.cashRow}>
                  <Text style={[styles.cashLabel, { color: '#eab308' }]}>Paid Towards Debt Today</Text>
                  <Text style={[styles.cashValue, { color: '#eab308' }]}>- ${paidToday.toFixed(2)}</Text>
                </View>

                <View style={styles.cashDivider} />

                {/* Net of Today (Income - Debt Paid Today) */}
                <View style={styles.cashRow}>
                  <Text style={[styles.cashLabel, { fontWeight: '800', color: '#0f172a' }]}>
                    Net of Today
                  </Text>
                  <Text style={[styles.cashValue, { fontWeight: '900', color: (todayIncome - paidToday) >= 0 ? '#059669' : '#dc2626' }]}>
                    ${(todayIncome - paidToday).toFixed(2)}
                  </Text>
                </View>

                {/* Weekly Net (WTD Income - Debts - Wages) */}
                <View style={styles.cashRow}>
                  <Text style={[styles.cashLabel, { fontWeight: '800', color: '#5b21b6' }]}>
                    Weekly Net (After Wages)
                  </Text>
                  <Text style={[styles.cashValue, { fontWeight: '900', color: weeklyNetIncome >= 0 ? '#059669' : '#dc2626' }]}>
                    ${weeklyNetIncome.toFixed(2)}
                  </Text>
                </View>

                <Text style={styles.cashSubtext}>
                  *Weekly net = WTD income − total debts − wages.
                </Text>
              </View>
            )}

            {/* Wages Input - Kept intact */}
            <View style={styles.wagesCard}>
              <View style={styles.wagesHeaderRow}>
                <Ionicons name="people-outline" size={20} color="#2563eb" />
                <Text style={styles.wagesHeader}>Weekly Wages Paid</Text>
              </View>
              <View style={styles.wagesRow}>
                <Text style={styles.wagesLabel}>Enter total wages paid this week:</Text>
                <TextInput
                  style={styles.wagesInput}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={wagesInput}
                  onChangeText={async (text) => {
                    setWagesInput(text);
                    try {
                      const db = await import('../src/db/database');
                      await db.saveWeeklyWages(parseFloat(text) || 0);
                      // Reload data to update numbers
                      const summary = await db.getWeeklyCashSummary();
                      setWages(summary.wages);
                      setNetDrawer(summary.netDrawer);
                      const wtdReport = await db.getReport(
                        `${new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 1)).toISOString().slice(0, 10)}T00:00:00`,
                        `${new Date().toISOString().slice(0, 10)}T23:59:59`
                      );
                      setWeeklyNetIncome(wtdReport.net_cash_flow);
                    } catch (e) {
                      console.warn("Failed to save wages:", e);
                    }
                  }}
                />
              </View>
            </View>
          </>
        )}

        {/* 6-Button Grid */}
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

      {/* PIN MODAL */}
      <Modal animationType="slide" transparent visible={pinModalVisible} onRequestClose={() => setPinModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter PIN</Text>
            <Text style={styles.modalSubtitle}>Enter your 4-digit security code</Text>
            <TextInput
              style={styles.pinInput}
              placeholder="****"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              value={pinInput}
              onChangeText={setPinInput}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPinModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handlePinAuth}>
                <Text style={styles.modalConfirmText}>Unlock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },
  syncCard: {
    backgroundColor: '#0f172a', borderRadius: 16, padding: 16, marginBottom: 16,
  },
  syncTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  syncButtonsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  pushBtn: {
    flex: 1, backgroundColor: '#22c55e', paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  pullBtn: {
    flex: 1, backgroundColor: '#3b82f6', paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  syncBtnText: { color: '#fff', fontWeight: '700', marginLeft: 6 },
  syncHint: { color: '#94a3b8', fontSize: 12, marginTop: 6 },
  lockButton: {
    backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  lockButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  lockedCard: {
    backgroundColor: '#f1f5f9', borderRadius: 16, padding: 20, alignItems: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0',
  },
  lockedText: { color: '#64748b', fontSize: 14, marginTop: 8 },
  loadingContainer: { alignItems: 'center', padding: 20 },
  loadingText: { color: '#64748b', marginTop: 8 },
  cashCard: {
    backgroundColor: '#f3e8ff', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#d8b4fe',
  },
  cashHeaderRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
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
  wagesCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  wagesHeaderRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
  },
  wagesHeader: { fontSize: 16, fontWeight: '700', color: '#2563eb', marginLeft: 8 },
  wagesRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  wagesLabel: { fontSize: 14, color: '#475569', flex: 1, marginRight: 12 },
  wagesInput: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, minWidth: 100, fontSize: 16,
    fontWeight: '600', textAlign: 'right', color: '#0f172a',
  },
  dashboardGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  dashCard: {
    flex: 1, borderRadius: 16, padding: 20, alignItems: 'center',
    justifyContent: 'center', height: 100,
  },
  dashTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 8, textAlign: 'center' },
  reportCard: { backgroundColor: '#10b981' },
  settingsCard: { backgroundColor: '#2563eb' },
  warrantyCard: { backgroundColor: '#d97706' },
  catPrinterCard: { backgroundColor: '#0ea5e9' },
  inventoryCard: { backgroundColor: '#0f766e' },
  stickerCard: { backgroundColor: '#9333ea' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    width: '80%', backgroundColor: '#fff', borderRadius: 20, padding: 24,
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  pinInput: {
    width: '100%', borderWidth: 1, borderColor: '#2563eb', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 16, fontSize: 24, fontWeight: '700',
    textAlign: 'center', letterSpacing: 8, color: '#0f172a', marginBottom: 24,
    backgroundColor: '#f8fafc',
  },
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center',
  },
  modalCancelText: { color: '#64748b', fontSize: 16, fontWeight: '600' },
  modalConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
