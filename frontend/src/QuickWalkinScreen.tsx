import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createQuickWalkinService, createWalkinProductSale } from './db/database';
import { triggerAutoPush } from './utils/autoSync';
import InventoryPicker, { PickedItem } from './InventoryPicker';

export default function QuickWalkinScreen() {
  const [serviceDesc, setServiceDesc] = useState('');
  const [cost, setCost] = useState('');
  const [isPaid, setIsPaid] = useState(true);
  const [isPartial, setIsPartial] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [outsourceCost, setOutsourceCost] = useState('');
  const [pickedItems, setPickedItems] = useState<PickedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const productsSubtotal = pickedItems.reduce(
    (sum, it) => sum + it.quantity * it.unit_price,
    0
  );

  const handleSubmit = async () => {
    // If products were picked, we use the special Product Sale logic
    if (pickedItems.length > 0) {
      setLoading(true);
      try {
        // Process the first picked item as a sale
        // (If they picked multiple, they'd just add them one by one via the picker)
        const item = pickedItems[0];
        await createWalkinProductSale(item.inventory_id, item.quantity);
        
        triggerAutoPush();
        Alert.alert('Success', 'Product sold and deducted from inventory!');
        router.back();
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to sell product.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Otherwise, fallback to regular Walk-in Service
    const totalCost = parseFloat(cost) || 0;
    if (totalCost <= 0) {
      Alert.alert('Error', 'Please enter a valid price or pick a product.');
      return;
    }

    let partialPaidNumber = 0;
    if (isPartial) {
      partialPaidNumber = parseFloat(partialAmount) || 0;
      if (partialPaidNumber <= 0) {
        Alert.alert('Error', 'Please enter a valid partial payment amount.');
        return;
      }
      if (partialPaidNumber >= totalCost) {
        Alert.alert('Error', 'Partial payment must be less than total cost. Use "Paid" instead.');
        return;
      }
    }

    setLoading(true);
    try {
      await createQuickWalkinService(
        serviceDesc.trim() || 'Quick Walk-in Service',
        totalCost + productsSubtotal, // Combines labor + parts
        isPaid || isPartial,
        partialPaidNumber,
        parseFloat(outsourceCost) || 0
      );
      
      triggerAutoPush();
      Alert.alert('Success', 'Walk-in service added to Cash Drawer!');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add walk-in service.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quick Walk-in</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* Service Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Service Description (Optional)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="e.g. Oil Change, Product Sale..."
                value={serviceDesc}
                onChangeText={setServiceDesc}
              />
            </View>
          </View>

          {/* 🔥 NEW: Inventory Products Used */}
          <View style={styles.productsCard}>
            <InventoryPicker value={pickedItems} onChange={setPickedItems} />
          </View>

          {/* Total Price */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Total Price (Labor + Parts)</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                value={cost}
                onChangeText={setCost}
                keyboardType="decimal-pad"
              />
            </View>
            {productsSubtotal > 0 && (
              <Text style={styles.autoCalcText}>
                + ${productsSubtotal.toFixed(2)} in parts (auto-calculated)
              </Text>
            )}
          </View>

          {/* Payment Status */}
          <View style={styles.paymentRow}>
            <TouchableOpacity style={[styles.payBtn, isPaid && styles.payBtnActive]} onPress={() => { setIsPaid(true); setIsPartial(false); setPartialAmount(''); }}>
              <Ionicons name="checkmark-circle" size={20} color={isPaid ? '#fff' : '#64748b'} />
              <Text style={[styles.payBtnText, isPaid && styles.payBtnTextActive]}>Paid</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.payBtn, isPartial && styles.payBtnActivePartial]} onPress={() => { setIsPartial(!isPartial); setIsPaid(false); }}>
              <Ionicons name="time" size={20} color={isPartial ? '#fff' : '#64748b'} />
              <Text style={[styles.payBtnText, isPartial && styles.payBtnTextActive]}>Partial</Text>
            </TouchableOpacity>
          </View>

          {/* Partial Amount Input */}
          {isPartial && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Amount Received</Text>
              <View style={[styles.inputContainer, { borderColor: '#eab308' }]}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  value={partialAmount}
                  onChangeText={setPartialAmount}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          )}

          {/* Outsource Cost */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Outsource Cost (Private)</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                value={outsourceCost}
                onChangeText={(t) => setOutsourceCost(t.replace(/[^\d.]/g, ''))}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <TouchableOpacity style={[styles.submitButton, loading && styles.disabled]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="cash-outline" size={24} color="#fff" />
                <Text style={styles.submitText}>
                  {pickedItems.length > 0 ? 'Sell Product' : 'Add to Cash Drawer'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  content: { flex: 1, padding: 24 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 16, height: 56, borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  input: { flex: 1, fontSize: 16, color: '#1e293b' },
  currencySymbol: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginRight: 8 },
  autoCalcText: { fontSize: 12, color: '#059669', marginTop: 6, fontStyle: 'italic' },
  paymentRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  payBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', gap: 8,
  },
  payBtnActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  payBtnActivePartial: { backgroundColor: '#eab308', borderColor: '#eab308' },
  payBtnText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  payBtnTextActive: { color: '#fff' },
  submitButton: {
    backgroundColor: '#0f172a', borderRadius: 12, height: 56,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8
  },
  disabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 18, fontWeight: '600', marginLeft: 8 },
  productsCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});
