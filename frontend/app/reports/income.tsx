import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getIncomeByCategory, CategoryIncomeRow } from '../../src/db/database';
import { getCategoryLabelAr } from '../../src/utils/categoryLabels';

export default function IncomeByCategoryScreen() {
  const router = useRouter();

  // Default range = this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const toIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const [startDate, setStartDate] = useState(toIso(monthStart));
  const [endDate, setEndDate] = useState(toIso(now));
  const [rows, setRows] = useState<CategoryIncomeRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getIncomeByCategory(
        startDate ? `${startDate}T00:00:00` : undefined,
        endDate ? `${endDate}T23:59:59` : undefined,
      );
      setRows(data);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const grandTotal = rows.reduce((s, r) => s + r.total_revenue, 0);
  const grandNet = rows.reduce((s, r) => s + r.net_revenue, 0);
  const grandServices = rows.reduce((s, r) => s + r.total_services, 0);

  const maxRevenue =
    rows.length > 0 ? Math.max(...rows.map((r) => r.total_revenue)) : 1;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Income by Category</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Date range */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date Range</Text>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>From</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="calendar-outline" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
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
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                />
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.generateButton, loading && styles.buttonDisabled]}
            onPress={load}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.generateButtonText}>Refresh</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Services</Text>
            <Text style={styles.summaryValue}>{grandServices}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Revenue</Text>
            <Text style={[styles.summaryValue, { color: '#10b981' }]}>
              ${grandTotal.toFixed(0)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Net</Text>
            <Text style={[styles.summaryValue, { color: '#7c3aed' }]}>
              ${grandNet.toFixed(0)}
            </Text>
          </View>
        </View>

        {/* Category breakdown */}
        {rows.length === 0 && !loading ? (
          <View style={styles.empty}>
            <Ionicons name="stats-chart-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No services in this range</Text>
          </View>
        ) : (
          rows.map((r) => {
            const pct = grandTotal > 0 ? (r.total_revenue / grandTotal) * 100 : 0;
            const barWidth = maxRevenue > 0 ? (r.total_revenue / maxRevenue) * 100 : 0;
            return (
              <View key={r.category} style={styles.catCard}>
                <View style={styles.rowTop}>
                  <Text style={styles.catName}>{getCategoryLabelAr(r.category)}</Text>
                  <Text style={styles.catRevenue}>${r.total_revenue.toFixed(0)}</Text>
                </View>

                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${barWidth}%` }]} />
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    {r.total_services} service{r.total_services === 1 ? '' : 's'}
                  </Text>
                  <Text style={styles.metaText}>{pct.toFixed(1)}% of total</Text>
                </View>

                <View style={styles.pillsRow}>
                  <View style={[styles.pill, styles.pillPaid]}>
                    <Text style={styles.pillTextLight}>
                      Paid ${r.paid_revenue.toFixed(0)}
                    </Text>
                  </View>
                  {r.partial_revenue > 0 && (
                    <View style={[styles.pill, styles.pillPartial]}>
                      <Text style={styles.pillTextLight}>
                        Partial ${r.partial_revenue.toFixed(0)}
                      </Text>
                    </View>
                  )}
                  {r.unpaid_revenue > 0 && (
                    <View style={[styles.pill, styles.pillUnpaid]}>
                      <Text style={styles.pillTextLight}>
                        Unpaid ${r.unpaid_revenue.toFixed(0)}
                      </Text>
                    </View>
                  )}
                  {r.outsource_total > 0 && (
                    <View style={[styles.pill, styles.pillOutsource]}>
                      <Text style={styles.pillTextLight}>
                        Out ${r.outsource_total.toFixed(0)}
                      </Text>
                    </View>
                  )}
                </View>

                {r.outsource_total > 0 && (
                  <Text style={styles.netLine}>
                    Net after outsource:{' '}
                    <Text style={{ fontWeight: '800' }}>${r.net_revenue.toFixed(0)}</Text>
                  </Text>
                )}
              </View>
            );
          })
        )}
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
  content: { padding: 20, paddingBottom: 40 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  row: { flexDirection: 'row' },
  inputGroup: { marginBottom: 12 },
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
  generateButton: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  generateButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#e2e8f0' },
  summaryLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: '#94a3b8', marginTop: 12, fontSize: 14 },
  catCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  catName: { fontSize: 15, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 8 },
  catRevenue: { fontSize: 18, fontWeight: '900', color: '#059669' },
  barTrack: {
    height: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metaText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pillPaid: { backgroundColor: '#10b981' },
  pillPartial: { backgroundColor: '#eab308' },
  pillUnpaid: { backgroundColor: '#ef4444' },
  pillOutsource: { backgroundColor: '#7c3aed' },
  pillTextLight: { color: '#fff', fontSize: 11, fontWeight: '700' },
  netLine: {
    marginTop: 10,
    fontSize: 12,
    color: '#7c3aed',
    fontStyle: 'italic',
  },
});
