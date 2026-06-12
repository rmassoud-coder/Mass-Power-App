import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { loadSettings, saveSettings, AppSettings, DEFAULT_SETTINGS } from '../src/utils/settings';

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      Alert.alert('Saved', 'Settings updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <Ionicons name="settings" size={40} color="#2563eb" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Garage Information</Text>
            <Text style={styles.sectionDesc}>Used in printed receipts and exported HTML pages.</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Garage Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="business-outline" size={18} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  value={settings.garageName}
                  onChangeText={(v) => setSettings({ ...settings, garageName: v })}
                  placeholder="Mass Power Auto Services"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Garage Phone</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={18} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  value={settings.garagePhone}
                  onChangeText={(v) => setSettings({ ...settings, garagePhone: v })}
                  placeholder="+1 555-555-5555"
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>QR Code Hosting</Text>
            <Text style={styles.sectionDesc}>
              QR codes on vehicles will point to this base URL + the vehicle ID. Example:
              {'\n'}
              <Text style={styles.codeText}>https://myusername.github.io/myrepo/</Text>
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>GitHub Pages Base URL</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="link-outline" size={18} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  value={settings.githubBaseUrl}
                  onChangeText={(v) => setSettings({ ...settings, githubBaseUrl: v })}
                  placeholder="https://username.github.io/repo/"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color="#2563eb" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.infoTitle}>How it works</Text>
                <Text style={styles.infoText}>
                  1. From a customer&apos;s vehicle, tap the QR button{'\n'}
                  2. Tap &quot;Export HTML&quot; and save the file{'\n'}
                  3. Upload that .html file to your GitHub repo (root or subfolder){'\n'}
                  4. Enable GitHub Pages on the repo{'\n'}
                  5. The QR will then resolve to the uploaded page
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Save Settings</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  content: { flex: 1, paddingHorizontal: 20 },
  iconWrap: { alignItems: 'center', paddingVertical: 20 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  sectionDesc: { fontSize: 12, color: '#64748b', marginTop: 4, marginBottom: 16 },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: '#1e293b' },
  codeText: { fontFamily: 'Courier', color: '#2563eb', fontWeight: '600' },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginTop: 4,
  },
  infoTitle: { fontSize: 13, fontWeight: 'bold', color: '#1e40af', marginBottom: 4 },
  infoText: { fontSize: 12, color: '#1e40af', lineHeight: 18 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 52,
    marginBottom: 32,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
});
