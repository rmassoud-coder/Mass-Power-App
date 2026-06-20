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
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  searchCustomers,
  searchVehiclesByVin,
  searchVehiclesByPlate,
  listInventory,
  listDueOilReminders,
} from '../src/db/database';

// Module-level flag so the out-of-stock + reminder alerts only trigger once per app session
let outOfStockReminderShown = false;
let oilReminderShown = false;

export default function HomeScreen() {
  const [mobileNumber, setMobileNumber] = useState('');
  const [vinNumber, setVinNumber] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const { height } = useWindowDimensions();

  // Out-of-stock reminder — runs once per app session after the home screen loads
  useEffect(() => {
    if (outOfStockReminderShown) return;
    outOfStockReminderShown = true;

    const checkOutOfStock = async () => {
      try {
        const items = await listInventory();
        const outOfStock = items.filter((it) => Number(it.item_quantity) === 0);
        if (outOfStock.length === 0) return;

        // Build a readable list (cap at first 8 to keep the alert tidy)
        const preview = outOfStock
          .slice(0, 8)
          .map((it) => `• ${it.item_number} — ${it.item_type}`)
          .join('\n');
        const extra =
          outOfStock.length > 8 ? `\n…and ${outOfStock.length - 8} more` : '';

        // Small delay so the alert appears after the home screen settles
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
        // Silently ignore — reminder is non-critical
        console.warn('Out-of-stock check failed:', e);
      }
    };

    checkOutOfStock();
  }, [router]);

  // Oil-change WhatsApp reminders — fire once per app session after launch
  useEffect(() => {
    if (oilReminderShown) return;
    oilReminderShown = true;

    const checkDueReminders = async () => {
      try {
        const due = await listDueOilReminders();
        if (due.length === 0) return;

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

        // Give the inventory alert (if any) a chance to be dismissed first
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
        }, 900);
      } catch (e) {
        console.warn('Oil reminder check failed:', e);
      }
    };

    checkDueReminders();
  }, [router]);

  // Responsive sizing
  const isSmallScreen = height < 700;
  const cardPadding = isSmallScreen ? 14 : 20;
  const cardMargin = isSmallScreen ? 10 : 16;
  const sectionGap = isSmallScreen ? 8 : 16;
  const titleFontSize = isSmallScreen ? 14 : 16;
  const buttonPadding = isSmallScreen ? 10 : 14;

  const handleSearch = async (searchType: 'mobile' | 'vin' | 'plate', query: string) => {
    if (!query.trim()) {
      Alert.alert('Error', 'Please enter a search term');
      return;
    }

    setLoading(true);
    try {
      let results: any[] = [];
      if (searchType === 'mobile') {
        results = await searchCustomers(query.trim());
      } else if (searchType === 'vin') {
        results = await searchVehiclesByVin(query.trim());
      } else if (searchType === 'plate') {
        results = await searchVehiclesByPlate(query.trim());
      }

      if (results.length === 0) {
        Alert.alert(
          'No Results Found',
          'Would you like to create a new customer?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Create', onPress: () => router.push('/add-customer') },
          ]
        );
      } else {
        router.push({
          pathname: '/search-results',
          params: { results: JSON.stringify(results) },
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to search. Please try again.');
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
          <View style={styles.headerLeft}>
            <Image
              source={require('../assets/images/mass-power-logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.headerTitle}>Mass Power</Text>
              <Text style={styles.headerSubtitle}>Auto Services</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.headerAddButton}
            onPress={() => router.push('/add-customer')}
            testID="header-add-customer-button"
          >
            <Ionicons name="person-add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Search by Mobile Number */}
          <View style={[styles.searchCard, { padding: cardPadding, marginBottom: cardMargin }]}>
            <View style={[styles.searchHeader, { marginBottom: sectionGap }]}>
              <Ionicons name="call-outline" size={isSmallScreen ? 20 : 24} color="#2563eb" />
              <Text style={[styles.searchTitle, { fontSize: titleFontSize }]}>Search by Mobile Number</Text>
            </View>
            <View style={[styles.inputContainer, { marginBottom: sectionGap }]}>
              <TextInput
                style={[styles.input, { paddingVertical: isSmallScreen ? 8 : 12 }]}
                placeholder="Enter mobile number"
                value={mobileNumber}
                onChangeText={setMobileNumber}
                keyboardType="phone-pad"
                testID="mobile-search-input"
              />
            </View>
            <TouchableOpacity
              style={[styles.searchButton, { paddingVertical: buttonPadding }, loading && styles.searchButtonDisabled]}
              onPress={() => handleSearch('mobile', mobileNumber)}
              disabled={loading}
              testID="mobile-search-button"
            >
              <Ionicons name="search" size={isSmallScreen ? 16 : 20} color="#fff" />
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>

          {/* Search by VIN Number */}
          <View style={[styles.searchCard, { padding: cardPadding, marginBottom: cardMargin }]}>
            <View style={[styles.searchHeader, { marginBottom: sectionGap }]}>
              <Ionicons name="barcode-outline" size={isSmallScreen ? 20 : 24} color="#2563eb" />
              <Text style={[styles.searchTitle, { fontSize: titleFontSize }]}>Search by VIN Number</Text>
            </View>
            <View style={[styles.inputContainer, { marginBottom: sectionGap }]}>
              <TextInput
                style={[styles.input, { paddingVertical: isSmallScreen ? 8 : 12 }]}
                placeholder="Enter VIN number"
                value={vinNumber}
                onChangeText={setVinNumber}
                autoCapitalize="characters"
                testID="vin-search-input"
              />
            </View>
            <TouchableOpacity
              style={[styles.searchButton, { paddingVertical: buttonPadding }, loading && styles.searchButtonDisabled]}
              onPress={() => handleSearch('vin', vinNumber)}
              disabled={loading}
              testID="vin-search-button"
            >
              <Ionicons name="search" size={isSmallScreen ? 16 : 20} color="#fff" />
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>

          {/* Search by Plate Number */}
          <View style={[styles.searchCard, { padding: cardPadding, marginBottom: cardMargin }]}>
            <View style={[styles.searchHeader, { marginBottom: sectionGap }]}>
              <Ionicons name="car-outline" size={isSmallScreen ? 20 : 24} color="#2563eb" />
              <Text style={[styles.searchTitle, { fontSize: titleFontSize }]}>Search by Plate Number</Text>
            </View>
            <View style={[styles.inputContainer, { marginBottom: sectionGap }]}>
              <TextInput
                style={[styles.input, { paddingVertical: isSmallScreen ? 8 : 12 }]}
                placeholder="Enter plate number"
                value={plateNumber}
                onChangeText={setPlateNumber}
                autoCapitalize="characters"
                testID="plate-search-input"
              />
            </View>
            <TouchableOpacity
              style={[styles.searchButton, { paddingVertical: buttonPadding }, loading && styles.searchButtonDisabled]}
              onPress={() => handleSearch('plate', plateNumber)}
              disabled={loading}
              testID="plate-search-button"
            >
              <Ionicons name="search" size={isSmallScreen ? 16 : 20} color="#fff" />
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.addCustomerButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/add-customer')}
            testID="add-customer-button"
          >
            <Ionicons name="person-add-outline" size={isSmallScreen ? 16 : 20} color="#2563eb" />
            <Text style={styles.addCustomerButtonText}>Add New Customer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reportButton, styles.remindersButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/reminders')}
            testID="reminders-button"
          >
            <Ionicons name="logo-whatsapp" size={isSmallScreen ? 16 : 20} color="#fff" />
            <Text style={styles.reportButtonText}>Oil Change Reminders</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reportButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/report')}
            testID="report-button"
          >
            <Ionicons name="document-text-outline" size={isSmallScreen ? 16 : 20} color="#fff" />
            <Text style={styles.reportButtonText}>View Services Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.backupButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/backup')}
            testID="backup-button"
          >
            <Ionicons name="cloud-download-outline" size={isSmallScreen ? 16 : 20} color="#1e293b" />
            <Text style={styles.backupButtonText}>Backup & Restore</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.backupButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/settings')}
            testID="settings-button"
          >
            <Ionicons name="settings-outline" size={isSmallScreen ? 16 : 20} color="#1e293b" />
            <Text style={styles.backupButtonText}>Settings</Text>
          </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerLogo: {
    width: 52,
    height: 52,
    marginRight: 12,
    borderRadius: 26,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  searchCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 12,
  },
  inputContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  searchButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  addCustomerButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2563eb',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  addCustomerButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  reportButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#10b981',
    marginTop: 12,
  },
  reportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  backupButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  backupButtonText: {
    color: '#1e293b',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  remindersButton: {
    backgroundColor: '#25D366',
  },
});
