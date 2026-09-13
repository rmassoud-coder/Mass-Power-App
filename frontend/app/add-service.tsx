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
import { Picker } from '@react-native-picker/picker';
import { createQuickWalkinService, createWalkinProductSale, SERVICE_CATEGORIES } from './db/database';
import { triggerAutoPush } from './utils/autoSync';
import InventoryPicker, { PickedItem } from './components/InventoryPicker';

// 🔥 NEW: Arabic labels for the dropdown. Keys must match SERVICE_CATEGORIES
// exactly (the English values stored in the database and used for reports).
// Only the displayed label is Arabic — the stored value stays English so it
// still matches add-service.tsx's categories for correct report grouping.
const SERVICE_CATEGORY_LABELS_AR: Record<string, string> = {
  'HVAC Services': 'خدمات التكييف',
  'Locksmith Services': 'خدمات الأقفال',
  'Oil Services': 'خدمات الزيت',
  'Battery Replacement': 'استبدال البطارية',
  'Electrical Services': 'خدمات كهربائية',
  'Mechanical Services': 'خدمات ميكانيكية',
  'Other Services': 'خدمات أخرى',
};

export default function QuickWalkinScreen() {
  const [customerName, setCustomerName] = useState(''); // 🔥 NEW: Optional name field
  const [serviceCategory, setServiceCategory] = useState<string>(SERVICE_CATEGORIES[0]); // 🔥 NEW: Mandatory dropdown
  const [additionalInfo, setAdditionalInfo] = useState(''); // 🔥 NEW: Optional free-text notes
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
    // 🔥 NEW: Category is mandatory
    if (!serviceCategory) {
      Alert.alert('خطأ', 'يرجى اختيار نوع الخدمة');
      return;
    }

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

    // ✅ ALLOW $0 (Free service) - Removed the validation block!
    const totalCost = parseFloat(cost) || 0;

    let partialPaidNumber = 0;
    if (isPartial) {
      partialPaidNumber = parseFloat(partialAmount) || 0;
      if (partialPaidNumber < 0) {
        Alert.alert('خطأ', 'المبلغ الجزئي لا يمكن أن يكون سالباً.');
        return;
      }
      // ✅ CHANGE: Now allows $0 partial payment for $0 service
      if (partialPaidNumber > totalCost) {
        Alert.alert('خطأ', 'يجب أن يكون المبلغ الجزئي أقل من التكلفة الإجمالية. استخدم "مدفوع" بدلاً من ذلك.');
        return;
      }
    }

    setLoading(true);
    try {
      // 🔥 Pass the customer name, mandatory category (stored in English),
      // and optional notes as separate fields — matches createService's
      // service_description / additional_info column split.
      await createQuickWalkinService(
        customerName.trim() || undefined,
        serviceCategory,
        additionalInfo.trim() || undefined,
        totalCost + productsSubtotal,
        totalCost > 0 ? (isPaid || isPartial) : false, // ✅ $0 = UNPAID, >0 = paid/partial
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

          {/* 🔥 NEW: Service Category (Mandatory Dropdown, Arabized labels) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>نوع الخدمة *</Text>
            <View style={styles.pickerContainer}>
              <Ionicons name="clipboard-outline" size={20} color="#666" style={styles.pickerIcon} />
              <Picker
                selectedValue={serviceCategory}
                onValueChange={(value) => setServiceCategory(value)}
                style={styles.picker}
                testID="quick-walkin-category-picker"
              >
                {SERVICE_CATEGORIES.map((cat) => (
                  <Picker.Item
                    key={cat}
                    label={SERVICE_CATEGORY_LABELS_AR[cat] || cat}
                    value={cat}
                  />
                ))}
              </Picker>
            </View>
          </View>

          {/* 🔥 NEW: Additional Notes (Optional free text) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>ملاحظات إضافية (اختياري)</Text>
            <View style={[styles.inputContainer, styles.textAreaContainer]}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="مثال: تغيير زيت، بيع منتج..."
                value={additionalInfo}
                onChangeText={setAdditionalInfo}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
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
  textAreaContainer: { height: 90, alignItems: 'flex-start', paddingVertical: 12 },
  textArea: { height: '100%' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1e293b' },
  currencySymbol: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginRight: 8 },
  autoCalcText: { fontSize: 12, color: '#059669', marginTop: 6, fontStyle: 'italic' },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingLeft: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pickerIcon: { marginRight: 12 },
  picker: { flex: 1, height: 56 },
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
