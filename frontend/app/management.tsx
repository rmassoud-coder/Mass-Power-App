import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type Tile = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  route: string;
  testID: string;
  description?: string;
};

const TILES: Tile[] = [
  {
    label: 'Inventory',
    icon: 'cube-outline',
    color: '#fff',
    bg: '#0f766e',
    route: '/inventory',
    testID: 'tile-inventory',
    description: 'Manage parts, oil filters, stock & prices',
  },
  {
    label: 'Oil Change Reminders',
    icon: 'logo-whatsapp',
    color: '#fff',
    bg: '#25D366',
    route: '/reminders',
    testID: 'tile-reminders',
    description: 'WhatsApp customers when service is due',
  },
  {
    label: 'Services Report',
    icon: 'document-text-outline',
    color: '#fff',
    bg: '#2563eb',
    route: '/report',
    testID: 'tile-report',
    description: 'View / export all services',
  },
  {
    label: 'Backup & Restore',
    icon: 'cloud-download-outline',
    color: '#0f172a',
    bg: '#e2e8f0',
    route: '/backup',
    testID: 'tile-backup',
    description: 'Save & restore your database',
  },
  {
    label: 'Settings',
    icon: 'settings-outline',
    color: '#0f172a',
    bg: '#e2e8f0',
    route: '/settings',
    testID: 'tile-settings',
    description: 'Garage profile, GitHub, country code',
  },
  {
    label: 'Monthly QR',
    icon: 'qr-code-outline',
    color: '#fff',
    bg: '#7c3aed',
    route: '/qr-generate',
    testID: 'tile-qr-generate',
    description: 'Print this month\'s guarantee QR sticker',
  },
  {
    label: 'Scan Guarantee QR',
    icon: 'scan-outline',
    color: '#fff',
    bg: '#dc2626',
    route: '/qr-scan',
    testID: 'tile-qr-scan',
    description: 'Read a sticker to see its month & year',
  },
];

export default function ManagementScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>Backend Management</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.grid}>
          {TILES.map((t) => (
            <TouchableOpacity
              key={t.route}
              style={[styles.tile, { backgroundColor: t.bg }]}
              onPress={() => router.push(t.route as never)}
              activeOpacity={0.85}
              testID={t.testID}
            >
              <View style={styles.iconBubble}>
                <Ionicons name={t.icon} size={28} color={t.color} />
              </View>
              <Text style={[styles.tileLabel, { color: t.color }]}>{t.label}</Text>
              {t.description ? (
                <Text style={[styles.tileDesc, { color: t.color, opacity: 0.85 }]}>
                  {t.description}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  scroll: { padding: 16, paddingBottom: 32 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    width: '48%',
    minHeight: 140,
    borderRadius: 16,
    padding: 14,
    justifyContent: 'space-between',
    elevation: 2,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 6,
  },
  tileDesc: { fontSize: 11, marginTop: 4, lineHeight: 14 },
});
