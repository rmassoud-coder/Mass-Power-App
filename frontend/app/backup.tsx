import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportAllData, importData } from '../src/db/database';
import ConfirmDialog from '../src/components/ConfirmDialog';

export default function BackupScreen() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace' | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const jsonData = await exportAllData();
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `mass-power-backup-${timestamp}.json`;

      if (Platform.OS === 'web') {
        // On web, trigger a download
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Alert.alert('Success', `Backup downloaded as ${fileName}`);
      } else {
        // On native, write to file and share
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, jsonData, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Save your garage backup',
            UTI: 'public.json',
          });
        } else {
          Alert.alert('Backup Saved', `Saved to:\n${fileUri}`);
        }
      }
    } catch (error: any) {
      Alert.alert('Export Failed', error?.message || 'Could not export data');
    } finally {
      setExporting(false);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      let jsonContent: string;

      if (Platform.OS === 'web') {
        // On web, the asset.file is a File object
        const file = (asset as any).file;
        if (file) {
          jsonContent = await file.text();
        } else {
          throw new Error('Could not read file on web');
        }
      } else {
        jsonContent = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      // Validate JSON
      const parsed = JSON.parse(jsonContent);
      if (!parsed.customers || !parsed.vehicles || !parsed.services) {
        throw new Error('Invalid backup file format');
      }

      setPendingImport(jsonContent);
    } catch (error: any) {
      Alert.alert('Import Failed', error?.message || 'Could not read file');
    }
  };

  const performImport = async () => {
    if (!pendingImport || !importMode) return;
    setImporting(true);
    try {
      const result = await importData(pendingImport, importMode === 'merge');
      setPendingImport(null);
      setImportMode(null);
      Alert.alert(
        'Import Complete',
        `Added: ${result.customers} customers, ${result.vehicles} vehicles, ${result.services} services`
      );
    } catch (error: any) {
      Alert.alert('Import Failed', error?.message || 'Could not import data');
    } finally {
      setImporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Backup & Restore</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Export Section */}
        <View style={styles.section}>
          <View style={styles.sectionIcon}>
            <Ionicons name="cloud-upload-outline" size={32} color="#2563eb" />
          </View>
          <Text style={styles.sectionTitle}>Export Data</Text>
          <Text style={styles.sectionDescription}>
            Save all your customers, vehicles, and service records to a backup file. You can use this file to restore your data or transfer it to another device.
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.exportButton, exporting && styles.buttonDisabled]}
            onPress={handleExport}
            disabled={exporting}
            testID="export-button"
          >
            {exporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Export Backup</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Import Section */}
        <View style={styles.section}>
          <View style={[styles.sectionIcon, { backgroundColor: '#fef3c7' }]}>
            <Ionicons name="cloud-download-outline" size={32} color="#d97706" />
          </View>
          <Text style={styles.sectionTitle}>Import Data</Text>
          <Text style={styles.sectionDescription}>
            Restore data from a previously exported backup file. You'll be asked whether to merge with existing data or replace it.
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.importButton]}
            onPress={handlePickFile}
            testID="import-button"
          >
            <Ionicons name="folder-open-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Choose Backup File</Text>
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#64748b" />
          <Text style={styles.infoText}>
            All your data is stored locally on this device. Backups are JSON files you can save to email, cloud drives, or transfer between devices.
          </Text>
        </View>
      </ScrollView>

      {/* Import Mode Dialog */}
      <ConfirmDialog
        visible={pendingImport !== null && importMode === null}
        title="How to Import?"
        message="Choose Merge to add records without removing existing data. Choose Replace to delete current data first."
        confirmText="Merge"
        cancelText="Replace"
        destructive={false}
        onConfirm={() => setImportMode('merge')}
        onCancel={() => setImportMode('replace')}
      />

      {/* Final Confirmation */}
      <ConfirmDialog
        visible={pendingImport !== null && importMode !== null}
        title={importMode === 'replace' ? 'Replace All Data?' : 'Merge Backup?'}
        message={
          importMode === 'replace'
            ? 'This will DELETE all current data and replace it with the backup. This cannot be undone.'
            : 'This will add records from the backup file. Existing records with the same ID will not be changed.'
        }
        confirmText={importing ? 'Importing...' : 'Continue'}
        cancelText="Cancel"
        destructive={importMode === 'replace'}
        onConfirm={performImport}
        onCancel={() => {
          if (!importing) {
            setPendingImport(null);
            setImportMode(null);
          }
        }}
      />
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
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  sectionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 200,
  },
  exportButton: { backgroundColor: '#2563eb' },
  importButton: { backgroundColor: '#d97706' },
  buttonDisabled: { opacity: 0.6 },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
    marginLeft: 10,
    lineHeight: 18,
  },
});
