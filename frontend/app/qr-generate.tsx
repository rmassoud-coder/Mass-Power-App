import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import bwipjs from '@bwip-js/react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { currentMonthPayload } from '../src/utils/guaranteeQr';

/**
 * Generates the monthly Mass Power guarantee sticker as a **Data Matrix** at
 * the smallest available size (10×10 modules, ECC200). The payload is a bare
 * `YYYYMM` numeric string — 6 digits, the maximum a 10×10 Data Matrix can hold.
 */
export default function QrGenerateScreen() {
  const router = useRouter();
  const [now, setNow] = useState(() => currentMonthPayload());
  const [printing, setPrinting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [bcError, setBcError] = useState<string | null>(null);

  useEffect(() => {
    // Recompute payload each minute so a midnight month-rollover updates the screen.
    const interval = setInterval(() => setNow(currentMonthPayload()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Regenerate the Data Matrix image whenever the payload changes
  useEffect(() => {
    let cancelled = false;
    setBcError(null);
    setDataUrl(null);
    (async () => {
      try {
        const png = await bwipjs.toDataURL({
          bcid: 'datamatrix',
          text: now.payload,
          scale: 20,              // big preview, still crisp when printed small
          padding: 2,             // quiet zone (modules)
          version: '10x10',       // force smallest size
          backgroundcolor: 'FFFFFF',
          barcolor: '000000',
        } as Record<string, unknown>);
        // @bwip-js/react-native returns an object — uri is the data URL
        const uri =
          typeof png === 'string'
            ? png
            : (png as { uri?: string }).uri ||
              (png as { url?: string }).url ||
              null;
        if (!cancelled && uri) setDataUrl(uri);
        else if (!cancelled) setBcError('No Data Matrix image was returned.');
      } catch (e: any) {
        if (!cancelled) setBcError(e?.message || 'Data Matrix generation failed.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [now.payload]);

  const monthLabel = useMemo(() => {
    const d = new Date(now.year, now.month - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [now]);

  // Extract the raw base64 portion of the data URL for file writes / HTML print
  const base64Body = useMemo(() => {
    if (!dataUrl) return '';
    const m = /^data:image\/[^;]+;base64,(.+)$/.exec(dataUrl);
    return m ? m[1] : '';
  }, [dataUrl]);

  const buildPrintHtml = (imageUri: string, label: string): string => {
    // Minimal, cutting-friendly sheet: no titles, no borders, no metadata.
    // Just a tidy grid of Data Matrix stickers you can cut out. A thin dashed
    // outline sits around each sticker (visible on paper, easy cutting guide).
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Guarantee Stickers ${label}</title>
  <style>
    @page { size: A4; margin: 6mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #fff; color: #000; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4mm;
      padding: 2mm;
    }
    .sticker {
      width: 46mm;
      height: 30mm;
      padding: 1.5mm;
      border: 0.15mm dashed #999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .sticker img {
      display: block;
      width: 22mm;
      height: 22mm;
      object-fit: contain;
    }
    .sticker .lbl {
      font-size: 8pt;
      font-weight: 800;
      line-height: 1;
      margin-top: 1mm;
      letter-spacing: 0.4pt;
    }
  </style>
</head>
<body>
  <div class="grid">
    ${Array.from({ length: 28 })
      .map(
        () => `
      <div class="sticker">
        <img src="${imageUri}" alt="" />
        <div class="lbl">${label}</div>
      </div>`
      )
      .join('')}
  </div>
</body>
</html>`;
  };

  const handlePrint = async () => {
    if (printing) return;
    if (!dataUrl) {
      Alert.alert('Not ready', 'The Data Matrix is still rendering. Please try again.');
      return;
    }
    setPrinting(true);
    try {
      const html = buildPrintHtml(dataUrl, monthLabel);
      await Print.printAsync({ html });
    } catch (e: any) {
      Alert.alert('Print failed', e?.message || 'Could not open the print dialog.');
    } finally {
      setPrinting(false);
    }
  };

  const handleSaveImage = async () => {
    if (saving) return;
    if (!dataUrl || !base64Body) {
      Alert.alert('Not ready', 'The Data Matrix is still rendering. Please try again.');
      return;
    }
    setSaving(true);
    try {
      const safeLabel = `${now.year}-${String(now.month).padStart(2, '0')}`;
      const fileName = `mass-power-dm-${safeLabel}.png`;

      // ---- Web preview path: trigger a real browser download ----
      if (Platform.OS === 'web') {
        try {
          const doc: any = (globalThis as any).document;
          if (doc?.createElement) {
            const link = doc.createElement('a');
            link.href = dataUrl;
            link.download = fileName;
            doc.body.appendChild(link);
            link.click();
            doc.body.removeChild(link);
            return;
          }
        } catch {
          // fall through to alert below
        }
        Alert.alert('Download', 'Could not start the download — long-press the image to save it.');
        return;
      }

      // ---- Native path (Android / iOS): write file + share ----
      const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      if (!cacheDir) throw new Error('No writable directory available.');
      const fileUri = `${cacheDir}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, base64Body, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(
          'Saved',
          `Data Matrix image saved to:\n${fileUri}\n\n(Sharing is not available on this device — open a file manager to access it.)`
        );
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/png',
        dialogTitle: `Save Data Matrix — ${monthLabel}`,
        UTI: 'public.png',
      });
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not save the image.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>Monthly Guarantee Code</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <View style={styles.matrixFrame}>
            {dataUrl ? (
              <Image
                source={{ uri: dataUrl }}
                style={styles.matrixImage}
                resizeMode="contain"
              />
            ) : bcError ? (
              <Text style={{ color: '#dc2626', padding: 16, textAlign: 'center' }}>
                {bcError}
              </Text>
            ) : (
              <ActivityIndicator size="large" color="#7c3aed" />
            )}
          </View>
          <Text style={styles.payload}>{now.payload}</Text>
          <Text style={styles.hint}>
            Data Matrix (ECC200) at 10×10 modules — the smallest size available. Encodes
            6 numeric digits (YYYYMM) and remains readable at the 1cm × 1cm print size.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, styles.btnSave, (saving || !base64Body) && styles.btnDisabled]}
          onPress={handleSaveImage}
          disabled={saving || !base64Body}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="image" size={20} color="#fff" />
              <Text style={styles.btnText}>Save as PNG / Share</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnPrint, (printing || !dataUrl) && styles.btnDisabled]}
          onPress={handlePrint}
          disabled={printing || !dataUrl}
          activeOpacity={0.85}
        >
          {printing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="print" size={20} color="#fff" />
              <Text style={styles.btnText}>Print Sheet (28 stickers)</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.footer}>
          The code rotates automatically — opening this screen at the start of a new month
          will show the new value without doing anything.
        </Text>
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
  scroll: { padding: 16, paddingBottom: 32, alignItems: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
  },
  monthLabel: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 14 },
  matrixFrame: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixImage: { width: 220, height: 220 },
  payload: {
    marginTop: 12,
    fontSize: 16,
    color: '#475569',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
    fontWeight: '800',
  },
  hint: { marginTop: 8, fontSize: 12, color: '#64748b', textAlign: 'center' },
  btn: {
    width: '100%',
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPrint: { backgroundColor: '#7c3aed' },
  btnSave: { backgroundColor: '#2563eb' },
  btnDisabled: { backgroundColor: '#94a3b8' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  footer: { marginTop: 14, fontSize: 12, color: '#94a3b8', textAlign: 'center' },
});
