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
import { triggerAutoPush } from '../src/utils/autoSync';
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

  // Generate a unique dummy VIN based on input
  const generateDummyVin = (input: string): string => {
    // Remove any spaces and convert to uppercase
    const cleanInput = input.trim().toUpperCase();
    
    // If it's already a valid 17-character VIN, return it
    if (cleanInput.length === 17 && isValidVin(cleanInput)) {
      return cleanInput;
    }
    
    // If it's "1234" or similar short code, generate a proper VIN
    if (cleanInput.length <= 10) {
      // Format: [Year][Make Code][Model Code][Unique Identifier][Check Digit]
      // Example: 1HGCM82633A123456
      
      // Generate timestamp-based unique identifier
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      
      // Create a unique VIN with the user's input as a suffix
      // Pad the input to ensure it's part of the VIN
      const suffix = cleanInput.padStart(4, 'X').substring(0, 4);
      
      // Construct a valid-looking VIN (17 characters)
      // Position 1-3: World Manufacturer Identifier (WMI)
      // Position 4-8: Vehicle Descriptor Section (VDS)
      // Position 9: Check Digit (we'll use a placeholder)
      // Position 10: Model Year
      // Position 11: Plant Code
      // Position 12-17: Serial Number
      
      const wmi = '1HG'; // Honda-like WMI
      const vds = 'CM826'; // Generic VDS
      const checkDigit = '3'; // Placeholder
      const modelYear = 'A'; // 2010
      const plantCode = '3';
      const serial = suffix + random.substring(0, 4);
      
      // Ensure total length is exactly 17 characters
      const dummyVin = `${wmi}${vds}${checkDigit}${modelYear}${plantCode}${serial}`.substring(0, 17);
      
      return dummyVin;
    }
    
    // If it's between 11-16 characters, pad to 17
    if (cleanInput.length < 17) {
      return cleanInput.padEnd(17, 'X');
    }
    
    // If it's 17 characters but not valid, still use it
    return cleanInput.substring(0, 17);
  };

  // Check if the input is a dummy VIN request (short code)
  const isDummyRequest = (input: string): boolean => {
    const clean = input.trim();
    return clean.length <= 10 && /^[0-9]+$/.test(clean);
  };

  const handleScanVIN = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const res = await scanVinWithCamera();
      if (res.ok) {
        setVin(res.vin);
        if (res.candidates.length > 1) {
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
      if (res.reason === 'cancelled') return;
      if (res.reason === 'no_vin' && res.candidates && res.candidates.length > 0) {
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
    const vinInput = vin.trim();
    
    if (!vinInput) {
      Alert.alert('Error', 'Please enter a VIN number');
      return;
    }

    // Check if it's a dummy VIN request
    if (isDummyRequest(vinInput)) {
      const dummyVin = generateDummyVin(vinInput);
      setVin(dummyVin);
      
      // Auto-fill with generic values for dummy VIN
      setMake('GENERIC');
      setModel('VEHICLE');
      setYear('2020');
      
      Alert.alert(
        'Dummy VIN Generated',
        `A unique VIN has been generated: ${dummyVin}\n\nMake and Model have been auto-filled as "GENERIC VEHICLE". You can edit them if needed.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Normal VIN decoding
    if (vinInput.length < 11 || vinInput.length > 17) {
      Alert.alert('Error', 'VIN must be between 11 and 17 characters');
      return;
    }

    if (vinInput.length === 17 && !isValidVin(vinInput)) {
      console.warn('VIN charset looks off — decoder may not return data.');
    }

    setDecoding(true);
    try {
      const data = await decodeVin(vinInput);
      
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
    const vinInput = vin.trim();
    
    // Check if it's a dummy request before validation
    if (isDummyRequest(vinInput)) {
      // Auto-generate dummy VIN if user forgot to click decode
      const dummyVin = generateDummyVin(vinInput);
      setVin(dummyVin);
      
      // Auto-fill with generic values
      if (!make.trim()) setMake('GENERIC');
      if (!model.trim()) setModel('VEHICLE');
      if (!year.trim()) setYear('2020');
      
      // Continue with submission
      setTimeout(() => {
        handleSubmit();
      }, 100);
      return;
    }

    // Validate required fields
    if (!vinInput || !make.trim() || !model.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Validate VIN length if it's not a dummy
    if (!isDummyRequest(vinInput) && vinInput.length < 11) {
      Alert.alert('Error', 'VIN must be at least 11 characters');
      return;
    }

    setLoading(true);
    try {
      await createVehicle(
        params.customerId as string,
        vinInput,
        plateNumber.trim(),
        make.trim(),
        model.trim(),
        year.trim() || undefined
      );
      triggerAutoPush();

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
                    placeholder="Enter VIN or short code (e.g., 1234)"
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
                  accessibilityLabel="Decode VIN or generate dummy VIN"
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
                {'\n'}Type "1234" and tap the lightning icon to generate a dummy VIN.
              </Text>
            </View>

            {/* Plate Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Plate Number </Text>
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
