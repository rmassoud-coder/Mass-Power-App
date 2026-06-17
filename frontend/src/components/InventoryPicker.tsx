import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  InventoryItem,
  listInventory,
} from '../db/database';

export interface PickedItem {
  inventory_id: string;
  item_type: string; // snapshot for display
  unit_price: number; // snapshot for display
  quantity: number;
  stock_remaining: number; // current stock minus already-pre-picked (for context)
  pre_existing_qty?: number; // when editing, quantity already in service before this session
}

export interface InventoryPickerProps {
  value: PickedItem[];
  onChange: (items: PickedItem[]) => void;
  /** Items pre-loaded on edit (so stock check accounts for restoration) */
  preExistingByInventoryId?: Record<string, number>;
}

export default function InventoryPicker({
  value,
  onChange,
  preExistingByInventoryId,
}: InventoryPickerProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const refresh = async () => {
    const inv = await listInventory();
    setInventory(inv);
  };

  useEffect(() => {
    refresh();
  }, []);

  const productsSubtotal = useMemo(
    () => value.reduce((sum, it) => sum + it.quantity * it.unit_price, 0),
    [value]
  );

  const onPick = (inv: InventoryItem) => {
    // If already in list, increment qty
    const existing = value.find((v) => v.inventory_id === inv.id);
    if (existing) {
      // Cap at stock + any pre-existing qty (since the pre-existing portion will be 'restored' on save)
      const cap = inv.item_quantity + (preExistingByInventoryId?.[inv.id] || 0);
      const next = Math.min(existing.quantity + 1, cap);
      onChange(
        value.map((v) =>
          v.inventory_id === inv.id ? { ...v, quantity: next } : v
        )
      );
    } else {
      onChange([
        ...value,
        {
          inventory_id: inv.id,
          item_type: inv.item_type,
          unit_price: inv.item_price,
          quantity: 1,
          stock_remaining: inv.item_quantity,
          pre_existing_qty: preExistingByInventoryId?.[inv.id] || 0,
        },
      ]);
    }
  };

  const onRemove = (inventory_id: string) => {
    onChange(value.filter((v) => v.inventory_id !== inventory_id));
  };

  const setQty = (inventory_id: string, qtyStr: string) => {
    const inv = inventory.find((i) => i.id === inventory_id);
    let q = parseInt(qtyStr || '0', 10);
    if (isNaN(q) || q < 0) q = 0;
    if (inv) {
      const cap = inv.item_quantity + (preExistingByInventoryId?.[inv.id] || 0);
      if (q > cap) q = cap;
    }
    onChange(
      value.map((v) =>
        v.inventory_id === inventory_id ? { ...v, quantity: q } : v
      )
    );
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(
      (i) =>
        i.item_type.toLowerCase().includes(q) ||
        i.item_number.toLowerCase().includes(q)
    );
  }, [search, inventory]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <MaterialCommunityIgnore />
        <MaterialCommunityIcons name="package-variant-closed" size={20} color="#0f172a" />
        <Text style={styles.title}>Products Used</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={async () => {
            await refresh();
            setModalOpen(true);
          }}
          testID="add-product-button"
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>Pick Products</Text>
        </TouchableOpacity>
      </View>

      {value.length === 0 ? (
        <Text style={styles.empty}>No products picked. Tap "Pick Products" to add from inventory.</Text>
      ) : (
        <View style={{ marginTop: 6 }}>
          {value.map((it) => (
            <View key={it.inventory_id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {it.item_type}
                </Text>
                <Text style={styles.rowSub}>
                  ${it.unit_price.toFixed(2)} each
                </Text>
              </View>
              <View style={styles.qtyWrap}>
                <TouchableOpacity
                  onPress={() => setQty(it.inventory_id, String(Math.max(0, it.quantity - 1)))}
                  style={styles.qtyBtn}
                >
                  <Ionicons name="remove" size={16} color="#1e293b" />
                </TouchableOpacity>
                <TextInput
                  style={styles.qtyInput}
                  value={String(it.quantity)}
                  onChangeText={(t) => setQty(it.inventory_id, t)}
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  onPress={() => setQty(it.inventory_id, String(it.quantity + 1))}
                  style={styles.qtyBtn}
                >
                  <Ionicons name="add" size={16} color="#1e293b" />
                </TouchableOpacity>
              </View>
              <Text style={styles.lineTotal}>
                ${(it.quantity * it.unit_price).toFixed(2)}
              </Text>
              <TouchableOpacity onPress={() => onRemove(it.inventory_id)} style={styles.deleteBtn}>
                <Ionicons name="close" size={16} color="#dc2626" />
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>Products subtotal</Text>
            <Text style={styles.subtotalValue}>${productsSubtotal.toFixed(2)}</Text>
          </View>
        </View>
      )}

      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pick from Inventory</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#1e293b" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color="#64748b" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or item number"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
              />
            </View>

            <ScrollView style={{ flex: 1 }}>
              {filtered.length === 0 ? (
                <Text style={styles.modalEmpty}>
                  {inventory.length === 0
                    ? 'No inventory yet. Add items from Settings → Inventory.'
                    : 'No matches.'}
                </Text>
              ) : (
                filtered.map((inv) => {
                  const lowStock = inv.item_quantity < 2;
                  const inListQty =
                    value.find((v) => v.inventory_id === inv.id)?.quantity || 0;
                  const cap =
                    inv.item_quantity + (preExistingByInventoryId?.[inv.id] || 0);
                  const disabled = inListQty >= cap;
                  return (
                    <TouchableOpacity
                      key={inv.id}
                      style={[styles.invRow, lowStock && styles.invRowLow]}
                      onPress={() => !disabled && onPick(inv)}
                      disabled={disabled}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.invTitle, lowStock && { color: '#b91c1c' }]}
                          numberOfLines={1}
                        >
                          {inv.item_type}
                        </Text>
                        <Text style={[styles.invSub, lowStock && { color: '#b91c1c' }]}>
                          {inv.item_number} • Stock:{' '}
                          <Text style={lowStock ? styles.lowStockText : undefined}>
                            {inv.item_quantity}
                          </Text>
                          {' '}• ${inv.item_price.toFixed(2)}
                        </Text>
                      </View>
                      {inListQty > 0 ? (
                        <View style={styles.inCartBadge}>
                          <Text style={styles.inCartText}>×{inListQty}</Text>
                        </View>
                      ) : (
                        <Ionicons
                          name="add-circle"
                          size={26}
                          color={disabled ? '#cbd5e1' : '#10b981'}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => setModalOpen(false)}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Tiny placeholder so headerRow has no missing icon if user removes it
function MaterialCommunityIgnore() {
  return null;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginLeft: 6 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { fontSize: 12, color: '#94a3b8', marginTop: 10, fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  rowTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  rowSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  qtyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginHorizontal: 8,
  },
  qtyBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  qtyInput: {
    width: 36,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
  },
  lineTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f766e',
    minWidth: 60,
    textAlign: 'right',
  },
  deleteBtn: { padding: 6, marginLeft: 4 },
  subtotalRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subtotalLabel: { fontSize: 12, fontWeight: '600', color: '#475569' },
  subtotalValue: { fontSize: 14, fontWeight: '800', color: '#0f766e' },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 18,
    maxHeight: '85%',
    minHeight: '50%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center' },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0f172a' },
  closeBtn: { padding: 4 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginVertical: 10,
  },
  searchInput: { flex: 1, paddingVertical: 8, marginLeft: 6, fontSize: 13 },
  modalEmpty: { textAlign: 'center', color: '#94a3b8', padding: 28, fontSize: 13 },
  invRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderRadius: 6,
  },
  invRowLow: { backgroundColor: '#fef2f2' },
  invTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  invSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  lowStockText: { color: '#b91c1c', fontWeight: '900' },
  inCartBadge: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  inCartText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  doneBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  doneBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
