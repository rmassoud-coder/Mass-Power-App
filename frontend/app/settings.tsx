import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  loadSettings,
  saveSettings,
  AppSettings,
  DEFAULT_SETTINGS,
  buildGithubUploadHelpUrl,
  isGithubConfigured,
} from '../src/utils/settings';
import { getAllVehiclesWithDetails } from '../src/db/database';
import { buildVehicleHistoryHtml } from '../src/utils/htmlBuilder';
import { testGithubConnection, uploadAllVehicleProfiles } from '../src/utils/githubUploader';

const GITHUB_REPO_URL = 'https://github.com/rmassoud-coder/Mass-Power-App';

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [testingGh, setTestingGh] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [ghStatus, setGhStatus] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

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

  const handleExportAllVehicles = async () => {
    // eslint-disable-next-line no-console
    console.log('[bulk-export] starting');
    setExporting(true);
    setExportProgress('Loading vehicles...');
    try {
      const all = await getAllVehiclesWithDetails();
      if (all.length === 0) {
        Alert.alert('Nothing to export', 'No vehicles found in the database.');
        return;
      }

      const zip = new JSZip();
      const folder = zip.folder('vehicle profiles');
      if (!folder) throw new Error('Failed to create zip folder');

      // index.html — quick directory listing
      const indexLinks = all
        .map(
          (item) =>
            `<li><a href="${item.vehicle.id}.html">${esc(item.vehicle.year || '')} ${esc(
              item.vehicle.make
            )} ${esc(item.vehicle.model)} &mdash; ${esc(item.vehicle.plate_number)} (${esc(
              item.customer.name
            )})</a></li>`
        )
        .join('\n      ');
      const indexHtml = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<title>${esc(settings.garageName)} - Vehicle Profiles</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 720px; margin: 32px auto; padding: 0 16px; color: #1e293b; }
  h1 { color: #2563eb; } a { color: #2563eb; text-decoration: none; }
  ul { padding-left: 20px; line-height: 1.8; } li { border-bottom: 1px solid #f1f5f9; padding: 4px 0; }
  .meta { color: #94a3b8; font-size: 13px; margin-bottom: 24px; }
</style></head>
<body>
  <h1>${esc(settings.garageName)}</h1>
  <div class="meta">${all.length} vehicle profiles &middot; Generated ${new Date().toLocaleString()}</div>
  <ul>
      ${indexLinks}
  </ul>
</body></html>`;
      folder.file('index.html', indexHtml);

      // Each vehicle HTML
      for (let i = 0; i < all.length; i++) {
        const item = all[i];
        setExportProgress(`Generating ${i + 1}/${all.length}: ${item.vehicle.make} ${item.vehicle.model}`);
        const html = buildVehicleHistoryHtml(item.customer, item.vehicle, item.services, settings);
        folder.file(`${item.vehicle.id}.html`, html);
      }

      setExportProgress('Building ZIP...');
      const base64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });

      const stamp = new Date().toISOString().slice(0, 10);
      const zipPath = `${FileSystem.cacheDirectory}vehicle-profiles-${stamp}.zip`;
      await FileSystem.writeAsStringAsync(zipPath, base64, {
        encoding: 'base64',
      });

      setExportProgress('Opening share sheet...');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(zipPath, {
          mimeType: 'application/zip',
          dialogTitle: `${all.length} vehicle profiles`,
        });
      } else {
        Alert.alert('Saved', `ZIP saved to: ${zipPath}`);
      }
      Alert.alert(
        'Export complete',
        `${all.length} vehicle HTML files packaged.\n\nUnzip and upload the contents to the "vehicle profiles" folder in your GitHub repo.`
      );
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Unable to export vehicle profiles');
    } finally {
      setExporting(false);
      setExportProgress('');
    }
  };

  const handleOpenGithubUpload = () => {
    Linking.openURL(buildGithubUploadHelpUrl()).catch(() => {
      Alert.alert('Cannot open browser', 'Please visit your GitHub repo manually.');
    });
  };

  const handleOpenRepo = () => {
    Linking.openURL(GITHUB_REPO_URL).catch(() => {});
  };

  const handleTestGithub = async () => {
    // eslint-disable-next-line no-console
    console.log('[gh-test] starting');
    setTestingGh(true);
    setGhStatus({ kind: 'info', text: 'Testing GitHub connection...' });
    try {
      await saveSettings(settings);
      const result = await testGithubConnection(settings);
      if (result.ok) {
        const msg = `✓ Connected as @${result.user} — ${settings.githubOwner}/${settings.githubRepo}@${settings.githubBranch}`;
        setGhStatus({ kind: 'ok', text: msg });
        Alert.alert('GitHub connection OK ✓', msg);
      } else {
        setGhStatus({ kind: 'err', text: result.message });
        Alert.alert('Connection failed', result.message);
      }
    } catch (e: any) {
      const msg = e?.message || 'Unable to test connection';
      setGhStatus({ kind: 'err', text: msg });
      Alert.alert('Test failed', msg);
    } finally {
      setTestingGh(false);
    }
  };

  const handleSyncAll = async () => {
    // eslint-disable-next-line no-console
    console.log('[gh-sync-all] starting');
    if (!isGithubConfigured(settings)) {
      setGhStatus({ kind: 'err', text: 'Add your Personal Access Token first.' });
      Alert.alert('GitHub not configured', 'Add your Personal Access Token first.');
      return;
    }
    setSyncingAll(true);
    setSyncProgress('Loading vehicles...');
    setGhStatus({ kind: 'info', text: 'Loading vehicles...' });
    try {
      await saveSettings(settings);
      const all = await getAllVehiclesWithDetails();
      if (all.length === 0) {
        setGhStatus({ kind: 'info', text: 'No vehicles in the database.' });
        Alert.alert('Nothing to sync', 'No vehicles in the database.');
        return;
      }
      const result = await uploadAllVehicleProfiles(all, settings, (i, total, label) => {
        const t = `Uploading ${i}/${total}: ${label}`;
        setSyncProgress(t);
        setGhStatus({ kind: 'info', text: t });
      });
      if (result.failed.length === 0) {
        const msg = `✓ ${result.uploaded} profile${result.uploaded === 1 ? '' : 's'} uploaded`;
        setGhStatus({ kind: 'ok', text: msg });
        Alert.alert('Sync complete ✓', `${msg}\n\nGitHub Pages may take 30-60s to refresh.`);
      } else {
        const failList = result.failed.slice(0, 3).map((f) => `• ${f.label}: ${f.error}`).join('\n');
        const more = result.failed.length > 3 ? `\n…and ${result.failed.length - 3} more` : '';
        const summary = `Synced ${result.uploaded}/${all.length}. Failures:\n${failList}${more}`;
        setGhStatus({ kind: 'err', text: summary });
        Alert.alert(`Synced ${result.uploaded}/${all.length}`, `Failed:\n${failList}${more}`);
      }
    } catch (e: any) {
      const msg = e?.message || 'Unable to sync to GitHub';
      setGhStatus({ kind: 'err', text: msg });
      Alert.alert('Sync failed', msg);
    } finally {
      setSyncingAll(false);
      setSyncProgress('');
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

          {/* INVENTORY */}
          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => router.push('/inventory' as any)}
            testID="nav-inventory"
            activeOpacity={0.75}
          >
            <View style={styles.linkCardIcon}>
              <Ionicons name="cube" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkCardTitle}>Inventory</Text>
              <Text style={styles.linkCardDesc}>
                Manage stock items (auto INV-codes). Used by service product picker.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </TouchableOpacity>

          {/* GARAGE INFO */}
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Default Country Code (for WhatsApp)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="globe-outline" size={18} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  value={settings.defaultCountryCode}
                  onChangeText={(v) =>
                    setSettings({ ...settings, defaultCountryCode: v.replace(/[^\d]/g, '') })
                  }
                  placeholder="961"
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
              <Text style={styles.sectionDesc}>
                Prepended to customer numbers when sending WhatsApp reminders if they don&apos;t already include a country code. Leave blank to disable.
              </Text>
            </View>
          </View>

          {/* QR CODE HOSTING */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>QR Code Hosting</Text>
            <Text style={styles.sectionDesc}>
              QR codes on vehicles will point to this base URL + the vehicle ID.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>GitHub Pages Base URL</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="link-outline" size={18} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  value={settings.githubBaseUrl}
                  onChangeText={(v) => setSettings({ ...settings, githubBaseUrl: v })}
                  placeholder="https://rmassoud-coder.github.io/Mass-Power-App/vehicle%20profiles/"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.linkRow} onPress={handleOpenRepo}>
              <Ionicons name="logo-github" size={18} color="#1e293b" />
              <Text style={styles.linkText}>Open repo: rmassoud-coder/Mass-Power-App</Text>
              <Ionicons name="open-outline" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* GITHUB AUTO-SYNC */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>GitHub Auto-Sync</Text>
            <Text style={styles.sectionDesc}>
              Push vehicle profile HTML files directly to your repo from inside the app — no manual upload needed. Requires a Personal Access Token.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Personal Access Token</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={18} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  value={settings.githubToken}
                  onChangeText={(v) => setSettings({ ...settings, githubToken: v })}
                  placeholder="ghp_..."
                  secureTextEntry={!showToken}
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="github-token-input"
                />
                <TouchableOpacity onPress={() => setShowToken(!showToken)}>
                  <Ionicons name={showToken ? 'eye-off' : 'eye'} size={18} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.row2}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                <Text style={styles.label}>Owner</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={settings.githubOwner}
                    onChangeText={(v) => setSettings({ ...settings, githubOwner: v })}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
                <Text style={styles.label}>Repo</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={settings.githubRepo}
                    onChangeText={(v) => setSettings({ ...settings, githubRepo: v })}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
            </View>

            <View style={styles.row2}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                <Text style={styles.label}>Branch</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={settings.githubBranch}
                    onChangeText={(v) => setSettings({ ...settings, githubBranch: v })}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
                <Text style={styles.label}>Folder</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={settings.githubFolder}
                    onChangeText={(v) => setSettings({ ...settings, githubFolder: v })}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.uploadHelpBtn,
                { marginTop: 4 },
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleTestGithub}
              disabled={testingGh || !settings.githubToken}
              testID="github-test-button"
            >
              <View style={styles.btnInner}>
                {testingGh ? (
                  <ActivityIndicator color="#2563eb" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#2563eb" />
                    <Text style={styles.uploadHelpText}>Test Connection</Text>
                  </>
                )}
              </View>
            </Pressable>

            {ghStatus && (
              <View
                style={[
                  styles.statusBox,
                  ghStatus.kind === 'ok' && styles.statusOk,
                  ghStatus.kind === 'err' && styles.statusErr,
                  ghStatus.kind === 'info' && styles.statusInfo,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    ghStatus.kind === 'ok' && { color: '#065f46' },
                    ghStatus.kind === 'err' && { color: '#991b1b' },
                    ghStatus.kind === 'info' && { color: '#1e40af' },
                  ]}
                >
                  {ghStatus.text}
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.exportBtn,
                { backgroundColor: '#16a34a', marginTop: 10 },
                syncingAll && styles.exportBtnDisabled,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleSyncAll}
              disabled={syncingAll || !isGithubConfigured(settings)}
              testID="github-sync-all-button"
            >
              <View style={styles.btnInner}>
                {syncingAll ? (
                  <>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.exportBtnText}>{syncProgress || 'Uploading...'}</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={20} color="#fff" />
                    <Text style={styles.exportBtnText}>Sync ALL Vehicles to GitHub</Text>
                  </>
                )}
              </View>
            </Pressable>

            <View style={[styles.infoCard, { marginTop: 12 }]}>
              <Ionicons name="information-circle" size={20} color="#2563eb" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.infoTitle}>How to get a token</Text>
                <Text style={styles.infoText}>
                  1. Open{' '}
                  <Text
                    style={{ textDecorationLine: 'underline' }}
                    onPress={() => Linking.openURL('https://github.com/settings/tokens/new')}
                  >
                    github.com/settings/tokens/new
                  </Text>
                  {'\n'}2. Note: <Text style={styles.code}>Mass Power App</Text>{'\n'}
                  3. Expiration: 90 days (or No expiration){'\n'}
                  4. Tick the <Text style={styles.code}>public_repo</Text> checkbox (or <Text style={styles.code}>repo</Text> if your repo is private){'\n'}
                  5. Click Generate token → copy &amp; paste it above{'\n'}
                  6. Tap <Text style={{ fontWeight: 'bold' }}>Test Connection</Text> to verify
                </Text>
              </View>
            </View>
          </View>

          {/* BULK EXPORT */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bulk Export Vehicle Profiles</Text>
            <Text style={styles.sectionDesc}>
              Generate one HTML file per vehicle (matching the QR URLs) plus an index.html, packaged in a ZIP ready to upload to the &quot;vehicle profiles&quot; folder on GitHub.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.exportBtn,
                exporting && styles.exportBtnDisabled,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleExportAllVehicles}
              disabled={exporting}
              testID="bulk-export-button"
            >
              <View style={styles.btnInner}>
                {exporting ? (
                  <>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.exportBtnText}>{exportProgress || 'Working...'}</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="archive" size={20} color="#fff" />
                    <Text style={styles.exportBtnText}>Export All Vehicles (ZIP)</Text>
                  </>
                )}
              </View>
            </Pressable>

            <TouchableOpacity style={styles.uploadHelpBtn} onPress={handleOpenGithubUpload}>
              <Ionicons name="cloud-upload-outline" size={18} color="#2563eb" />
              <Text style={styles.uploadHelpText}>Open GitHub Upload Page</Text>
              <Ionicons name="open-outline" size={14} color="#2563eb" />
            </TouchableOpacity>
          </View>

          {/* HOW IT WORKS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How to publish vehicle profiles</Text>

            <View style={styles.step}>
              <Text style={styles.stepNum}>1</Text>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>One-time setup on GitHub</Text>
                <Text style={styles.stepText}>
                  In your <Text style={styles.code}>Mass-Power-App</Text> repo, create a folder named{' '}
                  <Text style={styles.code}>vehicle profiles</Text> (with a space). Go to repo
                  <Text style={styles.code}> Settings → Pages</Text> and enable GitHub Pages from the{' '}
                  <Text style={styles.code}>main</Text> branch.
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNum}>2</Text>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>Generate the HTML files</Text>
                <Text style={styles.stepText}>
                  Tap <Text style={styles.code}>Export All Vehicles (ZIP)</Text> above. A ZIP is created with one
                  HTML file per vehicle (named by vehicle ID) plus an{' '}
                  <Text style={styles.code}>index.html</Text> directory page.
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNum}>3</Text>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>Upload to GitHub</Text>
                <Text style={styles.stepText}>
                  Unzip on your computer. Open the{' '}
                  <Text style={styles.code}>vehicle profiles</Text> folder on GitHub and drag the .html files
                  inside (or use the &quot;Open GitHub Upload Page&quot; button above to jump there).
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNum}>4</Text>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>Scan &amp; verify</Text>
                <Text style={styles.stepText}>
                  Open any customer&apos;s vehicle in the app, tap the purple QR icon, and scan the QR with a
                  phone camera. It should open the page on GitHub Pages.
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color="#2563eb" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.infoTitle}>Tip</Text>
                <Text style={styles.infoText}>
                  Re-export and re-upload weekly to keep the online pages in sync with the latest services.
                  Existing files are overwritten when you drag-upload to GitHub.
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

function esc(s: string | undefined | null): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  code: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#7c3aed', fontWeight: '600' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  linkText: { flex: 1, fontSize: 13, color: '#1e293b', marginLeft: 8 },
  row2: { flexDirection: 'row' },
  statusBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusOk: { backgroundColor: '#d1fae5', borderColor: '#a7f3d0' },
  statusErr: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  statusInfo: { backgroundColor: '#dbeafe', borderColor: '#bfdbfe' },
  statusText: { fontSize: 12, lineHeight: 17 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  exportBtnDisabled: { opacity: 0.7 },
  exportBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadHelpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#2563eb',
  },
  uploadHelpText: { color: '#2563eb', fontSize: 14, fontWeight: '600', marginHorizontal: 6 },
  step: { flexDirection: 'row', marginBottom: 14 },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563eb',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: 'bold',
    fontSize: 13,
    marginRight: 10,
  },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 13, fontWeight: 'bold', color: '#1e293b', marginBottom: 2 },
  stepText: { fontSize: 12, color: '#475569', lineHeight: 18 },
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
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  linkCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  linkCardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  linkCardDesc: { fontSize: 11, color: '#64748b', marginTop: 2 },
});
