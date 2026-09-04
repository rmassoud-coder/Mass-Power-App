import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// Simple version first - no complex imports
export default function ManagementScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if everything loads
    console.log('✅ ManagementScreen mounted');
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading Management...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        {/* Simple Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sync Status</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusIconContainer, { backgroundColor: '#22c55e20' }]}>
              <Ionicons name="cloud-outline" size={24} color="#22c55e" />
            </View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusText, { color: '#22c55e' }]}>Online</Text>
              <Text style={styles.statusSubtext}>Last sync: Just now</Text>
            </View>
          </View>
        </View>

        {/* Sync Buttons - Simple */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Manual Sync</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.pullButton]}
              onPress={() => Alert.alert('Pull', 'Pull button pressed')}
            >
              <Ionicons name="download-outline" size={24} color="#fff" />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonText}>Pull Data</Text>
                <Text style={styles.buttonSubtext}>Download from cloud</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.pushButton]}
              onPress={() => Alert.alert('Push', 'Push button pressed')}
            >
              <Ionicons name="upload-outline" size={24} color="#fff" />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonText}>Push Data</Text>
                <Text style={styles.buttonSubtext}>Upload to cloud</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Text */}
        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={16} color="#64748b" />
          <Text style={styles.infoText}>
            Data is automatically synced every 25 minutes.
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
