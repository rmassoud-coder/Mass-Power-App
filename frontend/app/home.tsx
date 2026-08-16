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
import * as Updates from 'expo-updates';
import {
  searchCustomers,
  searchVehiclesByVin,
  searchVehiclesByPlate,
  listInventory,
  listDueOilReminders,
} from '@/src/db/database';
import SyncStatusPill from '@/src/components/SyncStatusPill';

// Module-level flag so the out-of-stock + reminder alerts only trigger once per app session
let outOfStockReminderShown = false;
let oilReminderShown = false;

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const { height } = useWindowDimensions();

  // Responsive sizing
  const isSmallScreen = height < 700;
  const cardPadding = isSmallScreen ? 14 : 20;
  const cardMargin = isSmallScreen ? 10 : 16;
  const buttonPadding = isSmallScreen ? 10 : 14;

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
        
        // If empty, we stop here and mark it as done
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
        
        // ⚠️ CRITICAL FIX: If an error happens, we MUST mark this as true
        // so the app NEVER retries this in an infinite loop.
        oilReminderShown = true; 
      }
    };

    checkDueReminders();
  }, [router]);

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      Alert.alert('Error', 'Please enter a search term');
      return;
    }

    setLoading(true);
    try {
      let results: any[] = [];

      // Try searching by mobile
      const mobileResults = await searchCustomers(query);
      if (mobileResults.length > 0) {
        results = mobileResults;
      } else {
        // Try searching by VIN
        const vinResults = await searchVehiclesByVin(query);
        if (vinResults.length > 0) {
          results = vinResults;
        } else {
          // Try searching by Plate
          const plateResults = await searchVehiclesByPlate(query);
          if (plateResults.length > 0) {
            results = plateResults;
          }
        }
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

  // 🔥 Safety function kept inside the file just in case you ever need it again
  // 🔥 DIRECT SQL NUKE (No imports needed)
const handleNukeDatabase = async () => {
  Alert.alert(
    '⚠️ DANGER',
    'This will wipe corrupted supplier data. Your customers and revenue are SAFE.\n\nProceed?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'NUKE SUPPLIER DATA',
        style: 'destructive',
        onPress: async () => {
          try {
            // 1. Open the database directly
            const SQLite = require('expo-sqlite');
            const db = await SQLite.openDatabaseAsync('mass_power.db');
            
            // 2. Drop and recreate only the bad tables
            await db.execAsync(`
              PRAGMA foreign_keys = OFF;
              DROP TABLE IF EXISTS supplier_balances;
              DROP TABLE IF EXISTS wages_paid;
              PRAGMA foreign_keys = ON;

              CREATE TABLE IF NOT EXISTS supplier_balances (
                supplier_id TEXT PRIMARY KEY,
                balance REAL NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
              );
              
              CREATE TABLE IF NOT EXISTS wages_paid (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                amount REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
              );
            `);
            
            Alert.alert('Success', 'Corrupted supplier data wiped. Please RESTART the app.');
          } catch (error) {
            Alert.alert('Error', 'Failed to wipe data: ' + (error as any).message);
          }
        }
      }
    ]
  );
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
              <View style={{ marginTop: 4 }}>
                <SyncStatusPill />
              </View>
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
          {/* Unified Search - works with mobile, VIN, or plate */}
          <View style={[styles.searchCard, { padding: cardPadding, marginBottom: cardMargin }]}>
            <View style={styles.searchHeader}>
              <Ionicons name="search-outline" size={isSmallScreen ? 20 : 24} color="#2563eb" />
              <Text style={styles.searchTitle}>Search Customer</Text>
            </View>
            <Text style={styles.searchHint}>
              Enter mobile number, VIN, or plate number
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Mobile • VIN • Plate"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="characters"
                keyboardType="phone-pad" // 🔥 Set to number pad by default
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
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>

          {/* Add New Customer */}
          <TouchableOpacity
            style={[styles.addCustomerButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/add-customer')}
            testID="add-customer-button"
          >
            <Ionicons name="person-add-outline" size={isSmallScreen ? 16 : 20} color="#2563eb" />
            <Text style={styles.addCustomerButtonText}>Add New Customer</Text>
          </TouchableOpacity>

          {/* Quick Walk-in Button */}
          <TouchableOpacity
            style={[styles.walkinButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/quick-walkin')}
            testID="quick-walkin-button"
          >
            <Ionicons name="walk-outline" size={isSmallScreen ? 16 : 20} color="#fff" />
            <Text style={styles.walkinButtonText}>Quick Walk-in</Text>
          </TouchableOpacity>

          {/* Supplier Debts Button - NEW */}
          <TouchableOpacity
            style={[styles.debtButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/supplier-debt')}
          >
            <Ionicons name="receipt-outline" size={isSmallScreen ? 16 : 20} color="#fff" />
            <Text style={styles.debtButtonText}>Supplier Debts</Text>
          </TouchableOpacity>

          {/* Backend Management */}
          <TouchableOpacity
            style={[styles.reportButton, styles.managementButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/management')}
            testID="management-button"
          >
            <Ionicons name="construct-outline" size={isSmallScreen ? 16 : 20} color="#fff" />
            <Text style={styles.reportButtonText}>Backend Management</Text>
          </TouchableOpacity>

          {/* Build timestamp */}
          <Text style={styles.buildStamp} testID="build-timestamp">
            {Updates.createdAt
              ? `Last update: ${new Date(Updates.createdAt).toLocaleString()}`
              : 'Local Dev Mode'}
          </Text>

         /* {
          <TouchableOpacity
            style={styles.nukeButton}
            onPress={handleNukeDatabase}
          >
            <Ionicons name="trash-bin" size={20} color="#fff" />
            <Text style={styles.nukeButtonText}>🗑️ NUKE 34MB DATABASE</Text>
          </TouchableOpacity>
          } */

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
    paddingBottom: 30,
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
    marginBottom: 4,
  },
  searchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 12,
  },
  searchHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
    marginLeft: 36,
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
  // New styles for Quick Walk-in Button
  walkinButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#d97706',
    marginTop: 8,
  },
  walkinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // 🔥 New styles for Supplier Debts Button
  debtButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#8b5cf6',
    marginTop: 8,
  },
  debtButtonText: {
    color: '#fff',
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
  managementButton: {
    backgroundColor: '#0f172a',
  },
  buildStamp: {
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 11,
    color: '#94a3b8',
  },
  // 🔥 Hidden nuke styles - kept just in case
/*  nukeButton: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  nukeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },*/
});
