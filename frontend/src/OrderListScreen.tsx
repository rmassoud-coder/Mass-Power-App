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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  listStock,
  addStockItem,
  updateStockQuantity,
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await listStock();
      setItems(data as StockItem[]);
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
    const aOut = a.quantity === 0;
    const bOut = b.quantity === 0;
    if (aOut === bOut) return a.name.localeCompare(b.name);
    return aOut ? 1 : -1;
  });

  const outOfStockCount = items.filter((i) => i.quantity === 0).length;

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
          ) : (
            sortedItems.map((item) => {
              const isOutOfStock = item.quantity === 0;
              return (
                <View
                  key={item.id}
                  style={[styles.stockItem, isOutOfStock && styles.stockItemOut]}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name={isOutOfStock ? 'alert-circle' : 'cube-outline'}
                      size={22}
                      color={isOutOfStock ? '#ef4444' : '#10b981'}
                    />
                  </View>

                  <View style={styles.itemContent}>
                    <Text
                      style={[
                        styles.stockText,
                        isOutOfStock && styles.stockTextOut,
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.qtyText,
                        isOutOfStock && styles.qtyTextOut,
                      ]}
                    >
                      {isOutOfStock
                        ? 'Out of stock — needs restocking'
                        : `In stock: ${item.quantity}`}
                    </Text>
                  </View>

                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => decreaseQty(item.id, item.quantity)}
                    >
                      <Ionicons name="remove" size={18} color="#0f172a" />
                    </TouchableOpacity>
                    <Text style={styles.qtyNumber}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => increaseQty(item.id, item.quantity)}
                    >
                      <Ionicons name="add" size={18} color="#0f172a" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={() => removeItem(item.id)}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
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
  stockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stockItemOut: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    borderWidth: 1.5,
  },
  iconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: { flex: 1, marginHorizontal: 8 },
  stockText: { fontSize: 16, color: '#1e293b', fontWeight: '600' },
  stockTextOut: { color: '#b91c1c', fontWeight: '700' },
  qtyText: { fontSize: 12, color: '#64748b', marginTop: 4 },
  qtyTextOut: { color: '#dc2626', fontWeight: '700' },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  qtyBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  qtyNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    minWidth: 24,
    textAlign: 'center',
  },
  deleteBtn: { padding: 4 },
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
});
