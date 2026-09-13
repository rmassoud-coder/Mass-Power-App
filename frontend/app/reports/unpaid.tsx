import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getUnpaidServices, UnpaidServiceRow } from '../../src/db/database';

interface UnpaidData {
  items: UnpaidServiceRow[];
  total_count: number;
  total_cost: number;
  total_partial: number;
  total_remaining: number;
}

export default function UnpaidServicesScreen() {
  const router = useRouter();
  const [data, setData] = useState<UnpaidData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getUnpaidServices();
      setData(result);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load unpaid services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const partialItems = data?.items.filter((i) => i.partial_paid > 0) || [];
  const fullUnpaidItems = data?.items.filter((i) => i.partial_paid === 0) || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Unpaid Services</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Refresh button */}
        <TouchableOpacity
          style={[styles.refreshButton, loading && styles.buttonDisabled]}
          onPress={load}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </>
          )}
        </TouchableOpacity>

        {!data && loading && (
          <View style={styles.emptyState}>
            <ActivityIndicator color="#dc2626" size="large" />
            <Text style={styles.emptyText}>Loading unpaid services…</Text>
          </View>
        )}

        {data && (
          <>
            {/* Summary card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Unpaid</Text>
                  <Text style={[styles.summaryValue, { color: '#dc2626' }]}>
                    {data.total_count}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Outstanding</Text>
                  <Text style={[styles.summaryValue, { color: '#dc2626' }]}>
                    ${data.total_remaining.toFixed(0)}
                  </Text>
                </View>
              </View>
              {data.total_partial > 0 && (
                <View style={styles.summarySubRow}>
                  <Text style={styles.summarySubText}>
                    Partial already collected: ${data.total_partial.toFixed(0)}
                  </Text>
                </View>
              )}
            </View>

            {data.total_count === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                <Text style={styles.emptyText}>No unpaid services — everything is settled 🎉</Text>
              </View>
            ) : (
              <>
                {/* Partial payments section */}
                {partialItems.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name="time" size={18} color="#a16207" />
                      <Text style={[styles.sectionTitle, { color: '#a16207' }]}>
                        Partial Payments ({partialItems.length})
                      </Text>
                    </View>
                    {partialItems.map((item) => (
                      <UnpaidCard key={item.service_id} item={item} isPartial />
                    ))}
                  </View>
                )}

                {/* Full unpaid section */}
                {fullUnpaidItems.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name="alert-circle" size={18} color="#dc2626" />
                      <Text style={[styles.sectionTitle, { color: '#dc2626' }]}>
                        Fully Unpaid ({fullUnpaidItems.length})
                      </Text>
                    </View>
                    {fullUnpaidItems.map((item) => (
                      <UnpaidCard key={item.service_id} item={item} />
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function UnpaidCard({ item, isPartial }: { item: UnpaidServiceRow; isPartial?: boolean }) {
  return (
    <View
      style={[
        styles.itemCard,
        isPartial ? styles.itemCardPartial : styles.itemCardUnpaid,
      ]}
    >
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemDescription}>{item.service_description}</Text>
          {item.additional_info ? (
            <Text style={styles.itemAdditional}>{item.additional_info}</Text>
          ) : null}
        </View>
        {isPartial ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.itemAmount, { color: '#a16207' }]}>
              ${item.remaining.toFixed(2)}
            </Text>
            <Text style={styles.itemAmountHint}>remaining</Text>
          </View>
        ) : (
          <Text style={[styles.itemAmount, { color: '#dc2626' }]}>
            ${item.cost.toFixed(2)}
          </Text>
        )}
      </View>

      {isPartial && (
        <View style={styles.partialBreakdown}>
          <Text style={styles.partialBreakdownText}>
            Total ${item.cost.toFixed(2)} · Paid ${item.partial_paid.toFixed(2)}
          </Text>
        </View>
      )}

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
  content: { padding: 16, paddingBottom: 40 },

  refreshButton: {
    flexDirection: 'row',
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  refreshButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },

  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#fecaca' },
  summaryLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  summaryValue: { fontSize: 22, fontWeight: 'bold' },
  summarySubRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  summarySubText: { fontSize: 13, color: '#a16207', fontWeight: '600' },

  section: { marginBottom: 20 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },

  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
  },
  itemCardUnpaid: { borderLeftColor: '#dc2626', backgroundColor: '#fef9f9' },
  itemCardPartial: { borderLeftColor: '#eab308', backgroundColor: '#fffbeb' },

  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  itemInfo: { flex: 1, marginRight: 8 },
  itemDescription: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  itemAdditional: { fontSize: 12, color: '#64748b', marginTop: 2 },
  itemAmount: { fontSize: 17, fontWeight: '900' },
  itemAmountHint: { fontSize: 10, color: '#a16207', fontStyle: 'italic', marginTop: 1 },

  partialBreakdown: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  partialBreakdownText: { fontSize: 12, color: '#92400e', fontWeight: '700' },

  itemDetails: { paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  detailText: { fontSize: 12, color: '#475569', marginLeft: 8 },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: {
    color: '#64748b',
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
