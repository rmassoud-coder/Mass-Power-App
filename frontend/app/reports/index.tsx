import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface MenuItem {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  route: string;
  color: string;
}

export default function ReportsMenuScreen() {
  const router = useRouter();

  const items: MenuItem[] = [
    {
      key: 'sales',
      title: 'Sales Report',
      subtitle: 'Services, revenue, filters by customer / VIN / plate',
      icon: <Ionicons name="document-text" size={24} color="#2563eb" />,
      route: '/reports/sales',
      color: '#dbeafe',
    },
    {
      key: 'unpaid',
      title: 'Unpaid Services',
      subtitle: 'All outstanding balances — no date limit',
      icon: <Ionicons name="alert-circle" size={24} color="#dc2626" />,
      route: '/reports/unpaid',
      color: '#fee2e2',
    },
    {
      key: 'income',
      title: 'Income by Category',
      subtitle: 'See which services bring in the most money',
      icon: <Ionicons name="stats-chart" size={24} color="#059669" />,
      route: '/reports/income',
      color: '#d1fae5',
    },
    {
      key: 'reorder',
      title: 'Reorder Report',
      subtitle: 'Low-stock items grouped by supplier',
      icon: <MaterialCommunityIcons name="package-variant-closed" size={24} color="#b91c1c" />,
      route: '/reports/reorder',
      color: '#fee2e2',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Pick a report</Text>

        {items.map((it) => (
          <TouchableOpacity
            key={it.key}
            style={styles.card}
            onPress={() => router.push(it.route as any)}
            testID={`report-menu-${it.key}`}
          >
            <View style={[styles.iconWrap, { backgroundColor: it.color }]}>
              {it.icon}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{it.title}</Text>
              <Text style={styles.cardSubtitle}>{it.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </TouchableOpacity>
        ))}
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
  content: { padding: 24 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  cardSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
});
