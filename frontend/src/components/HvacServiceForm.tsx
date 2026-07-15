import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { HvacService } from '../db/database';

interface Props {
  value: HvacService;
  onChange: (next: HvacService) => void;
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

export default function HvacServiceForm({ value, onChange }: Props) {
  React.useEffect(() => {
    if (!value.freonDate) {
      onChange({ ...value, freonDate: todayIso() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [dateText, setDateText] = React.useState<string>(
    formatIsoDate(value.freonDate)
  );

  React.useEffect(() => {
    setDateText(formatIsoDate(value.freonDate));
  }, [value.freonDate]);

  const commitDateText = (txt: string) => {
    setDateText(txt);
    const iso = parseLooseDate(txt);
    onChange({ ...value, freonDate: iso });
  };

  const setToday = () => onChange({ ...value, freonDate: todayIso() });

  return (
    <View>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="snowflake" size={20} color="#0284c7" />
        <Text style={styles.headerText}>HVAC Service Details</Text>
      </View>
      <Text style={styles.subtitle}>
        Printed on the 55mm sticker so the customer & garage always know when freon was added.
      </Text>

      {/* Freon Added Date */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Freon Added Date</Text>
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
            testID="hvac-freon-date"
          />
        </View>
        <View style={styles.presetRow}>
          <TouchableOpacity style={styles.presetBtn} onPress={setToday} testID="hvac-date-today">
            <Text style={styles.presetBtnText}>Today</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Leak Tested */}
      <View style={styles.fieldGroup}>
        <TouchableOpacity
          style={styles.leakRow}
          onPress={() => onChange({ ...value, leakTested: !value.leakTested })}
          testID="hvac-leak-checkbox"
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.checkbox,
              value.leakTested && styles.checkboxChecked,
            ]}
          >
            {value.leakTested && (
              <MaterialCommunityIcons name="check" size={16} color="#fff" />
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.leakLabel}>Tested for Freon Leaks</Text>
            <Text style={styles.leakHint}>
              Tick if the AC circuit was pressure/dye-tested for freon leaks.
            </Text>
          </View>
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color={value.leakTested ? '#0284c7' : '#cbd5e1'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  headerText: { fontSize: 14, fontWeight: '700', color: '#075985', marginLeft: 8 },
  subtitle: { fontSize: 11, color: '#0369a1', marginBottom: 12 },
  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#075985', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: '#bae6fd',
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
    borderColor: '#bae6fd',
  },
  presetBtnText: { fontSize: 11, fontWeight: '600', color: '#0284c7' },
  leakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#7dd3fc',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  leakLabel: { fontSize: 13, fontWeight: '700', color: '#075985' },
  leakHint: { fontSize: 11, color: '#0369a1', marginTop: 2 },
});
