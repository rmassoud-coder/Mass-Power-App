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
import InventoryPicker, { PickedItem } from './components/InventoryPicker';

export default function QuickWalkinScreen() {
  const [customerName, setCustomerName] = useState(''); // 🔥 NEW: Optional name field
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
        const item = pickedItems[0];
        await createWalkinProductSale(item.inventory_id, item.quantity);
        triggerAutoPush();
        Alert.alert('نجاح', 'تم بيع المنتج وخصمه من المخزون!');
        router.back();
      } catch (error: any) {
        Alert.alert('خطأ', error.message || 'فشل بيع المنتج.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Otherwise, fallback to regular Walk-in Service
    const totalCost = parseFloat(cost) || 0;
    if (totalCost <= 0) {
      Alert.alert('خطأ', 'الرجاء إدخال سعر صحيح أو اختيار منتج.');
      return;
    }

    let partialPaidNumber = 0;
    if (isPartial) {
      partialPaidNumber = parseFloat(partialAmount) || 0;
      if (partialPaidNumber < 0) {
        Alert.alert('خطأ', 'المبلغ الجزئي لا يمكن أن يكون سالباً.');
        return;
      }
      if (partialPaidNumber >= totalCost) {
        Alert.alert('خطأ', 'يجب أن يكون المبلغ الجزئي أقل من التكلفة الإجمالية. استخدم "مدفوع" بدلاً من ذلك.');
        return;
      }
    }

    setLoading(true);
    try {
      // 🔥 Pass the customer name into the database (If blank, database defaults to 'Walk-in')
      await createQuickWalkinService(
        customerName.trim() || undefined, // 🔥 NEW: Passing the name
        serviceDesc.trim() || 'Quick Walk-in Service',
        totalCost + productsSubtotal,
        isPaid || isPartial,          // <-- ✅ KEPT ORIGINAL LOGIC
        partialPaidNumber,
        parseFloat(outsourceCost) || 0
      );
      
      triggerAutoPush();
      Alert.alert('نجاح', 'تمت إضافة خدمة العميل بدون موعد إلى الصندوق!');
      router.back();
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'فشل إضافة خدمة العميل بدون موعد.');
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
          <Text style={styles.headerTitle}>عميل بدون موعد</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* 🔥 NEW: Customer Name (Optional) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>اسم العميل (اختياري)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="اتركه فارغاً لعميل عام"
                value={customerName}
                onChangeText={setCustomerName}
              />
            </View>
          </View>

          {/* Service Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>وصف الخدمة (اختياري)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="مثال: تغيير زيت، بيع منتج..."
                value={serviceDesc}
                onChangeText={setServiceDesc}
              />
            </View>
          </View>

          {/* Inventory Products Used */}
          <View style={styles.productsCard}>
            <InventoryPicker value={pickedItems} onChange={setPickedItems} />
          </View>

          {/* Total Price */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>السعر الإجمالي (عمل + قطع)</Text>
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
                + ${productsSubtotal.toFixed(2)} في القطع (محسوب تلقائياً)
              </Text>
            )}
          </View>

          {/* Payment Status */}
          <View style={styles.paymentRow}>
            <TouchableOpacity style={[styles.payBtn, isPaid && styles.payBtnActive]} onPress={() => { setIsPaid(true); setIsPartial(false); setPartialAmount(''); }}>
              <Ionicons name="checkmark-circle" size={20} color={isPaid ? '#fff' : '#64748b'} />
              <Text style={[styles.payBtnText, isPaid && styles.payBtnTextActive]}>مدفوع</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.payBtn, isPartial && styles.payBtnActivePartial]} onPress={() => { setIsPartial(!isPartial); setIsPaid(false); }}>
              <Ionicons name="time" size={20} color={isPartial ? '#fff' : '#64748b'} />
              <Text style={[styles.payBtnText, isPartial && styles.payBtnTextActive]}>دفعة جزئية</Text>
            </TouchableOpacity>
          </View>

          {/* Partial Amount Input */}
          {isPartial && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>المبلغ المستلم</Text>
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
            <Text style={styles.label}>تكلفة الاستعانة بمصدر خارجي (خاصة)</Text>
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
                  {pickedItems.length > 0 ? 'بيع منتج' : 'إضافة إلى الصندوق'}
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
  inputIcon: { marginRight: 12 },
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
