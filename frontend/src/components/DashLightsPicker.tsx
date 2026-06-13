import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { DashLights } from '../db/database';

interface Props {
  value: DashLights;
  onChange: (next: DashLights) => void;
}

interface LightDef {
  key: keyof DashLights;
  label: string;
  iconLib: 'ion' | 'mc';
  icon: string;
  color: string;
}

const LIGHTS: LightDef[] = [
  { key: 'abs', label: 'ABS', iconLib: 'mc', icon: 'car-brake-abs', color: '#f59e0b' },
  { key: 'check_engine', label: 'Check Engine', iconLib: 'mc', icon: 'engine', color: '#dc2626' },
  { key: 'brake', label: 'Brake', iconLib: 'mc', icon: 'car-brake-alert', color: '#ef4444' },
  { key: 'airbag', label: 'Airbag', iconLib: 'mc', icon: 'airbag', color: '#f97316' },
];

export default function DashLightsPicker({ value, onChange }: Props) {
  const toggle = (k: keyof DashLights) => {
    onChange({ ...value, [k]: !value[k] });
  };

  const activeCount = LIGHTS.filter((l) => value[l.key]).length;

  return (
    <View>
      <View style={styles.headerRow}>
        <Ionicons name="warning" size={18} color="#f59e0b" />
        <Text style={styles.headerText}>Dashboard Warning Lights</Text>
        {activeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activeCount}</Text>
          </View>
        )}
      </View>
      <Text style={styles.subtitle}>Tap any light that was ON when this service was performed</Text>
      <View style={styles.grid}>
        {LIGHTS.map((l) => {
          const active = !!value[l.key];
          return (
            <TouchableOpacity
              key={l.key}
              style={[styles.chip, active && { borderColor: l.color, backgroundColor: l.color + '15' }]}
              onPress={() => toggle(l.key)}
              activeOpacity={0.7}
              testID={`dash-${l.key}`}
            >
              {l.iconLib === 'mc' ? (
                <MaterialCommunityIcons name={l.icon as any} size={22} color={active ? l.color : '#94a3b8'} />
              ) : (
                <Ionicons name={l.icon as any} size={22} color={active ? l.color : '#94a3b8'} />
              )}
              <Text style={[styles.chipText, active && { color: l.color, fontWeight: '700' }]}>
                {l.label}
              </Text>
              <View style={[styles.checkBox, active && { backgroundColor: l.color, borderColor: l.color }]}>
                {active && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 8,
  },
  badge: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  subtitle: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    minWidth: '48%',
    flex: 1,
  },
  chipText: {
    fontSize: 13,
    color: '#475569',
    marginLeft: 8,
    flex: 1,
  },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
