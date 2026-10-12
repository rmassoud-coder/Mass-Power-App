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
  getSupplierBalances,
  recordSupplierPayment,
  getSupplierPaidMTDMap,
} from '../../src/db/database';

// Round to whole number (no decimals)
const R = (n: number): number => Math.round(Number(n) || 0);

export default function PaySuppliersScreen() {
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; balance: number }[]>([]);
  const [paidMTDMap, setPaidMTDMap] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payTodayValue, setPayTodayValue] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      const [balanceList, mtdPaidMap] = await Promise.all([
        getSupplierBalances(),
        getSupplierPaidMTDMap(),
      ]);
      setSuppliers(balanceList);
      setPaidMTDMap(mtdPaidMap);
    } catch (error) {
      Alert.alert('Error', 'Failed to load supplier data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleEditPress = (id: string) => {
    setEditingId(id);
    setPayTodayValue('');
  };

  const handleSavePress = async () => {
    if (!editingId) return;
    const amountPaid = parseFloat(payTodayValue);
    if (isNaN(amountPaid) || amountPaid <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    setSaving(true);
    try {
      await recordSupplierPayment(editingId, amountPaid);
      setEditingId(null);
      setPayTodayValue('');
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save payment.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setPayTodayValue('');
  };

  // ✅ Total paid this month (sum of all suppliers' MTD)
  const totalPaidMTD = Object.values(paidMTDMap).reduce((sum, v) => sum + (v || 0), 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Loading suppliers...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pay Suppliers</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* ✅ TOTAL BANNER */}
        <View style={styles.totalBanner}>
          <View style={styles.totalIconWrap}>
            <Ionicons name="wallet-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.totalLabel}>Total Paid This Month</Text>
            <Text style={styles.totalValue}>${R(totalPaidMTD)}</Text>
          </View>
        </View>

        {suppliers.length === 0 ? (
          <Text style={styles.emptyText}>No suppliers found. Add one in Backend Management.</Text>
        ) : (
          suppliers.map((s) => {
            const paidMTD = paidMTDMap[s.id] || 0;
            return (
              <View key={s.id} style={styles.supplierItem}>
                <View style={styles.supplierInfo}>
                  <Text style={styles.supplierName} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.supplierBalanceLabel}>
                    Paid this month: ${R(paidMTD)}
                  </Text>
                </View>

                {editingId === s.id ? (
                  <View style={styles.editRow}>
                    <Text style={styles.currencySymbol}>$</Text>
                    <TextInput
                      style={styles.editInput}
                      value={payTodayValue}
                      onChangeText={setPayTodayValue}
                      keyboardType="decimal-pad"
                      autoFocus
                      placeholder="0"
                    />
                    <TouchableOpacity
                      onPress={handleSavePress}
                      disabled={saving}
                      style={styles.saveBtn}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={cancelEdit} style={styles.cancelBtn}>
                      <Ionicons name="close" size={18} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleEditPress(s.id)}
                    style={styles.payBtn}
                  >
                    <Ionicons name="cash-outline" size={16} color="#fff" />
                    <Text style={styles.payBtnText}>Pay</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  content: { flex: 1 },
  contentContainer: { padding: 12, paddingBottom: 32 },

  // ✅ Total banner
  totalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    gap: 12,
  },
  totalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  totalValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },

  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    marginTop: 20,
    fontStyle: 'italic',
  },

  // ✅ Compact supplier row
  supplierItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  supplierInfo: { flex: 1, marginRight: 8 },
  supplierName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  supplierBalanceLabel: { fontSize: 12, color: '#059669', fontWeight: '600', marginTop: 1 },

  // ✅ Compact Pay button
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  payBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ✅ Compact edit row
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    minWidth: 64,
    backgroundColor: '#eff6ff',
    textAlign: 'center',
  },
  currencySymbol: { fontSize: 14, fontWeight: '600', color: '#475569' },
  saveBtn: {
    backgroundColor: '#059669',
    borderRadius: 8,
    padding: 6,
  },
  cancelBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 6,
  },
});
