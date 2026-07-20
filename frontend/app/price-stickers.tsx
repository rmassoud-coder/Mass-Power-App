import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { listInventory, InventoryItem } from '../src/db/database';
import { loadSettings } from '../src/utils/settings';
import { printHtml } from '../src/utils/printer';
import { buildPriceStickersHtml } from '../src/utils/htmlBuilder';

export default function PriceStickersScreen() {
  const router = useRouter();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listInventory();
      setItems(list);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.item_type.toLowerCase().includes(q) ||
        (it.item_code || '').toLowerCase().includes(q) ||
        (it.item_supplier || '').toLowerCase().includes(q) ||
        it.item_number.toLowerCase().includes(q),
    );
  }, [items, search]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const it of filtered) next.add(it.id);
      return next;
    });
  };

  const clearAll = () => setSelectedIds(new Set());

  const handlePrint = async () => {
    if (selectedIds.size === 0) {
      Alert.alert('No items selected', 'Tick at least one item to print a price sticker.');
      return;
    }
    setPrinting(true);
    try {
      const settings = await loadSettings();
      const selected = items.filter((it) => selectedIds.has(it.id));
      const html = buildPriceStickersHtml(selected, settings.garageName);
      await printHtml(html);
    } catch (e: any) {
      Alert.alert(
        'Print failed',
        e?.message ||
          'Unable to open printer. Make sure your thermal printer is paired and a print service (PrinterShare / RawBT) is installed.',
      );
    } finally {
      setPrinting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Price Stickers</Text>
          <Text style={styles.headerSub}>
            {selectedIds.size} selected • {items.length} items
          </Text>
        </View>
        <TouchableOpacity onPress={load} style={styles.iconBtn}>
          <Ionicons name="refresh" size={20} color="#1e293b" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search item, code, supplier…"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          testID="sticker-search-input"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Bulk controls */}
      <View style={styles.bulkRow}>
        <TouchableOpacity style={styles.bulkBtn} onPress={selectAllVisible} testID="sticker-select-all">
          <Ionicons name="checkmark-done" size={14} color="#7c3aed" />
          <Text style={styles.bulkText}>
            Select all{search ? ' (filtered)' : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bulkBtn} onPress={clearAll} testID="sticker-clear-all">
          <Ionicons name="close-circle-outline" size={14} color="#dc2626" />
          <Text style={[styles.bulkText, { color: '#dc2626' }]}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* List — FlatList so it always scrolls even with 1000+ rows */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color="#7c3aed" />
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 120 }}
          data={filtered}
          keyExtractor={(it) => it.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="tag-off" size={40} color="#cbd5e1" />
              <Text style={styles.emptyText}>
                {items.length === 0
                  ? 'No inventory yet — add items from the Inventory screen first.'
                  : `No items match "${search.trim()}"`}
              </Text>
            </View>
          }
          renderItem={({ item: it }) => {
            const retail =
              it.item_retail_price && it.item_retail_price > 0
                ? it.item_retail_price
                : it.item_price;
            const checked = selectedIds.has(it.id);
            return (
              <TouchableOpacity
                style={[styles.row, checked && styles.rowChecked]}
                onPress={() => toggle(it.id)}
                activeOpacity={0.7}
                testID={`sticker-row-${it.id}`}
              >
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {it.item_type}
                  </Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {it.item_number}
                    {it.item_code ? ` • ${it.item_code}` : ''}
                    {it.item_supplier ? ` • ${it.item_supplier}` : ''}
                  </Text>
                </View>
                <Text style={styles.itemPrice}>${retail.toFixed(2)}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Floating Print button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.printBtn,
            (printing || selectedIds.size === 0) && styles.printBtnDisabled,
          ]}
          onPress={handlePrint}
          disabled={printing || selectedIds.size === 0}
          testID="print-stickers-button"
        >
          {printing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="print-outline" size={20} color="#fff" />
              <Text style={styles.printBtnText}>
                Print {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}
                Sticker{selectedIds.size === 1 ? '' : 's'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 6,
  },
  backBtn: { padding: 6 },
  iconBtn: { padding: 8 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginTop: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    padding: 0,
  },
  bulkRow: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
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
  bulkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c3aed',
    letterSpacing: 0.3,
  },

  list: { flex: 1, paddingHorizontal: 12, paddingTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    gap: 10,
  },
  rowChecked: {
    backgroundColor: '#faf5ff',
    borderColor: '#c4b5fd',
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
  checkboxChecked: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  itemName: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  itemMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: '900', color: '#0f766e', marginLeft: 8 },

  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 30,
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 12,
  },
  printBtnDisabled: { opacity: 0.4 },
  printBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
