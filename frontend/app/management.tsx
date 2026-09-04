import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, AppState, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { runAutoPush, runAutoPull } from '../utils/autoSync'; // ✅ Fixed: combined import

export default function ManagementScreen() {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'online' | 'offline'>('idle');
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const netInfo = useNetInfo();

  const performPull = async () => {
    try {
      setIsPulling(true);
      setSyncStatus('syncing');
      setErrorMessage(null);
      console.log('⬇️ Pulling data...');
      
      await runAutoPull();
      
      setSyncStatus('online');
      console.log('✅ Pull completed');
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
      
      await runAutoPush();
      
      setSyncStatus('online');
      console.log('✅ Push completed');
    } catch (error: any) {
      console.warn('⚠️ Push failed:', error);
      setSyncStatus('offline');
      setErrorMessage(error?.message || 'Push failed');
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Management</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status:</Text>
        <View style={[styles.statusBadge, { backgroundColor: syncStatus === 'online' ? '#22c55e' : syncStatus === 'syncing' ? '#f59e0b' : '#ef4444' }]}>
          <Text style={styles.statusText}>
            {syncStatus === 'online' ? '✅ Online' : syncStatus === 'syncing' ? '🔄 Syncing...' : '❌ Offline'}
          </Text>
        </View>
      </View>

      {errorMessage && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.pullButton, (isPulling || !netInfo.isConnected) && styles.buttonDisabled]}
          onPress={performPull}
          disabled={isPulling || !netInfo.isConnected}
        >
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={styles.buttonText}>Pull</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.pushButton, (isPushing || !netInfo.isConnected) && styles.buttonDisabled]}
          onPress={performPush}
          disabled={isPushing || !netInfo.isConnected}
        >
          <Ionicons name="upload-outline" size={20} color="#fff" />
          <Text style={styles.buttonText}>Push</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 30,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 16,
    color: '#94a3b8',
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
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
});
