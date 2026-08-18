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
import { getSupplierBalances, updateSupplierBalance, getWeeklyCashSummary } from '../db/database';

export default function SupplierDebtScreen() {
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; balance: number }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payTodayValue, setPayTodayValue] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ 
    totalDebt: number; 
    todayRevenue: number; 
    paidToday: number;
    drawer: number 
  }>({
    totalDebt: 0,
    todayRevenue: 0,
    paidToday: 0,
    drawer: 0,
  });
  const router = useRouter();

  const loadData = useCallback(async () => {
  setLoading(true);
  try {
    // 1. Get Today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // 2. Get Today's Income using the SAME getReport logic as the purple screen
    const todayReport = await getReport(
      `${todayStr}T00:00:00`,
      `${todayStr}T23:59:59`
    );
    const todayRevenue = todayReport.total_cost;

    // 3. Get Supplier Balances (List)
    const balanceList = await getSupplierBalances();

    // 4. Get Debts & Paid logic (Keep your working paid logic)
    // We still use getWeeklyCashSummary to keep the paid debts correct
    const cashSummary = await getWeeklyCashSummary();

    setSuppliers(balanceList);
    
    // 5. Update the summary using Today's Income from getReport
    // But keep PaidToday and Debt from getWeeklyCashSummary
    setSummary({
      totalDebt: cashSummary.totalOutstandingDebt,
      todayRevenue: todayRevenue,          // <-- NOW USING CORRECT getReport VALUE
      paidToday: cashSummary.paidTowardsDebtToday,
      drawer: todayRevenue - cashSummary.paidTowardsDebtToday - cashSummary.wages, 
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

  // ✅ FIXED: Correctly sets the supplier ID instead of null
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
      setTimeout(() => loadData(), 300); // Small delay to let DB settle
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
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Cash Drawer Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Today's Revenue</Text>
            <Text style={styles.summaryValue}>${summary.todayRevenue.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: '#dc2626' }]}>Total Outstanding Debt</Text>
            <Text style={[styles.summaryValue, { color: '#dc2626' }]}>- ${summary.totalDebt.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: '#eab308' }]}>Paid Towards Debt Today</Text>
            <Text style={[styles.summaryValue, { color: '#eab308' }]}>- ${summary.paidToday.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.drawerLabel}>Net Cash Drawer</Text>
            <Text style={[styles.drawerValue, { color: summary.drawer >= 0 ? '#059669' : '#dc2626' }]}>
              ${summary.drawer.toFixed(2)}
            </Text>
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
  summaryCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: '#475569' },
  summaryValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 12 },
  drawerLabel: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  drawerValue: { fontSize: 20, fontWeight: '900' },
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
