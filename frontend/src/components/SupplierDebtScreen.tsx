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
import { getSupplierBalances, updateSupplierBalance, getDailyCashSummary, paySupplierDebt } from '../db/database';

export default function SupplierDebtScreen() {
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; balance: number }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ totalDebt: number; todayRevenue: number; drawer: number }>({
    totalDebt: 0,
    todayRevenue: 0,
    drawer: 0,
  });
  const router = useRouter();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [balanceList, cashSummary] = await Promise.all([
        getSupplierBalances(),
        getDailyCashSummary(today),
      ]);
      setSuppliers(balanceList);
      setSummary({
        totalDebt: cashSummary.totalOutstandingDebt,
        todayRevenue: cashSummary.revenue,
        drawer: cashSummary.netDrawer,
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

  const handleEditPress = (id: string, currentBalance: number) => {
    setEditingId(id);
    setEditValue(String(currentBalance));
  };

  const handleSavePress = async () => {
    if (!editingId) return;
    const newBalance = parseFloat(editValue);
    if (isNaN(newBalance) || newBalance < 0) {
      Alert.alert('Error', 'Please enter a valid number.');
      return;
    }

    setSaving(true);
    try {
      await updateSupplierBalance(editingId, newBalance);
      setEditingId(null);
      setEditValue('');
      loadData(); // Reload to update math
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update balance.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
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

      <ScrollView style={styles.content}>
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
                <Text style={styles.supplierBalanceLabel}>Current Debt</Text>
              </View>

              {editingId === s.id ? (
                <View style={styles.editRow}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editValue}
                    onChangeText={setEditValue}
                    keyboardType="decimal-pad"
                    autoFocus
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
                  <Text style={[styles.balanceText, { color: s.balance > 0 ? '#dc2626' : '#059669' }]}>
                    ${s.balance.toFixed(2)}
                  </Text>
                  <TouchableOpacity onPress={() => handleEditPress(s.id, s.balance)} style={styles.editBtn}>
                    <Ionicons name="pencil" size={18} color="#2563eb" />
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
  content: { flex: 1, padding: 16 },
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
  supplierBalanceLabel: { fontSize: 12, color: '#94a3b8' },
  displayRow: { flexDirection: 'row', alignItems: 'center' },
  balanceText: { fontSize: 18, fontWeight: '700', marginRight: 12 },
  editRow: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  editInput: {
    borderWidth: 1, borderColor: '#2563eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    fontSize: 16, minWidth: 80, marginHorizontal: 8, backgroundColor: '#eff6ff',
  },
  currencySymbol: { fontSize: 16, fontWeight: '600', color: '#475569' },
  saveBtn: { backgroundColor: '#059669', borderRadius: 8, padding: 8, marginRight: 6 },
  cancelBtn: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 8 },
  editBtn: { backgroundColor: '#eff6ff', borderRadius: 8, padding: 8 },
  refreshBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#0f172a', borderRadius: 12, paddingVertical: 14, marginTop: 20,
  },
  refreshText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
});
