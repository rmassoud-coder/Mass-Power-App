import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, AppState, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
// import { runAutoPush, runAutoPull } from '../src/utils/autoSync'; // REMOVED
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

  // ============================================================
  // SYNC CONFIGURATION
  // ============================================================
  const SYNC_INTERVAL_MS = 1500000; // 25 minutes
  // ============================================================

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  const performPull = async () => {
    try {
      setIsPulling(true);
      setSyncStatus('syncing');
      setErrorMessage(null);
      console.log('⬇️ Pulling data...');
      
      // await runAutoPull(); // REMOVED
      
      // Simulate sync for testing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const now = new Date();
      setLastSyncTime(now);
      setSyncCount(prev => prev + 1);
      setSyncStatus('online');
      console.log('✅ Pull completed at:', now.toLocaleTimeString());
    } catch (error: any) {
      console.warn('⚠️ Pull failed:', error);
      setSyncStatus('offline');
      setErrorMessage(error?.message || 'Pull failed');
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
      
      // await runAutoPush(); // REMOVED
      
      // Simulate sync for testing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const now = new Date();
      setLastSyncTime(now);
      setSyncCount(prev => prev + 1);
      setSyncStatus('online');
      console.log('✅ Push completed at:', now.toLocaleTimeString());
    } catch (error: any) {
      console.warn('⚠️ Push failed:', error);
      setSyncStatus('offline');
      setErrorMessage(error?.message || 'Push failed');
    } finally {
      setIsPushing(false);
    }
  };

  // Periodic sync setup - NO initial sync
  useEffect(() => {
    isMounted.current = true;

    intervalRef.current = setInterval(() => {
      if (isMounted.current && netInfo.isConnected) {
        performPull();
      }
    }, SYNC_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isMounted.current && netInfo.isConnected) {
        performPull();
      }
    });

    return () => {
      isMounted.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      subscription.remove();
    };
  }, []);

  const getLastSyncDisplay = () => {
    if (!lastSyncTime) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - lastSyncTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours < 24) {
      return mins > 0 ? `${hours}h ${mins}m ago` : `${hours}h ago`;
    }
    return lastSyncTime.toLocaleDateString();
  };

  const getStatusColor = () => {
    if (!netInfo.isConnected) return '#ef4444';
    switch (syncStatus) {
      case 'syncing': return '#f59e0b';
      case 'online': return '#22c55e';
      case 'offline': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getStatusIcon = () => {
    if (!netInfo.isConnected) return 'wifi-outline';
    switch (syncStatus) {
      case 'syncing': return 'sync-outline';
      case 'online': return 'cloud-outline';
      case 'offline': return 'cloud-offline-outline';
      default: return 'cloud-outline';
    }
  };

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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Management</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.statusContainer}>
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

          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.pullButton, (isPulling || !netInfo.isConnected) && styles.buttonDisabled]}
              onPress={performPull}
              disabled={isPulling || !netInfo.isConnected}
            >
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>Pull</Text>
              {isPulling && (
                <View style={styles.spinner}>
                  <Ionicons name="sync-outline" size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.pushButton, (isPushing || !netInfo.isConnected) && styles.buttonDisabled]}
              onPress={performPush}
              disabled={isPushing || !netInfo.isConnected}
            >
              <Ionicons name="upload-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>Push</Text>
              {isPushing && (
                <View style={styles.spinner}>
                  <Ionicons name="sync-outline" size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.networkContainer}>
            <Text style={styles.networkLabel}>Network</Text>
            <View style={styles.networkRow}>
              <Ionicons name={netInfo.isConnected ? 'wifi' : 'wifi-outline'} size={16} color={netInfo.isConnected ? '#22c55e' : '#ef4444'} />
              <Text style={[styles.networkText, { color: netInfo.isConnected ? '#22c55e' : '#ef4444' }]}>
                {netInfo.isConnected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
          </View>

          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={16} color="#64748b" />
            <Text style={styles.infoText}>
              Auto-sync every {SYNC_INTERVAL_MS / 60000} minutes
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
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
    width: '100%',
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginLeft: 8,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
    justifyContent: 'center',
    flex: 1,
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
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  spinner: {
    marginLeft: 4,
  },
  networkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  networkLabel: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  networkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    borderRadius: 8,
    marginTop: 16,
    width: '100%',
  },
  infoText: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
});
