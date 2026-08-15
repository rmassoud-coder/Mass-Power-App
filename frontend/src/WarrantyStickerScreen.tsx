import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { printJob } from './utils/printService';
import { buildWarrantyStickerDoc } from './utils/thermalDoc';
import { loadSettings } from './utils/settings';

const WARRANTY_TYPES = [
  { label: 'Select Item Type...', value: '' },
  { label: 'Electrical Part', value: 'Electrical Part' },
  { label: 'Key Fob', value: 'Key Fob' },
  { label: 'Battery', value: 'Battery' },
];

export default function WarrantyStickerScreen() {
  const router = useRouter();
  
  const [warrantyPeriod, setWarrantyPeriod] = useState<'6' | '12'>('6');
  const [itemType, setItemType] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    if (!itemType) {
      Alert.alert('Error', 'Please select a warranty item type.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a warranty description.');
      return;
    }

    setLoading(true);
    try {
      const settings = await loadSettings();
      
      const now = new Date();
      let expiryDate = new Date(now);
      if (warrantyPeriod === '6') {
        expiryDate.setMonth(expiryDate.getMonth() + 6);
      } else {
        expiryDate.setMonth(expiryDate.getMonth() + 12);
      }

      const doc = buildWarrantyStickerDoc(
        itemType,
        description.trim(),
        warrantyPeriod,
        now,
        expiryDate,
        settings
      );

      // 🔥 CRITICAL FIX: Pass 'thermal: doc' so it routes to Cat Printer
      await printJob(doc, { jobName: 'Warranty Sticker', thermal: doc });
      
      Alert.alert('Success', 'Warranty sticker sent to printer!');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to print warranty sticker.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Warranty Sticker</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        
        {/* 1. Item Type Dropdown */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Item Type *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={itemType}
              onValueChange={(value) => setItemType(value)}
              style={styles.picker}
            >
              {WARRANTY_TYPES.map((type) => (
                <Picker.Item key={type.value} label={type.label} value={type.value} />
              ))}
            </Picker>
          </View>
        </View>

        {/* 2. Description Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Warranty Description *</Text>
          <View style={styles.textAreaContainer}>
            <TextInput
              style={styles.textArea}
              placeholder="e.g. Covers manufacturing defects and premature failure."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* 3. Warranty Period Toggle (6 vs 12 months) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Warranty Period</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, warrantyPeriod === '6' && styles.toggleBtnActive]}
              onPress={() => setWarrantyPeriod('6')}
            >
              <Text style={[styles.toggleText, warrantyPeriod === '6' && styles.toggleTextActive]}>
                6 Months
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, warrantyPeriod === '12' && styles.toggleBtnActive]}
              onPress={() => setWarrantyPeriod('12')}
            >
              <Text style={[styles.toggleText, warrantyPeriod === '12' && styles.toggleTextActive]}>
                12 Months
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. Date Info (Static Display) */}
        <View style={styles.dateCard}>
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>Date Issued:</Text>
            <Text style={styles.dateValue}>{new Date().toLocaleDateString()}</Text>
          </View>
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>Expires:</Text>
            <Text style={styles.dateValue}>
              {new Date(new Date().setMonth(new Date().getMonth() + parseInt(warrantyPeriod))).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* 5. Print Button */}
        <TouchableOpacity
          style={[styles.printButton, loading && styles.buttonDisabled]}
          onPress={handlePrint}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="print-outline" size={24} color="#fff" />
              <Text style={styles.printButtonText}>Print Warranty Sticker</Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
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
  content: { flex: 1 },
  contentContainer: { padding: 24, paddingBottom: 40 },
  
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  picker: { height: 50, color: '#1e293b' },
  textAreaContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    minHeight: 80,
  },
  textArea: { fontSize: 16, color: '#1e293b', flex: 1 },
  toggleRow: { flexDirection: 'row', gap: 12 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  toggleBtnActive: { backgroundColor: '#d97706', borderColor: '#d97706' },
  toggleText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  toggleTextActive: { color: '#fff' },
  dateCard: {
    backgroundColor: '#f3e8ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#d8b4fe',
  },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  dateLabel: { fontSize: 14, fontWeight: '600', color: '#5b21b6' },
  dateValue: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  printButton: {
    backgroundColor: '#d97706',
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  printButtonText: { color: '#fff', fontSize: 18, fontWeight: '600', marginLeft: 8 },
});
