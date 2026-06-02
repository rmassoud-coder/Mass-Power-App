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
import { createService } from '../src/db/database';
import { Picker } from '@react-native-picker/picker';

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
  const [serviceDescription, setServiceDescription] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [cost, setCost] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const handleSubmit = async () => {
    if (!selectedVehicleId || !serviceDescription.trim() || !cost.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
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
        serviceDescription.trim(),
        additionalInfo.trim() || undefined,
        costNumber,
        isPaid
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

        <ScrollView style={styles.content}>
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

            {/* Service Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Service Description *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="clipboard-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Oil Change, Brake Repair"
                  value={serviceDescription}
                  onChangeText={setServiceDescription}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Additional Info */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Additional Info</Text>
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

            {/* Cost */}
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
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardView: {
    flex: 1,
  },
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  form: {
    paddingTop: 32,
  },
  iconContainer: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingLeft: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pickerIcon: {
    marginRight: 12,
  },
  picker: {
    flex: 1,
    height: 56,
  },
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
  textAreaContainer: {
    height: 120,
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
  },
  textArea: {
    height: '100%',
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginRight: 4,
  },
  submitButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
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
    marginBottom: 24,
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
  checkboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  paidCheckboxLabel: {
    marginLeft: 12,
    flex: 1,
  },
  paidCheckboxText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  paidCheckboxSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});
