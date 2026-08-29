import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import {
  searchCustomers,
  searchVehiclesByVin,
  searchVehiclesByPlate,
  listInventory,
  listDueOilReminders,
} from '@/src/db/database';
import SyncStatusPill from '@/src/components/SyncStatusPill';
import MassPowerLogo from '@/src/components/MassPowerLogo';

// Module-level flags
let outOfStockReminderShown = false;
let oilReminderShown = false;

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const { height } = useWindowDimensions();

  const isSmallScreen = height < 700;
  const cardPadding = isSmallScreen ? 12 : 16;
  const cardMargin = isSmallScreen ? 8 : 12;
  const buttonPadding = isSmallScreen ? 8 : 12;

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const SECRET_PIN = '3945';

  // Out-of-stock reminder
  useEffect(() => {
    if (outOfStockReminderShown) return;
    outOfStockReminderShown = true;

    const checkOutOfStock = async () => {
      try {
        const items = await listInventory();
        const outOfStock = items.filter((it) => Number(it.item_quantity) === 0);
        if (outOfStock.length === 0) return;

        const preview = outOfStock
          .slice(0, 8)
          .map((it) => `• ${it.item_number} — ${it.item_type}`)
          .join('\n');
        const extra =
          outOfStock.length > 8 ? `\n…and ${outOfStock.length - 8} more` : '';

        setTimeout(() => {
          Alert.alert(
            `Out of Stock (${outOfStock.length})`,
            `The following inventory item${outOfStock.length === 1 ? '' : 's'} ` +
              `${outOfStock.length === 1 ? 'is' : 'are'} at zero quantity:\n\n${preview}${extra}`,
            [
              { text: 'Dismiss', style: 'cancel' },
              {
                text: 'View Inventory',
                onPress: () => router.push('/inventory'),
              },
            ],
            { cancelable: true }
          );
        }, 350);
      } catch (e) {
        console.warn('Out-of-stock check failed:', e);
      }
    };

    checkOutOfStock();
  }, [router]);

  // Oil-change reminders
  useEffect(() => {
    if (oilReminderShown) return;
    
    const checkDueReminders = async () => {
      try {
        const due = await listDueOilReminders();
        
        if (due.length === 0) {
          oilReminderShown = true;
          return;
        }

        const preview = due
          .slice(0, 6)
          .map(
            (r) =>
              `• ${r.customer_name} — ${[r.vehicle_make, r.vehicle_model]
                .filter(Boolean)
                .join(' ') || 'vehicle'}`
          )
          .join('\n');
        const extra = due.length > 6 ? `\n…and ${due.length - 6} more` : '';

        setTimeout(() => {
          Alert.alert(
            `Oil Change Reminders (${due.length})`,
            `${due.length} customer${due.length === 1 ? ' is' : 's are'} due for an oil change:\n\n${preview}${extra}`,
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Open Reminders',
                onPress: () => router.push('/reminders'),
              },
            ],
            { cancelable: true }
          );
          oilReminderShown = true;
        }, 900);
      } catch (e) {
        console.warn('Oil reminder check failed:', e);
        oilReminderShown = true; 
      }
    };

    checkDueReminders();
  }, [router]);

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      Alert.alert('خطأ', 'الرجاء إدخال كلمة للبحث');
      return;
    }

    setLoading(true);
    try {
      let results: any[] = [];

      const mobileResults = await searchCustomers(query);
      if (mobileResults.length > 0) {
        results = mobileResults;
      } else {
        const vinResults = await searchVehiclesByVin(query);
        if (vinResults.length > 0) {
          results = vinResults;
        } else {
          const plateResults = await searchVehiclesByPlate(query);
          if (plateResults.length > 0) {
            results = plateResults;
          }
        }
      }

      if (results.length === 0) {
        Alert.alert(
          'لا توجد نتائج',
          'هل تريد إنشاء عميل جديد؟',
          [
            { text: 'إلغاء', style: 'cancel' },
            { text: 'إنشاء', onPress: () => router.push('/add-customer') },
          ]
        );
      } else {
        router.push({
          pathname: '/search-results',
          params: { results: JSON.stringify(results) },
        });
      }
    } catch (error: any) {
      Alert.alert('خطأ', error?.message || 'فشل البحث. الرجاء المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackendPress = () => {
    setPinModalVisible(true);
  };

  const handlePinAuth = () => {
    if (pinInput === SECRET_PIN) {
      setPinModalVisible(false);
      setPinInput('');
      router.push('/management');
    } else {
      Alert.alert('خطأ', 'رمز PIN غير صحيح. الرجاء المحاولة مرة أخرى.');
      setPinInput('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <MassPowerLogo size={75} />
            <Text style={styles.headerSubtitle}>Auto Services</Text>
          </View>
          <View style={{ marginTop: 6 }}>
            <SyncStatusPill />
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.searchCard, { padding: cardPadding, marginBottom: cardMargin }]}>
            <View style={styles.searchHeader}>
              <Ionicons name="search-outline" size={isSmallScreen ? 18 : 22} color="#00d4ff" />
              <Text style={styles.searchTitle}>ابحث عن عميل</Text>
            </View>
            <Text style={styles.searchHint}>
              أدخل رقم الموبايل، رقم الهيكل، أو رقم اللوحة
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="موبايل • هيكل • لوحة"
                placeholderTextColor="#64748b"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="characters"
                keyboardType="phone-pad"
                testID="unified-search-input"
              />
            </View>
            <TouchableOpacity
              style={[styles.searchButton, loading && styles.searchButtonDisabled]}
              onPress={handleSearch}
              disabled={loading}
              testID="unified-search-button"
            >
              <Ionicons name="search" size={isSmallScreen ? 14 : 18} color="#fff" />
              <Text style={styles.searchButtonText}>بحث</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.addCustomerButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/add-customer')}
            testID="add-customer-button"
          >
            <Ionicons name="person-add-outline" size={isSmallScreen ? 14 : 18} color="#39ff14" />
            <Text style={styles.addCustomerButtonText}>إضافة عميل جديد</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.walkinButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/quick-walkin')}
            testID="quick-walkin-button"
          >
            <Ionicons name="walk-outline" size={isSmallScreen ? 14 : 18} color="#ffff00" />
            <Text style={styles.walkinButtonText}>بيع سريع</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.orderButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/order-list')}
          >
            <Ionicons name="list-outline" size={isSmallScreen ? 14 : 18} color="#ff00ff" />
            <Text style={styles.orderButtonText}>قائمة مشتريات</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.managementButton, { paddingVertical: buttonPadding }]}
            onPress={handleBackendPress}
            testID="management-button"
          >
            <Ionicons name="construct-outline" size={isSmallScreen ? 14 : 18} color="#ff1493" />
            <Text style={styles.managementButtonText}>الإدارة و الاعدادات</Text>
          </TouchableOpacity>

          <Text style={styles.buildStamp} testID="build-timestamp">
            {Updates.createdAt
              ? `آخر تحديث: ${new Date(Updates.createdAt).toLocaleString()}`
              : 'وضع التطوير المحلي'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={pinModalVisible}
        onRequestClose={() => setPinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>أدخل رمز PIN</Text>
            <Text style={styles.modalSubtitle}>أدخل رمز الأمان المكوّن من 4 أرقام</Text>

            <TextInput
              style={styles.pinInput}
              placeholder="****"
              placeholderTextColor="#475569"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry={true}
              value={pinInput}
              onChangeText={setPinInput}
              autoFocus={true}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPinModalVisible(false)}>
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handlePinAuth}>
                <Text style={styles.modalConfirmText}>فتح</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f16' },
  keyboardView: { flex: 1 },
  
  header: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#151c26',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  
  searchCard: {
    backgroundColor: '#1a2332',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d3a4f',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  searchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 10,
  },
  searchHint: {
    fontSize: 11,
    color: '#cbd5e1',
    marginBottom: 12,
    marginLeft: 32,
  },
  inputContainer: {
    backgroundColor: '#0f141c',
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d3a4f',
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'right',
  },
  searchButton: {
    backgroundColor: '#0052cc',
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  
  addCustomerButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#00e5ff', // KEPT ORIGINAL
    backgroundColor: '#1a2332',
    marginTop: 10,
  },
  addCustomerButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  walkinButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#1a2332',
    borderWidth: 1.5,
    borderColor: '#ff5722', // KEPT ORIGINAL
    marginTop: 10,
  },
  walkinButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  orderButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#1a2332',
    borderWidth: 1.5,
    borderColor: '#00e676', // KEPT ORIGINAL
    marginTop: 10,
  },
  orderButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  managementButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#475569', // KEPT ORIGINAL
    marginTop: 10,
  },
  managementButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  
  buildStamp: {
    marginTop: 20,
    marginBottom: 6,
    textAlign: 'center',
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 22, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#1a2332',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2d3a4f',
    padding: 22,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 18,
  },
  pinInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#00e5ff', // KEPT ORIGINAL
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    color: '#ffffff',
    marginBottom: 20,
    backgroundColor: '#0f141c',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2d3a4f',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0052cc',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
