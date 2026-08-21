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
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OrderItem {
  id: string;
  text: string;
  quantity: number; // ✅ ADDED
  isCompleted: boolean;
  createdAt: string;
}

const STORAGE_KEY = '@purchase_orders';

export default function OrderListScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load orders from AsyncStorage
  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure old items without quantity default to 1
        const withQuantity = parsed.map((item: any) => ({
          ...item,
          quantity: item.quantity || 1,
        }));
        setOrders(withQuantity);
      }
    } catch (e) {
      console.warn('Failed to load orders:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveOrders = async (newOrders: OrderItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newOrders));
      setOrders(newOrders);
    } catch (e) {
      Alert.alert('Error', 'Failed to save order list.');
    }
  };

  const addOrder = () => {
    const text = inputText.trim();
    if (!text) {
      Alert.alert('Error', 'Please enter an item to order.');
      return;
    }
    const newItem: OrderItem = {
      id: Date.now().toString(),
      text,
      quantity: 1, // ✅ DEFAULT TO 1
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };
    saveOrders([...orders, newItem]);
    setInputText('');
  };

  const toggleComplete = (id: string) => {
    const updated = orders.map((item) =>
      item.id === id ? { ...item, isCompleted: !item.isCompleted } : item
    );
    saveOrders(updated);
  };

  const deleteOrder = (id: string) => {
    const updated = orders.filter((item) => item.id !== id);
    saveOrders(updated);
  };

  // ✅ NEW: Increase quantity
  const increaseQty = (id: string) => {
    const updated = orders.map((item) =>
      item.id === id ? { ...item, quantity: item.quantity + 1 } : item
    );
    saveOrders(updated);
  };

  // ✅ NEW: Decrease quantity (min 1)
  const decreaseQty = (id: string) => {
    const updated = orders.map((item) =>
      item.id === id ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item
    );
    saveOrders(updated);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order List</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {isLoading ? (
            <Text style={styles.loadingText}>Loading orders...</Text>
          ) : orders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="clipboard-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No orders yet. Add items you need to purchase.</Text>
            </View>
          ) : (
            orders.map((item) => (
              <View key={item.id} style={styles.orderItem}>
                {/* Checkbox */}
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => toggleComplete(item.id)}
                >
                  <View style={[styles.checkbox, item.isCompleted && styles.checkboxChecked]}>
                    {item.isCompleted && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                </TouchableOpacity>

                {/* Text and Quantity */}
                <View style={styles.itemContent}>
                  <Text style={[styles.orderText, item.isCompleted && styles.orderTextCompleted]}>
                    {item.text}
                  </Text>
                  <Text style={styles.qtyText}>Qty: {item.quantity}</Text>
                </View>

                {/* Quantity Controls */}
                <View style={styles.qtyControls}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => decreaseQty(item.id)}>
                    <Ionicons name="remove" size={18} color="#0f172a" />
                  </TouchableOpacity>
                  <Text style={styles.qtyNumber}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => increaseQty(item.id)}>
                    <Ionicons name="add" size={18} color="#0f172a" />
                  </TouchableOpacity>
                </View>

                {/* Delete */}
                <TouchableOpacity onPress={() => deleteOrder(item.id)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter item to order..."
            value={inputText}
            onChangeText={setInputText}
            returnKeyType="done"
            onSubmitEditing={addOrder}
          />
          <TouchableOpacity style={styles.addBtn} onPress={addOrder}>
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
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 100 },
  loadingText: { textAlign: 'center', color: '#94a3b8', marginTop: 20 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#94a3b8', fontSize: 14, marginTop: 12, textAlign: 'center' },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  checkboxContainer: { padding: 4 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: { backgroundColor: '#10b981', borderColor: '#10b981' },
  itemContent: { flex: 1, marginHorizontal: 12 },
  orderText: { fontSize: 16, color: '#1e293b' },
  orderTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  qtyText: { fontSize: 12, color: '#64748b', marginTop: 4 },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
