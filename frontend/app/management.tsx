import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getReport, getWeeklyCashSummary, saveWeeklyWages } from '../src/db/database';
import { pushToCloud, pullFromCloud } from '../src/utils/dbSync';
import { getBroadcastContacts, openWhatsAppBroadcast } from '../src/utils/whatsappHelper';

export default function ManagementScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [wagesInput, setWagesInput] = useState('');

  // WhatsApp Broadcast State
  const [broadcastVisible, setBroadcastVisible] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [contacts, setContacts] = useState<{ name: string; phone: string }[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  const handleSaveWages = async () => {
    const amount = parseFloat(wagesInput);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Error', 'Please enter a valid wage amount.');
      return;
    }
    try {
      await saveWeeklyWages(amount);
      setWagesInput('');
      Alert.alert('Success', 'Wages saved!');
    } catch (e) {
      Alert.alert('Error', 'Failed to save wages.');
    }
  };

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
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5b21b6" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        {/* Wages Input */}
        <View style={styles.wagesBox}>
          <Text style={styles.wagesTitle}>Weekly Wages Paid</Text>
          <View style={styles.wagesInputRow}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.wagesInput}
              placeholder="0.00"
              value={wagesInput}
              onChangeText={setWagesInput}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={styles.saveWagesBtn} onPress={handleSaveWages}>
              <Text style={styles.saveWagesBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* WhatsApp Broadcast Button */}
        <TouchableOpacity style={styles.whatsappButton} onPress={openBroadcast}>
          <Ionicons name="logo-whatsapp" size={24} color="#fff" />
          <Text style={styles.whatsappButtonText}>Send Bulk WhatsApp</Text>
        </TouchableOpacity>

        {/* 7-Button Grid */}
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
            <Text style={styles.dashTitle}>Supplier Debts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dashCard, styles.warrantyCard]} onPress={() => router.push('/warranty-stickers')}>
            <Ionicons name="shield-checkmark-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Warranty Stickers</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dashboardGrid}>
          <TouchableOpacity style={[styles.dashCard, styles.catPrinterCard]} onPress={() => router.push('/cat-printer')}>
            <Ionicons name="print-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Cat Printer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dashCard, styles.inventoryCard]} onPress={() => router.push('/inventory')}>
            <Ionicons name="cube-outline" size={32} color="#fff" />
            <Text style={styles.dashTitle}>Inventory</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dashboardGrid}>
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

  wagesBox: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  wagesTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  wagesInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wagesInput: {
    flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1,
    borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
    color: '#1e293b',
  },
  currencySymbol: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  saveWagesBtn: {
    backgroundColor: '#10b981', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  saveWagesBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

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
  reportCard: { backgroundColor: '#10b981' },
  settingsCard: { backgroundColor: '#2563eb' },
  supplierDebtCard: { backgroundColor: '#8b5cf6' },
  warrantyCard: { backgroundColor: '#d97706' },
  catPrinterCard: { backgroundColor: '#0ea5e9' },
  inventoryCard: { backgroundColor: '#0f766e' },
  stickerCard: { backgroundColor: '#9333ea' },

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
