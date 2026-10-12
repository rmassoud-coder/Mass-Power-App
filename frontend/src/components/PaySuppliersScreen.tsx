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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getWeeklyCashSummary,
  getMonthlyCashSummary,
  getAllTimeCashSummary,
  getReport,
  saveWeeklyWages,
  getLocalDateStr,
  getWeekStartMonday,
  getMonthStart,
} from '../../src/db/database';

// ✅ Round to whole number (no decimals)
const R = (n: number): number => Math.round(Number(n) || 0);

export default function SupplierDebtScreen() {
  const [loading, setLoading] = useState(true);
  const [wagesInput, setWagesInput] = useState('');
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

      const [cashSummary, monthlyCashSummary, allTimeSummary] = await Promise.all([
        getWeeklyCashSummary(),
        getMonthlyCashSummary(),
        getAllTimeCashSummary(),
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
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load cash flow data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload every time this screen is opened, so supplier payments made
  // from the new Pay Suppliers screen show up here immediately.
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
        {/* Summary Card */}
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
                      R(summary.monthCashOut) >=
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
                  R(summary.monthCashOut)
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

          <View style={styles.cashDivider} />

          {/* NET CASH DRAWER (START-TO-DATE) */}
          <View style={styles.cashRow}>
            <Text
              style={[styles.cashLabel, { fontWeight: '800', color: '#0f172a' }]}
              numberOfLines={1}
            >
              Net Cash Drawer (Start-to-Date)
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
                      R(summary.allTimeCashOut) >=
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
                  R(summary.allTimeCashOut)
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

        <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.refreshText}>Refresh Math</Text>
        </TouchableOpacity>
      </ScrollView>
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
    marginBottom: 20,
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
  refreshBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#0f172a', borderRadius: 12, paddingVertical: 14, marginTop: 20,
  },
  refreshText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
});
