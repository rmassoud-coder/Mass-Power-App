import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { runAutoPull } from '../utils/autoSync';

interface SyncStatusPillProps {
  showLabel?: boolean;
}

export default function SyncStatusPill({ showLabel = true }: SyncStatusPillProps) {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'online' | 'offline'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncCount, setSyncCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const netInfo = useNetInfo();
  
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

  const performSync = async (trigger: 'initial' | 'periodic' | 'foreground' | 'manual') => {
    try {
      setSyncStatus('syncing');
      setErrorMessage(null);
      console.log(`🔄 [${trigger}] Syncing data...`);
      
      // Call your sync function - this pulls data from cloud
      await runAutoPull();
      
      const now = new Date();
      setLastSyncTime(now);
      setSyncCount(prev => prev + 1);
      setSyncStatus('online');
      
      console.log(`✅ [${trigger}] Sync completed at:`, now.toLocaleTimeString());
    } catch (error: any) {
      console.warn(`⚠️ [${trigger}] Sync failed:`, error);
      setSyncStatus('offline');
      setErrorMessage(error?.message || 'Sync failed');
    }
  };

  // Check network status and update pill
  useEffect(() => {
    if (netInfo.isConnected === false) {
      setSyncStatus('offline');
    } else if (syncStatus !== 'syncing' && syncStatus !== 'idle') {
      setSyncStatus('online');
    }
  }, [netInfo.isConnected]);

  // Setup periodic sync
  useEffect(() => {
    isMounted.current = true;

    // Initial sync when component mounts
    performSync('initial');

    // ============================================================
    // PERIODIC SYNC EVERY SYNC_INTERVAL_MS
    // ============================================================
    intervalRef.current = setInterval(() => {
      if (isMounted.current && netInfo.isConnected) {
        performSync('periodic');
      } else if (!netInfo.isConnected) {
        console.log('📡 Skipping sync - device offline');
      }
    }, SYNC_INTERVAL_MS);
    // ============================================================

    // Sync when app comes back to foreground
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isMounted.current && netInfo.isConnected) {
        performSync('foreground');
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

  // Determine pill appearance
  const getStatusConfig = () => {
    // Offline takes priority
    if (!netInfo.isConnected) {
      return {
        icon: 'cloud-offline-outline',
        backgroundColor: '#ef4444',
        text: 'Offline',
        textColor: '#ffffff',
        dotColor: '#ef4444',
      };
    }

    switch (syncStatus) {
      case 'syncing':
        return {
          icon: 'sync-outline',
          backgroundColor: '#f59e0b',
          text: 'Syncing...',
          textColor: '#ffffff',
          dotColor: '#f59e0b',
        };
      case 'online':
        return {
          icon: 'cloud-outline',
          backgroundColor: '#22c55e',
          text: 'Online',
          textColor: '#ffffff',
          dotColor: '#22c55e',
        };
      case 'offline':
        return {
          icon: 'cloud-offline-outline',
          backgroundColor: '#ef4444',
          text: 'Offline',
          textColor: '#ffffff',
          dotColor: '#ef4444',
        };
      case 'idle':
      default:
        return {
          icon: 'cloud-outline',
          backgroundColor: '#64748b',
          text: 'Loading...',
          textColor: '#ffffff',
          dotColor: '#64748b',
        };
    }
  };

  const config = getStatusConfig();

  // Format last sync time for display
  const getLastSyncDisplay = () => {
    if (!lastSyncTime) return '';
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

  return (
    <View style={styles.container}>
      <View style={[styles.pill, { backgroundColor: config.backgroundColor }]}>
        <View style={[styles.dot, { backgroundColor: config.dotColor }]} />
        
        <Ionicons name={config.icon as any} size={14} color="#fff" />
        
        {showLabel && (
          <Text style={[styles.statusText, { color: config.textColor }]}>
            {config.text}
          </Text>
        )}
        
        {lastSyncTime && syncStatus !== 'syncing' && syncStatus !== 'idle' && (
          <Text style={[styles.syncTime, { color: config.textColor }]}>
            • {getLastSyncDisplay()}
          </Text>
        )}
        
        {syncCount > 0 && (
          <View style={styles.syncCountBadge}>
            <Text style={styles.syncCountText}>{syncCount}</Text>
          </View>
        )}
        
        {errorMessage && (
          <Ionicons name="alert-circle-outline" size={14} color="#fff" />
        )}
      </View>
      
      {errorMessage && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 32,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  syncTime: {
    fontSize: 10,
    fontWeight: '400',
    opacity: 0.8,
  },
  syncCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 2,
  },
  syncCountText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#ffffff',
  },
  errorText: {
    fontSize: 10,
    color: '#ef4444',
    marginTop: 2,
    textAlign: 'center',
  },
});
