import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import {
  createService,
  SERVICE_CATEGORIES,
  EMPTY_DASH_LIGHTS,
  EMPTY_OIL_REMINDER,
  EMPTY_BATTERY_REPLACEMENT,
  EMPTY_HVAC_SERVICE,
  DashLights,
  OilReminder,
  BatteryReplacement,
  HvacService,
  getOrCreateWalkInVehicle,
} from '../src/db/database';
import { triggerAutoPush } from '../src/utils/autoSync';
import DashLightsPicker from '../src/components/DashLightsPicker';
import OilReminderForm from '../src/components/OilReminderForm';
import BatteryReplacementForm from '../src/components/BatteryReplacementForm';
import HvacServiceForm from '../src/components/HvacServiceForm';
import InventoryPicker, { PickedItem } from '../src/components/InventoryPicker';

interface Vehicle {
  id: string;
  vin: string;
  plate_number: string;
  make: string;
  model: string;
  year?: string;
}

export default function AddServiceScreen() {
  const params = useLocalSearchParams();
  const vehiclesParam: Vehicle[] = params.vehicles ? JSON.parse(params.vehicles as string) : [];
  const isWalkIn = params.walkin === 'true';

  const [vehicles, setVehicles] = useState<Vehicle[]>(vehiclesParam);
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehiclesParam[0]?.id || '');
  const [loadingVehicles, setLoadingVehicles] = useState(isWalkIn);
  const [serviceCategory, setServiceCategory] = useState<string>(SERVICE_CATEGORIES[0]);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [cost, setCost] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [dashLights, setDashLights] = useState<DashLights>(EMPTY_DASH_LIGHTS);
  const [oilReminder, setOilReminder] = useState<OilReminder>(EMPTY_OIL_REMINDER);
  const [batteryReplacement, setBatteryReplacement] = useState<BatteryReplacement>(
    EMPTY_BATTERY_REPLACEMENT
  );
  const [hvacService, setHvacService] = useState<HvacService>(EMPTY_HVAC_SERVICE);
  const [outsourceCost, setOutsourceCost] = useState('');
  const [pickedItems, setPickedItems] = useState<PickedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Load walk-in vehicle if needed
  useEffect(() => {
    if (isWalkIn && vehicles.length === 0) {
      const loadWalkInVehicle = async () => {
        try {
          const walkInVehicle = await getOrCreateWalkInVehicle();
          setVehicles([walkInVehicle]);
          setSelectedVehicleId(walkInVehicle.id);
        } catch (error) {
          Alert.alert('Error', 'Failed to load walk-in vehicle');
        } finally {
          setLoadingVehicles(false);
        }
      };
      loadWalkInVehicle();
    }
  }, [isWalkIn, vehicles.length]);

  const isOilService = serviceCategory === 'Oil Services';
  const isBatteryService = serviceCategory === 'Battery Replacement';
  const isHvacService = serviceCategory === 'HVAC Services';
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  const productsSubtotal = pickedItems.reduce(
    (sum, it) => sum + it.quantity * it.unit_price,
    0
  );
  const laborCost = parseFloat(cost) || 0;
  const grandTotal = laborCost + productsSubtotal;

  const handleSubmit = async () => {
    if (!selectedVehicleId || !serviceCategory || !cost.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (isOilService && !oilReminder.oilGrade.trim()) {
      Alert.alert('Error', 'Oil grade is required for Oil Services (e.g. 5W-30)');
      return;
    }

    if (isBatteryService && !batteryReplacement.ampRate.trim()) {
      Alert.alert(
        'Error',
        'Amp Rate is required for Battery Replacement (e.g. 700 CCA or 80 Ah)'
      );
      return;
    }

    const laborNumber = parseFloat(cost);
    if (isNaN(laborNumber) || laborNumber < 0) {
      Alert.alert('Error', 'Please enter a valid labor cost');
      return;
    }
    // Grand total = labor + parts retail
    const costNumber = laborNumber + productsSubtotal;

    // Pending payment validation
    let partialPaidNumber = 0;
    if (isPending) {
      partialPaidNumber = parseFloat(partialAmount) || 0;
      if (partialPaidNumber < 0) {
        Alert.alert('Error', 'Partial payment cannot be negative');
        return;
      }
      if (partialPaidNumber >= costNumber) {
        Alert.alert(
          'Error',
          'Partial payment must be less than total cost. Use "Paid" instead if fully paid.'
        );
        return;
      }
    }

    setLoading(true);
    try {
      await createService(
        selectedVehicleId,
        serviceCategory,
        additionalInfo.trim() || undefined,
        costNumber,
        isPaid,
        dashLights,
        isOilService ? oilReminder : EMPTY_OIL_REMINDER,
        pickedItems.map((p) => ({ inventory_id: p.inventory_id, quantity: p.quantity })),
        partialPaidNumber,
        isBatteryService ? batteryReplacement : undefined,
        isHvacService ? hvacService : undefined,
        parseFloat(outsourceCost || '0') || 0
      );
      triggerAutoPush();

      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add service');
    } finally {
      setLoading(false);
    }
  };

  if (loadingVehicles) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading walk-in vehicle...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Service Record</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <View style={styles.iconContainer}>
              <Ionicons name="construct" size={48} color="#10b981" />
            </View>

            {/* Walk-in Badge */}
            {isWalkIn && (
              <View style={styles.walkinBadge}>
                <Ionicons name="walk-outline" size={20} color="#2563eb" />
                <Text style={styles.walkinBadgeText}>Walk-in Customer</Text>
                <Text style={styles.walkinBadgeSubtext}>
                  {vehicles.length > 0 ? `${vehicles[0]?.make} ${vehicles[0]?.model}` : 'Loading...'}
                </Text>
              </View>
            )}

            {/* Vehicle Selection - Hidden for walk-in */}
            {!isWalkIn && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Select Vehicle *</Text>
                <View style={styles.pickerContainer}>
                  <Ionicons name="car-sport-outline" size={20} color="#666" style={styles.pickerIcon} />
                  <Picker
                    selectedValue={selectedVehicleId}
                    onValueChange={(value) => setSelectedVehicleId(value)}
                    style={styles.picker}
                  >
                    {vehicles.map((vehicle) => (
                      <Picker.Item
                        key={vehicle.id}
                        label={`${vehicle.year || ''} ${vehicle.make} ${vehicle.model} - ${vehicle.plate_number}`}
                        value={vehicle.id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            )}

            {/* Service Category (Dropdown) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Service Type *</Text>
              <View style={styles.pickerContainer}>
                <Ionicons name="clipboard-outline" size={20} color="#666" style={styles.pickerIcon} />
                <Picker
                  selectedValue={serviceCategory}
                  onValueChange={(value) => setServiceCategory(value)}
                  style={styles.picker}
                  testID="service-category-picker"
                >
                  {SERVICE_CATEGORIES.map((cat) => (
                    <Picker.Item key={cat} label={cat} value={cat} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Oil Service Reminder (conditional) */}
            {isOilService && (
              <View style={styles.oilCard}>
                <OilReminderForm
                  value={oilReminder}
                  onChange={setOilReminder}
                  make={selectedVehicle?.make}
                  model={selectedVehicle?.model}
                />
              </View>
            )}

            {/* Battery Replacement (conditional) */}
            {isBatteryService && (
              <View style={styles.batteryCard}>
                <BatteryReplacementForm
                  value={batteryReplacement}
                  onChange={setBatteryReplacement}
                />
              </View>
            )}

            {/* HVAC Services (conditional) */}
            {isHvacService && (
              <View style={styles.hvacCard}>
                <HvacServiceForm value={hvacService} onChange={setHvacService} />
              </View>
            )}

            {/* Additional Info / Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes / Description</Text>
              <View style={[styles.inputContainer, styles.textAreaContainer]}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g., oil filter replaced, brake pads worn..."
                  value={additionalInfo}
                  onChangeText={setAdditionalInfo}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Inventory Products Used */}
            <InventoryPicker value={pickedItems} onChange={setPickedItems} />

            {/* Dashboard Warning Lights */}
            <View style={styles.dashCard}>
              <DashLightsPicker value={dashLights} onChange={setDashLights} />
            </View>

            {/* Cost */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Labor / Service Fee *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="cash-outline" size={20} color="#666" style={styles.inputIcon} />
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  value={cost}
                  onChangeText={setCost}
                  keyboardType="decimal-pad"
                />
              </View>
              {productsSubtotal > 0 && (
                <View style={styles.totalBreakdown}>
                  <Text style={styles.totalLine}>Labor: ${laborCost.toFixed(2)}</Text>
                  <Text style={styles.totalLine}>Parts (retail): ${productsSubtotal.toFixed(2)}</Text>
                  <Text style={styles.totalGrand}>Grand Total: ${grandTotal.toFixed(2)}</Text>
                </View>
              )}
            </View>

            {/* Outsource Cost (PRIVATE, Reports-only) */}
            <View style={styles.outsourceCard}>
              <View style={styles.outsourceHeaderRow}>
                <Ionicons name="lock-closed" size={14} color="#6b21a8" />
                <Text style={styles.outsourceHeader}>Outsource Cost (Private)</Text>
              </View>
              <Text style={styles.outsourceHint}>
                Money paid to a 3rd party for this job. Subtracted from your cash-flow in
                the Reports screen only — never shown on receipts, invoices or stickers.
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="cash-outline" size={20} color="#6b21a8" style={styles.inputIcon} />
                <Text style={[styles.currencySymbol, { color: '#6b21a8' }]}>$</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  value={outsourceCost}
                  onChangeText={(t) => setOutsourceCost(t.replace(/[^\d.]/g, ''))}
                  keyboardType="decimal-pad"
                  testID="outsource-cost-input"
                />
              </View>
            </View>

            {/* Paid Checkbox */}
            <TouchableOpacity
              style={styles.paidCheckbox}
              onPress={() => {
                const next = !isPaid;
                setIsPaid(next);
                if (next) {
                  setIsPending(false);
                  setPartialAmount('');
                }
              }}
              testID="paid-checkbox"
            >
              <View style={[styles.checkbox, isPaid && styles.checkboxChecked]}>
                {isPaid && <Ionicons name="checkmark" size={18} color="#fff" />}
              </View>
              <View style={styles.paidCheckboxLabel}>
                <Text style={styles.paidCheckboxText}>Invoice Paid</Text>
                <Text style={styles.paidCheckboxSubtext}>
                  {isPaid ? 'Marked as paid' : 'Will show as unpaid in red'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Pending Payment Checkbox + partial amount */}
            <View style={styles.pendingRow}>
              <TouchableOpacity
                style={[styles.paidCheckbox, { flex: 1, marginTop: 0 }]}
                onPress={() => {
                  const next = !isPending;
                  setIsPending(next);
                  if (next) setIsPaid(false);
                  else setPartialAmount('');
                }}
                testID="pending-checkbox"
              >
                <View
                  style={[
                    styles.checkbox,
                    isPending && { backgroundColor: '#eab308', borderColor: '#eab308' },
                  ]}
                >
                  {isPending && <Ionicons name="time" size={16} color="#fff" />}
                </View>
                <View style={styles.paidCheckboxLabel}>
                  <Text style={styles.paidCheckboxText}>Pending Payment</Text>
                  <Text style={styles.paidCheckboxSubtext}>
                    {isPending ? 'Will show as pending in yellow' : 'Partial or awaiting payment'}
                  </Text>
                </View>
              </TouchableOpacity>
              {isPending && (
                <View style={styles.partialInputWrap} testID="partial-input-wrap">
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.partialInput}
                    placeholder="0.00"
                    value={partialAmount}
                    onChangeText={setPartialAmount}
                    keyboardType="decimal-pad"
                    testID="partial-input"
                  />
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  <Text style={styles.submitButtonText}>Add Service</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  keyboardView: { flex: 1 },
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
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  content: { flex: 1, paddingHorizontal: 24 },
  form: { paddingTop: 24 },
  iconContainer: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingLeft: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pickerIcon: { marginRight: 12 },
  picker: { flex: 1, height: 56 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  textAreaContainer: { height: 100, alignItems: 'flex-start', paddingVertical: 12 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1e293b' },
  textArea: { height: '100%' },
  currencySymbol: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginRight: 4 },
  dashCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  oilCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
    marginBottom: 20,
  },
  batteryCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#6ee7b7',
    backgroundColor: '#ecfdf5',
    marginBottom: 20,
  },
  hvacCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#7dd3fc',
    backgroundColor: '#f0f9ff',
    marginBottom: 20,
  },
  outsourceCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#c4b5fd',
    backgroundColor: '#faf5ff',
    marginBottom: 20,
  },
  outsourceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  outsourceHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6b21a8',
    letterSpacing: 0.3,
  },
  outsourceHint: {
    fontSize: 11,
    color: '#7c3aed',
    marginBottom: 10,
    lineHeight: 15,
  },
  submitButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  paidCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: { backgroundColor: '#10b981', borderColor: '#10b981' },
  paidCheckboxLabel: { marginLeft: 12, flex: 1 },
  paidCheckboxText: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  paidCheckboxSubtext: { fontSize: 12, color: '#64748b', marginTop: 2 },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  partialInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eab308',
    paddingHorizontal: 10,
    height: 46,
    minWidth: 120,
    flexGrow: 1,
    flexBasis: 120,
  },
  partialInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '700',
    minWidth: 60,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: '600', marginLeft: 8 },
  totalBreakdown: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  totalLine: { fontSize: 12, color: '#475569', marginBottom: 2 },
  totalGrand: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f766e',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  walkinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  walkinBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
    marginLeft: 10,
  },
  walkinBadgeSubtext: {
    marginLeft: 'auto',
    fontSize: 14,
    color: '#64748b',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
});
