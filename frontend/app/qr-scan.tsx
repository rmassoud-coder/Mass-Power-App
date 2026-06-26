import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parseGuaranteePayload, type ParsedGuarantee } from '../src/utils/guaranteeQr';

export default function QrScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<ParsedGuarantee | null>(null);
  const lastScanRef = useRef<{ raw: string; ts: number } | null>(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (!data) return;
    const nowTs = Date.now();
    // Debounce — same code within 2.5s ignored, so the camera doesn't spam re-decode
    if (lastScanRef.current && lastScanRef.current.raw === data && nowTs - lastScanRef.current.ts < 2500) {
      return;
    }
    lastScanRef.current = { raw: data, ts: nowTs };
    setResult(parseGuaranteePayload(data));
  };

  const renderResultOverlay = () => {
    if (!result) return null;
    const isGuarantee = result.valid;
    return (
      <View style={[styles.resultCard, isGuarantee ? styles.cardOk : styles.cardBad]}>
        <Ionicons
          name={isGuarantee ? 'shield-checkmark' : 'alert-circle'}
          size={42}
          color={isGuarantee ? '#16a34a' : '#dc2626'}
        />
        {isGuarantee ? (
          <>
            <Text style={styles.resultTitle}>Guarantee Date</Text>
            <Text style={styles.resultBig}>{result.prettyLabel}</Text>
            <Text style={styles.resultSub}>Code: {result.raw}</Text>
          </>
        ) : (
          <>
            <Text style={styles.resultTitle}>Unknown QR</Text>
            <Text style={styles.resultSub}>{result.raw || 'Empty scan'}</Text>
            <Text style={[styles.resultSub, { marginTop: 6 }]}>
              This QR isn&apos;t a Mass Power guarantee sticker.
            </Text>
          </>
        )}
        <TouchableOpacity
          style={styles.scanAgain}
          onPress={() => {
            setResult(null);
            lastScanRef.current = null;
          }}
        >
          <Ionicons name="refresh" size={18} color="#0f172a" />
          <Text style={styles.scanAgainText}>Scan another</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Permission states
  if (!permission) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.permTitle}>Preparing camera…</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={64} color="#64748b" />
          <Text style={styles.permTitle}>Camera permission needed</Text>
          <Text style={styles.permSub}>
            We need the camera to scan guarantee QR stickers.
          </Text>
          {permission.canAskAgain ? (
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Grant Permission</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.permBtn}
              onPress={() => Linking.openSettings()}
            >
              <Text style={styles.permBtnText}>Open Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onBack={() => router.back()} />
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['datamatrix', 'qr'] }}
          onBarcodeScanned={result ? undefined : onBarcodeScanned}
        />
        {!result && (
          <>
            <View style={styles.reticle} />
            <Text style={styles.helper}>Point the camera at the QR sticker</Text>
          </>
        )}
        {renderResultOverlay()}
      </View>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
        <Ionicons name="arrow-back" size={24} color="#0f172a" />
      </TouchableOpacity>
      <Text style={styles.title}>Scan Guarantee QR</Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  permTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 10,
  },
  permSub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 4 },
  permBtn: {
    marginTop: 18,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  permBtnText: { color: '#fff', fontWeight: '800' },
  cameraWrap: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: 240,
    height: 240,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'transparent',
  },
  helper: {
    position: 'absolute',
    bottom: 32,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
  },
  resultCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 6,
    borderWidth: 2,
  },
  cardOk: { borderColor: '#16a34a' },
  cardBad: { borderColor: '#dc2626' },
  resultTitle: { fontSize: 14, fontWeight: '700', color: '#475569', marginTop: 4 },
  resultBig: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 4,
  },
  resultSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
  scanAgain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  scanAgainText: { fontWeight: '800', color: '#0f172a' },
});
