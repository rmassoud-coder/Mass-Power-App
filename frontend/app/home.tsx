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
} from '../src/db/database';
import SyncStatusPill from '../src/components/SyncStatusPill';

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

          {/* Walk-in Customer Button */}
          <TouchableOpacity
            style={styles.walkinCard}
            onPress={() => router.push({
              pathname: '/add-service',
              params: { walkin: 'true' }
            })}
            activeOpacity={0.7}
            testID="walkin-button"
          >
            <View style={styles.walkinIconContainer}>
              <Ionicons name="walk-outline" size={40} color="#fff" />
            </View>
            <View style={styles.walkinContent}>
              <Text style={styles.walkinTitle}>Walk-in Customer</Text>
              <Text style={styles.walkinSubtitle}>Quick service without customer profile</Text>
              <View style={styles.walkinBadge}>
                <Text style={styles.walkinBadgeText}>Add Service</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Add New Customer */}
          <TouchableOpacity
            style={[styles.addCustomerButton, { paddingVertical: buttonPadding }]}
            onPress={() => router.push('/add-customer')}
            testID="add-customer-button"
          >
            <Ionicons name="person-add-outline" size={isSmallScreen ? 16 : 20} color="#2563eb" />
            <Text style={styles.addCustomerButtonText}>Add New Customer</Text>
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
        </ScrollView>
      </KeyboardAvoidingView>
