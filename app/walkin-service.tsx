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
import { createWalkinService } from '../src/db/database';
import { triggerAutoPush } from '../src/utils/autoSync';

type PaymentStatus = 'paid' | 'unpaid' | 'partial';

export default function WalkinServiceScreen() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [cost, setCost] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [partialAmount, setPartialAmount] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const today = new Date().toLocaleDateString();

  const handleSubmit = async () => {
    if (!serviceDescription.trim()) {
      Alert.alert('Error', 'Please enter a service description');
      return;
    }

    const costValue = parseFloat(cost);
    if (isNaN(costValue) || costValue <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    let partialValue = 0;
    if (paymentStatus === 'partial') {
      partialValue = parseFloat(partialAmount);
      if (isNaN(partialValue) || partialValue <= 0) {
        Alert.alert('Error', 'Please enter a valid partial payment amount');
        return;
      }
      if (partialValue >= costValue) {
        Alert.alert('Error', 'Partial payment must be less than the total amount');
        return;
      }
    }

    setLoading(true);
    try {
      await createWalkinService(
        customerName.trim() || undefined,
        serviceDescription.trim(),
        costValue,
        paymentStatus === 'paid',
        paymentStatus === 'partial' ? partialValue : 0,
        additionalInfo.trim() || undefined
      );
      triggerAutoPush();

      let statusText = 'Paid in full';
      if (paymentStatus === 'unpaid') statusText = 'Unpaid';
      if (paymentStatus === 'partial') statusText = `Partial ($${partialValue.toFixed(2)} paid)`;

      Alert.alert(
        'Success',
        `Walk-in service added!\n\nService: ${serviceDescription}\nAmount: $${costValue.toFixed(2)}\nStatus: ${statusText}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
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
          <Text style={styles.headerTitle}>Walk-in Service</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            <View style={styles.iconContainer}>
              <Ionicons name="walk-outline" size={48} color="#2563eb" />
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="information-circle-outline" size={20} color="#2563eb" />
              <Text style={styles.infoText}>
                Walk-in services are tracked in your daily revenue and included in backups.
              </Text>
            </View>

            {/* Customer Name - Optional */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Customer Name <Text style={styles.optionalLabel}>(Optional)</Text></Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter customer name (optional)"
                  value={customerName}
                  onChangeText={setCustomerName}
                />
              </View>
            </View>

            {/* Service Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Service Description *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="construct-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Oil Change, Brake Repair"
                  value={serviceDescription}
                  onChangeText={setServiceDescription}
                />
              </View>
            </View>

            {/* Amount */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Amount ($) *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="cash-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  value={cost}
                  onChangeText={setCost}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Payment Status */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Payment Status</Text>
              <View style={styles.statusRow}>
                <TouchableOpacity
                  style={[styles.statusButton, paymentStatus === 'paid' && styles.statusButtonActive]}
                  onPress={() => setPaymentStatus('paid')}
                >
                  <Ionicons name="checkmark-circle" size={18} color={paymentStatus === 'paid' ? '#fff' : '#059669'} />
                  <Text style={[styles.statusButtonText, paymentStatus === 'paid' && styles.statusButtonTextActive]}>
                    Paid
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.statusButton, paymentStatus === 'unpaid' && styles.statusButtonActiveUnpaid]}
                  onPress={() => setPaymentStatus('unpaid')}
                >
                  <Ionicons name="alert-circle" size={18} color={paymentStatus === 'unpaid' ? '#fff' : '#dc2626'} />
                  <Text style={[styles.statusButtonText, paymentStatus === 'unpaid' && styles.statusButtonTextActive]}>
                    Unpaid
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.statusButton, paymentStatus === 'partial' && styles.statusButtonActivePartial]}
                  onPress={() => setPaymentStatus('partial')}
                >
                  <Ionicons name="time" size={18} color={paymentStatus === 'partial' ? '#fff' : '#a16207'} />
                  <Text style={[styles.statusButtonText, paymentStatus === 'partial' && styles.statusButtonTextActive]}>
                    Partial
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Partial Payment Amount */}
            {paymentStatus === 'partial' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Partial Payment Amount ($) *</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="cash-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    value={partialAmount}
                    onChangeText={setPartialAmount}
                    keyboardType="decimal-pad"
                  />
                </View>
                <Text style={styles.hintText}>Amount must be less than total</Text>
              </View>
            )}

            {/* Additional Info */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Additional Info <Text style={styles.optionalLabel}>(Optional)</Text></Text>
              <View style={styles.inputContainer}>
                <Ionicons name="document-text-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Optional notes"
                  value={additionalInfo}
                  onChangeText={setAdditionalInfo}
                />
              </View>
            </View>

            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={16} color="#64748b" />
              <Text style={styles.dateText}>Date: {today}</Text>
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
                  <Text style={styles.submitButtonText}>Add Walk-in Service</Text>
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
  form: { paddingTop: 24, paddingBottom: 40 },
  iconContainer: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e293b',
    marginLeft: 10,
    lineHeight: 18,
  },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 6 },
  optionalLabel: { fontSize: 12, fontWeight: '400', color: '#94a3b8' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1e293b' },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    gap: 6,
  },
  statusButtonActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  statusButtonActiveUnpaid: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  statusButtonActivePartial: {
    backgroundColor: '#a16207',
    borderColor: '#a16207',
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  statusButtonTextActive: {
    color: '#fff',
  },
  hintText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    fontStyle: 'italic',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  dateText: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});
