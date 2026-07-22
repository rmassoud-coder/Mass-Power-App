import React, { useCallback, useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getReport,
  listSuppliers,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  getLowStockBySupplier,
  Supplier,
  LowStockItemBySupplier,
} from '../src/db/database';
import { loadSettings } from '../src/utils/settings';
import { printJob } from '../src/utils/printService';
import { MASS_POWER_LOGO_PNG_BASE64 } from '../src/utils/logoBase64';

interface ReportItem {
  service_id: string;
  customer_id: string;
  customer_name: string;
  customer_mobile: string;
  vehicle_id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year?: string;
  vehicle_vin: string;
  vehicle_plate: string;
  service_description: string;
  additional_info?: string;
  cost: number;
  is_paid: boolean;
  service_date: string;
}

interface ReportResponse {
  items: ReportItem[];
  total_cost: number;
  total_services: number;
  unpaid_count: number;
  unpaid_total: number;
  outsource_total: number;
  net_cash_flow: number;
}

type FilterType = 'mobile' | 'vin' | 'plate';

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReorderHtml(
  groups: LowStockItemBySupplier[],
  garageName: string,
  garagePhone: string,
  threshold: number,
): string {
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const totalSkus = groups.reduce((s, g) => s + g.items.length, 0);
  const sections = groups
    .map((g) => {
      const rows = g.items
        .map((it, idx) => {
          const retail =
            it.item_retail_price && it.item_retail_price > 0
              ? it.item_retail_price
              : it.item_price;
          return `
            <tr>
              <td class="idx">${idx + 1}</td>
              <td>
                <div class="p-name">${escapeHtml(it.item_type)}</div>
                <div class="p-sub">${escapeHtml(it.item_number)}${it.item_code ? ' &middot; Code: ' + escapeHtml(it.item_code) : ''}</div>
              </td>
              <td class="qty">${it.item_quantity}</td>
              <td class="qty-order">____</td>
              <td class="price">$${retail.toFixed(2)}</td>
            </tr>`;
        })
        .join('');
      return `
        <div class="supplier-block">
          <div class="supplier-header">
            <div class="supplier-name">${escapeHtml(g.supplier_name)}</div>
            <div class="supplier-meta">${g.items.length} SKU${g.items.length === 1 ? '' : 's'} below stock</div>
          </div>
          <table class="items-table">
            <thead>
              <tr>
                <th style="width:6%">#</th>
                <th>Item</th>
                <th style="width:12%">Stock</th>
                <th style="width:14%">Order Qty</th>
                <th style="width:14%">Retail</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8" />
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica', 'Arial', sans-serif; color: #0f172a; margin: 0; padding: 0; }
  .header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
  .logo { width: 60px; height: 60px; border-radius: 50%; }
  .titles { flex: 1; }
  .shop { font-size: 20px; font-weight: 900; letter-spacing: 0.5px; }
  .subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }
  .doc-title { text-align: center; font-size: 18px; font-weight: 900; letter-spacing: 2px; color: #b91c1c; margin-bottom: 6px; text-transform: uppercase; }
  .doc-meta { text-align: center; font-size: 11px; color: #475569; margin-bottom: 18px; }
  .supplier-block { margin-bottom: 22px; page-break-inside: avoid; }
  .supplier-header { background: #0f172a; color: #fff; padding: 8px 12px; border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center; }
  .supplier-name { font-size: 15px; font-weight: 800; letter-spacing: 0.5px; }
  .supplier-meta { font-size: 11px; opacity: 0.85; }
  table.items-table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-top: none; }
  table.items-table th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-size: 11px; color: #475569; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
  table.items-table td { padding: 8px; font-size: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .idx { color: #64748b; font-size: 11px; }
  .p-name { font-weight: 700; }
  .p-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
  .qty { text-align: center; font-weight: 900; color: #b91c1c; }
  .qty-order { text-align: center; font-weight: 900; color: #0f172a; letter-spacing: 1px; }
  .price { text-align: right; color: #0f766e; font-weight: 700; }
  .footer { margin-top: 22px; text-align: center; font-size: 10px; color: #94a3b8; }
  .empty { text-align: center; padding: 40px; color: #64748b; font-size: 13px; }
</style>
</head><body>
  <div class="header">
    <img class="logo" src="${MASS_POWER_LOGO_PNG_BASE64}" alt="logo" />
    <div class="titles">
      <div class="shop">${escapeHtml(garageName || 'Mass Power Auto Services')}</div>
      ${garagePhone ? `<div class="subtitle">${escapeHtml(garagePhone)}</div>` : ''}
    </div>
  </div>

  <div class="doc-title">Reorder Report</div>
  <div class="doc-meta">Items with stock below ${threshold} &middot; Generated ${today} &middot; ${totalSkus} SKU${totalSkus === 1 ? '' : 's'} across ${groups.length} supplier${groups.length === 1 ? '' : 's'}</div>

  ${groups.length === 0 ? '<div class="empty">Nothing to reorder &mdash; stock levels look healthy.</div>' : sections}

  <div class="footer">${escapeHtml(garageName || 'Mass Power Auto Services')} &mdash; Reorder Report</div>
</body></html>`;
}

export default function ReportScreen() {
  const router = useRouter();

  // Default the date range to TODAY so the mechanic sees "today's sales" the
  // moment they open the screen. They can widen the range afterwards.
  const todayIso = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [filterType, setFilterType] = useState<FilterType>('mobile');
  const [filterValue, setFilterValue] = useState('');
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportResponse | null>(null);

  // Suppliers list
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [suppliersOpen, setSuppliersOpen] = useState(false);

  // Reorder report
  const [reorderGroups, setReorderGroups] = useState<LowStockItemBySupplier[] | null>(null);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [reorderPrinting, setReorderPrinting] = useState(false);
  const [reorderThreshold, setReorderThreshold] = useState('5');
  const [lastThresholdUsed, setLastThresholdUsed] = useState<number>(5);

  const loadSuppliers = useCallback(async () => {
    try {
      const list = await listSuppliers();
      setSuppliers(list);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  // Auto-run today's sales report on first mount so the mechanic sees the
  // daily total straight away without having to tap "Generate".
  const didAutoRun = React.useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;
    didAutoRun.current = true;
    // Fire in the next tick so all state is initialised
    setTimeout(() => {
      handleGenerate();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveSupplier = async () => {
    const name = supplierName.trim();
    if (!name) {
      Alert.alert('Error', 'Supplier name is required');
      return;
    }
    setSavingSupplier(true);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, name, supplierContact.trim());
      } else {
        await addSupplier(name, supplierContact.trim());
      }
      setSupplierName('');
      setSupplierContact('');
      setEditingSupplier(null);
      await loadSuppliers();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save supplier');
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setSupplierName(s.name);
    setSupplierContact(s.contact_info || '');
  };

  const handleCancelEditSupplier = () => {
    setEditingSupplier(null);
    setSupplierName('');
    setSupplierContact('');
  };

  const handleDeleteSupplier = (s: Supplier) => {
    const doDelete = async () => {
      try {
        await deleteSupplier(s.id);
        if (editingSupplier?.id === s.id) handleCancelEditSupplier();
        await loadSuppliers();
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to delete');
      }
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm(`Delete supplier "${s.name}"?\nInventory items linked to it will keep the parts but lose the supplier tag.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete supplier?',
        `${s.name}\nParts tagged with this supplier will lose the tag.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const handleGenerateReorder = async () => {
    const raw = parseInt(reorderThreshold, 10);
    const threshold = Number.isFinite(raw) && raw >= 1 ? raw : 5;
    setReorderLoading(true);
    try {
      const groups = await getLowStockBySupplier(threshold);
      setReorderGroups(groups);
      setLastThresholdUsed(threshold);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to build reorder report');
    } finally {
      setReorderLoading(false);
    }
  };

  const handlePrintReorder = async () => {
    if (!reorderGroups) return;
    setReorderPrinting(true);
    try {
      const settings = await loadSettings();
      const html = buildReorderHtml(
        reorderGroups,
        settings.garageName,
        settings.garagePhone,
        lastThresholdUsed,
      );
      await printJob(html, { jobName: 'Reorder Report' });
    } catch (e: any) {
      Alert.alert(
        'Print failed',
        e?.message ||
          'Unable to open printer. Make sure a print service is installed (e.g. PrinterShare / RawBT).'
      );
    } finally {
      setReorderPrinting(false);
    }
  };

  const isValidDate = (dateStr: string) => {
    if (!dateStr) return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  };

  const handleGenerate = async () => {
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      Alert.alert('Error', 'Please use YYYY-MM-DD date format');
      return;
    }

    setLoading(true);
    try {
      const data = await getReport(
        startDate ? `${startDate}T00:00:00` : undefined,
        endDate ? `${endDate}T23:59:59` : undefined,
        filterType === 'mobile' && filterValue.trim() ? filterValue.trim() : undefined,
        filterType === 'vin' && filterValue.trim() ? filterValue.trim() : undefined,
        filterType === 'plate' && filterValue.trim() ? filterValue.trim() : undefined,
        unpaidOnly,
      );
      setReport(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    // Reset to today's range (matches the initial "daily sales" default) so
    // the daily view stays sticky rather than blanking out.
    const today = new Date().toISOString().slice(0, 10);
    setStartDate(today);
    setEndDate(today);
    setFilterValue('');
    setUnpaidOnly(false);
    setReport(null);
  };

  const getFilterPlaceholder = () => {
    if (filterType === 'mobile') return 'Enter mobile number';
    if (filterType === 'vin') return 'Enter VIN';
    return 'Enter plate number';
  };

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
          <Text style={styles.headerTitle}>Services and Reports</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 40 }}
          nestedScrollEnabled
        >
          {/* Date Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date Range</Text>
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>From</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="calendar-outline" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={startDate}
                    onChangeText={setStartDate}
                    maxLength={10}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>To</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="calendar-outline" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={endDate}
                    onChangeText={setEndDate}
                    maxLength={10}
                  />
                </View>
              </View>
            </View>
            <Text style={styles.hint}>Leave blank for all dates</Text>
          </View>

          {/* Filter Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Filter By (Optional)</Text>
            <View style={styles.filterTabs}>
              <TouchableOpacity
                style={[styles.filterTab, filterType === 'mobile' && styles.filterTabActive]}
                onPress={() => setFilterType('mobile')}
              >
                <Ionicons
                  name="call-outline"
                  size={18}
                  color={filterType === 'mobile' ? '#fff' : '#64748b'}
                />
                <Text style={[styles.filterTabText, filterType === 'mobile' && styles.filterTabTextActive]}>
                  Mobile
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, filterType === 'vin' && styles.filterTabActive]}
                onPress={() => setFilterType('vin')}
              >
                <Ionicons
                  name="barcode-outline"
                  size={18}
                  color={filterType === 'vin' ? '#fff' : '#64748b'}
                />
                <Text style={[styles.filterTabText, filterType === 'vin' && styles.filterTabTextActive]}>
                  VIN
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, filterType === 'plate' && styles.filterTabActive]}
                onPress={() => setFilterType('plate')}
              >
                <Ionicons
                  name="car-outline"
                  size={18}
                  color={filterType === 'plate' ? '#fff' : '#64748b'}
                />
                <Text style={[styles.filterTabText, filterType === 'plate' && styles.filterTabTextActive]}>
                  Plate
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={getFilterPlaceholder()}
                value={filterValue}
                onChangeText={setFilterValue}
                autoCapitalize={filterType === 'mobile' ? 'none' : 'characters'}
              />
            </View>

            {/* Unpaid Only Toggle */}
            <TouchableOpacity
              style={styles.unpaidToggle}
              onPress={() => setUnpaidOnly(!unpaidOnly)}
              testID="unpaid-only-toggle"
            >
              <View style={[styles.checkbox, unpaidOnly && styles.checkboxCheckedRed]}>
                {unpaidOnly && <Ionicons name="checkmark" size={18} color="#fff" />}
              </View>
              <View style={styles.unpaidToggleLabel}>
                <Text style={styles.unpaidToggleText}>Show Unpaid Services Only</Text>
                <Text style={styles.unpaidToggleSubtext}>
                  Filter to show only services that haven&apos;t been paid yet
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.generateButton, loading && styles.buttonDisabled]}
              onPress={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="document-text" size={20} color="#fff" />
                  <Text style={styles.generateButtonText}>Generate Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ========== Reorder Report (low stock < threshold) ========== */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name="package-variant-closed" size={20} color="#b91c1c" />
              <Text style={[styles.sectionTitle, { marginBottom: 0, marginLeft: 8, flex: 1 }]}>
                Reorder Report
              </Text>
            </View>
            <Text style={styles.helperText}>
              Items with stock below the threshold, grouped by supplier — ready to send to each dealer.
            </Text>

            <View style={styles.thresholdRow}>
              <Text style={styles.thresholdLabel}>Stock threshold</Text>
              <View style={styles.thresholdInputWrap}>
                <TouchableOpacity
                  onPress={() => {
                    const cur = parseInt(reorderThreshold, 10) || 5;
                    setReorderThreshold(String(Math.max(1, cur - 1)));
                  }}
                  style={styles.thresholdStep}
                  testID="reorder-threshold-minus"
                >
                  <Ionicons name="remove" size={18} color="#0f172a" />
                </TouchableOpacity>
                <TextInput
                  style={styles.thresholdInput}
                  value={reorderThreshold}
                  onChangeText={(t) => {
                    // digits-only, allow empty while typing
                    const digits = t.replace(/[^\d]/g, '');
                    setReorderThreshold(digits);
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  testID="reorder-threshold-input"
                />
                <TouchableOpacity
                  onPress={() => {
                    const cur = parseInt(reorderThreshold, 10) || 0;
                    setReorderThreshold(String(cur + 1));
                  }}
                  style={styles.thresholdStep}
                  testID="reorder-threshold-plus"
                >
                  <Ionicons name="add" size={18} color="#0f172a" />
                </TouchableOpacity>
              </View>
              <Text style={styles.thresholdSuffix}>
                items
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.generateButton, reorderLoading && styles.buttonDisabled, { backgroundColor: '#b91c1c' }]}
                onPress={handleGenerateReorder}
                disabled={reorderLoading}
                testID="generate-reorder-button"
              >
                {reorderLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="clipboard-list" size={20} color="#fff" />
                    <Text style={styles.generateButtonText}>Generate</Text>
                  </>
                )}
              </TouchableOpacity>
              {reorderGroups && reorderGroups.length > 0 && (
                <TouchableOpacity
                  style={[styles.generateButton, reorderPrinting && styles.buttonDisabled, { backgroundColor: '#7c3aed', flex: 1 }]}
                  onPress={handlePrintReorder}
                  disabled={reorderPrinting}
                  testID="print-reorder-button"
                >
                  {reorderPrinting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="print-outline" size={20} color="#fff" />
                      <Text style={styles.generateButtonText}>Print / Export</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {reorderGroups && (
              reorderGroups.length === 0 ? (
                <View style={styles.reorderEmpty}>
                  <MaterialCommunityIcons name="check-circle" size={24} color="#059669" />
                  <Text style={styles.reorderEmptyText}>
                    All items have stock ≥ {lastThresholdUsed} — nothing to reorder.
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.reorderMetaLine}>
                    Showing items with stock &lt; {lastThresholdUsed}
                  </Text>
                  <ScrollView
                    style={styles.reorderScroll}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    {reorderGroups.map((g) => (
                      <View key={g.supplier_name} style={styles.supplierBlock}>
                        <View style={styles.supplierHeader}>
                          <Text style={styles.supplierName}>{g.supplier_name}</Text>
                          <Text style={styles.supplierBadge}>{g.items.length}</Text>
                        </View>
                        {g.items.map((it) => (
                          <View key={it.id} style={styles.supplierItem}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.supplierItemName} numberOfLines={1}>
                                {it.item_type}
                              </Text>
                              <Text style={styles.supplierItemMeta}>
                                {it.item_number}{it.item_code ? ` • ${it.item_code}` : ''}
                              </Text>
                            </View>
                            <View style={styles.stockPill}>
                              <Text style={styles.stockPillText}>{it.item_quantity}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )
            )}
          </View>

          {/* ========== Suppliers Management ========== */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeaderRow}
              onPress={() => setSuppliersOpen(!suppliersOpen)}
              testID="suppliers-toggle"
            >
              <MaterialCommunityIcons name="truck-outline" size={20} color="#2563eb" />
              <Text style={[styles.sectionTitle, { marginBottom: 0, marginLeft: 8, flex: 1 }]}>
                Suppliers ({suppliers.length})
              </Text>
              <Ionicons
                name={suppliersOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#64748b"
              />
            </TouchableOpacity>

            {suppliersOpen && (
              <>
                <View style={styles.supplierForm}>
                  <TextInput
                    style={styles.input}
                    placeholder="Supplier name (e.g. Bosch, NGK)"
                    value={supplierName}
                    onChangeText={setSupplierName}
                    autoCapitalize="words"
                    testID="supplier-name-input"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Contact info / phone (optional)"
                    value={supplierContact}
                    onChangeText={setSupplierContact}
                    testID="supplier-contact-input"
                  />
                  <View style={styles.supplierBtnRow}>
                    {editingSupplier && (
                      <TouchableOpacity
                        style={styles.supplierCancelBtn}
                        onPress={handleCancelEditSupplier}
                      >
                        <Text style={styles.supplierCancelText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.supplierSaveBtn, savingSupplier && styles.buttonDisabled]}
                      onPress={handleSaveSupplier}
                      disabled={savingSupplier}
                      testID="supplier-save-button"
                    >
                      {savingSupplier ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name={editingSupplier ? 'checkmark' : 'add'} size={16} color="#fff" />
                          <Text style={styles.supplierSaveText}>
                            {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {suppliers.length === 0 ? (
                  <Text style={styles.helperText}>No suppliers yet. Add one above.</Text>
                ) : (
                  <View style={{ marginTop: 6 }}>
                    {suppliers.map((s) => (
                      <View key={s.id} style={styles.supplierRow} testID={`supplier-row-${s.id}`}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.supplierRowName}>{s.name}</Text>
                          {s.contact_info ? (
                            <Text style={styles.supplierRowContact} numberOfLines={1}>
                              {s.contact_info}
                            </Text>
                          ) : null}
                        </View>
                        <TouchableOpacity onPress={() => handleEditSupplier(s)} style={styles.supplierIconBtn}>
                          <Ionicons name="pencil" size={16} color="#2563eb" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteSupplier(s)} style={styles.supplierIconBtn}>
                          <Ionicons name="trash" size={16} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Report Results */}
          {report && (
            <View style={styles.resultsSection}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Services</Text>
                  <Text style={styles.summaryValue}>{report.total_services}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Revenue</Text>
                  <Text style={[styles.summaryValue, styles.totalCost]}>
                    ${report.total_cost.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* PRIVATE cash-flow summary (owner-only, never printed) */}
              {report.outsource_total > 0 && (
                <View style={styles.cashflowCard}>
                  <View style={styles.cashflowHeaderRow}>
                    <Ionicons name="lock-closed" size={13} color="#6b21a8" />
                    <Text style={styles.cashflowHeader}>Cash-Flow (Private)</Text>
                  </View>
                  <View style={styles.cashflowRow}>
                    <Text style={styles.cashflowLabel}>Revenue</Text>
                    <Text style={styles.cashflowValue}>
                      ${report.total_cost.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.cashflowRow}>
                    <Text style={[styles.cashflowLabel, { color: '#dc2626' }]}>
                      − Outsource
                    </Text>
                    <Text style={[styles.cashflowValue, { color: '#dc2626' }]}>
                      − ${report.outsource_total.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.cashflowGrandRow}>
                    <Text style={styles.cashflowGrandLabel}>Net Cash in Hand</Text>
                    <Text style={styles.cashflowGrandValue}>
                      ${report.net_cash_flow.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              {report.unpaid_count > 0 && (
                <View style={styles.unpaidSummaryCard}>
                  <View style={styles.unpaidSummaryRow}>
                    <Ionicons name="alert-circle" size={20} color="#ef4444" />
                    <Text style={styles.unpaidSummaryText}>
                      {report.unpaid_count} unpaid service{report.unpaid_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={styles.unpaidSummaryAmount}>
                    Outstanding: ${report.unpaid_total.toFixed(2)}
                  </Text>
                </View>
              )}

              {(() => {
                const pending = report.items.filter(
                  (i) => !i.is_paid && Number((i as any).partial_paid) > 0
                );
                if (pending.length === 0) return null;
                const totalRemaining = pending.reduce(
                  (s, i) => s + Math.max(0, i.cost - (Number((i as any).partial_paid) || 0)),
                  0
                );
                const totalPartial = pending.reduce(
                  (s, i) => s + (Number((i as any).partial_paid) || 0),
                  0
                );
                return (
                  <View style={styles.pendingSummaryCard} testID="pending-summary">
                    <View style={styles.unpaidSummaryRow}>
                      <Ionicons name="time" size={20} color="#a16207" />
                      <Text style={[styles.unpaidSummaryText, { color: '#a16207' }]}>
                        {pending.length} pending payment{pending.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={[styles.unpaidSummaryAmount, { color: '#a16207' }]}>
                      Paid so far: ${totalPartial.toFixed(2)} • Remaining: ${totalRemaining.toFixed(2)}
                    </Text>
                  </View>
                );
              })()}

              {report.items.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-outline" size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>No services found for the selected filters</Text>
                </View>
              ) : (
                <View style={styles.itemsList}>
                  <Text style={styles.itemsTitle}>Service Records</Text>
                  {report.items.map((item) => {
                    const partial = Number((item as any).partial_paid) || 0;
                    const isPending = !item.is_paid && partial > 0;
                    const isUnpaid = !item.is_paid && partial === 0;
                    return (
                    <View
                      key={item.service_id}
                      style={[
                        styles.reportItem,
                        isUnpaid && styles.reportItemUnpaid,
                        isPending && styles.reportItemPending,
                      ]}
                    >
                      <View style={styles.itemHeader}>
                        <View style={styles.itemIconContainer}>
                          <Ionicons name="construct" size={20} color="#10b981" />
                        </View>
                        <View style={styles.itemInfo}>
                          <View style={styles.itemTitleRow}>
                            <Text style={styles.itemDescription}>{item.service_description}</Text>
                            {isUnpaid && (
                              <View style={styles.unpaidBadge}>
                                <Text style={styles.unpaidBadgeText}>UNPAID</Text>
                              </View>
                            )}
                            {isPending && (
                              <View style={styles.pendingBadge} testID="pending-badge">
                                <Text style={styles.pendingBadgeText}>
                                  PENDING · ${partial.toFixed(0)}/${item.cost.toFixed(0)}
                                </Text>
                              </View>
                            )}
                          </View>
                          {item.additional_info && (
                            <Text style={styles.itemAdditional}>{item.additional_info}</Text>
                          )}
                        </View>
                        {isPending ? (
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.itemCost, styles.itemCostUnpaid]}>
                              ${Math.max(0, item.cost - partial).toFixed(2)}
                            </Text>
                            <Text style={styles.itemCostHint}>
                              remaining
                            </Text>
                          </View>
                        ) : (
                          <Text style={[styles.itemCost, !item.is_paid && styles.itemCostUnpaid]}>
                            ${item.cost.toFixed(2)}
                          </Text>
                        )}
                      </View>
                      <View style={styles.itemDetails}>
                        <View style={styles.detailRow}>
                          <Ionicons name="person-outline" size={14} color="#64748b" />
                          <Text style={styles.detailText}>
                            {item.customer_name} • {item.customer_mobile}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="car-sport-outline" size={14} color="#64748b" />
                          <Text style={styles.detailText}>
                            {item.vehicle_year ? `${item.vehicle_year} ` : ''}
                            {item.vehicle_make} {item.vehicle_model} • {item.vehicle_plate}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="calendar-outline" size={14} color="#64748b" />
                          <Text style={styles.detailText}>
                            {new Date(item.service_date).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
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
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  row: { flexDirection: 'row' },
  inputGroup: { marginBottom: 0 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#1e293b' },
  hint: { fontSize: 12, color: '#64748b', marginTop: 8, fontStyle: 'italic' },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  filterTabActive: { backgroundColor: '#2563eb' },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#64748b', marginLeft: 6 },
  filterTabTextActive: { color: '#fff' },
  unpaidToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxCheckedRed: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  unpaidToggleLabel: {
    marginLeft: 12,
    flex: 1,
  },
  unpaidToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991b1b',
  },
  unpaidToggleSubtext: {
    fontSize: 12,
    color: '#b91c1c',
    marginTop: 2,
  },
  unpaidSummaryCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  unpaidSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  unpaidSummaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991b1b',
    marginLeft: 6,
  },
  unpaidSummaryAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  reportItemUnpaid: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    backgroundColor: '#fef9f9',
  },
  reportItemPending: {
    borderLeftWidth: 4,
    borderLeftColor: '#eab308',
    backgroundColor: '#fffbeb',
  },
  pendingSummaryCard: {
    backgroundColor: '#fefce8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  pendingBadge: {
    backgroundColor: '#eab308',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  pendingBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  unpaidBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  unpaidBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  itemCostUnpaid: {
    color: '#ef4444',
  },
  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  clearButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: { color: '#1e293b', fontSize: 16, fontWeight: '600' },
  generateButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  generateButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  resultsSection: { marginBottom: 32 },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#e2e8f0' },
  summaryLabel: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  summaryValue: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  totalCost: { color: '#10b981' },
  emptyContainer: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 14, color: '#94a3b8', marginTop: 12, textAlign: 'center' },
  itemsList: {},
  itemsTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 12 },
  reportItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  itemIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemDescription: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  itemAdditional: { fontSize: 13, color: '#64748b', marginTop: 2 },
  itemCost: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },
  itemCostHint: {
    fontSize: 10,
    color: '#b45309',
    fontStyle: 'italic',
    marginTop: 2,
  },
  itemDetails: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  detailText: { fontSize: 13, color: '#475569', marginLeft: 8 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  reorderEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    gap: 8,
  },
  reorderEmptyText: {
    color: '#065f46',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  reorderMetaLine: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78716c',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  reorderScroll: {
    maxHeight: 420,
  },
  cashflowCard: {
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#c4b5fd',
    backgroundColor: '#faf5ff',
  },
  cashflowHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cashflowHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6b21a8',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cashflowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  cashflowLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  cashflowValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
  },
  cashflowGrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: '#c4b5fd',
  },
  cashflowGrandLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#6b21a8',
  },
  cashflowGrandValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#059669',
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 10,
  },
  thresholdLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  thresholdInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  thresholdStep: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  thresholdInput: {
    width: 46,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    paddingVertical: 6,
  },
  thresholdSuffix: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  supplierBlock: {
    backgroundColor: '#fefce8',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  supplierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  supplierName: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  supplierBadge: {
    color: '#fff',
    backgroundColor: '#b91c1c',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
  },
  supplierItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  supplierItemName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  supplierItemMeta: { fontSize: 11, color: '#78716c', marginTop: 2 },
  stockPill: {
    backgroundColor: '#dc2626',
    minWidth: 34,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    alignItems: 'center',
  },
  stockPillText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  supplierForm: {
    marginTop: 4,
    gap: 8,
  },
  supplierBtnRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  supplierSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  supplierSaveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  supplierCancelBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supplierCancelText: { color: '#334155', fontWeight: '700', fontSize: 13 },
  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  supplierRowName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  supplierRowContact: { fontSize: 11, color: '#64748b', marginTop: 2 },
  supplierIconBtn: {
    padding: 8,
    marginLeft: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});
