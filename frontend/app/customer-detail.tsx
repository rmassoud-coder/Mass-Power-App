import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ConfirmDialog from '../src/components/ConfirmDialog';

interface Vehicle {
  id: string;
  vin: string;
  plate_number: string;
  make: string;
  model: string;
  year?: string;
  created_at: string;
}

interface Service {
  id: string;
  vehicle_id: string;
  service_description: string;
  additional_info?: string;
  cost: number;
  service_date: string;
}

interface Customer {
  id: string;
  name: string;
  mobile_number: string;
}

interface CustomerDetail {
  customer: Customer;
  vehicles: Vehicle[];
  services: Service[];
}

type DeleteTarget =
  | { type: 'customer' }
  | { type: 'vehicle'; id: string }
  | { type: 'service'; id: string }
  | null;

export default function CustomerDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<CustomerDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

  // Auto-refresh whenever screen comes into focus (after edits/adds)
  useFocusEffect(
    useCallback(() => {
      fetchCustomerDetails();
    }, [])
  );

  const fetchCustomerDetails = async () => {
    try {
      const response = await fetch(
        `${backendUrl}/api/customers/${params.customerId}/details`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch customer details');
      }

      const data = await response.json();
      setDetails(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load customer details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      let url = '';
      if (deleteTarget.type === 'customer') {
        url = `${backendUrl}/api/customers/${params.customerId}`;
      } else if (deleteTarget.type === 'vehicle') {
        url = `${backendUrl}/api/vehicles/${deleteTarget.id}`;
      } else if (deleteTarget.type === 'service') {
        url = `${backendUrl}/api/services/${deleteTarget.id}`;
      }

      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Delete failed');
      }

      const wasCustomer = deleteTarget.type === 'customer';
      setDeleteTarget(null);

      if (wasCustomer) {
        router.replace('/home');
      } else {
        // Auto-refresh the screen after delete
        await fetchCustomerDetails();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const getDeleteDialogProps = () => {
    if (!deleteTarget) {
      return { title: '', message: '' };
    }
    if (deleteTarget.type === 'customer') {
      return {
        title: 'Delete Customer?',
        message:
          'This will permanently delete the customer, all their vehicles, and all service records. This action cannot be undone.',
      };
    }
    if (deleteTarget.type === 'vehicle') {
      return {
        title: 'Delete Vehicle?',
        message:
          'This will permanently delete this vehicle and all its service records. This action cannot be undone.',
      };
    }
    return {
      title: 'Delete Service?',
      message: 'This will permanently delete this service record. This action cannot be undone.',
    };
  };

  const handleDeleteService = (serviceId: string) => {
    setDeleteTarget({ type: 'service', id: serviceId });
  };

  const handleDeleteVehicle = (vehicleId: string) => {
    setDeleteTarget({ type: 'vehicle', id: vehicleId });
  };

  const handleDeleteCustomer = () => {
    setDeleteTarget({ type: 'customer' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  if (!details) {
    return null;
  }

  const totalCost = details.services.reduce((sum, service) => sum + service.cost, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/edit-customer',
                params: {
                  customerId: details.customer.id,
                  name: details.customer.name,
                  mobileNumber: details.customer.mobile_number,
                },
              })
            }
            style={styles.headerActionButton}
          >
            <Ionicons name="create-outline" size={22} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteCustomer} style={styles.headerActionButton}>
            <Ionicons name="trash-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Customer Info Card */}
        <View style={styles.customerCard}>
          <View style={styles.customerIconLarge}>
            <Ionicons name="person" size={40} color="#2563eb" />
          </View>
          <Text style={styles.customerName}>{details.customer.name}</Text>
          <View style={styles.customerPhoneRow}>
            <Ionicons name="call" size={16} color="#64748b" />
            <Text style={styles.customerPhone}>{details.customer.mobile_number}</Text>
          </View>
        </View>

        {/* Vehicles Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vehicles ({details.vehicles.length})</Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/add-vehicle',
                  params: { customerId: details.customer.id },
                })
              }
              style={styles.addButton}
            >
              <Ionicons name="add-circle" size={24} color="#2563eb" />
            </TouchableOpacity>
          </View>

          {details.vehicles.map((vehicle) => (
            <View key={vehicle.id} style={styles.vehicleCard}>
              <View style={styles.vehicleHeader}>
                <Ionicons name="car-sport" size={24} color="#2563eb" />
                <View style={styles.vehicleInfo}>
                  <Text style={styles.vehicleName}>
                    {vehicle.year ? `${vehicle.year} ` : ''}{vehicle.make} {vehicle.model}
                  </Text>
                  <Text style={styles.vehicleMeta}>VIN: {vehicle.vin}</Text>
                  <Text style={styles.vehicleMeta}>Plate: {vehicle.plate_number}</Text>
                </View>
                <View style={styles.vehicleActions}>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: '/edit-vehicle',
                        params: {
                          vehicleId: vehicle.id,
                          vin: vehicle.vin,
                          plateNumber: vehicle.plate_number,
                          make: vehicle.make,
                          model: vehicle.model,
                          year: vehicle.year || '',
                        },
                      })
                    }
                    style={styles.cardActionButton}
                  >
                    <Ionicons name="create-outline" size={20} color="#2563eb" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteVehicle(vehicle.id)}
                    style={styles.cardActionButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {details.vehicles.length === 0 && (
            <Text style={styles.emptyText}>No vehicles registered</Text>
          )}
        </View>

        {/* Services Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Service History ({details.services.length})</Text>
              <Text style={styles.totalCost}>Total: ${totalCost.toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/add-service',
                  params: {
                    customerId: details.customer.id,
                    vehicles: JSON.stringify(details.vehicles),
                  },
                })
              }
              style={styles.addButton}
              disabled={details.vehicles.length === 0}
            >
              <Ionicons
                name="add-circle"
                size={24}
                color={details.vehicles.length === 0 ? '#cbd5e1' : '#2563eb'}
              />
            </TouchableOpacity>
          </View>

          {details.services.map((service) => {
            const vehicle = details.vehicles.find((v) => v.id === service.vehicle_id);
            return (
              <View key={service.id} style={styles.serviceCard}>
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceIconContainer}>
                    <Ionicons name="construct" size={20} color="#10b981" />
                  </View>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceDescription}>{service.service_description}</Text>
                    {service.additional_info && (
                      <Text style={styles.serviceAdditional}>{service.additional_info}</Text>
                    )}
                    {vehicle && (
                      <Text style={styles.serviceVehicle}>
                        {vehicle.make} {vehicle.model} - {vehicle.plate_number}
                      </Text>
                    )}
                    <Text style={styles.serviceDate}>
                      {new Date(service.service_date).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.serviceActions}>
                    <Text style={styles.serviceCost}>${service.cost.toFixed(2)}</Text>
                    <View style={styles.serviceButtonRow}>
                      <TouchableOpacity
                        onPress={() =>
                          router.push({
                            pathname: '/edit-service',
                            params: {
                              serviceId: service.id,
                              serviceDescription: service.service_description,
                              additionalInfo: service.additional_info || '',
                              cost: service.cost.toString(),
                            },
                          })
                        }
                        style={styles.deleteButton}
                      >
                        <Ionicons name="create-outline" size={20} color="#2563eb" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteService(service.id)}
                        style={styles.deleteButton}
                      >
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

          {details.services.length === 0 && (
            <Text style={styles.emptyText}>No service records</Text>
          )}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title={getDeleteDialogProps().title}
        message={getDeleteDialogProps().message}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
        cancelText="Cancel"
        destructive={true}
        onConfirm={performDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  editButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    padding: 8,
    marginLeft: 4,
  },
  vehicleActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardActionButton: {
    padding: 8,
    marginLeft: 4,
  },
  serviceButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  customerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  customerIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  customerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  customerPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerPhone: {
    fontSize: 16,
    color: '#64748b',
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  totalCost: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    marginTop: 4,
  },
  addButton: {
    padding: 4,
  },
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  vehicleHeader: {
    flexDirection: 'row',
  },
  vehicleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  vehicleMeta: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  serviceHeader: {
    flexDirection: 'row',
  },
  serviceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  serviceDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  serviceAdditional: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  serviceVehicle: {
    fontSize: 13,
    color: '#2563eb',
    marginTop: 4,
  },
  serviceDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  serviceActions: {
    alignItems: 'flex-end',
  },
  serviceCost: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 8,
  },
  deleteButton: {
    padding: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
