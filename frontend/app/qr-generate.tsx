import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Print from 'expo-print';
import { currentMonthPayload } from '../src/utils/guaranteeQr';
import { loadSettings, type AppSettings } from '../src/utils/settings';

export default function QrGenerateScreen() {
  const router = useRouter();
  const [now, setNow] = useState(() => currentMonthPayload());
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [printing, setPrinting] = useState(false);
  const qrRef = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
    // Recompute when the screen mounts; also re-check every minute so a midnight
    // month change auto-updates without the user closing the screen.
    const interval = setInterval(() => {
      setNow(currentMonthPayload());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const monthLabel = useMemo(() => {
    const d = new Date(now.year, now.month - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [now]);

  const buildPrintHtml = (base64Png: string, label: string, payload: string): string => {
    const garage = settings?.garageName || 'Mass Power Auto Services';
    // Sticker is rendered exactly 1cm × 1cm for the QR with a tiny label below
    // it for the human-readable date. Multiple copies per A4 sheet for easy
    // cutting.
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${garage} – Guarantee QR ${label}</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; color: #000; }
    h1 { font-size: 14px; margin: 0 0 6mm 0; }
    .header { font-size: 11px; margin-bottom: 6mm; color: #333; }
    .grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 4mm;
    }
    .sticker {
      width: 18mm; /* a little frame */
      padding: 1mm;
      border: 0.2mm dashed #999;
      text-align: center;
    }
    .sticker img {
      display: block;
      width: 10mm;  /* exact 1cm QR */
      height: 10mm;
      margin: 0 auto 0.6mm auto;
      image-rendering: pixelated;
    }
    .sticker .lbl {
      font-size: 6pt;
      font-weight: 700;
      line-height: 1;
    }
    .sticker .sub {
      font-size: 5pt;
      color: #555;
      margin-top: 0.4mm;
    }
  </style>
</head>
<body>
  <h1>${garage} — Guarantee Stickers</h1>
  <div class="header">Month: <b>${label}</b> &nbsp;•&nbsp; Code: ${payload}</div>
  <div class="grid">
    ${Array.from({ length: 56 })
      .map(
        () => `
      <div class="sticker">
        <img src="data:image/png;base64,${base64Png}" alt="QR" />
        <div class="lbl">${label}</div>
        <div class="sub">MPAS</div>
      </div>`
      )
      .join('')}
  </div>
</body>
</html>`;
  };

  const handlePrint = async () => {
    if (printing) return;
    if (!qrRef.current) {
      Alert.alert('QR not ready', 'The QR code is still rendering. Please try again.');
      return;
    }
    setPrinting(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        qrRef.current!.toDataURL((data: string) => {
          if (!data) reject(new Error('Could not export QR.'));
          else resolve(data);
        });
      });
      const html = buildPrintHtml(base64, monthLabel, now.payload);
      await Print.printAsync({ html });
    } catch (e: any) {
      Alert.alert('Print failed', e?.message || 'Could not open the print dialog.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>Monthly Guarantee QR</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <View style={styles.qrFrame}>
            <QRCode
              value={now.payload}
              size={220}
              ecl="L"
              quietZone={6}
              backgroundColor="#ffffff"
              color="#000000"
              getRef={(r) => (qrRef.current = r as never)}
            />
          </View>
          <Text style={styles.payload}>{now.payload}</Text>
          <Text style={styles.hint}>
            Smallest QR profile (Version 1, low ECC). Designed to remain readable at 1cm × 1cm
            when printed.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, styles.btnPrint, printing && styles.btnDisabled]}
          onPress={handlePrint}
          disabled={printing}
          activeOpacity={0.85}
        >
          {printing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="print" size={20} color="#fff" />
              <Text style={styles.btnText}>Print Sheet (56 stickers)</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.footer}>
          The QR rotates automatically — open this screen on the first day of a new month and
          you&apos;ll see the new code without doing anything.
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
  monthLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 14,
  },
  qrFrame: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  payload: {
    marginTop: 12,
    fontSize: 14,
    color: '#475569',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    fontWeight: '700',
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  btn: {
    width: '100%',
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPrint: { backgroundColor: '#7c3aed' },
  btnDisabled: { backgroundColor: '#94a3b8' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  footer: {
    marginTop: 14,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
