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

  // Reload every time the screen is opened
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
        {suppliers.length === 0 ? (
          <Text style={styles.emptyText}>No suppliers found. Add one in Backend Management.</Text>
        ) : (
          suppliers.map((s) => {
            const paidMTD = paidMTDMap[s.id] || 0;
            return (
              <View key={s.id} style={styles.supplierItem}>
                <View style={styles.supplierInfo}>
                  <Text style={styles.supplierName}>{s.name}</Text>
                  <Text style={styles.supplierBalanceLabel}>
                    Paid this month: ${R(paidMTD)}
                  </Text>
                </View>

                {editingId === s.id ? (
                  <View style={styles.editRow}>
                    <Text style={styles.payLabel}>Amount:</Text>
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
                      <Text style={styles.payBtnText}>Pay Supplier</Text>
                    </TouchableOpacity>
                  </View>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 20, fontStyle: 'italic' },
  supplierItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  supplierInfo: { flex: 1 },
  supplierName: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 2 },
  supplierBalanceLabel: { fontSize: 13, color: '#059669', fontWeight: '600' },
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
});
