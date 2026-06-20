import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  listDueOilReminders,
  dismissReminder,
  OilReminderDue,
} from '../src/db/database';
import { loadSettings, type AppSettings } from '../src/utils/settings';
import {
  openWhatsAppReminder,
  formatDueDate,
  sanitizePhoneForWhatsApp,
} from '../src/utils/whatsapp';

export default function RemindersScreen() {
  const router = useRouter();
  const [items, setItems] = useState<OilReminderDue[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [list, s] = await Promise.all([listDueOilReminders(), loadSettings()]);
    setItems(list);
    setSettings(s);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const handleSend = async (r: OilReminderDue) => {
    if (!settings) return;
    const res = await openWhatsAppReminder(r, {
      garageName: settings.garageName,
      garagePhone: settings.garagePhone,
    });
    if (!res.ok) {
      Alert.alert('WhatsApp', res.message || 'Could not open WhatsApp.');
      return;
    }
    // Ask whether to mark this reminder done
    setTimeout(() => {
      Alert.alert(
        'Reminder Sent?',
        `Mark the reminder for ${r.customer_name} as done so it doesn't appear again?`,
        [
          { text: 'Keep for now', style: 'cancel' },
          {
            text: 'Yes, mark done',
            onPress: async () => {
              await dismissReminder(r.service_id);
              await load();
            },
          },
        ]
      );
    }, 800);
  };

  const handleDismiss = (r: OilReminderDue) => {
    Alert.alert(
      'Dismiss Reminder?',
      `Permanently hide the oil change reminder for ${r.customer_name} (${
        [r.vehicle_make, r.vehicle_model].filter(Boolean).join(' ')
      })?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: async () => {
            await dismissReminder(r.service_id);
            await load();
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: OilReminderDue }) => {
    const phone = sanitizePhoneForWhatsApp(item.customer_mobile);
    const carBits = [item.vehicle_year, item.vehicle_make, item.vehicle_model]
      .filter(Boolean)
      .join(' ');
    const overdueLabel =
      item.days_overdue === 0
        ? 'Due today'
        : `Overdue by ${item.days_overdue} day${item.days_overdue === 1 ? '' : 's'}`;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.customer}>{item.customer_name}</Text>
            <Text style={styles.phone}>
              {item.customer_mobile || 'No phone number'}
            </Text>
          </View>
          <View
            style={[
              styles.badge,
              item.days_overdue === 0 ? styles.badgeDue : styles.badgeOver,
            ]}
          >
            <Text style={styles.badgeText}>{overdueLabel}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Ionicons name="car-sport" size={16} color="#475569" />
          <Text style={styles.rowText}>{carBits || '—'}</Text>
        </View>
        {!!item.vehicle_plate && (
          <View style={styles.row}>
            <Ionicons name="barcode-outline" size={16} color="#475569" />
            <Text style={styles.rowText}>Plate: {item.vehicle_plate}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Ionicons name="calendar" size={16} color="#475569" />
          <Text style={styles.rowText}>
            Due: {formatDueDate(item.next_service_date)}
          </Text>
        </View>
        {item.next_service_mileage ? (
          <View style={styles.row}>
            <Ionicons name="speedometer" size={16} color="#475569" />
            <Text style={styles.rowText}>
              Mileage: {item.next_service_mileage.toLocaleString()} km
            </Text>
          </View>
        ) : null}
        {item.oil_grade ? (
          <View style={styles.row}>
            <Ionicons name="water" size={16} color="#475569" />
            <Text style={styles.rowText}>Oil: {item.oil_grade}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.btn,
              styles.btnWhatsApp,
              !phone && styles.btnDisabled,
            ]}
            onPress={() => handleSend(item)}
            disabled={!phone}
            activeOpacity={0.85}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.btnText}>Send WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnDismiss]}
            onPress={() => handleDismiss(item)}
            activeOpacity={0.85}
          >
            <Ionicons name="close-circle" size={20} color="#dc2626" />
            <Text style={[styles.btnText, { color: '#dc2626' }]}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>Oil Change Reminders</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-done-circle" size={64} color="#16a34a" />
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptySub}>No oil change reminders are due.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.service_id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptySub: { marginTop: 4, fontSize: 14, color: '#64748b' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  customer: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  phone: { fontSize: 13, color: '#64748b', marginTop: 2 },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  badgeDue: { backgroundColor: '#fef3c7' },
  badgeOver: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#92400e' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  rowText: { fontSize: 13, color: '#334155' },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnWhatsApp: { backgroundColor: '#25D366' },
  btnDismiss: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  btnDisabled: { backgroundColor: '#94a3b8' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
