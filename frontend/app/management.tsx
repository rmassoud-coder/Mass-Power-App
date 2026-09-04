import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, AppState, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { runAutoPush, runAutoPull } from '../src/utils/autoSync';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function ManagementScreen() {
  const router = useRouter();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'online' | 'offline'>('idle');
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncCount, setSyncCount] = useState(0);
  const netInfo = useNetInfo();

  const performPull = async () => {
    try {
      setIsPulling(true);
      setSyncStatus('syncing');
      setErrorMessage(null);
      console.log('⬇️ Pulling data...');
      
      await runAutoPull();
      
      const now = new Date();
      setLastSyncTime(now);
      setSyncCount(prev => prev + 1);
      setSyncStatus('online');
      console.log('✅ Pull completed at:', now.toLocaleTimeString());
      
      Alert.alert('Success', 'Data pulled successfully!');
    } catch (error: any) {
      console.warn('⚠️ Pull failed:', error);
      setSyncStatus('offline');
      setErrorMessage(error?.message || 'Pull failed');
      Alert.alert('Error', 'Pull failed: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsPulling(false);
    }
  };

  const performPush = async () => {
    try {
      setIsPushing(true);
      setSyncStatus('syncing');
      setErrorMessage(null);
      console.log('⬆️ Pushing data...');
      
      await runAutoPush();
      
      const now = new Date();
      setLastSyncTime(now);
      setSyncCount(prev => prev + 1);
      setSyncStatus('online');
      console.log('✅ Push completed at:', now.toLocaleTimeString());
      
      Alert.alert('Success', 'Data pushed successfully!');
    } catch (error: any) {
      console.warn('⚠️ Push failed:', error);
      setSyncStatus('offline');
      setErrorMessage(error?.message || 'Push failed');
      Alert.alert('Error', 'Push failed: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsPushing(false);
    }
  };

  // Update status based on network
  useEffect(() => {
    if (netInfo.isConnected === false) {
      setSyncStatus('offline');
    } else if (syncStatus !== 'syncing' && syncStatus !== 'idle') {
      setSyncStatus('online');
    }
  }, [netInfo.isConnected]);

  // Format last sync time for display
  const getLastSyncDisplay = () => {
    if (!lastSyncTime) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - lastSyncTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours < 24) {
      return mins > 0 ? `${hours}h ${mins}m ago` : `${hours}h ago`;
    }
    return lastSyncTime.toLocaleDateString();
  };

  // Get status color
  const getStatusColor = () => {
    if (!netInfo.isConnected) return '#ef4444';
    switch (syncStatus) {
      case 'syncing': return '#f59e0b';
      case 'online': return '#22c55e';
      case 'offline': return '#ef4444';
      default: return '#64748b';
    }
  };

  // Get status icon
  const getStatusIcon = () => {
    if (!netInfo.isConnected) return 'wifi-outline';
    switch (syncStatus) {
      case 'syncing': return 'sync-outline';
      case 'online': return 'cloud-outline';
      case 'offline': return 'cloud-offline-outline';
      default: return 'cloud-outline';
    }
  };

  // Get status text
  const getStatusText = () => {
    if (!netInfo.isConnected) return 'Offline';
    switch (syncStatus) {
      case 'syncing': return isPushing ? 'Pushing...' : isPulling ? 'Pulling...' : 'Syncing...';
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      default: return 'Loading...';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Management</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sync Status</Text>
          
          <View style={styles.statusRow}>
            <View style={[styles.statusIconContainer, { backgroundColor: getStatusColor() + '20' }]}>
              <Ionicons name={getStatusIcon()} size={24} color={getStatusColor()} />
            </View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {getStatusText()}
              </Text>
              <Text style={styles.statusSubtext}>
                Last sync: {getLastSyncDisplay()}
              </Text>
              {syncCount > 0 && (
                <Text style={styles.statusSubtext}>
                  Total syncs: {syncCount}
                </Text>
              )}
            </View>
          </View>

          {errorMessage && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}
        </View>

        {/* Sync Buttons */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Manual Sync</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.pullButton, (isPulling || !netInfo.isConnected) && styles.buttonDisabled]}
              onPress={performPull}
              disabled={isPulling || !netInfo.isConnected}
              activeOpacity={0.7}
            >
              <Ionicons name="download-outline" size={24} color="#fff" />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonText}>Pull Data</Text>
                <Text style={styles.buttonSubtext}>Download from cloud</Text>
              </View>
              {isPulling && (
                <View style={styles.spinner}>
                  <Ionicons name="sync-outline" size={20} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.pushButton, (isPushing || !netInfo.isConnected) && styles.buttonDisabled]}
              onPress={performPush}
              disabled={isPushing || !netInfo.isConnected}
              activeOpacity={0.7}
            >
              <Ionicons name="upload-outline" size={24} color="#fff" />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonText}>Push Data</Text>
                <Text style={styles.buttonSubtext}>Upload to cloud</Text>
              </View>
              {isPushing && (
                <View style={styles.spinner}>
                  <Ionicons name="sync-outline" size={20} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Network Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Network Information</Text>
          
          <View style={styles.networkRow}>
            <Ionicons name={netInfo.isConnected ? 'wifi' : 'wifi-outline'} size={20} color={netInfo.isConnected ? '#22c55e' : '#ef4444'} />
            <Text style={[styles.networkText, { color: netInfo.isConnected ? '#22c55e' : '#ef4444' }]}>
              {netInfo.isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
          
          {netInfo.isConnected && netInfo.details && (
            <View style={styles.networkDetails}>
              <Text style={styles.networkDetailText}>
                Type: {netInfo.details?.cellularGeneration || netInfo.type || 'Unknown'}
              </Text>
              {netInfo.details?.ipAddress && (
                <Text style={styles.networkDetailText}>
                  IP: {netInfo.details.ipAddress}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Info Text */}
        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={16} color="#64748b" />
          <Text style={styles.infoText}>
            Data is automatically synced every 25 minutes. Use manual sync for immediate updates.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerRight: {
    width: 32,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '700',
  },
  statusSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginLeft: 8,
    flex: 1,
  },
  buttonContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pullButton: {
    backgroundColor: '#3b82f6',
  },
  pushButton: {
    backgroundColor: '#8b5cf6',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  spinner: {
    marginLeft: 8,
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  networkDetails: {
    marginTop: 8,
    paddingLeft: 28,
  },
  networkDetailText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
});
