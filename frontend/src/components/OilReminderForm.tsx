import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { OilReminder } from '../db/database';

interface Props {
  value: OilReminder;
  onChange: (next: OilReminder) => void;
}

function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  } catch {
    return iso || '';
  }
}

function parseLooseDate(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Try DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/;
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  let yy = 0,
    mm = 0,
    dd = 0;
  const m1 = trimmed.match(dmy);
  const m2 = trimmed.match(ymd);
  if (m1) {
    dd = parseInt(m1[1], 10);
    mm = parseInt(m1[2], 10);
    yy = parseInt(m1[3], 10);
    if (yy < 100) yy += 2000;
  } else if (m2) {
    yy = parseInt(m2[1], 10);
    mm = parseInt(m2[2], 10);
    dd = parseInt(m2[3], 10);
  } else {
    return null;
  }
  const d = new Date(Date.UTC(yy, mm - 1, dd));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function addMonths(iso: string | null, months: number): string {
  const base = iso ? new Date(iso) : new Date();
  base.setMonth(base.getMonth() + months);
  return base.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function OilReminderForm({ value, onChange }: Props) {
  const [dateText, setDateText] = React.useState<string>(formatIsoDate(value.nextServiceDate));

  // Keep local text in sync if parent changes value
  React.useEffect(() => {
    setDateText(formatIsoDate(value.nextServiceDate));
  }, [value.nextServiceDate]);

  const commitDateText = (txt: string) => {
    setDateText(txt);
    const iso = parseLooseDate(txt);
    onChange({ ...value, nextServiceDate: iso });
  };

  const presetDate = (months: number) => {
    const iso = addMonths(value.nextServiceDate || todayIso(), months);
    onChange({ ...value, nextServiceDate: iso });
  };

  const presetMileage = (delta: number) => {
    const base = value.currentMileage ?? 0;
    onChange({ ...value, nextServiceMileage: base + delta });
  };

  const onCurrentMileageChange = (txt: string) => {
    const cleaned = txt.replace(/[^0-9]/g, '');
    onChange({ ...value, currentMileage: cleaned ? parseInt(cleaned, 10) : null });
  };

  const onNextMileageChange = (txt: string) => {
    const cleaned = txt.replace(/[^0-9]/g, '');
    onChange({ ...value, nextServiceMileage: cleaned ? parseInt(cleaned, 10) : null });
  };

  return (
    <View>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="oil" size={20} color="#f59e0b" />
        <Text style={styles.headerText}>Next Oil Change Reminder</Text>
      </View>
      <Text style={styles.subtitle}>Captured on the printed receipt so the customer remembers when to come back.</Text>

      {/* Current Mileage */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Current Mileage (km)</Text>
        <View style={styles.inputRow}>
          <MaterialCommunityIcons name="speedometer" size={18} color="#64748b" style={styles.icon} />
          <TextInput
            style={styles.input}
            value={value.currentMileage != null ? String(value.currentMileage) : ''}
            onChangeText={onCurrentMileageChange}
            keyboardType="number-pad"
            placeholder="e.g. 125000"
            placeholderTextColor="#94a3b8"
            testID="oil-current-mileage"
          />
          <Text style={styles.unit}>km</Text>
        </View>
      </View>

      {/* Next Service Date */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Next Oil Change Date</Text>
        <View style={styles.inputRow}>
          <MaterialCommunityIcons name="calendar" size={18} color="#64748b" style={styles.icon} />
          <TextInput
            style={styles.input}
            value={dateText}
            onChangeText={(t) => setDateText(t)}
            onBlur={() => commitDateText(dateText)}
            placeholder="DD/MM/YYYY"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoCorrect={false}
            testID="oil-next-date"
          />
        </View>
        <View style={styles.presetRow}>
          <TouchableOpacity style={styles.presetBtn} onPress={() => presetDate(3)} testID="oil-date-3mo">
            <Text style={styles.presetBtnText}>+3 months</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetBtn} onPress={() => presetDate(6)} testID="oil-date-6mo">
            <Text style={styles.presetBtnText}>+6 months</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetBtn} onPress={() => presetDate(12)} testID="oil-date-12mo">
            <Text style={styles.presetBtnText}>+12 months</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Next Service Mileage */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Next Oil Change Mileage (km)</Text>
        <View style={styles.inputRow}>
          <MaterialCommunityIcons name="map-marker-distance" size={18} color="#64748b" style={styles.icon} />
          <TextInput
            style={styles.input}
            value={value.nextServiceMileage != null ? String(value.nextServiceMileage) : ''}
            onChangeText={onNextMileageChange}
            keyboardType="number-pad"
            placeholder="e.g. 130000"
            placeholderTextColor="#94a3b8"
            testID="oil-next-mileage"
          />
          <Text style={styles.unit}>km</Text>
        </View>
        <View style={styles.presetRow}>
          <TouchableOpacity style={styles.presetBtn} onPress={() => presetMileage(5000)} testID="oil-mileage-5k">
            <Text style={styles.presetBtnText}>+5,000 km</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetBtn} onPress={() => presetMileage(7500)} testID="oil-mileage-75">
            <Text style={styles.presetBtnText}>+7,500 km</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetBtn} onPress={() => presetMileage(10000)} testID="oil-mileage-10k">
            <Text style={styles.presetBtnText}>+10,000 km</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  headerText: { fontSize: 14, fontWeight: '700', color: '#92400e', marginLeft: 8 },
  subtitle: { fontSize: 11, color: '#a16207', marginBottom: 12 },
  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#78350f', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#1e293b', paddingVertical: 0 },
  unit: { fontSize: 12, color: '#94a3b8', marginLeft: 4 },
  presetRow: { flexDirection: 'row', marginTop: 6, gap: 6 },
  presetBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  presetBtnText: { fontSize: 11, fontWeight: '600', color: '#b45309' },
});
