import React, { useState, useEffect } from 'react';
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
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import {
  createQuickWalkinService,
  createWalkinProductSale,
  SERVICE_CATEGORIES,
  listStock,
  deductStockItems,
} from './db/database';
import { triggerAutoPush } from './utils/autoSync';
import InventoryPicker, { PickedItem } from './components/InventoryPicker';
import { getCategoryLabelAr } from './utils/categoryLabels';

interface StockItem {
  id: string;
  name: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

interface PickedStockItem {
  id: string;
  name: string;
  quantity: number; // picked quantity
  available: number;
}

const LOCKSHEMITH_CATEGORY = 'Locksmith Services';

export default function QuickWalkinScreen() {
  const [customerName, setCustomerName] = useState('');
  const [serviceCategory, setServiceCategory] = useState<string>('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [cost, setCost] = useState('');
  const [isPaid, setIsPaid] = useState(true);
  const [isPartial, setIsPartial] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [outsourceCost, setOutsourceCost] = useState('');
  const [pickedItems, setPickedItems] = useState<PickedItem[]>([]);

  // ✅ NEW: Locksmith stock state
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [pickedStock, setPickedStock] = useState<PickedStockItem[]>([]);
  const [stockPickerVisible, setStockPickerVisible] = useState(false);

  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isLocksmith = serviceCategory === LOCKSHEMITH_CATEGORY;

  const productsSubtotal = pickedItems.reduce(
    (sum, it) => sum + it.quantity * it.unit_price,
    0
  );

  // ✅ Load stock list when Locksmith is selected
  useEffect(() => {
    if (isLocksmith) {
      loadStock();
    }
  }, [isLocksmith]);

  const loadStock = async () => {
    try {
      const data = await listStock();
      setStockList(data as StockItem[]);
    } catch (e) {
      console.warn('Failed to load stock:', e);
    }
  };

  // ============ STOCK PICKER HELPERS ============

  const addStockItem = (item: StockItem) => {
    const existing = pickedStock.find((p) => p.id === item.id);
    if (existing) {
      if (existing.quantity >= existing.available) {
        Alert.alert('تنبيه', `لا يمكن اختيار أكثر من ${existing.available} من هذا العنصر.`);
        return;
      }
      setPickedStock((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, quantity: p.quantity + 1 } : p))
      );
    } else {
      if (item.quantity <= 0) {
        Alert.alert('تنبيه', 'هذا العنصر غير متوفر في المخزون.');
        return;
      }
      setPickedStock((prev) => [
        ...prev,
        {
          id: item.id,
          name: item.name,
          quantity: 1,
          available: item.quantity,
        },
      ]);
    }
  };

