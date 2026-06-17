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
import { createVehicle } from '../src/db/database';
import { decodeVin } from '../src/utils/vinDecoder';
import { scanVinWithCamera, isValidVin } from '../src/utils/vinScanner';

export default function AddVehicleScreen() {
  const params = useLocalSearchParams();
  const [vin, setVin] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const router = useRouter();

  const handleScanVIN = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const res = await scanVinWithCamera();
      if (res.ok) {
        setVin(res.vin);
        if (res.candidates.length > 1) {
          // Let user pick if multiple candidates found
          Alert.alert(
            'VIN Detected',
            `Best match: ${res.vin}\n\nOther possibilities:\n${res.candidates
              .slice(1, 5)
              .map((c) => `• ${c}`)
              .join('\n')}`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('VIN Detected', `Captured: ${res.vin}`, [
            { text: 'OK' },
          ]);
        }
        return;
      }
      // Non-OK paths
      if (res.reason === 'cancelled') return; // silent
      if (res.reason === 'no_vin' && res.candidates && res.candidates.length > 0) {
        // Offer the longest readable lines as fallbacks
        const choices = res.candidates
          .map((c) => c.toUpperCase().replace(/\s+/g, ''))
          .filter((c) => c.length >= 11 && c.length <= 19)
          .slice(0, 4);
        if (choices.length > 0) {
          Alert.alert(
            'No exact VIN found',
            'Pick the closest reading or try again:',
            [
              ...choices.map((c) => ({
                text: c,
                onPress: () => setVin(c.slice(0, 17)),
              })),
              { text: 'Retake', onPress: handleScanVIN },
              { text: 'Cancel', style: 'cancel' as const },
            ]
          );
          return;
        }
      }
      Alert.alert('Scan Failed', res.message);
    } catch (e: any) {
      Alert.alert('Scan Error', e?.message || 'Unexpected error during scan.');
    } finally {
      setScanning(false);
    }
  };

  const handleDecodeVIN = async () => {
    if (!vin.trim()) {
      Alert.alert('Error', 'Please enter a VIN number');
      return;
    }

    if (vin.length < 11 || vin.length > 17) {
      Alert.alert('Error', 'VIN must be between 11 and 17 characters');
      return;
    }

    if (vin.length === 17 && !isValidVin(vin)) {
      // Soft warning — still attempt decode (NHTSA may handle it)
      console.warn('VIN charset looks off — decoder may not return data.');
    }

    setDecoding(true);
    try {
      const data = await decodeVin(vin);
      
      if (data.offline) {
        Alert.alert('No Internet', 'VIN decoder requires internet. Please enter vehicle details manually.');
      } else if (data.error) {
        Alert.alert('VIN Decoder', data.error);
      } else {
        if (data.make) setMake(data.make);
        if (data.model) setModel(data.model);
        if (data.year) setYear(data.year);
        Alert.alert('Success', 'VIN decoded successfully!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to decode VIN. Please enter details manually.');
    } finally {
      setDecoding(false);
    }
  };

  const handleSubmit = async () => {
    if (!vin.trim() || !plateNumber.trim() || !make.trim() || !model.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await createVehicle(
        params.customerId as string,
        vin.trim(),
        plateNumber.trim(),
        make.trim(),
        model.trim(),
        year.trim() || undefined
      );

      // Navigate back to customer detail
      router.replace({
        pathname: '/customer-detail',
        params: { customerId: params.customerId as string },
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add vehicle');
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
          <Text style={styles.headerTitle}>Add Vehicle</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.form}>
            <View style={styles.iconContainer}>
              <Ionicons name="car-sport" size={48} color="#2563eb" />
            </View>

            {/* VIN Number with Scanner + Decoder */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>VIN Number *</Text>
              <View style={styles.vinRow}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                  <Ionicons name="barcode-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter VIN"
                    value={vin}
                    onChangeText={setVin}
                    autoCapitalize="characters"
                    maxLength={17}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.scanButton, scanning && styles.decodeButtonDisabled]}
                  onPress={handleScanVIN}
                  disabled={scanning}
                  accessibilityLabel="Scan VIN with camera"
                >
                  {scanning ? (
                    <ActivityIndicator size="small" color="#0f766e" />
                  ) : (
                    <Ionicons name="camera" size={24} color="#0f766e" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.decodeButton, decoding && styles.decodeButtonDisabled]}
                  onPress={handleDecodeVIN}
                  disabled={decoding}
                  accessibilityLabel="Decode VIN via NHTSA"
                >
                  {decoding ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <Ionicons name="flash" size={24} color="#2563eb" />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>
                Tap the camera to scan the VIN, or the lightning icon to auto-fill from a typed VIN.
              </Text>
            </View>

            {/* Plate Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Plate Number *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="reader-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter plate number"
                  value={plateNumber}
                  onChangeText={setPlateNumber}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* Make */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Make *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="business-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Toyota, Honda"
                  value={make}
                  onChangeText={setMake}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Model */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Model *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="car-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Camry, Civic"
                  value={model}
                  onChangeText={setModel}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Year */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Year</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="calendar-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 2020"
                  value={year}
                  onChangeText={setYear}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
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
                  <Text style={styles.submitButtonText}>Add Vehicle</Text>
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
    backgroundColor: '#eff6ff',
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
  vinRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
  },
  decodeButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  scanButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginRight: 8,
  },
  decodeButtonDisabled: {
    opacity: 0.6,
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    fontStyle: 'italic',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
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
