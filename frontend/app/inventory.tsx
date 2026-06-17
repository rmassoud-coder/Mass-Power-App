import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  InventoryItem,
  listInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from '../src/db/database';

export default function InventoryScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [formType, setFormType] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listInventory();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setFormType('');
    setFormQty('');
    setFormPrice('');
    setModalOpen(true);
  };

  const openEdit = (it: InventoryItem) => {
    setEditing(it);
    setFormType(it.item_type);
    setFormQty(String(it.item_quantity));
    setFormPrice(String(it.item_price));
    setModalOpen(true);
  };

  const handleSave = async () => {
    const qty = parseInt(formQty || '0', 10);
    const price = parseFloat(formPrice || '0');
    if (!formType.trim()) {
      Alert.alert('Error', 'Item Type is required');
      return;
    }
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Error', 'Quantity must be 0 or greater');
      return;
    }
    if (isNaN(price) || price < 0) {
      Alert.alert('Error', 'Price must be 0 or greater');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateInventoryItem(editing.id, formType, qty, price);
      } else {
        await addInventoryItem(formType, qty, price);
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (it: InventoryItem) => {
    const doDelete = async () => {
      try {
        await deleteInventoryItem(it.id);
        await load();
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to delete');
      }
    };
    if (Platform.OS === 'web') {
      // window.confirm avoids the Alert button-tap web bug
      // eslint-disable-next-line no-alert
      if (window.confirm(`Delete ${it.item_type} (${it.item_number})?`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete item?',
        `${it.item_type} (${it.item_number})`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventory</Text>
        <TouchableOpacity onPress={openAdd} style={styles.headerAdd} testID="add-inventory-button">
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2563eb" />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="package-variant" size={56} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No inventory yet</Text>
          <Text style={styles.emptyDesc}>
            Add products you keep in stock. Each will get an auto-generated INV-XXX code.
          </Text>
          <TouchableOpacity style={styles.emptyAdd} onPress={openAdd}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.emptyAddText}>Add Your First Item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 80 }}>
          {items.map((it) => {
            const low = it.item_quantity < 2;
            return (
              <View
                key={it.id}
                style={[styles.row, low && styles.rowLow]}
                testID={`inventory-row-${it.item_number}`}
              >
                <View style={styles.rowMain}>
                  <View style={styles.rowTitleLine}>
                    <Text
                      style={[styles.rowType, low && { color: '#991b1b' }]}
                      numberOfLines={1}
                    >
                      {it.item_type}
                    </Text>
                    {low && (
                      <View style={styles.lowChip}>
                        <Ionicons name="warning" size={11} color="#fff" />
                        <Text style={styles.lowChipText}>LOW</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.rowMeta}>
                    {it.item_number} • ${it.item_price.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.qtyBlock}>
                  <Text style={[styles.qtyValue, low && styles.qtyValueLow]}>
                    {it.item_quantity}
                  </Text>
                  <Text style={styles.qtyLabel}>in stock</Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => openEdit(it)} style={styles.iconBtn}>
                    <Ionicons name="pencil" size={16} color="#2563eb" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(it)} style={styles.iconBtn}>
                    <Ionicons name="trash" size={16} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editing ? `Edit ${editing.item_number}` : 'Add Inventory Item'}
              </Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={22} color="#1e293b" />
              </TouchableOpacity>
            </View>

            {editing && (
              <View style={styles.itemNumberBadge}>
                <Text style={styles.itemNumberBadgeText}>Item No: {editing.item_number}</Text>
              </View>
            )}

            <Text style={styles.label}>Item Type *</Text>
            <TextInput
              style={styles.input}
              value={formType}
              onChangeText={setFormType}
              placeholder="e.g. Oil Filter, Brake Pad, 5W-30 Oil"
              autoCapitalize="words"
              testID="inventory-type-input"
            />

            <Text style={styles.label}>Quantity *</Text>
            <TextInput
              style={styles.input}
              value={formQty}
              onChangeText={setFormQty}
              placeholder="0"
              keyboardType="number-pad"
              testID="inventory-qty-input"
            />

            <Text style={styles.label}>Price (per unit) *</Text>
            <TextInput
              style={styles.input}
              value={formPrice}
              onChangeText={setFormPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
              testID="inventory-price-input"
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              testID="inventory-save-button"
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Add Item'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#0f172a', marginLeft: 6 },
  headerAdd: {
    backgroundColor: '#2563eb',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b', marginTop: 12 },
  emptyDesc: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 6 },
  emptyAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 18,
    gap: 6,
  },
  emptyAddText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  list: { flex: 1, paddingHorizontal: 12, paddingTop: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowLow: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  rowMain: { flex: 1 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowType: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  rowMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  lowChip: {
    flexDirection: 'row',
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    gap: 3,
  },
  lowChipText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  qtyBlock: { alignItems: 'center', marginHorizontal: 12 },
  qtyValue: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  qtyValueLow: { color: '#dc2626' },
  qtyLabel: { fontSize: 10, color: '#64748b' },
  actions: { flexDirection: 'row' },
  iconBtn: {
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginLeft: 4,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  itemNumberBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  itemNumberBadgeText: { color: '#075985', fontSize: 11, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 10,
    backgroundColor: '#f8fafc',
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: '#10b981',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