  const increasePickedQty = (id: string) => {
    setPickedStock((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (p.quantity >= p.available) return p;
        return { ...p, quantity: p.quantity + 1 };
      })
    );
  };

  const decreasePickedQty = (id: string) => {
    setPickedStock((prev) =>
      prev
        .map((p) => (p.id === id ? { ...p, quantity: p.quantity - 1 } : p))
        .filter((p) => p.quantity > 0)
    );
  };

  const removePickedStock = (id: string) => {
    setPickedStock((prev) => prev.filter((p) => p.id !== id));
  };

  // ============ SUBMIT ============

  const handleSubmit = async () => {
    if (!serviceCategory) {
      Alert.alert('خطأ', 'يرجى اختيار نوع الخدمة');
      return;
    }

    // ❌ Disable existing product sale logic when Locksmith is selected
    // (Walk-in product sale is for the inventory table, not stock)
    if (!isLocksmith && pickedItems.length > 0) {
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

    const totalCost = parseFloat(cost) || 0;

    let partialPaidNumber = 0;
    if (isPartial) {
      partialPaidNumber = parseFloat(partialAmount) || 0;
      if (partialPaidNumber < 0) {
        Alert.alert('خطأ', 'المبلغ الجزئي لا يمكن أن يكون سالباً.');
        return;
      }
      if (partialPaidNumber > totalCost) {
        Alert.alert(
          'خطأ',
          'يجب أن يكون المبلغ الجزئي أقل من التكلفة الإجمالية. استخدم "مدفوع" بدلاً من ذلك.'
        );
        return;
      }
    }

    setLoading(true);
    try {
      // ✅ Create the walk-in service first
      await createQuickWalkinService(
        customerName.trim() || undefined,
        serviceCategory,
        additionalInfo.trim() || undefined,
        totalCost + productsSubtotal,
        totalCost > 0 ? isPaid || isPartial : false,
        partialPaidNumber,
        parseFloat(outsourceCost) || 0
      );

      // ✅ Then deduct stock (only if Locksmith + items picked)
      if (isLocksmith && pickedStock.length > 0) {
        await deductStockItems(
          pickedStock.map((p) => ({ id: p.id, quantity: p.quantity }))
        );
      }

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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>عميل بدون موعد</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* Customer Name */}
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

          {/* Service Category */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>نوع الخدمة *</Text>
            <View style={styles.pickerContainer}>
              <Ionicons
                name="clipboard-outline"
                size={20}
                color="#666"
                style={styles.pickerIcon}
              />
              <Picker
                selectedValue={serviceCategory}
                onValueChange={(value) => setServiceCategory(value)}
                style={styles.picker}
                testID="quick-walkin-category-picker"
              >
                <Picker.Item label="— اختر نوع الخدمة —" value="" color="#94a3b8" />
                {SERVICE_CATEGORIES.map((cat) => (
                  <Picker.Item key={cat} label={getCategoryLabelAr(cat)} value={cat} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Additional Notes */}
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

          {/* ✅ CONDITIONAL: Locksmith Stock picker OR Inventory picker */}
          {isLocksmith ? (
            <View style={styles.stockSection}>
              <View style={styles.stockHeader}>
                <Text style={styles.label}>قطع من المخزون (اختياري)</Text>
                <TouchableOpacity
                  style={styles.addStockBtn}
                  onPress={() => setStockPickerVisible(true)}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
                  <Text style={styles.addStockBtnText}>اختر قطعة</Text>
                </TouchableOpacity>
              </View>

              {pickedStock.length === 0 ? (
                <View style={styles.emptyStockBox}>
                  <Ionicons name="cube-outline" size={32} color="#94a3b8" />
                  <Text style={styles.emptyStockText}>لم يتم اختيار أي قطعة بعد</Text>
                </View>
              ) : (
                pickedStock.map((item) => (
                  <View key={item.id} style={styles.pickedStockRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickedStockName}>{item.name}</Text>
                      <Text style={styles.pickedStockMeta}>
                        متوفر: {item.available}
                      </Text>
                    </View>
                    <View style={styles.qtyControls}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => decreasePickedQty(item.id)}
                      >
                        <Ionicons name="remove" size={18} color="#0f172a" />
                      </TouchableOpacity>
                      <Text style={styles.qtyNumber}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => increasePickedQty(item.id)}
                      >
                        <Ionicons name="add" size={18} color="#0f172a" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      onPress={() => removePickedStock(item.id)}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          ) : (
            <View style={styles.productsCard}>
              <InventoryPicker value={pickedItems} onChange={setPickedItems} />
            </View>
          )}

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
            <TouchableOpacity
              style={[styles.payBtn, isPaid && styles.payBtnActive]}
              onPress={() => {
                setIsPaid(true);
                setIsPartial(false);
                setPartialAmount('');
              }}
            >
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={isPaid ? '#fff' : '#64748b'}
              />
              <Text style={[styles.payBtnText, isPaid && styles.payBtnTextActive]}>
                مدفوع
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.payBtn, isPartial && styles.payBtnActivePartial]}
              onPress={() => {
                setIsPartial(!isPartial);
                setIsPaid(false);
              }}
            >
              <Ionicons name="time" size={20} color={isPartial ? '#fff' : '#64748b'} />
              <Text style={[styles.payBtnText, isPartial && styles.payBtnTextActive]}>
                دفعة جزئية
              </Text>
            </TouchableOpacity>
          </View>

          {/* Partial Amount */}
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

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.disabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cash-outline" size={24} color="#fff" />
                <Text style={styles.submitText}>إضافة إلى الصندوق</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ✅ STOCK PICKER MODAL */}
      <Modal
        visible={stockPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setStockPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>اختر قطعة من المخزون</Text>
              <TouchableOpacity onPress={() => setStockPickerVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {stockList.length === 0 ? (
              <View style={styles.emptyModal}>
                <Ionicons name="cube-outline" size={48} color="#94a3b8" />
                <Text style={styles.emptyModalText}>لا توجد قطع في المخزون</Text>
              </View>
            ) : (
              <FlatList
                data={stockList}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 400 }}
                renderItem={({ item }) => {
                  const alreadyPicked = pickedStock.find((p) => p.id === item.id);
                  const isOut = item.quantity === 0;
                  return (
                    <TouchableOpacity
                      style={[styles.stockRow, isOut && styles.stockRowDisabled]}
                      onPress={() => !isOut && addStockItem(item)}
                      disabled={isOut}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.stockRowName, isOut && styles.stockRowNameDisabled]}
                        >
                          {item.name}
                        </Text>
                        <Text style={styles.stockRowMeta}>
                          {isOut ? 'غير متوفر' : `متوفر: ${item.quantity}`}
                          {alreadyPicked ? ` • مختار: ${alreadyPicked.quantity}` : ''}
                        </Text>
                      </View>
                      {!isOut && (
                        <Ionicons name="add-circle" size={24} color="#2563eb" />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
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
  content: { flex: 1, padding: 24 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
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
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    gap: 8,
  },
  payBtnActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  payBtnActivePartial: { backgroundColor: '#eab308', borderColor: '#eab308' },
  payBtnText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  payBtnTextActive: { color: '#fff' },
  submitButton: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
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

  // ✅ NEW: Locksmith stock section styles
  stockSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addStockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  addStockBtnText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyStockBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyStockText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  pickedStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  pickedStockName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  pickedStockMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
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

  // ✅ NEW: Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  emptyModal: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyModalText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  stockRowDisabled: {
    opacity: 0.4,
  },
  stockRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  stockRowNameDisabled: {
    color: '#94a3b8',
  },
  stockRowMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});
