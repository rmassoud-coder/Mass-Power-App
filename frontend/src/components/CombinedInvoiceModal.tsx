import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { Service, Vehicle } from '../db/database';

interface Props {
  visible: boolean;
  onClose: () => void;
  services: Service[];
  vehicles: Vehicle[];
  printing: boolean;
  onPrint: (selectedIds: string[], discountAmount: number) => void;
}

/**
 * Modal that lets the mechanic pick which services to include in a single
 * combined invoice, apply a flat money discount, and print the whole thing
 * as one 55mm thermal invoice.
 *
 * Rules for pre-selection:
 *  - Services that are UNPAID or PENDING (partial_paid > 0 or is_paid = 0)
 *    are considered NEW/OPEN and are ticked by default.
 *  - Fully PAID services are considered OLD/CLOSED and are shown but not
 *    ticked. The user can still tick them to include on a reprint.
 */
export default function CombinedInvoiceModal({
  visible,
  onClose,
  services,
  vehicles,
  printing,
  onPrint,
}: Props) {
  const vehicleById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [discountText, setDiscountText] = useState('0');

  // Whenever the modal opens or the services change, pre-tick the open ones
  useEffect(() => {
    if (!visible) return;
    const next = new Set<string>();
    for (const s of services) {
      if (!s.is_paid) next.add(s.id);
    }
    setSelected(next);
    setDiscountText('0');
  }, [visible, services]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOpen = () => {
    setSelected(new Set(services.filter((s) => !s.is_paid).map((s) => s.id)));
  };
  const selectAll = () => setSelected(new Set(services.map((s) => s.id)));
  const clearAll = () => setSelected(new Set());

  const selectedServices = useMemo(
    () => services.filter((s) => selected.has(s.id)),
    [services, selected],
  );

  /** For each service, the amount still owing. If it's PENDING (partial), that's
   *  cost − partial_paid. If it's UNPAID, it's the full cost. If it's already
   *  PAID we still include the full cost because the user explicitly ticked it
   *  (e.g. reprinting an old receipt). */
  const remaining = (s: Service): number => {
    const partial = Number(s.partial_paid) || 0;
    if (!s.is_paid && partial > 0) {
      return Math.max(0, (s.cost || 0) - partial);
    }
    return s.cost || 0;
  };

  const subtotal = selectedServices.reduce((sum, s) => sum + remaining(s), 0);
  const discountValue = Math.max(0, parseFloat(discountText || '0') || 0);
  const cleanDiscount = Math.min(discountValue, subtotal);
  const grandTotal = Math.max(0, subtotal - cleanDiscount);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <MaterialCommunityIcons name="receipt-text" size={20} color="#0f172a" />
            <Text style={styles.title}>Combined Invoice</Text>
            <TouchableOpacity onPress={onClose} disabled={printing}>
              <Ionicons name="close" size={24} color="#0f172a" />
            </TouchableOpacity>
          </View>

          {/* Bulk controls */}
          <View style={styles.bulkRow}>
            <TouchableOpacity style={styles.bulkBtn} onPress={selectAllOpen} testID="invoice-select-open">
              <Ionicons name="alert-circle" size={14} color="#dc2626" />
              <Text style={styles.bulkText}>Open jobs</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bulkBtn} onPress={selectAll} testID="invoice-select-all">
              <Ionicons name="checkmark-done" size={14} color="#2563eb" />
              <Text style={styles.bulkText}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bulkBtn} onPress={clearAll} testID="invoice-clear">
              <Ionicons name="close-circle-outline" size={14} color="#64748b" />
              <Text style={styles.bulkText}>None</Text>
            </TouchableOpacity>
          </View>

          {/* List */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {services.length === 0 ? (
              <Text style={styles.empty}>No services yet for this customer.</Text>
            ) : (
              services.map((s) => {
                const v = vehicleById.get(s.vehicle_id);
                const checked = selected.has(s.id);
                const isOpen = !s.is_paid;
                const dateFmt = new Date(s.service_date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                });
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.row, checked && styles.rowChecked]}
                    onPress={() => toggle(s.id)}
                    activeOpacity={0.7}
                    testID={`invoice-row-${s.id}`}
                  >
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowLine1}>
                        <Text style={styles.rowService} numberOfLines={1}>
                          {s.service_description}
                        </Text>
                        {isOpen ? (
                          <View
                            style={[
                              styles.statusChip,
                              (s.partial_paid || 0) > 0
                                ? styles.chipPending
                                : styles.chipUnpaid,
                            ]}
                          >
                            <Text style={styles.chipText}>
                              {(s.partial_paid || 0) > 0 ? 'PENDING' : 'NEW'}
                            </Text>
                          </View>
                        ) : (
                          <View style={[styles.statusChip, styles.chipPaid]}>
                            <Text style={styles.chipText}>PAID</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {dateFmt}
                        {v ? ` • ${[v.year, v.make, v.model].filter(Boolean).join(' ')}` : ''}
                        {v?.plate_number ? ` • ${v.plate_number}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.rowCost}>${remaining(s).toFixed(2)}</Text>
                      {(s.partial_paid || 0) > 0 && !s.is_paid && (
                        <Text style={styles.rowCostHint}>
                          remaining · paid ${(s.partial_paid || 0).toFixed(0)}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Discount + totals footer */}
          <View style={styles.footer}>
            <View style={styles.discountRow}>
              <Text style={styles.discountLabel}>Discount ($)</Text>
              <TextInput
                style={styles.discountInput}
                value={discountText}
                onChangeText={(t) => setDiscountText(t.replace(/[^\d.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                testID="invoice-discount-input"
              />
            </View>

            <View style={styles.totalsBlock}>
              <View style={styles.totalLine}>
                <Text style={styles.totalLabel}>
                  Subtotal ({selectedServices.length} service{selectedServices.length === 1 ? '' : 's'})
                </Text>
                <Text style={styles.totalValue}>${subtotal.toFixed(2)}</Text>
              </View>
              {cleanDiscount > 0 && (
                <View style={styles.totalLine}>
                  <Text style={[styles.totalLabel, { color: '#dc2626' }]}>Discount</Text>
                  <Text style={[styles.totalValue, { color: '#dc2626' }]}>
                    − ${cleanDiscount.toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={[styles.totalLine, styles.grandLine]}>
                <Text style={styles.grandLabel}>GRAND TOTAL</Text>
                <Text style={styles.grandValue}>${grandTotal.toFixed(2)}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.printBtn,
                (printing || selectedServices.length === 0) && styles.printBtnDisabled,
              ]}
              onPress={() => onPrint([...selected], cleanDiscount)}
              disabled={printing || selectedServices.length === 0}
              testID="invoice-print-button"
            >
              {printing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="print-outline" size={20} color="#fff" />
                  <Text style={styles.printBtnText}>
                    Print Invoice
                    {selectedServices.length > 0 ? ` (${selectedServices.length})` : ''}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 20,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: '#0f172a' },
  bulkRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bulkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bulkText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    fontStyle: 'italic',
    paddingVertical: 30,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    marginBottom: 6,
  },
  rowChecked: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  rowLine1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowService: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  rowMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  rowCost: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f766e',
    marginLeft: 8,
  },
  rowCostHint: {
    fontSize: 9,
    color: '#b45309',
    fontStyle: 'italic',
    marginTop: 2,
    textAlign: 'right',
  },
  statusChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  chipUnpaid: { backgroundColor: '#fee2e2' },
  chipPending: { backgroundColor: '#fef3c7' },
  chipPaid: { backgroundColor: '#dcfce7' },
  chipText: { fontSize: 9, fontWeight: '900', color: '#0f172a', letterSpacing: 0.5 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    padding: 16,
    gap: 12,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  discountLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  discountInput: {
    width: 110,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  totalsBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  totalLabel: { fontSize: 12, color: '#334155', fontWeight: '600' },
  totalValue: { fontSize: 13, color: '#0f172a', fontWeight: '700' },
  grandLine: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1.5,
    borderTopColor: '#0f172a',
  },
  grandLabel: { fontSize: 14, color: '#0f172a', fontWeight: '900' },
  grandValue: { fontSize: 18, color: '#0f172a', fontWeight: '900' },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 10,
  },
  printBtnDisabled: { opacity: 0.4 },
  printBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
