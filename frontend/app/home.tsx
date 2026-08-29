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
  const cardPadding = isSmallScreen ? 14 : 20;
  const cardMargin = isSmallScreen ? 10 : 16;
  const buttonPadding = isSmallScreen ? 10 : 14;

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
            <MassPowerLogo size={55} />
            <Text style={styles.headerSubtitle}>Auto Services</Text>
          </View>
          <View style={{ marginTop: 8 }}>
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
              <Ionicons name="search-outline" size={isSmallScreen ? 20 : 24} color="#94a3b8" />
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
              <Ionicons name="search" size={isSmallScreen ? 16 : 20} color="#fff" />
              <Text style={styles.searchButtonText}>بحث</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.addCustomerButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/add-customer')}
            testID="add-customer-button"
          >
            <Ionicons name="person-add-outline" size={isSmallScreen ? 16 : 20} color="#94a3b8" />
            <Text style={styles.addCustomerButtonText}>إضافة عميل جديد</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.walkinButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/quick-walkin')}
            testID="quick-walkin-button"
          >
            <Ionicons name="walk-outline" size={isSmallScreen ? 16 : 20} color="#94a3b8" />
            <Text style={styles.walkinButtonText}>بيع سريع</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.orderButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/order-list')}
          >
            <Ionicons name="list-outline" size={isSmallScreen ? 16 : 20} color="#94a3b8" />
            <Text style={styles.orderButtonText}>قائمة مشتريات</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.managementButton, { paddingVertical: buttonPadding }]}
            onPress={handleBackendPress}
            testID="management-button"
          >
            <Ionicons name="construct-outline" size={isSmallScreen ? 16 : 20} color="#94a3b8" />
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
    paddingVertical: 20,
    backgroundColor: '#151c26',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 },
  
  searchCard: {
    backgroundColor: '#1a2332',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d3a4f',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  searchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 12,
  },
  searchHint: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 14,
    marginLeft: 36,
  },
  inputContainer: {
    backgroundColor: '#0f141c',
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2d3a4f',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'right',
  },
  searchButton: {
    backgroundColor: '#2d3a4f',
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  
  addCustomerButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2d3a4f',
    backgroundColor: '#1a2332',
    marginTop: 10,
  },
  addCustomerButtonText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  walkinButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#1a2332',
    borderWidth: 2,
    borderColor: '#2d3a4f',
    marginTop: 12,
  },
  walkinButtonText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  orderButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#1a2332',
    borderWidth: 2,
    borderColor: '#2d3a4f',
    marginTop: 12,
  },
  orderButtonText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  managementButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#2d3a4f',
    marginTop: 12,
  },
  managementButtonText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  
  buildStamp: {
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 13,
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2d3a4f',
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 20,
  },
  pinInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#2d3a4f',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 10,
    color: '#ffffff',
    marginBottom: 24,
    backgroundColor: '#0f141c',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2d3a4f',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2d3a4f',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
