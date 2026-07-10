import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BatteryReplacement } from '../db/database';

interface Props {
  value: BatteryReplacement;
  onChange: (next: BatteryReplacement) => void;
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
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function BatteryReplacementForm({ value, onChange }: Props) {
  // Default install date to today if not set yet
  React.useEffect(() => {
    if (!value.installDate) {
      onChange({ ...value, installDate: todayIso() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [dateText, setDateText] = React.useState<string>(
    formatIsoDate(value.installDate)
  );

  React.useEffect(() => {
    setDateText(formatIsoDate(value.installDate));
  }, [value.installDate]);

  const commitDateText = (txt: string) => {
    setDateText(txt);
    const iso = parseLooseDate(txt);
    onChange({ ...value, installDate: iso });
  };

  const setToday = () => onChange({ ...value, installDate: todayIso() });

  const warrantyOptions: Array<{ months: number; label: string }> = [
    { months: 6, label: '6 months' },
    { months: 12, label: '1 year' },
  ];

  return (
    <View>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="car-battery" size={20} color="#059669" />
        <Text style={styles.headerText}>Battery Details</Text>
      </View>
      <Text style={styles.subtitle}>
        Printed on the 55mm sticker so the customer & garage always know install date & warranty.
      </Text>

      {/* Amp Rate */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Amp Rate <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.inputRow}>
          <MaterialCommunityIcons name="flash" size={18} color="#64748b" style={styles.icon} />
          <TextInput
            style={styles.input}
            value={value.ampRate}
            onChangeText={(t) => onChange({ ...value, ampRate: t })}
            placeholder="e.g. 700 CCA or 80 Ah"
            placeholderTextColor="#94a3b8"
            autoCapitalize="characters"
            autoCorrect={false}
            testID="battery-amp-rate"
          />
        </View>
      </View>

      {/* Install Date */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Installation Date</Text>
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
            testID="battery-install-date"
          />
        </View>
        <View style={styles.presetRow}>
          <TouchableOpacity style={styles.presetBtn} onPress={setToday} testID="battery-date-today">
            <Text style={styles.presetBtnText}>Today</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Warranty */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Warranty Length</Text>
        <View style={styles.presetRow}>
          {warrantyOptions.map((opt) => (
            <TouchableOpacity
              key={opt.months}
              style={[
                styles.warrantyBtn,
                value.warrantyMonths === opt.months && styles.warrantyBtnActive,
              ]}
              onPress={() => onChange({ ...value, warrantyMonths: opt.months })}
              testID={`battery-warranty-${opt.months}`}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={
                  value.warrantyMonths === opt.months
                    ? 'shield-check'
                    : 'shield-outline'
                }
                size={16}
                color={value.warrantyMonths === opt.months ? '#fff' : '#059669'}
              />
              <Text
                style={[
                  styles.warrantyBtnText,
                  value.warrantyMonths === opt.months && styles.warrantyBtnTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Parasitic Draw Tested */}
      <View style={styles.fieldGroup}>
        <TouchableOpacity
          style={styles.parasiticRow}
          onPress={() =>
            onChange({ ...value, parasiticTested: !value.parasiticTested })
          }
          testID="battery-parasitic-checkbox"
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.checkbox,
              value.parasiticTested && styles.checkboxChecked,
            ]}
          >
            {value.parasiticTested && (
              <MaterialCommunityIcons name="check" size={16} color="#fff" />
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.parasiticLabel}>Parasitic Draw Tested</Text>
            <Text style={styles.parasiticHint}>
              Tick if the vehicle was tested for parasitic current draw during install.
            </Text>
          </View>
          <MaterialCommunityIcons
            name="current-dc"
            size={22}
            color={value.parasiticTested ? '#059669' : '#cbd5e1'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  headerText: { fontSize: 14, fontWeight: '700', color: '#065f46', marginLeft: 8 },
  subtitle: { fontSize: 11, color: '#047857', marginBottom: 12 },
  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#065f46', marginBottom: 6 },
  required: { color: '#dc2626', fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#1e293b', paddingVertical: 0 },
  presetRow: { flexDirection: 'row', marginTop: 6, gap: 6 },
  presetBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  presetBtnText: { fontSize: 11, fontWeight: '600', color: '#059669' },
  warrantyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  warrantyBtnActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  warrantyBtnText: { fontSize: 13, fontWeight: '700', color: '#059669' },
  warrantyBtnTextActive: { color: '#fff' },
  parasiticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#6ee7b7',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  parasiticLabel: { fontSize: 13, fontWeight: '700', color: '#065f46' },
  parasiticHint: { fontSize: 11, color: '#047857', marginTop: 2 },
});
