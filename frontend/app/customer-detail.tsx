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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import ConfirmDialog from '../src/components/ConfirmDialog';
import VehicleQrModal from '../src/components/VehicleQrModal';
import BrandLogo from '../src/components/BrandLogo';
import {
  getCustomerDetails,
  deleteCustomer,
  deleteVehicle,
  deleteService,
  CustomerDetail as DBCustomerDetail,
  Customer as DBCustomer,
  Vehicle as DBVehicle,
  Service as DBService,
} from '../src/db/database';
import { loadSettings } from '../src/utils/settings';
import { buildThermalReceiptHtml, buildOilStickerHtml } from '../src/utils/htmlBuilder';
import { printHtml } from '../src/utils/printer';

interface Vehicle extends DBVehicle {}
interface Service extends DBService {}
interface Customer extends DBCustomer {}

interface CustomerDetail extends DBCustomerDetail {}

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
  const [qrVehicle, setQrVehicle] = useState<Vehicle | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printingStickerId, setPrintingStickerId] = useState<string | null>(null);

  // Auto-refresh whenever screen comes into focus (after edits/adds)
  useFocusEffect(
    useCallback(() => {
      fetchCustomerDetails();
    }, [])
  );

  const fetchCustomerDetails = async () => {
    try {
      const data = await getCustomerDetails(params.customerId as string);
      setDetails(data);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load customer details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'customer') {
        await deleteCustomer(params.customerId as string);
      } else if (deleteTarget.type === 'vehicle') {
        await deleteVehicle(deleteTarget.id);
      } else if (deleteTarget.type === 'service') {
        await deleteService(deleteTarget.id);
      }

      const wasCustomer = deleteTarget.type === 'customer';
      setDeleteTarget(null);

      if (wasCustomer) {
        router.replace('/home');
      } else {
        await fetchCustomerDetails();
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to delete. Please try again.');
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

  const handlePrintService = async (service: Service, vehicle: Vehicle) => {
    if (!details) return;
    setPrintingId(service.id);
    try {
      const settings = await loadSettings();
      const html = buildThermalReceiptHtml(details.customer, vehicle, service, settings);
      await printHtml(html);
    } catch (e: any) {
      Alert.alert(
        'Print failed',
        e?.message ||
          'Unable to open printer. Make sure your Bluetooth thermal printer is paired and a print service is installed (e.g. PrinterShare / RawBT).'
      );
    } finally {
      setPrintingId(null);
    }
  };

  const handlePrintSticker = async (service: Service, vehicle: Vehicle) => {
    if (!details) return;
    setPrintingStickerId(service.id);
    try {
      const settings = await loadSettings();
      const html = buildOilStickerHtml(details.customer, vehicle, service, settings);
      await printHtml(html);
    } catch (e: any) {
      Alert.alert(
        'Print failed',
        e?.message ||
          'Unable to open printer. Make sure your Bluetooth thermal printer is paired and a print service is installed (e.g. PrinterShare / RawBT).'
      );
    } finally {
      setPrintingStickerId(null);
    }
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

        {/* Total Summary */}
        {details.vehicles.length > 0 && (
          <View style={styles.summaryBar}>
            <Text style={styles.summaryText}>
              {details.vehicles.length} vehicle{details.vehicles.length !== 1 ? 's' : ''} • {details.services.length} service{details.services.length !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.summaryTotalCost}>Total: ${totalCost.toFixed(2)}</Text>
          </View>
        )}

        {/* Vehicles with their Services */}
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
              <Ionicons name="add-circle" size={28} color="#2563eb" />
            </TouchableOpacity>
          </View>

          {details.vehicles.map((vehicle) => {
            const vehicleServices = details.services.filter((s) => s.vehicle_id === vehicle.id);
            const vehicleTotalCost = vehicleServices.reduce((sum, s) => sum + s.cost, 0);

            return (
              <View key={vehicle.id} style={styles.vehicleGroupCard}>
                {/* Vehicle Header */}
                <View style={styles.vehicleGroupHeader}>
                  <View style={styles.vehicleGroupIconContainer}>
                    <BrandLogo make={vehicle.make} size={32} fallbackColor="#2563eb" />
                  </View>
                  <View style={styles.vehicleGroupInfo}>
                    <Text style={styles.vehicleGroupName}>
                      {vehicle.year ? `${vehicle.year} ` : ''}{vehicle.make} {vehicle.model}
                    </Text>
                    <Text style={styles.vehicleGroupMeta}>Plate: {vehicle.plate_number}</Text>
                    <Text style={styles.vehicleGroupMeta}>VIN: {vehicle.vin}</Text>
                  </View>
                  <View style={styles.vehicleGroupActions}>
                    <TouchableOpacity
                      onPress={() => setQrVehicle(vehicle)}
                      style={styles.cardActionButton}
                      testID={`qr-vehicle-${vehicle.id}`}
                    >
                      <MaterialCommunityIcons name="qrcode" size={22} color="#7c3aed" />
                    </TouchableOpacity>
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

                {/* Services Sub-section for this Vehicle */}
                <View style={styles.servicesSubSection}>
                  <View style={styles.servicesSubHeader}>
                    <View style={styles.servicesSubHeaderLeft}>
                      <Ionicons name="construct" size={16} color="#10b981" />
                      <Text style={styles.servicesSubTitle}>
                        Services ({vehicleServices.length})
                      </Text>
                      {vehicleServices.length > 0 && (
                        <Text style={styles.vehicleSubtotal}>
                          • ${vehicleTotalCost.toFixed(2)}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: '/add-service',
                          params: {
                            customerId: details.customer.id,
                            vehicles: JSON.stringify([vehicle]),
                          },
                        })
                      }
                      style={styles.addServiceButton}
                      testID={`add-service-${vehicle.id}`}
                    >
                      <Ionicons name="add-circle" size={22} color="#10b981" />
                    </TouchableOpacity>
                  </View>

                  {vehicleServices.length === 0 ? (
                    <Text style={styles.noServicesText}>No services yet for this vehicle</Text>
                  ) : (
                    vehicleServices.map((service) => {
                      const dashOn: string[] = [];
                      if (service.dash_abs) dashOn.push('ABS');
                      if (service.dash_check_engine) dashOn.push('Engine');
                      if (service.dash_brake) dashOn.push('Brake');
                      if (service.dash_airbag) dashOn.push('Airbag');
                      if (service.dash_immobilizer) dashOn.push('Key');
                      return (
                      <View key={service.id} style={[styles.serviceItemCard, !service.is_paid && styles.serviceItemUnpaid]}>
                        <View style={styles.serviceItemContent}>
                          <View style={styles.serviceItemMain}>
                            <View style={styles.serviceItemTitleRow}>
                              <Text style={styles.serviceItemDescription}>
                                {service.service_description}
                              </Text>
                              {!service.is_paid && (
                                <View style={styles.unpaidBadge}>
                                  <Text style={styles.unpaidBadgeText}>UNPAID</Text>
                                </View>
                              )}
                            </View>
                            {service.additional_info && (
                              <Text style={styles.serviceItemAdditional}>
                                {service.additional_info}
                              </Text>
                            )}
                            {dashOn.length > 0 && (
                              <View style={styles.dashBadgeRow}>
                                <Ionicons name="warning" size={11} color="#ea580c" />
                                <Text style={styles.dashBadgeText}>{dashOn.join(' \u2022 ')}</Text>
                              </View>
                            )}
                            {(service.next_service_date || service.next_service_mileage) && (
                              <View style={styles.oilBadgeRow}>
                                <MaterialCommunityIcons name="oil" size={11} color="#b45309" />
                                <Text style={styles.oilBadgeText}>
                                  Next oil:
                                  {service.next_service_date
                                    ? ` ${new Date(service.next_service_date).toLocaleDateString()}`
                                    : ''}
                                  {service.next_service_mileage
                                    ? `${service.next_service_date ? ' \u2022 ' : ' '}${service.next_service_mileage.toLocaleString()} km`
                                    : ''}
                                </Text>
                              </View>
                            )}
                            <Text style={styles.serviceItemDate}>
                              {new Date(service.service_date).toLocaleDateString()}
                            </Text>
                          </View>
                          <View style={styles.serviceItemRight}>
                            <Text style={[styles.serviceItemCost, !service.is_paid && styles.serviceItemCostUnpaid]}>
                              ${service.cost.toFixed(2)}
                            </Text>
                            <View style={styles.serviceItemActions}>
                              {(service.next_service_date || service.next_service_mileage) && (
                                <TouchableOpacity
                                  onPress={() => handlePrintSticker(service, vehicle)}
                                  style={styles.serviceItemActionButton}
                                  disabled={printingStickerId === service.id}
                                  testID={`print-sticker-${service.id}`}
                                >
                                  {printingStickerId === service.id ? (
                                    <ActivityIndicator size="small" color="#b45309" />
                                  ) : (
                                    <MaterialCommunityIcons name="oil" size={18} color="#b45309" />
                                  )}
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                onPress={() => handlePrintService(service, vehicle)}
                                style={styles.serviceItemActionButton}
                                disabled={printingId === service.id}
                                testID={`print-service-${service.id}`}
                              >
                                {printingId === service.id ? (
                                  <ActivityIndicator size="small" color="#7c3aed" />
                                ) : (
                                  <Ionicons name="print-outline" size={18} color="#7c3aed" />
                                )}
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() =>
                                  router.push({
                                    pathname: '/edit-service',
                                    params: {
                                      serviceId: service.id,
                                      serviceDescription: service.service_description,
                                      additionalInfo: service.additional_info || '',
                                      cost: service.cost.toString(),
                                      isPaid: service.is_paid ? 'true' : 'false',
                                      dashAbs: service.dash_abs ? 'true' : 'false',
                                      dashCheckEngine: service.dash_check_engine ? 'true' : 'false',
                                      dashBrake: service.dash_brake ? 'true' : 'false',
                                      dashAirbag: service.dash_airbag ? 'true' : 'false',
                                      dashImmobilizer: service.dash_immobilizer ? 'true' : 'false',
                                      currentMileage: service.current_mileage != null ? String(service.current_mileage) : '',
                                      nextServiceDate: service.next_service_date || '',
                                      nextServiceMileage: service.next_service_mileage != null ? String(service.next_service_mileage) : '',
                                      oilGrade: service.oil_grade || '',
                                    },
                                  })
                                }
                                style={styles.serviceItemActionButton}
                              >
                                <Ionicons name="create-outline" size={18} color="#2563eb" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleDeleteService(service.id)}
                                style={styles.serviceItemActionButton}
                              >
                                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </View>
                      );
                    })
                  )}
                </View>
              </View>
            );
          })}

          {details.vehicles.length === 0 && (
            <Text style={styles.emptyText}>No vehicles registered. Add a vehicle to start tracking services.</Text>
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

      <VehicleQrModal
        visible={qrVehicle !== null}
        customer={details.customer}
        vehicle={qrVehicle}
        services={qrVehicle ? details.services.filter((s) => s.vehicle_id === qrVehicle.id) : []}
        onClose={() => setQrVehicle(null)}
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
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
  },
  summaryTotalCost: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  vehicleGroupCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  vehicleGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  vehicleGroupIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleGroupInfo: {
    flex: 1,
    marginLeft: 12,
  },
  vehicleGroupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  vehicleGroupMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  vehicleGroupActions: {
    flexDirection: 'row',
  },
  servicesSubSection: {
    padding: 12,
  },
  servicesSubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginBottom: 6,
  },
  servicesSubHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  servicesSubTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    marginLeft: 6,
  },
  vehicleSubtotal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginLeft: 4,
  },
  addServiceButton: {
    padding: 2,
  },
  noServicesText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  serviceItemCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  serviceItemUnpaid: {
    backgroundColor: '#fef2f2',
    borderLeftColor: '#ef4444',
  },
  serviceItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  unpaidBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  unpaidBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  serviceItemCostUnpaid: {
    color: '#ef4444',
  },
  serviceItemContent: {
    flexDirection: 'row',
  },
  serviceItemMain: {
    flex: 1,
  },
  serviceItemDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  serviceItemAdditional: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  serviceItemDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  serviceItemRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  serviceItemCost: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 4,
  },
  serviceItemActions: {
    flexDirection: 'row',
  },
  serviceItemActionButton: {
    padding: 4,
    marginLeft: 2,
  },
  dashBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: '#fff7ed',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  dashBadgeText: {
    fontSize: 10,
    color: '#ea580c',
    fontWeight: '600',
    marginLeft: 4,
  },
  oilBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  oilBadgeText: {
    fontSize: 10,
    color: '#b45309',
    fontWeight: '600',
    marginLeft: 4,
  },
});
