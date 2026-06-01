import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface Vehicle {
  id: string;
  vin: string;
  plate_number: string;
  make: string;
  model: string;
  year?: string;
}

interface Customer {
  id: string;
  name: string;
  mobile_number: string;
}

interface SearchResult {
  customer: Customer;
  vehicles: Vehicle[];
  total_services: number;
}

export default function SearchResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const results: SearchResult[] = params.results ? JSON.parse(params.results as string) : [];

  const handleCustomerPress = (customerId: string) => {
    router.push({
      pathname: '/customer-detail',
      params: { customerId },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Search Results</Text>
          <Text style={styles.headerSubtitle}>{results.length} customer(s) found</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {results.map((result) => (
          <TouchableOpacity
            key={result.customer.id}
            style={styles.customerCard}
            onPress={() => handleCustomerPress(result.customer.id)}
          >
            <View style={styles.customerHeader}>
              <View style={styles.customerIcon}>
                <Ionicons name="person" size={24} color="#2563eb" />
              </View>
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{result.customer.name}</Text>
                <View style={styles.customerMeta}>
                  <Ionicons name="call" size={14} color="#64748b" />
                  <Text style={styles.customerPhone}>{result.customer.mobile_number}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#cbd5e1" />
            </View>

            <View style={styles.divider} />

            <View style={styles.vehiclesList}>
              <Text style={styles.vehiclesTitle}>Vehicles:</Text>
              {result.vehicles.map((vehicle) => (
                <View key={vehicle.id} style={styles.vehicleItem}>
                  <Ionicons name="car-sport" size={16} color="#64748b" />
                  <Text style={styles.vehicleText}>
                    {vehicle.year ? `${vehicle.year} ` : ''}{vehicle.make} {vehicle.model}
                  </Text>
                </View>
              ))}
              {result.vehicles.length === 0 && (
                <Text style={styles.noVehiclesText}>No vehicles registered</Text>
              )}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="car-outline" size={20} color="#2563eb" />
                <Text style={styles.statValue}>{result.vehicles.length}</Text>
                <Text style={styles.statLabel}>Vehicles</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="construct-outline" size={20} color="#10b981" />
                <Text style={styles.statValue}>{result.total_services}</Text>
                <Text style={styles.statLabel}>Services</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
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
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  customerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  customerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  customerPhone: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 16,
  },
  vehiclesList: {
    marginBottom: 16,
  },
  vehiclesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  vehicleText: {
    fontSize: 14,
    color: '#1e293b',
    marginLeft: 8,
  },
  noVehiclesText: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});
