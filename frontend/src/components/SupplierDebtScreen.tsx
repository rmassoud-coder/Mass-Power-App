import React, { useState, useEffect, useCallback } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getSupplierBalances,
  updateSupplierBalance,
  getWeeklyCashSummary,
  getReport,
  saveWeeklyWages,
} from '../../src/db/database';

export default function SupplierDebtScreen() {
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; balance: number }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payTodayValue, setPayTodayValue] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wagesInput, setWagesInput] = useState('');
  const [summary, setSummary] = useState<{
    todayRevenue: number;
    todayOutsource: number;
    wtdIncome: number;
    wtdOutsource: number;
    totalDebt: number;
    paidToday: number;
    paidWeek: number;
    wages: number;
    todayCashOut: number;
    weekCashOut: number;
  }>({
    todayRevenue: 0,
    todayOutsource: 0,
    wtdIncome: 0,
    wtdOutsource: 0,
    totalDebt: 0,
    paidToday: 0,
    paidWeek: 0,
    wages: 0,
    todayCashOut: 0,
    weekCashOut: 0,
  });
  const router = useRouter();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const dayOfWeek = today.getDay();
      const diffToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
      const monday = new Date(today);
      monday.setDate(today.getDate() - diffToMonday);
      const mondayStr = monday.toISOString().slice(0, 10);

      const todayReport = await getReport(
        `${todayStr}T00:00:00`,
        `${todayStr}T23:59:59`
      );

      const wtdReport = await getReport(
        `${mondayStr}T00:00:00`,
        `${todayStr}T23:59:59`
      );

      const [balanceList, cashSummary] = await Promise.all([
        getSupplierBalances(),
        getWeeklyCashSummary(),
      ]);

      setSuppliers(balanceList);
      setSummary({
        todayRevenue: todayReport.total_cost,
        todayOutsource: todayReport.outsource_total,
        wtdIncome: wtdReport.total_cost,
        wtdOutsource: wtdReport.outsource_total,
        totalDebt: cashSummary.totalOutstandingDebt,
        paidToday: cashSummary.paidTowardsDebtToday,
        paidWeek: cashSummary.paidTowardsDebtWeek,
        wages: cashSummary.weekWages,
        todayCashOut: cashSummary.todayWages,
        weekCashOut: cashSummary.weekWages,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load supplier data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const handleEditPress = (id: string) => {
    setEditingId(id);
    setPayTodayValue('');
  };

  const handleSavePress = async () => {
    if (!editingId) return;
    const amountPaid = parseFloat(payTodayValue);
    if (isNaN(amountPaid) || amountPaid <= 0) {
      Alert.alert('Error', 'Please enter a valid amount paid today.');
      return;
    }

    const supplier = suppliers.find(s => s.id === editingId);
    if (!supplier) return;

    if (amountPaid > supplier.balance) {
      Alert.alert('Error', 'You cannot pay more than the outstanding balance.');
      return;
    }

    setSaving(true);
    try {
      const newBalance = supplier.balance - amountPaid;
      await updateSupplierBalance(editingId, newBalance);
      setEditingId(null);
      setPayTodayValue('');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update balance.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setPayTodayValue('');
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
        <Text style={styles.headerTitle}>Supplier Debts</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Summary Card */}
        <View style={styles.cashCard}>
          <View style={styles.cashHeaderRow}>
            <Ionicons name="cash-outline" size={22} color="#5b21b6" />
            <Text style={styles.cashHeader}>WEEKLY CASH FLOW</Text>
            <TouchableOpacity style={styles.viewBtn} onPress={() => router.push('/report')}>
              <Text style={styles.viewBtnText}>Details</Text>
            </TouchableOpacity>
          </View>

          {/* Today's Section */}
          <View style={styles.cashRow}>
            <Text style={styles.cashLabel}>Today's Income</Text>
            <Text style={styles.cashValue}>${summary.todayRevenue.toFixed(2)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#dc2626' }]}>− Outsource</Text>
            <Text style={[styles.cashValue, { color: '#dc2626' }]}>- ${summary.todayOutsource.toFixed(2)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#eab308' }]}>− Paid Debts Today</Text>
            <Text style={[styles.cashValue, { color: '#eab308' }]}>- ${summary.paidToday.toFixed(2)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#eab308' }]}>− Cash Out Today</Text>
            <Text style={[styles.cashValue, { color: '#eab308' }]}>- ${summary.todayCashOut.toFixed(2)}</Text>
          </View>

          <View style={styles.cashDivider} />

          {/* ✅ NET CASH DRAWER (TODAY) */}
          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { fontWeight: '800', color: '#0f172a' }]}>
              Net Cash Drawer (Today)
            </Text>
            <Text
              style={[
                styles.cashValue,
                {
                  fontWeight: '900',
                  color:
                    summary.todayRevenue -
                      summary.todayOutsource -
                      summary.paidToday -
                      summary.todayCashOut >=
                    0
                      ? '#059669'
                      : '#dc2626',
                },
              ]}
            >
              $
              {(
                summary.todayRevenue -
                summary.todayOutsource -
                summary.paidToday -
                summary.todayCashOut
              ).toFixed(2)}
            </Text>
          </View>

          <View style={styles.cashDivider} />

          {/* Week-to-Date Section */}
          <View style={styles.cashRow}>
            <Text style={styles.cashLabel}>Week-to-Date Income</Text>
            <Text style={styles.cashValue}>${summary.wtdIncome.toFixed(2)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#dc2626' }]}>− Outsource (WTD)</Text>
            <Text style={[styles.cashValue, { color: '#dc2626' }]}>- ${summary.wtdOutsource.toFixed(2)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#eab308' }]}>− Paid Debts This Week</Text>
            <Text style={[styles.cashValue, { color: '#eab308' }]}>- ${summary.paidWeek.toFixed(2)}</Text>
          </View>

          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { color: '#eab308' }]}>− Cash Out (Week)</Text>
            <Text style={[styles.cashValue, { color: '#eab308' }]}>- ${summary.weekCashOut.toFixed(2)}</Text>
          </View>

          <View style={styles.cashDivider} />

          {/* ✅ NET CASH DRAWER (WEEK) */}
          <View style={styles.cashRow}>
            <Text style={[styles.cashLabel, { fontWeight: '800', color: '#0f172a' }]}>
              Net Cash Drawer (Week)
            </Text>
            <Text
              style={[
                styles.cashValue,
                {
                  fontWeight: '900',
                  color:
                    summary.wtdIncome -
                      summary.wtdOutsource -
                      summary.paidWeek -
                      summary.weekCashOut >=
                    0
                      ? '#059669'
                      : '#dc2626',
                },
              ]}
            >
              $
              {(
                summary.wtdIncome -
                summary.wtdOutsource -
                summary.paidWeek -
                summary.weekCashOut
              ).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Cash Out Input Box */}
        <View style={styles.wagesBox}>
          <Text style={styles.wagesTitle}>Cash Out (Wages+Goods+Exp)</Text>
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

        {/* Supplier List */}
        <Text style={styles.listTitle}>Manage Supplier Balances</Text>
        {suppliers.length === 0 ? (
          <Text style={styles.emptyText}>No suppliers found. Add one in Backend Management.</Text>
        ) : (
          suppliers.map((s) => (
            <View key={s.id} style={styles.supplierItem}>
              <View style={styles.supplierInfo}>
                <Text style={styles.supplierName}>{s.name}</Text>
                <Text style={styles.supplierBalanceLabel}>
                  {s.balance > 0 ? `Current Debt: $${s.balance.toFixed(2)}` : 'Debt Cleared'}
                </Text>
              </View>

              {editingId === s.id ? (
                <View style={styles.editRow}>
                  <Text style={styles.payLabel}>Pay Today:</Text>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.editInput}
                    value={payTodayValue}
                    onChangeText={setPayTodayValue}
                    keyboardType="decimal-pad"
                    autoFocus
                    placeholder="0.00"
                  />
                  <TouchableOpacity onPress={handleSavePress} disabled={saving} style={styles.saveBtn}>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelEdit} style={styles.cancelBtn}>
                    <Ionicons name="close" size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.displayRow}>
                  <TouchableOpacity onPress={() => handleEditPress(s.id)} style={styles.payBtn}>
                    <Text style={styles.payBtnText}>Pay Today</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}

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
    marginBottom: 4,
  },
  cashLabel: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500',
  },
  cashValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
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
  listTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 12 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 20, fontStyle: 'italic' },
  supplierItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  supplierInfo: { flex: 1 },
  supplierName: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 2 },
  supplierBalanceLabel: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  displayRow: { flexDirection: 'row', alignItems: 'center' },
  payBtn: {
    backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  payBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  editRow: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' },
  payLabel: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginRight: 6 },
  editInput: {
    borderWidth: 1, borderColor: '#2563eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    fontSize: 15, minWidth: 60, marginHorizontal: 4, backgroundColor: '#eff6ff',
  },
  currencySymbol: { fontSize: 15, fontWeight: '600', color: '#475569' },
  saveBtn: { backgroundColor: '#059669', borderRadius: 8, padding: 8, marginRight: 4 },
  cancelBtn: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 8 },
  refreshBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#0f172a', borderRadius: 12, paddingVertical: 14, marginTop: 20,
  },
  refreshText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
});
