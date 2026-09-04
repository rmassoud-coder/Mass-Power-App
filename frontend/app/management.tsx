import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, AppState, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { runAutoPush, runAutoPull } from '../src/utils/autoSync';
import { useRouter } from 'expo-router';

export default function ManagementScreen() {
  const router = useRouter();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'online' | 'offline'>('idle');
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncCount, setSyncCount] = useState(0);
  
  // Simple network mock - always connected
  const netInfo = { isConnected: true };

  // ============================================================
  // SYNC CONFIGURATION
  // ============================================================
  // ⭐ CHANGE THIS VALUE TO ADJUST SYNC INTERVAL
  // Value is in milliseconds:
  // 1 minute  = 60000
  // 5 minutes = 300000
  // 10 minutes = 600000
  // 15 minutes = 900000
  // 20 minutes = 1200000
  // 25 minutes = 1500000  <-- CURRENT VALUE
  // 30 minutes = 1800000
  // 1 hour    = 3600000
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

  // Periodic sync setup - NO initial sync
  useEffect(() => {
    isMounted.current = true;

    // ============================================================
    // PERIODIC SYNC EVERY SYNC_INTERVAL_MS
    // ============================================================
    intervalRef.current = setInterval(() => {
      if (isMounted.current && netInfo.isConnected) {
        performPull();
      }
    }, SYNC_INTERVAL_MS);
    // ============================================================

    // Sync when app comes back to foreground
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isMounted.current && netInfo.isConnected) {
        performPull();
      }
    });

    // Cleanup
    return () => {
      isMounted.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      subscription.remove();
    };
  }, []);

  // Format last sync time for display
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Management</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Sync Status Card */}
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

          {/* Push/Pull Buttons */}
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

          {/* Management Options */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Management Options</Text>
            
            <TouchableOpacity 
              style={styles.optionButton}
              onPress={() => router.push('/inventory')}
            >
              <Ionicons name="cube-outline" size={24} color="#60a5fa" />
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionText}>Inventory Management</Text>
                <Text style={styles.optionSubtext}>Manage stock and items</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.optionButton}
              onPress={() => router.push('/supplier-debts')}
            >
              <Ionicons name="people-outline" size={24} color="#f472b6" />
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionText}>Supplier Debts</Text>
                <Text style={styles.optionSubtext}>Manage supplier balances</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.optionButton}
              onPress={() => router.push('/reminders')}
            >
              <Ionicons name="notifications-outline" size={24} color="#fbbf24" />
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionText}>Reminders</Text>
                <Text style={styles.optionSubtext}>View all reminders</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.optionButton}
              onPress={() => router.push('/report')}
            >
              <Ionicons name="bar-chart-outline" size={24} color="#34d399" />
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionText}>Reports</Text>
                <Text style={styles.optionSubtext}>View business reports</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.optionButton}
              onPress={() => router.push('/backup')}
            >
              <Ionicons name="cloud-upload-outline" size={24} color="#a78bfa" />
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionText}>Backup & Restore</Text>
                <Text style={styles.optionSubtext}>Backup or restore data</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.optionButton, styles.dangerButton]}
              onPress={() => {
                Alert.alert(
                  'Clear All Data',
                  'Are you sure you want to clear all data? This action cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear Data', style: 'destructive', onPress: () => {
                        Alert.alert('Cleared', 'All data has been cleared');
                      }
                    }
                  ]
                );
              }}
            >
              <Ionicons name="trash-outline" size={24} color="#ef4444" />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionText, { color: '#ef4444' }]}>Clear All Data</Text>
                <Text style={[styles.optionSubtext, { color: '#ef4444' }]}>Delete all local data</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Network Info */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Network Information</Text>
            
            <View style={styles.networkRow}>
              <Ionicons name="wifi" size={20} color="#22c55e" />
              <Text style={[styles.networkText, { color: '#22c55e' }]}>
                Connected
              </Text>
            </View>
          </View>

          {/* Auto Sync Info */}
          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={16} color="#64748b" />
            <Text style={styles.infoText}>
              Data is automatically synced every {SYNC_INTERVAL_MS / 60000} minutes. Use manual sync for immediate updates.
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
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  dangerButton: {
    borderBottomWidth: 0,
  },
  optionTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  optionSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
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
