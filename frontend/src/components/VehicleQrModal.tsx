import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import type { Customer, Vehicle, Service } from '../db/database';
import { loadSettings, buildVehicleQrUrl, AppSettings } from '../utils/settings';
import { buildVehicleHistoryHtml } from '../utils/htmlBuilder';
import { shareHtml, sharePdfFromHtml } from '../utils/printer';

interface Props {
  visible: boolean;
  customer: Customer | null;
  vehicle: Vehicle | null;
  services: Service[];
  onClose: () => void;
}

export default function VehicleQrModal({ visible, customer, vehicle, services, onClose }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const qrRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      loadSettings().then(setSettings);
    }
  }, [visible]);

  if (!vehicle || !customer) return null;

  const url = settings ? buildVehicleQrUrl(settings.githubBaseUrl, vehicle.id) : '';

  const handleExportHtml = async () => {
    if (!settings) return;
    setBusy(true);
    try {
      const html = buildVehicleHistoryHtml(customer, vehicle, services, settings);
      await shareHtml(html, `${vehicle.id}`);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Unable to export HTML');
    } finally {
      setBusy(false);
    }
  };

  const handleExportPdf = async () => {
    if (!settings) return;
    setBusy(true);
    try {
      const html = buildVehicleHistoryHtml(customer, vehicle, services, settings);
      const fname = `${vehicle.make}_${vehicle.model}_${vehicle.plate_number}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      await sharePdfFromHtml(html, fname);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Unable to export PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Vehicle QR Code</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <Text style={styles.vehicleTitle}>
              {vehicle.year ? `${vehicle.year} ` : ''}{vehicle.make} {vehicle.model}
            </Text>
            <Text style={styles.vehicleSub}>Plate: {vehicle.plate_number}</Text>

            <View style={styles.qrBox}>
              {settings ? (
                <QRCode
                  value={url || 'https://example.com'}
                  size={200}
                  backgroundColor="#ffffff"
                  color="#000000"
                  getRef={(c) => (qrRef.current = c)}
                />
              ) : (
                <ActivityIndicator />
              )}
            </View>

            <View style={styles.urlBox}>
              <Text style={styles.urlLabel}>QR points to:</Text>
              <Text style={styles.urlText} numberOfLines={2}>{url || 'Loading...'}</Text>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={18} color="#2563eb" />
              <Text style={styles.infoText}>
                Export the HTML below and upload it to your GitHub Pages repo as <Text style={{ fontWeight: 'bold' }}>{vehicle.id}.html</Text>. Customers can then scan the QR to view their service history online.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.actionBtn, styles.primaryBtn]}
              onPress={handleExportHtml}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="code-slash" size={20} color="#fff" />
                  <Text style={styles.btnText}>Export HTML (for GitHub Pages)</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.secondaryBtn]}
              onPress={handleExportPdf}
              disabled={busy}
            >
              <Ionicons name="document-text" size={20} color="#2563eb" />
              <Text style={[styles.btnText, { color: '#2563eb' }]}>Export PDF (printable)</Text>
            </TouchableOpacity>

            <Text style={styles.serviceCount}>{services.length} service record{services.length !== 1 ? 's' : ''} included</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  closeBtn: { padding: 4 },
  body: { paddingHorizontal: 20 },
  bodyContent: { paddingTop: 16, paddingBottom: 16, alignItems: 'center' },
  vehicleTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  vehicleSub: { fontSize: 13, color: '#64748b', marginTop: 2, marginBottom: 16 },
  qrBox: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  urlBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  urlLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  urlText: { fontSize: 13, color: '#1e293b', fontFamily: 'Courier' },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 16,
    width: '100%',
  },
  infoText: { flex: 1, fontSize: 12, color: '#1e40af', marginLeft: 8, lineHeight: 17 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    marginBottom: 10,
  },
  primaryBtn: { backgroundColor: '#2563eb' },
  secondaryBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#2563eb' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15, marginLeft: 8 },
  serviceCount: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
});
