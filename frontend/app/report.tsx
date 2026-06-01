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

interface ReportItem {
  service_id: string;
  customer_id: string;
  customer_name: string;
  customer_mobile: string;
  vehicle_id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year?: string;
  vehicle_vin: string;
  vehicle_plate: string;
  service_description: string;
  additional_info?: string;
  cost: number;
  service_date: string;
}

interface ReportResponse {
  items: ReportItem[];
  total_cost: number;
  total_services: number;
}

type FilterType = 'mobile' | 'vin' | 'plate';

export default function ReportScreen() {
  const router = useRouter();
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('mobile');
  const [filterValue, setFilterValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportResponse | null>(null);

  const isValidDate = (dateStr: string) => {
    if (!dateStr) return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  };

  const handleGenerate = async () => {
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      Alert.alert('Error', 'Please use YYYY-MM-DD date format');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', `${startDate}T00:00:00`);
      if (endDate) params.append('end_date', `${endDate}T23:59:59`);
      if (filterValue.trim()) {
        params.append(filterType, filterValue.trim());
      }

      const response = await fetch(`${backendUrl}/api/reports/services?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const data = await response.json();
      setReport(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setStartDate('');
    setEndDate('');
    setFilterValue('');
    setReport(null);
  };

  const getFilterPlaceholder = () => {
    if (filterType === 'mobile') return 'Enter mobile number';
    if (filterType === 'vin') return 'Enter VIN';
    return 'Enter plate number';
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
          <Text style={styles.headerTitle}>Service Report</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* Date Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date Range</Text>
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>From</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="calendar-outline" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={startDate}
                    onChangeText={setStartDate}
                    maxLength={10}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>To</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="calendar-outline" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={endDate}
                    onChangeText={setEndDate}
                    maxLength={10}
                  />
                </View>
              </View>
            </View>
            <Text style={styles.hint}>Leave blank for all dates</Text>
          </View>

          {/* Filter Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Filter By (Optional)</Text>
            <View style={styles.filterTabs}>
              <TouchableOpacity
                style={[styles.filterTab, filterType === 'mobile' && styles.filterTabActive]}
                onPress={() => setFilterType('mobile')}
              >
                <Ionicons
                  name="call-outline"
                  size={18}
                  color={filterType === 'mobile' ? '#fff' : '#64748b'}
                />
                <Text style={[styles.filterTabText, filterType === 'mobile' && styles.filterTabTextActive]}>
                  Mobile
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, filterType === 'vin' && styles.filterTabActive]}
                onPress={() => setFilterType('vin')}
              >
                <Ionicons
                  name="barcode-outline"
                  size={18}
                  color={filterType === 'vin' ? '#fff' : '#64748b'}
                />
                <Text style={[styles.filterTabText, filterType === 'vin' && styles.filterTabTextActive]}>
                  VIN
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, filterType === 'plate' && styles.filterTabActive]}
                onPress={() => setFilterType('plate')}
              >
                <Ionicons
                  name="car-outline"
                  size={18}
                  color={filterType === 'plate' ? '#fff' : '#64748b'}
                />
                <Text style={[styles.filterTabText, filterType === 'plate' && styles.filterTabTextActive]}>
                  Plate
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={getFilterPlaceholder()}
                value={filterValue}
                onChangeText={setFilterValue}
                autoCapitalize={filterType === 'mobile' ? 'none' : 'characters'}
              />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.generateButton, loading && styles.buttonDisabled]}
              onPress={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="document-text" size={20} color="#fff" />
                  <Text style={styles.generateButtonText}>Generate Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Report Results */}
          {report && (
            <View style={styles.resultsSection}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Services</Text>
                  <Text style={styles.summaryValue}>{report.total_services}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Revenue</Text>
                  <Text style={[styles.summaryValue, styles.totalCost]}>
                    ${report.total_cost.toFixed(2)}
                  </Text>
                </View>
              </View>

              {report.items.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-outline" size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>No services found for the selected filters</Text>
                </View>
              ) : (
                <View style={styles.itemsList}>
                  <Text style={styles.itemsTitle}>Service Records</Text>
                  {report.items.map((item) => (
                    <View key={item.service_id} style={styles.reportItem}>
                      <View style={styles.itemHeader}>
                        <View style={styles.itemIconContainer}>
                          <Ionicons name="construct" size={20} color="#10b981" />
                        </View>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemDescription}>{item.service_description}</Text>
                          {item.additional_info && (
                            <Text style={styles.itemAdditional}>{item.additional_info}</Text>
                          )}
                        </View>
                        <Text style={styles.itemCost}>${item.cost.toFixed(2)}</Text>
                      </View>
                      <View style={styles.itemDetails}>
                        <View style={styles.detailRow}>
                          <Ionicons name="person-outline" size={14} color="#64748b" />
                          <Text style={styles.detailText}>
                            {item.customer_name} • {item.customer_mobile}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="car-sport-outline" size={14} color="#64748b" />
                          <Text style={styles.detailText}>
                            {item.vehicle_year ? `${item.vehicle_year} ` : ''}
                            {item.vehicle_make} {item.vehicle_model} • {item.vehicle_plate}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="calendar-outline" size={14} color="#64748b" />
                          <Text style={styles.detailText}>
                            {new Date(item.service_date).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
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
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  row: { flexDirection: 'row' },
  inputGroup: { marginBottom: 0 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#1e293b' },
  hint: { fontSize: 12, color: '#64748b', marginTop: 8, fontStyle: 'italic' },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  filterTabActive: { backgroundColor: '#2563eb' },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#64748b', marginLeft: 6 },
  filterTabTextActive: { color: '#fff' },
  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  clearButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: { color: '#1e293b', fontSize: 16, fontWeight: '600' },
  generateButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  generateButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  resultsSection: { marginBottom: 32 },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#e2e8f0' },
  summaryLabel: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  summaryValue: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  totalCost: { color: '#10b981' },
  emptyContainer: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 14, color: '#94a3b8', marginTop: 12, textAlign: 'center' },
  itemsList: {},
  itemsTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 12 },
  reportItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  itemIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemDescription: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  itemAdditional: { fontSize: 13, color: '#64748b', marginTop: 2 },
  itemCost: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },
  itemDetails: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  detailText: { fontSize: 13, color: '#475569', marginLeft: 8 },
});
