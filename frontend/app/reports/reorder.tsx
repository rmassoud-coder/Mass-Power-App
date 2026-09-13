import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getLowStockBySupplier, LowStockItemBySupplier } from '../../src/db/database';
import { loadSettings } from '../../src/utils/settings';
import { printJob } from '../../src/utils/printService';
import { buildReorderDoc } from '../../src/utils/thermalDoc';
import { MASS_POWER_LOGO_PNG_BASE64 } from '../../src/utils/logoBase64';

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

export default function ReorderReportScreen() {
  const router = useRouter();

  const [reorderGroups, setReorderGroups] = useState<LowStockItemBySupplier[] | null>(null);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [reorderPrinting, setReorderPrinting] = useState(false);
  const [reorderThreshold, setReorderThreshold] = useState('5');
  const [lastThresholdUsed, setLastThresholdUsed] = useState<number>(5);

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
      const thermal = buildReorderDoc(
        reorderGroups,
        settings.garageName,
        settings.garagePhone,
        lastThresholdUsed,
      );
      await printJob(html, { jobName: 'Reorder Report', thermal });
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reorder Report</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
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
            <Text style={styles.thresholdSuffix}>items</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
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
  content: { flex: 1, padding: 16 },
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
  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
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
});
