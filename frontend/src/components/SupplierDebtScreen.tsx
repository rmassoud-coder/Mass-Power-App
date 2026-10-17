import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// ✅ NOTE: These imports will fail if database.ts hasn't been updated yet
import {
  getWeeklyCashSummary,
  getMonthlyCashSummary,
  getAllTimeCashSummary,
  getReport,
  saveWeeklyWages,
  getLocalDateStr,
  getWeekStartMonday,
  getMonthStart,
  savePersonalWithdrawal,
  getPersonalWithdrawalForMonth,
  getAllTimePersonalWithdrawals,
} from '../../src/db/database';

// ✅ Round to whole number (no decimals)
const R = (n: number): number => Math.round(Number(n) || 0);

export default function SupplierDebtScreen() {
  const [loading, setLoading] = useState(true);
  const [wagesInput, setWagesInput] = useState('');

  // ✅ Reconcile Modal State
  const [reconcileVisible, setReconcileVisible] = useState(false);
  const [drawerInput, setDrawerInput] = useState('');
  
  const [summary, setSummary] = useState<{
    todayRevenue: number;
    todayOutsource: number;
    wtdIncome: number;
    wtdOutsource: number;
    mtdIncome: number;
    mtdOutsource: number;
    totalDebt: number;
    paidToday: number;
    paidWeek: number;
    paidMonth: number;
    wages: number;
    todayCashOut: number;
    weekCashOut: number;
    monthCashOut: number;
    allTimeRevenue: number;
    allTimeOutsource: number;
    allTimePaidDebts: number;
    allTimeCashOut: number;
    // ✅ NEW
    personalMonth: number;
    personalAllTime: number;
  }>({
    todayRevenue: 0,
    todayOutsource: 0,
    wtdIncome: 0,
    wtdOutsource: 0,
    mtdIncome: 0,
    mtdOutsource: 0,
    totalDebt: 0,
    paidToday: 0,
    paidWeek: 0,
    paidMonth: 0,
    wages: 0,
    todayCashOut: 0,
    weekCashOut: 0,
    monthCashOut: 0,
    allTimeRevenue: 0,
    allTimeOutsource: 0,
    allTimePaidDebts: 0,
    allTimeCashOut: 0,
    personalMonth: 0,
    personalAllTime: 0,
  });
  const router = useRouter();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();

      const todayStr = getLocalDateStr(today);
      const mondayStr = getLocalDateStr(getWeekStartMonday(today));
      const monthStartStr = getLocalDateStr(getMonthStart(today));

      const todayReport = await getReport(
        `${todayStr}T00:00:00`,
        `${todayStr}T23:59:59`
      );

      const wtdReport = await getReport(
        `${mondayStr}T00:00:00`,
        `${todayStr}T23:59:59`
      );

      const mtdReport = await getReport(
        `${monthStartStr}T00:00:00`,
        `${todayStr}T23:59:59`
      );

      // ✅ Fetch personal withdrawals alongside the other summaries
      const [
        cashSummary,
        monthlyCashSummary,
        allTimeSummary,
        personalMonthRecord,
        personalAllTimeTotal
      ] = await Promise.all([
        getWeeklyCashSummary(),
        getMonthlyCashSummary(),
        getAllTimeCashSummary(),
        getPersonalWithdrawalForMonth(monthStartStr, todayStr),
        getAllTimePersonalWithdrawals(),
      ]);

      setSummary({
        todayRevenue: todayReport.total_cost,
        todayOutsource: todayReport.outsource_total,
        wtdIncome: wtdReport.total_cost,
        wtdOutsource: wtdReport.outsource_total,
        mtdIncome: mtdReport.total_cost,
        mtdOutsource: mtdReport.outsource_total,
        totalDebt: cashSummary.totalOutstandingDebt,
        paidToday: cashSummary.paidTowardsDebtToday,
        paidWeek: cashSummary.paidTowardsDebtWeek,
        paidMonth: monthlyCashSummary.paidTowardsDebtMonth,
        wages: cashSummary.weekWages,
        todayCashOut: cashSummary.todayWages,
        weekCashOut: cashSummary.weekWages,
        monthCashOut: monthlyCashSummary.monthWages,
        allTimeRevenue: allTimeSummary.revenue,
        allTimeOutsource: allTimeSummary.totalOutsource,
        allTimePaidDebts: allTimeSummary.paidDebts,
        allTimeCashOut: allTimeSummary.wages,
        personalMonth: personalMonthRecord ? personalMonthRecord.withdrawal_amount : 0,
        personalAllTime: personalAllTimeTotal,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load cash flow data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSaveWages = async () => {
    const amount = parseFloat(wagesInput);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Error', 'Please enter a valid Cash Out amount.');
      return;
    }
    try {
      await saveWeeklyWages(amount);
      setWagesInput('');
      Alert.alert('Success', 'Cash Out saved!');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save Cash Out.');
    }
  };

  // ✅ Reconcile Modal Logic
  const currentMonthLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  
  // Expected cash this month = mtdIncome - mtdOutsource - paidMonth - monthCashOut
  const expectedDrawer = 
    R(summary.mtdIncome) - 
    R(summary.mtdOutsource) - 
    R(summary.paidMonth) - 
    R(summary.monthCashOut);

  const actualDrawerParsed = parseFloat(drawerInput);
  const isDrawerValid = !isNaN(actualDrawerParsed) && actualDrawerParsed >= 0;
  const diff = isDrawerValid ? expectedDrawer - R(actualDrawerParsed) : 0;

  const handleReconcileSubmit = async () => {
    if (!isDrawerValid) {
      Alert.alert('Error', 'Please enter a valid drawer amount.');
      return;
    }
    
    const monthKey = getLocalDateStr().substring(0, 7); // "YYYY-MM"
    
    try {
      await savePersonalWithdrawal(monthKey, expectedDrawer, R(actualDrawerParsed));
      setReconcileVisible(false);
      setDrawerInput('');
      Alert.alert('Success', 'Drawer reconciled successfully!');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save reconciliation.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Loading finances...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cash Flow Report</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.cashCard}>
          <View style={styles.cashHeaderRow}>
            <Ionicons name="cash-outline" size={22} color="#5b21b6" />
            <Text style={styles.cashHeader}>GENERAL CASH FLOW</Text>
            <TouchableOpacity style={styles.viewBtn} onPress={() => router.push('/report')}>
              <Text style={styles.viewBtnText}>Details</Text>
            </TouchableOpacity>
          </View>

          {/* Today's Section */}
          <View style={styles.cashRow}>
            <Text style={styles.cashLabel} numberOfLines={1}>Today's Income</Text>
            <Text style={styles.cashValue}>${R(summary.todayRevenue)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#dc2626' }]} numberOfLines={1}>− Outsource</Text>
            <Text style={[styles.cashValue, { color: '#dc2626' }]}>- ${R(summary.todayOutsource)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#eab308' }]} numberOfLines={1}>− Paid to Suppliers Today</Text>
            <Text style={[styles.cashValue, { color: '#eab308' }]}>- ${R(summary.paidToday)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#eab308' }]} numberOfLines={1}>− Cash Out Today</Text>
            <Text style={[styles.cashValue, { color: '#eab308' }]}>- ${R(summary.todayCashOut)}</Text>
          </View>

          <View style={styles.cashDivider} />

          {/* NET CASH DRAWER (TODAY) */}
          <View style={styles.cashRow}>
            <Text
              style={[styles.cashLabel, { fontWeight: '800', color: '#0f172a' }]}
              numberOfLines={1}
            >
              Net Cash Drawer (Today)
            </Text>
            <Text
              style={[
                styles.cashValue,
                {
                  fontWeight: '900',
                  color:
                    R(summary.todayRevenue) -
                      R(summary.todayOutsource) -
                      R(summary.paidToday) -
                      R(summary.todayCashOut) >=
                    0
                      ? '#059669'
                      : '#dc2626',
                },
              ]}
            >
              $
              {R(
                R(summary.todayRevenue) -
                  R(summary.todayOutsource) -
                  R(summary.paidToday) -
                  R(summary.todayCashOut)
              )}
            </Text>
          </View>

          <View style={styles.cashDivider} />

          {/* Week-to-Date Section */}
          <View style={styles.cashRow}>
            <Text style={styles.cashLabel} numberOfLines={1}>Week-to-Date Income</Text>
            <Text style={styles.cashValue}>${R(summary.wtdIncome)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#dc2626' }]} numberOfLines={1}>− Outsource (WTD)</Text>
            <Text style={[styles.cashValue, { color: '#dc2626' }]}>- ${R(summary.wtdOutsource)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#eab308' }]} numberOfLines={1}>− Paid to Suppliers This Week</Text>
            <Text style={[styles.cashValue, { color: '#eab308' }]}>- ${R(summary.paidWeek)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#eab308' }]} numberOfLines={1}>− Cash Out (Week)</Text>
            <Text style={[styles.cashValue, { color: '#eab308' }]}>- ${R(summary.weekCashOut)}</Text>
          </View>

          <View style={styles.cashDivider} />

          {/* NET CASH DRAWER (WEEK) */}
          <View style={styles.cashRow}>
            <Text
              style={[styles.cashLabel, { fontWeight: '800', color: '#0f172a' }]}
              numberOfLines={1}
            >
              Net Cash Drawer (Week)
            </Text>
            <Text
              style={[
                styles.cashValue,
                {
                  fontWeight: '900',
                  color:
                    R(summary.wtdIncome) -
                      R(summary.wtdOutsource) -
                      R(summary.paidWeek) -
                      R(summary.weekCashOut) >=
                    0
                      ? '#059669'
                      : '#dc2626',
                },
              ]}
            >
              $
              {R(
                R(summary.wtdIncome) -
                  R(summary.wtdOutsource) -
                  R(summary.paidWeek) -
                  R(summary.weekCashOut)
              )}
            </Text>
          </View>

          <View style={styles.cashDivider} />

          {/* Month-to-Date Section */}
          <View style={styles.cashRow}>
            <Text style={styles.cashLabel} numberOfLines={1}>Month-to-Date Income</Text>
            <Text style={styles.cashValue}>${R(summary.mtdIncome)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#dc2626' }]} numberOfLines={1}>− Outsource (MTD)</Text>
            <Text style={[styles.cashValue, { color: '#dc2626' }]}>- ${R(summary.mtdOutsource)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#eab308' }]} numberOfLines={1}>− Paid to Suppliers This Month</Text>
            <Text style={[styles.cashValue, { color: '#eab308' }]}>- ${R(summary.paidMonth)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#eab308' }]} numberOfLines={1}>− Cash Out (Month)</Text>
            <Text style={[styles.cashValue, { color: '#eab308' }]}>- ${R(summary.monthCashOut)}</Text>
          </View>

          {/* ✅ NEW: Personal Withdrawal Line (Month) */}
          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#8b5cf6' }]} numberOfLines={1}>− Personal (Month)</Text>
            <Text style={[styles.cashValue, { color: '#8b5cf6' }]}>- ${R(summary.personalMonth)}</Text>
          </View>

          <View style={styles.cashDivider} />

          {/* NET CASH DRAWER (MONTH) */}
          <View style={styles.cashRow}>
            <Text
              style={[styles.cashLabel, { fontWeight: '800', color: '#0f172a' }]}
              numberOfLines={1}
            >
              Net Cash Drawer (Month)
            </Text>
            <Text
              style={[
                styles.cashValue,
                {
                  fontWeight: '900',
                  color:
                    R(summary.mtdIncome) -
                      R(summary.mtdOutsource) -
                      R(summary.paidMonth) -
                      R(summary.monthCashOut) -
                      R(summary.personalMonth) >=
                    0
                      ? '#059669'
                      : '#dc2626',
                },
              ]}
            >
              $
              {R(
                R(summary.mtdIncome) -
                  R(summary.mtdOutsource) -
                  R(summary.paidMonth) -
                  R(summary.monthCashOut) -
                  R(summary.personalMonth)
              )}
            </Text>
          </View>

          <View style={styles.cashDivider} />

          {/* Start-to-Date Section */}
          <View style={styles.cashRow}>
            <Text style={styles.cashLabel} numberOfLines={1}>Start-to-Date Income</Text>
            <Text style={styles.cashValue}>${R(summary.allTimeRevenue)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#dc2626' }]} numberOfLines={1}>− Outsource</Text>
            <Text style={[styles.cashValue, { color: '#dc2626' }]}>- ${R(summary.allTimeOutsource)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#eab308' }]} numberOfLines={1}>− Paid to Suppliers</Text>
            <Text style={[styles.cashValue, { color: '#eab308' }]}>- ${R(summary.allTimePaidDebts)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#eab308' }]} numberOfLines={1}>− Cash Out</Text>
            <Text style={[styles.cashValue, { color: '#eab308' }]}>- ${R(summary.allTimeCashOut)}</Text>
          </View>

          {/* ✅ NEW: Personal Withdrawal Line (Start-to-Date) */}
          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#8b5cf6' }]} numberOfLines={1}>− Personal</Text>
            <Text style={[styles.cashValue, { color: '#8b5cf6' }]}>- ${R(summary.personalAllTime)}</Text>
          </View>

          <View style={styles.cashDivider} />

          {/* NET CASH DRAWER (START2DATE) */}
          <View style={styles.cashRow}>
            <Text
              style={[styles.cashLabel, { fontWeight: '800', color: '#0f172a' }]}
              numberOfLines={1}
            >
              Net Cash Drawer (Start2Date)
            </Text>
            <Text
              style={[
                styles.cashValue,
                {
                  fontWeight: '900',
                  color:
                    R(summary.allTimeRevenue) -
                      R(summary.allTimeOutsource) -
                      R(summary.allTimePaidDebts) -
                      R(summary.allTimeCashOut) -
                      R(summary.personalAllTime) >=
                    0
                      ? '#059669'
                      : '#dc2626',
                },
              ]}
            >
              $
              {R(
                R(summary.allTimeRevenue) -
                  R(summary.allTimeOutsource) -
                  R(summary.allTimePaidDebts) -
                  R(summary.allTimeCashOut) -
                  R(summary.personalAllTime)
              )}
            </Text>
          </View>
        </View>

        {/* Cash Out Input Box */}
        <View style={styles.wagesBox}>
          <Text style={styles.wagesTitle}>Cash Out (Wages+Exp)</Text>
          <View style={styles.wagesInputRow}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.wagesInput}
              placeholder="0.00"
              value={wagesInput}
              onChangeText={setWagesInput}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={styles.saveWagesBtn} onPress={handleSaveWages}>
              <Text style={styles.saveWagesBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ✅ Reconcile Drawer Button */}
        <TouchableOpacity 
          style={styles.reconcileBtn} 
          onPress={() => setReconcileVisible(true)}
        >
          <Ionicons name="calculator-outline" size={20} color="#fff" />
          <Text style={styles.reconcileBtnText}>Reconcile Drawer</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.refreshText}>Refresh Math</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ✅ Reconcile Drawer Modal */}
      <Modal
        visible={reconcileVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setReconcileVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reconcile Drawer</Text>
              <TouchableOpacity onPress={() => setReconcileVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalPeriodLabel}>Period: {currentMonthLabel}</Text>
              
              <View style={styles.modalRow}>
                <Text style={styles.modalRowLabel}>Expected Cash</Text>
                <Text style={styles.modalRowValue}>${expectedDrawer}</Text>
              </View>
              
              <View style={styles.modalDivider} />
              
              <Text style={styles.modalInputLabel}>Actual Drawer Count</Text>
              <View style={styles.modalInputContainer}>
                <Text style={styles.modalCurrency}>$</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0.00"
                  value={drawerInput}
                  onChangeText={setDrawerInput}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
              
              <View style={styles.modalDiffRow}>
                <Text style={styles.modalDiffLabel}>Personal Withdrawal:</Text>
                <Text style={[styles.modalDiffValue, { color: diff >= 0 ? '#059669' : '#dc2626' }]}>
                  ${diff}
                </Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setReconcileVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSaveBtn} 
                onPress={handleReconcileSubmit}
              >
                <Text style={styles.modalSaveText}>Save Reconciliation</Text>
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },
  cashCard: {
    backgroundColor: '#f3e8ff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#d8b4fe',
  },
  cashHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cashHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#5b21b6',
    marginLeft: 8,
    flex: 1,
  },
  viewBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  viewBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cashRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 8,
  },
  cashLabel: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500',
    flex: 1,
    flexShrink: 1,
  },
  cashValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    flexShrink: 0,
    textAlign: 'right',
  },
  cashDivider: {
    height: 1,
    backgroundColor: '#c4b5fd',
    marginVertical: 8,
  },
  wagesBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  wagesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  wagesInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wagesInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1e293b',
  },
  saveWagesBtn: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveWagesBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  currencySymbol: { fontSize: 15, fontWeight: '600', color: '#475569' },
  
  // ✅ Reconcile Button
  reconcileBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
    gap: 8,
  },
  reconcileBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  refreshBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#0f172a', borderRadius: 12, paddingVertical: 14,
  },
  refreshText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },

  // ✅ Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  modalBody: { marginBottom: 20 },
  modalPeriodLabel: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalRowLabel: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  modalRowValue: { fontSize: 18, fontWeight: '800', color: '#2563eb' },
  modalDivider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 12 },
  modalInputLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  modalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 16,
  },
  modalCurrency: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginRight: 8 },
  modalInput: { flex: 1, fontSize: 18, fontWeight: '600', color: '#1e293b' },
  modalDiffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
  },
  modalDiffLabel: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  modalDiffValue: { fontSize: 18, fontWeight: '900' },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  modalCancelText: { color: '#64748b', fontSize: 15, fontWeight: '600' },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
  },
  modalSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
