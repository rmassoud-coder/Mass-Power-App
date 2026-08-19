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
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import {
  createService,
  SERVICE_CATEGORIES,
  EMPTY_DASH_LIGHTS,
  EMPTY_OIL_REMINDER,
  EMPTY_BATTERY_REPLACEMENT,
  EMPTY_HVAC_SERVICE,
} from '../src/db/database';
import { triggerAutoPush } from '../src/utils/autoSync';

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
  const [isPending, setIsPending] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const laborCost = parseFloat(cost) || 0;
  const grandTotal = laborCost;

  const handleSubmit = async () => {
    if (!selectedVehicleId || !serviceCategory || !cost.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const laborNumber = parseFloat(cost);
    if (isNaN(laborNumber) || laborNumber < 0) {
      Alert.alert('Error', 'Please enter a valid labor cost');
      return;
    }

    let partialPaidNumber = 0;
    if (isPending) {
      partialPaidNumber = parseFloat(partialAmount) || 0;
      if (partialPaidNumber < 0) {
        Alert.alert('Error', 'Partial payment cannot be negative');
        return;
      }
    }

    setLoading(true);
    try {
      await createService(
        selectedVehicleId,
        serviceCategory,
        additionalInfo.trim() || undefined,
        laborNumber,
        isPaid,
        EMPTY_DASH_LIGHTS,
        EMPTY_OIL_REMINDER,
        [], // No inventory items
        partialPaidNumber,
        undefined, // No battery
        undefined, // No HVAC
        0 // No outsource
      );
      triggerAutoPush();
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
          <Text style={styles.headerTitle}>Add Service (Minimal)</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            {/* Vehicle Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Select Vehicle *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedVehicleId}
                  onValueChange={(value) => setSelectedVehicleId(value)}
                  style={styles.picker}
                >
                  {vehicles.map((vehicle) => (
                    <Picker.Item
                      key={vehicle.id}
                      label={`${vehicle.year || ''} ${vehicle.make} ${vehicle.model}`}
                      value={vehicle.id}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Service Category */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Service Type *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={serviceCategory}
                  onValueChange={(value) => setServiceCategory(value)}
                  style={styles.picker}
                >
                  {SERVICE_CATEGORIES.map((cat) => (
                    <Picker.Item key={cat} label={cat} value={cat} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes / Description</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Service notes"
                  value={additionalInfo}
                  onChangeText={setAdditionalInfo}
                />
              </View>
            </View>

            {/* Cost */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cost *</Text>
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
              <Text style={styles.totalGrand}>Total: ${grandTotal.toFixed(2)}</Text>
            </View>

            {/* Paid Checkbox */}
            <TouchableOpacity
              style={styles.paidCheckbox}
              onPress={() => {
                const next = !isPaid;
                setIsPaid(next);
                if (next) {
                  setIsPending(false);
                  setPartialAmount('');
                }
              }}
            >
              <View style={[styles.checkbox, isPaid && styles.checkboxChecked]}>
                {isPaid && <Ionicons name="checkmark" size={18} color="#fff" />}
              </View>
              <Text style={styles.paidCheckboxText}>Invoice Paid</Text>
            </TouchableOpacity>

            {/* Pending Payment */}
            <View style={styles.pendingRow}>
              <TouchableOpacity
                style={styles.paidCheckbox}
                onPress={() => {
                  const next = !isPending;
                  setIsPending(next);
                  if (next) setIsPaid(false);
                  else setPartialAmount('');
                }}
              >
                <View
                  style={[
                    styles.checkbox,
                    isPending && { backgroundColor: '#eab308', borderColor: '#eab308' },
                  ]}
                >
                  {isPending && <Ionicons name="time" size={16} color="#fff" />}
                </View>
                <Text style={styles.paidCheckboxText}>Pending Payment</Text>
              </TouchableOpacity>
              {isPending && (
                <View style={styles.partialInputWrap}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.partialInput}
                    placeholder="0.00"
                    value={partialAmount}
                    onChangeText={setPartialAmount}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}
            </View>

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
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  picker: { height: 56 },
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
  input: { flex: 1, fontSize: 16, color: '#1e293b' },
  currencySymbol: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginRight: 4 },
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
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: '600', marginLeft: 8 },
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
  paidCheckboxText: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginLeft: 12 },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  partialInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eab308',
    paddingHorizontal: 10,
    height: 46,
    minWidth: 120,
  },
  partialInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '700',
    minWidth: 60,
  },
  totalGrand: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f766e',
    marginTop: 8,
  },
});
