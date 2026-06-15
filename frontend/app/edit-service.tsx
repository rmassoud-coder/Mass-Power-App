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
  updateService,
  SERVICE_CATEGORIES,
  DashLights,
  OilReminder,
  EMPTY_OIL_REMINDER,
} from '../src/db/database';
import DashLightsPicker from '../src/components/DashLightsPicker';
import OilReminderForm from '../src/components/OilReminderForm';

export default function EditServiceScreen() {
  const params = useLocalSearchParams();

  const initialDesc = (params.serviceDescription as string) || SERVICE_CATEGORIES[0];
  const initialCategory = (SERVICE_CATEGORIES as readonly string[]).includes(initialDesc)
    ? initialDesc
    : 'Other Services';

  const initialAdditional =
    initialCategory !== initialDesc
      ? `${initialDesc}${params.additionalInfo ? ` - ${params.additionalInfo as string}` : ''}`
      : (params.additionalInfo as string) || '';

  const [serviceCategory, setServiceCategory] = useState<string>(initialCategory);
  const [additionalInfo, setAdditionalInfo] = useState(initialAdditional);
  const [cost, setCost] = useState(params.cost as string);
  const [isPaid, setIsPaid] = useState(params.isPaid === 'true');
  const [dashLights, setDashLights] = useState<DashLights>({
    abs: params.dashAbs === 'true',
    check_engine: params.dashCheckEngine === 'true',
    brake: params.dashBrake === 'true',
    airbag: params.dashAirbag === 'true',
    immobilizer: params.dashImmobilizer === 'true',
  });
  const [oilReminder, setOilReminder] = useState<OilReminder>({
    oilGrade: (params.oilGrade as string) || '',
    currentMileage: params.currentMileage ? parseInt(params.currentMileage as string, 10) : null,
    nextServiceDate: (params.nextServiceDate as string) || null,
    nextServiceMileage: params.nextServiceMileage
      ? parseInt(params.nextServiceMileage as string, 10)
      : null,
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isOilService = serviceCategory === 'Oil Services';

  const handleSubmit = async () => {
    if (!serviceCategory || !cost.trim()) {
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
      await updateService(
        params.serviceId as string,
        serviceCategory,
        additionalInfo.trim() || undefined,
        costNumber,
        isPaid,
        dashLights,
        isOilService ? oilReminder : EMPTY_OIL_REMINDER
      );

      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update service');
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
          <Text style={styles.headerTitle}>Edit Service</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <View style={styles.iconContainer}>
              <Ionicons name="construct" size={48} color="#10b981" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Service Type *</Text>
              <View style={styles.pickerContainer}>
                <Ionicons name="clipboard-outline" size={20} color="#666" style={styles.pickerIcon} />
                <Picker
                  selectedValue={serviceCategory}
                  onValueChange={(value) => setServiceCategory(value)}
                  style={styles.picker}
                  testID="service-category-picker-edit"
                >
                  {SERVICE_CATEGORIES.map((cat) => (
                    <Picker.Item key={cat} label={cat} value={cat} />
                  ))}
                </Picker>
              </View>
            </View>

            {isOilService && (
              <View style={styles.oilCard}>
                <OilReminderForm
                  value={oilReminder}
                  onChange={setOilReminder}
                  make={params.vehicleMake as string | undefined}
                  model={params.vehicleModel as string | undefined}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes / Description</Text>
              <View style={[styles.inputContainer, styles.textAreaContainer]}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Additional notes or details..."
                  value={additionalInfo}
                  onChangeText={setAdditionalInfo}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={styles.dashCard}>
              <DashLightsPicker value={dashLights} onChange={setDashLights} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cost *</Text>
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
            </View>

            <TouchableOpacity
              style={styles.paidCheckbox}
              onPress={() => setIsPaid(!isPaid)}
              testID="paid-checkbox-edit"
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
                  <Text style={styles.submitButtonText}>Update Service</Text>
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
});
