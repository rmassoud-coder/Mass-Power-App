import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  isCatPrinterAvailable,
  scanForCatPrinters,
  ensureCatPrinterPermissions,
  testPrint,
  CatDevice,
} from '../src/utils/catPrinter';
import { loadSettings, saveSettings, AppSettings } from '../src/utils/settings';

export default function CatPrinterScreen() {
  const router = useRouter();
  const [available] = useState<boolean>(() => isCatPrinterAvailable());
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<CatDevice[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = await loadSettings();
    setSettings(s);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleScan = async () => {
    if (!available) return;
    const ok = await ensureCatPrinterPermissions();
    if (!ok) {
      Alert.alert('Bluetooth permission needed', 'Please allow Nearby-Devices / Bluetooth permissions in your Android settings, then try again.');
      return;
    }
    setScanning(true);
    setDevices([]);
    try {
      const found = await scanForCatPrinters(7000);
      setDevices(found);
      if (found.length === 0) {
        Alert.alert(
          'No Cat Printer found',
          'Make sure the printer is turned on, close to the phone, and not connected to another app.',
        );
      }
    } catch (e: any) {
      Alert.alert('Scan failed', e?.message || 'Unknown BLE error');
    } finally {
      setScanning(false);
    }
  };

  const handleTest = async (d: CatDevice) => {
    if (!available) return;
    setTestingId(d.id);
    try {
      await testPrint(d.id, settings?.catPrinterDarkness ?? 3);
      Alert.alert(
        'Sent!',
        'A black-band test pattern was sent to the printer. If it printed, connection is good.',
      );
    } catch (e: any) {
      Alert.alert('Test print failed', e?.message || 'Unknown BLE error');
    } finally {
      setTestingId(null);
    }
  };

  const handleSetDarkness = async (level: number) => {
    if (!settings) return;
    const next: AppSettings = { ...settings, catPrinterDarkness: level };
    await saveSettings(next);
    setSettings(next);
  };

  const handlePair = async (d: CatDevice) => {
    if (!settings) return;
    setSavingId(d.id);
    try {
      const next: AppSettings = {
        ...settings,
        printerMode: 'cat-ble',
        catPrinterId: d.id,
        catPrinterName: d.name,
      };
      await saveSettings(next);
      setSettings(next);
      Alert.alert(
        'Paired',
        `Cat Printer "${d.name}" is now the default. Turn Printer Mode back to "External driver" any time in Settings to disable.`,
      );
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Unknown error');
    } finally {
      setSavingId(null);
    }
  };

  const handleUnpair = async () => {
    if (!settings) return;
    const next: AppSettings = {
      ...settings,
      printerMode: 'external',
      catPrinterId: '',
      catPrinterName: '',
    };
    await saveSettings(next);
    setSettings(next);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Cat Printer (PD01)</Text>
          <Text style={styles.sub}>Scan, pair, and test-print over Bluetooth</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {!available && (
          <View style={styles.warnCard}>
            <MaterialCommunityIcons name="bluetooth-off" size={22} color="#b45309" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.warnTitle}>Bluetooth not available here</Text>
              <Text style={styles.warnText}>
                Direct BLE only works on a real device build. Hit Publish → Generate Build →
                install the APK, then open this screen again.
              </Text>
            </View>
          </View>
        )}

        {/* Currently paired */}
        {settings?.catPrinterId ? (
          <View style={styles.pairedCard}>
            <View style={styles.pairedHeader}>
              <MaterialCommunityIcons name="printer-check" size={22} color="#059669" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.pairedTitle}>Paired Cat Printer</Text>
                <Text style={styles.pairedName}>{settings.catPrinterName || '(unnamed)'}</Text>
                <Text style={styles.pairedId}>{settings.catPrinterId}</Text>
                <Text style={styles.pairedMode}>
                  Mode: {settings.printerMode === 'cat-ble' ? 'Cat Printer BLE' : 'External driver'}
                </Text>
              </View>
            </View>
            <View style={styles.pairedActions}>
              <TouchableOpacity
                style={styles.pairedActionBtn}
                onPress={() => handleTest({ id: settings.catPrinterId, name: settings.catPrinterName })}
                disabled={!available || testingId === settings.catPrinterId}
                testID="paired-test-print"
              >
                {testingId === settings.catPrinterId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="print-outline" size={16} color="#fff" />
                    <Text style={styles.pairedActionText}>Test Print</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pairedActionBtn, { backgroundColor: '#dc2626' }]}
                onPress={handleUnpair}
                testID="paired-unpair"
              >
                <Ionicons name="close-circle" size={16} color="#fff" />
                <Text style={styles.pairedActionText}>Unpair</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.hintCard}>
            <Ionicons name="information-circle" size={22} color="#2563eb" />
            <Text style={styles.hintText}>
              Turn on your PD01, keep it close to the phone, then tap Scan.
            </Text>
          </View>
        )}

        {/* Print darkness */}
        <View style={styles.darkCard} testID="cat-darkness-card">
          <View style={styles.darkHeader}>
            <MaterialCommunityIcons name="brightness-6" size={20} color="#0f172a" />
            <Text style={styles.darkTitle}>Print Darkness</Text>
            <Text style={styles.darkLevel}>{settings?.catPrinterDarkness ?? 3}/5</Text>
          </View>
          <Text style={styles.darkSub}>
            Higher = darker print (uses more battery + heats more paper). 3 is a good default.
          </Text>
          <View style={styles.darkStops}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = (settings?.catPrinterDarkness ?? 3) === n;
              return (
                <TouchableOpacity
                  key={n}
                  style={[styles.darkStop, active && styles.darkStopActive]}
                  onPress={() => handleSetDarkness(n)}
                  testID={`cat-darkness-${n}`}
                >
                  <Text style={[styles.darkStopText, active && styles.darkStopTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Scan button */}
        <TouchableOpacity
          style={[styles.scanBtn, (!available || scanning) && styles.btnDisabled]}
          onPress={handleScan}
          disabled={!available || scanning}
          testID="cat-scan-button"
        >
          {scanning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="bluetooth-connect" size={20} color="#fff" />
              <Text style={styles.scanBtnText}>Scan for Cat Printer</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Results */}
        {devices.map((d) => (
          <View key={d.id} style={styles.deviceRow} testID={`cat-device-${d.id}`}>
            <MaterialCommunityIcons name="printer" size={22} color="#0f172a" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.deviceName}>{d.name}</Text>
              <Text style={styles.deviceMeta}>
                {d.id}{typeof d.rssi === 'number' ? ` • ${d.rssi} dBm` : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: '#0f172a' }]}
              onPress={() => handleTest(d)}
              disabled={testingId === d.id}
            >
              {testingId === d.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.smallBtnText}>Test</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: '#059669', marginLeft: 6 }]}
              onPress={() => handlePair(d)}
              disabled={savingId === d.id}
            >
              {savingId === d.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.smallBtnText}>Pair</Text>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: { padding: 6, marginRight: 6 },
  title: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  warnCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    borderColor: '#fbbf24',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  warnTitle: { color: '#92400e', fontWeight: '800', fontSize: 13 },
  warnText: { color: '#a16207', fontSize: 12, marginTop: 4, lineHeight: 16 },

  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  hintText: { flex: 1, color: '#1e3a8a', fontSize: 12, lineHeight: 16 },

  pairedCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  pairedHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  pairedTitle: { color: '#065f46', fontWeight: '800', fontSize: 12, textTransform: 'uppercase' },
  pairedName: { color: '#064e3b', fontWeight: '900', fontSize: 15, marginTop: 2 },
  pairedId: { color: '#047857', fontSize: 10, marginTop: 2 },
  pairedMode: { color: '#047857', fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  pairedActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pairedActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    borderRadius: 8,
  },
  pairedActionText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 14,
  },
  btnDisabled: { opacity: 0.4 },
  scanBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
  },
  deviceName: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  deviceMeta: { fontSize: 10, color: '#64748b', marginTop: 2 },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
  },
  smallBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  darkCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 14,
  },
  darkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  darkTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: '#0f172a' },
  darkLevel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2563eb',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  darkSub: { fontSize: 11, color: '#64748b', marginBottom: 10 },
  darkStops: { flexDirection: 'row', gap: 6 },
  darkStop: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  darkStopActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  darkStopText: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  darkStopTextActive: { color: '#fff' },
});
