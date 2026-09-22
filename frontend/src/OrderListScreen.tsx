import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  listStock,
  addStockItem,
  updateStockQuantity,
  updateStockItem,
  deleteStockItem,
} from '../src/db/database';
import { triggerAutoPush } from '../src/utils/autoSync';

interface StockItem {
  id: string;
  name: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export default function LocksmithStockScreen() {
  const router = useRouter();
  const [items, setItems] = useState<StockItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Edit modal state
  const [editVisible, setEditVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await listStock();
      const normalized = (data as StockItem[]).map((it) => ({
        ...it,
        quantity: Number(it.quantity) || 0,
      }));
      setItems(normalized);
    } catch (e) {
      console.warn('Failed to load stock:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = async () => {
    const text = inputText.trim();
    if (!text) {
      Alert.alert('Error', 'Please enter an item name.');
      return;
    }
    try {
      await addStockItem(text, 1);
      await loadItems();
      setInputText('');
      triggerAutoPush();
    } catch (e) {
      Alert.alert('Error', 'Failed to add item.');
    }
  };

  const increaseQty = async (id: string, currentQty: number) => {
    try {
      await updateStockQuantity(id, currentQty + 1);
      await loadItems();
      triggerAutoPush();
    } catch (e) {
      Alert.alert('Error', 'Failed to update quantity.');
    }
  };

  const decreaseQty = async (id: string, currentQty: number) => {
    try {
      await updateStockQuantity(id, Math.max(0, currentQty - 1));
      await loadItems();
      triggerAutoPush();
    } catch (e) {
      Alert.alert('Error', 'Failed to update quantity.');
    }
  };

  const openEdit = (item: StockItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQty(String(Number(item.quantity) || 0));
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const cleanName = editName.trim();
    if (!cleanName) {
      Alert.alert('Error', 'Item name cannot be empty.');
      return;
    }
    const qtyNum = parseInt(editQty, 10);
    if (!Number.isFinite(qtyNum) || qtyNum < 0) {
      Alert.alert('Error', 'Quantity must be 0 or greater.');
      return;
    }
    try {
      await updateStockItem(editingId, cleanName, qtyNum);
      await loadItems();
      setEditVisible(false);
      setEditingId(null);
      setEditName('');
      setEditQty('');
      triggerAutoPush();
    } catch (e) {
      Alert.alert('Error', 'Failed to update item.');
    }
  };

  const cancelEdit = () => {
    setEditVisible(false);
    setEditingId(null);
    setEditName('');
    setEditQty('');
  };

  const removeItem = (id: string) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to remove this item from stock?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteStockItem(id);
              await loadItems();
              triggerAutoPush();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete item.');
            }
          },
        },
      ]
    );
  };

  const sortedItems = [...items].sort((a, b) => {
    const aQty = Number(a.quantity) || 0;
    const bQty = Number(b.quantity) || 0;
    if (aQty !== bQty) return aQty - bQty;
    return a.name.localeCompare(b.name);
  });

  const filteredItems = sortedItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const outOfStockCount = items.filter((i) => Number(i.quantity) === 0).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Locksmith Stock</Text>
        <View style={{ width: 40 }} />
      </View>

      {outOfStockCount > 0 && (
        <View style={styles.alertBanner}>
          <Ionicons name="alert-circle" size={18} color="#fff" />
          <Text style={styles.alertBannerText}>
            {outOfStockCount} item{outOfStockCount > 1 ? 's' : ''} need restocking
          </Text>
        </View>
      )}

      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن قطعة..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {isLoading ? (
            <Text style={styles.loadingText}>Loading stock...</Text>
          ) : items.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>
                No stock items yet. Add your first item to get started.
              </Text>
            </View>
          ) : filteredItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>لا توجد نتائج لـ "{searchQuery}"</Text>
            </View>
          ) : (
            filteredItems.map((item) => {
              const qty = Number(item.quantity) || 0;
              const isOutOfStock = qty === 0;
              const isLow = qty === 1;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.stockItem,
                    isOutOfStock && styles.stockItemOut,
                    isLow && styles.stockItemLow,
                  ]}
                >
                  {/* ROW 1: icon + name + status */}
                  <View style={styles.rowTop}>
                    <View style={styles.iconContainer}>
                      <Ionicons
                        name={isOutOfStock ? 'alert-circle' : 'cube-outline'}
                        size={22}
                        color={isOutOfStock ? '#ef4444' : isLow ? '#d97706' : '#10b981'}
                      />
                    </View>
                    <View style={styles.textBlock}>
                      <Text
                        style={[
                          styles.stockText,
                          isOutOfStock && styles.stockTextOut,
                          isLow && styles.stockTextLow,
                        ]}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[
                          styles.qtyText,
                          isOutOfStock && styles.qtyTextOut,
                          isLow && styles.qtyTextLow,
                        ]}
                      >
                        {isOutOfStock
                          ? 'Out of stock — needs restocking'
                          : isLow
                          ? 'Low stock: 1'
                          : `In stock: ${qty}`}
                      </Text>
                    </View>
                  </View>

                  {/* ROW 2: quantity controls + edit + trash */}
                  <View style={styles.rowBottom}>
                    <View style={styles.qtyControls}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => decreaseQty(item.id, qty)}
                      >
                        <Ionicons name="remove" size={18} color="#0f172a" />
                      </TouchableOpacity>
                      <Text style={styles.qtyNumber}>{qty}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => increaseQty(item.id, qty)}
                      >
                        <Ionicons name="add" size={18} color="#0f172a" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.actionsGroup}>
                      <TouchableOpacity
                        onPress={() => openEdit(item)}
                        style={styles.iconBtn}
                      >
                        <Ionicons name="pencil-outline" size={18} color="#2563eb" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => removeItem(item.id)}
                        style={styles.iconBtn}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter stock item name..."
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={setInputText}
            returnKeyType="done"
            onSubmitEditing={addItem}
          />
          <TouchableOpacity style={styles.addBtn} onPress={addItem}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Edit modal */}
      <Modal
        visible={editVisible}
        animationType="fade"
        transparent
        onRequestClose={cancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Stock Item</Text>

            <Text style={styles.modalLabel}>Item name</Text>
            <View style={styles.modalInputContainer}>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Item name"
                placeholderTextColor="#94a3b8"
                autoFocus
              />
            </View>

            <Text style={styles.modalLabel}>Quantity</Text>
            <View style={styles.modalInputContainer}>
              <TextInput
                style={styles.modalInput}
                value={editQty}
                onChangeText={setEditQty}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={cancelEdit}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={saveEdit}
              >
                <Text style={styles.modalSaveText}>Save</Text>
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
  keyboardView: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  alertBannerText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#f8fafc',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
    paddingVertical: 0,
  },

  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 100 },
  loadingText: { textAlign: 'center', color: '#94a3b8', marginTop: 20 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 30,
  },

  // ✅ Stacked card layout
  stockItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stockItemOut: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    borderWidth: 1.5,
  },
  stockItemLow: {
    backgroundColor: '#fffbeb',
    borderColor: '#eab308',
    borderWidth: 1.5,
  },

  // Row 1: icon + name + status
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  textBlock: {
    flex: 1,
  },
  stockText: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600',
    flexWrap: 'wrap',
  },
  stockTextOut: { color: '#b91c1c', fontWeight: '700' },
  stockTextLow: { color: '#92400e', fontWeight: '700' },
  qtyText: { fontSize: 12, color: '#64748b', marginTop: 4 },
  qtyTextOut: { color: '#dc2626', fontWeight: '600' },
  qtyTextLow: { color: '#d97706', fontWeight: '600' },

  // Row 2: quantity controls + edit + delete
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qtyBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    minWidth: 28,
    textAlign: 'center',
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 12,
  },
  addBtn: {
    backgroundColor: '#2563eb',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  modalInputContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 16,
    justifyContent: 'center',
  },
  modalInput: {
    fontSize: 16,
    color: '#1e293b',
  },
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
  modalCancelText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
