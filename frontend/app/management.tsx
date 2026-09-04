import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getReport, getWeeklyCashSummary } from '../src/db/database';
import { pushToCloud, pullFromCloud } from '../src/utils/dbSync';
import { getBroadcastContacts, openWhatsAppBroadcast } from '../src/utils/whatsappHelper';

export default function ManagementScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  // WhatsApp Broadcast State
  const [broadcastVisible, setBroadcastVisible] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [contacts, setContacts] = useState<{ name: string; phone: string }[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  // ============================================================
  // SYNC CONFIGURATION
  // ============================================================
  // ⭐ CHANGE THIS VALUE TO ADJUST SYNC INTERVAL
  // Value is in milliseconds:
  // 1 minute  = 60000
  // 5 minutes = 300000
  // 10 minutes = 600000
  // 15 minutes = 900000
  // 20 minutes = 1200000
  // 25 minutes = 1500000  <-- CURRENT VALUE
  // 30 minutes = 1800000
  // 1 hour    = 3600000
  // ============================================================
  const SYNC_INTERVAL_MS = 1500000; // 25 minutes
  // ============================================================

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    const loadFinances = async () => {
      try {
        setLoading(true);
        await getWeeklyCashSummary();
      } catch (e) {
        console.warn("Failed to load finances:", e);
      } finally {
        setLoading(false);
      }
    };
    loadFinances();
  }, []);

  // ============================================================
  // PERIODIC SYNC SETUP
  // ============================================================
  useEffect(() => {
    isMounted.current = true;

    // Initial sync when component mounts (optional - remove if you don't want auto-sync on load)
    // You can uncomment this if you want initial sync
    // handlePull();

    // ============================================================
    // PERIODIC SYNC EVERY SYNC_INTERVAL_MS
    // ============================================================
    intervalRef.current = setInterval(() => {
      if (isMounted.current) {
        console.log('🔄 Periodic sync running...');
        // Silently sync in background
        pullFromCloud().catch(() => {});
      }
    }, SYNC_INTERVAL_MS);
    // ============================================================

    // Sync when app comes back to foreground
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isMounted.current) {
        console.log('📱 App came to foreground, syncing...');
        pullFromCloud().catch(() => {});
      }
    });

    // Cleanup
    return () => {
      isMounted.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      subscription.remove();
    };
  }, []);
  // ============================================================

  const handlePush = async () => {
    try {
      Alert.alert('Syncing', 'Pushing local data to cloud...');
      await pushToCloud();
      Alert.alert('Success', 'Push completed!');
    } catch (e: any) {
      Alert.alert('Error', 'Push failed: ' + e.message);
    }
  };

  const handlePull = async () => {
    try {
      Alert.alert('Syncing', 'Pulling cloud data to device...');
      await pullFromCloud();
      Alert.alert('Success', 'Pull completed!');
    } catch (e: any) {
      Alert.alert('Error', 'Pull failed: ' + e.message);
    }
  };

  const openBroadcast = async () => {
    setBroadcastVisible(true);
    setContactsLoading(true);
    try {
      const list = await getBroadcastContacts();
      setContacts(list);
    } catch (e) {
      Alert.alert('Error', 'Failed to load customer contacts.');
    } finally {
      setContactsLoading(false);
    }
  };

  const confirmSend = (contact: { name: string; phone: string }) => {
    if (!broadcastMessage.trim()) {
      Alert.alert('Error', 'Please type a message first.');
      return;
    }
    Alert.alert(
      'Send WhatsApp?',
      `Send message to ${contact.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            const res = await openWhatsAppBroadcast(contact.phone, broadcastMessage);
            if (!res.ok) {
              Alert.alert('Error', res.message || 'Failed to open WhatsApp.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Backend Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Cloud Sync */}
        <View style={styles.syncCard}>
          <Text style={styles.syncTitle}>Cloud Sync</Text>
          <View style={styles.syncButtonsRow}>
            <TouchableOpacity style={styles.pushBtn} onPress={handlePush}>
              <Ionicons name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.syncBtnText}>Push</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pullBtn} onPress={handlePull}>
              <Ionicons name="cloud-download" size={20} color="#fff" />
              <Text style={styles.syncBtnText}>Pull</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.syncHint}>Push uploads data. Pull merges cloud copy.</Text>
          <Text style={styles.syncHint}>
            Auto-sync every {SYNC_INTERVAL_MS / 60000} minutes
          </Text>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5b21b6" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        {/* WhatsApp Broadcast Button */}
        <TouchableOpacity style={styles.whatsappButton} onPress={openBroadcast}>
          <Ionicons name="logo-whatsapp" size={24} color="#fff" />
          <Text style={styles.whatsappButtonText}>Send Bulk WhatsApp</Text>
        </TouchableOpacity>

        {/* 8-Button Grid */}
        <View style={styles.dashboardGrid}>
          <TouchableOpacity style={[styles.dashCard, styles.reportCard]} onPress={() => router.push('/report')}>
            <Ionicons name="document-text-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dashCard, styles.settingsCard]} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Settings</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dashboardGrid}>
          <TouchableOpacity style={[styles.dashCard, styles.supplierDebtCard]} onPress={() => router.push('/supplier-debt')}>
            <Ionicons name="cash-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Cash Flow</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dashCard, styles.reminderCard]} onPress={() => router.push('/reminders')}>
            <Ionicons name="notifications-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Reminders</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dashboardGrid}>
          <TouchableOpacity style={[styles.dashCard, styles.warrantyCard]} onPress={() => router.push('/warranty-stickers')}>
            <Ionicons name="shield-checkmark-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Warranty Stickers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dashCard, styles.catPrinterCard]} onPress={() => router.push('/cat-printer')}>
            <Ionicons name="print-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Cat Printer</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dashboardGrid}>
          <TouchableOpacity style={[styles.dashCard, styles.inventoryCard]} onPress={() => router.push('/inventory')}>
            <Ionicons name="cube-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Inventory</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dashCard, styles.stickerCard]} onPress={() => router.push('/price-stickers')}>
            <Ionicons name="pricetag-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Price Stickers</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* WhatsApp Broadcast Modal */}
      <Modal visible={broadcastVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
              <Text style={styles.modalTitle}>Send Bulk WhatsApp</Text>
              <TouchableOpacity onPress={() => setBroadcastVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.messageInput}
              placeholder="Type your offer/message here..."
              multiline
              value={broadcastMessage}
              onChangeText={setBroadcastMessage}
            />

            <Text style={styles.contactsLabel}>Customers ({contacts.length})</Text>
            {contactsLoading ? (
              <ActivityIndicator color="#25D366" style={{ marginVertical: 20 }} />
            ) : (
              <FlatList
                data={contacts}
                keyExtractor={(item) => item.phone}
                style={{ maxHeight: 300 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.contactRow} onPress={() => confirmSend(item)}>
                    <Ionicons name="person-circle-outline" size={24} color="#25D366" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactName}>{item.name}</Text>
                      <Text style={styles.contactPhone}>{item.phone}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#64748b" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },
  syncCard: {
    backgroundColor: '#0f172a', borderRadius: 16, padding: 16, marginBottom: 16,
  },
  syncTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  syncButtonsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  pushBtn: {
    flex: 1, backgroundColor: '#22c55e', paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  pullBtn: {
    flex: 1, backgroundColor: '#3b82f6', paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  syncBtnText: { color: '#fff', fontWeight: '700', marginLeft: 6 },
  syncHint: { color: '#94a3b8', fontSize: 12, marginTop: 6 },
  loadingContainer: { alignItems: 'center', padding: 20, marginBottom: 16 },
  loadingText: { color: '#64748b', marginTop: 8 },

  whatsappButton: {
    backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  whatsappButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },

  dashboardGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  dashCard: {
    flex: 1, borderRadius: 16, padding: 20, alignItems: 'center',
    justifyContent: 'center', height: 100,
  },
  dashTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 8, textAlign: 'center' },

  // New varied colors (all different)
  reportCard: { backgroundColor: '#10b981' },
  settingsCard: { backgroundColor: '#2563eb' },
  supplierDebtCard: { backgroundColor: '#8b5cf6' },
  reminderCard: { backgroundColor: '#f97316' },  // Orange
  warrantyCard: { backgroundColor: '#06b6d4' },  // Cyan
  catPrinterCard: { backgroundColor: '#8b5cf6' },
  inventoryCard: { backgroundColor: '#059669' },
  stickerCard: { backgroundColor: '#db2777' },   // Pink

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', flex: 1, marginLeft: 8 },
  messageInput: {
    backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
    padding: 16, fontSize: 16, minHeight: 100, textAlignVertical: 'top', marginBottom: 16,
  },
  contactsLabel: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  contactName: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  contactPhone: { fontSize: 13, color: '#64748b', marginTop: 2 },
});
