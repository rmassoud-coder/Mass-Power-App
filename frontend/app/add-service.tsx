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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import {
  createService,
  SERVICE_CATEGORIES,
  EMPTY_DASH_LIGHTS,
  EMPTY_OIL_REMINDER,
  DashLights,
  OilReminder,
} from '../src/db/database';
import DashLightsPicker from '../src/components/DashLightsPicker';
import OilReminderForm from '../src/components/OilReminderForm';
import InventoryPicker, { PickedItem } from '../src/components/InventoryPicker';

interface Vehicle {
  id: string;
  vin: string;
  plate_number: string;
  make: string;
  model: string;
  year?: string;
}

export default function AddServiceScreen() {
  const params = useLocalSearchParams();
  const vehicles: Vehicle[] = params.vehicles ? JSON.parse(params.vehicles as string) : [];

  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id || '');
  const [serviceCategory, setServiceCategory] = useState<string>(SERVICE_CATEGORIES[0]);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [cost, setCost] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [dashLights, setDashLights] = useState<DashLights>(EMPTY_DASH_LIGHTS);
  const [oilReminder, setOilReminder] = useState<OilReminder>(EMPTY_OIL_REMINDER);
  const [pickedItems, setPickedItems] = useState<PickedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isOilService = serviceCategory === 'Oil Services';
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  const productsSubtotal = pickedItems.reduce(
    (sum, it) => sum + it.quantity * it.unit_price,
    0
  );
  // Inventory prices are tracked separately (for stock valuation) — they are
  // NOT added to the service cost. The mechanic types the final price they
  // want to charge and it stands alone.

  const handleSubmit = async () => {
    if (!selectedVehicleId || !serviceCategory || !cost.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (isOilService && !oilReminder.oilGrade.trim()) {
      Alert.alert('Error', 'Oil grade is required for Oil Services (e.g. 5W-30)');
      return;
    }

    const costNumber = parseFloat(cost);
    if (isNaN(costNumber) || costNumber < 0) {
      Alert.alert('Error', 'Please enter a valid cost');
      return;
    }

    setLoading(true);
    try {
      await createService(
        selectedVehicleId,
        serviceCategory,
        additionalInfo.trim() || undefined,
        costNumber,
        isPaid,
        dashLights,
        isOilService ? oilReminder : EMPTY_OIL_REMINDER,
        pickedItems.map((p) => ({ inventory_id: p.inventory_id, quantity: p.quantity }))
      );

      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add service');
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
          <Text style={styles.headerTitle}>Add Service Record</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <View style={styles.iconContainer}>
              <Ionicons name="construct" size={48} color="#10b981" />
            </View>

            {/* Vehicle Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Select Vehicle *</Text>
              <View style={styles.pickerContainer}>
                <Ionicons name="car-sport-outline" size={20} color="#666" style={styles.pickerIcon} />
                <Picker
                  selectedValue={selectedVehicleId}
                  onValueChange={(value) => setSelectedVehicleId(value)}
                  style={styles.picker}
                >
                  {vehicles.map((vehicle) => (
                    <Picker.Item
                      key={vehicle.id}
                      label={`${vehicle.year || ''} ${vehicle.make} ${vehicle.model} - ${vehicle.plate_number}`}
                      value={vehicle.id}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Service Category (Dropdown) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Service Type *</Text>
              <View style={styles.pickerContainer}>
                <Ionicons name="clipboard-outline" size={20} color="#666" style={styles.pickerIcon} />
                <Picker
                  selectedValue={serviceCategory}
                  onValueChange={(value) => setServiceCategory(value)}
                  style={styles.picker}
                  testID="service-category-picker"
                >
                  {SERVICE_CATEGORIES.map((cat) => (
                    <Picker.Item key={cat} label={cat} value={cat} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Oil Service Reminder (conditional) */}
            {isOilService && (
              <View style={styles.oilCard}>
                <OilReminderForm
                  value={oilReminder}
                  onChange={setOilReminder}
                  make={selectedVehicle?.make}
                  model={selectedVehicle?.model}
                />
              </View>
            )}

            {/* Additional Info / Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes / Description</Text>
              <View style={[styles.inputContainer, styles.textAreaContainer]}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g., oil filter replaced, brake pads worn..."
                  value={additionalInfo}
                  onChangeText={setAdditionalInfo}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Inventory Products Used */}
            <InventoryPicker value={pickedItems} onChange={setPickedItems} />

            {/* Dashboard Warning Lights */}
            <View style={styles.dashCard}>
              <DashLightsPicker value={dashLights} onChange={setDashLights} />
            </View>

            {/* Cost */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Service Cost *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="cash-outline" size={20} color="#666" style={styles.inputIcon} />
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
                <Text style={styles.hint}>
                  Note: inventory items are tracked for stock only. Set the customer&apos;s
                  price above — parts pricing is not added automatically.
                </Text>
              )}
            </View>

            {/* Paid Checkbox */}
            <TouchableOpacity
              style={styles.paidCheckbox}
              onPress={() => setIsPaid(!isPaid)}
              testID="paid-checkbox"
            >
              <View style={[styles.checkbox, isPaid && styles.checkboxChecked]}>
                {isPaid && <Ionicons name="checkmark" size={18} color="#fff" />}
              </View>
              <View style={styles.paidCheckboxLabel}>
                <Text style={styles.paidCheckboxText}>Invoice Paid</Text>
                <Text style={styles.paidCheckboxSubtext}>
                  {isPaid ? 'Marked as paid' : 'Will show as unpaid in red'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  <Text style={styles.submitButtonText}>Add Service</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  content: { flex: 1, paddingHorizontal: 24 },
  form: { paddingTop: 24 },
  iconContainer: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
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
  textAreaContainer: { height: 100, alignItems: 'flex-start', paddingVertical: 12 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1e293b' },
  textArea: { height: '100%' },
  currencySymbol: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginRight: 4 },
  dashCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  oilCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  paidCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: { backgroundColor: '#10b981', borderColor: '#10b981' },
  paidCheckboxLabel: { marginLeft: 12, flex: 1 },
  paidCheckboxText: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  paidCheckboxSubtext: { fontSize: 12, color: '#64748b', marginTop: 2 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: '600', marginLeft: 8 },
  totalBreakdown: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  totalLine: { fontSize: 12, color: '#475569', marginBottom: 2 },
  totalGrand: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f766e',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
});
