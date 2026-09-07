import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';
import { Image, Platform, View, Text, AppState } from 'react-native';
import { initDatabase } from '../src/db/database';
import RpmLoader from '../src/components/RpmLoader';
import HtmlRasterizerHost from '../src/components/HtmlRasterizerHost';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize local SQLite database
        await initDatabase();

        // Prewarm icon assets only on native (skip on web)
        if (Platform.OS !== 'web') {
          const iconAssets = [
            require('../assets/images/icon.png'),
            require('../assets/images/adaptive-icon.png'),
            require('../assets/images/mp-logo.png'),
          ];

          const cacheImages = iconAssets.map((icon) => {
            return Asset.fromModule(icon).downloadAsync();
          });

          await Promise.all(cacheImages);

          iconAssets.forEach((icon) => {
            const source = Image.resolveAssetSource(icon);
            if (source?.uri) {
              Image.prefetch(source.uri);
            }
          });
        }
      } catch (e: any) {
        console.warn(e);
        setInitError(e?.message || 'Failed to initialize database');
      } finally {
        // Hide the native splash
        await SplashScreen.hideAsync();
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  // Handle RpmLoader completion
  const handleLoaderComplete = () => {
    setShowLoader(false);
  };

  // ============================================================
  // SYNC CONFIGURATION
  // ============================================================
  const SYNC_INTERVAL_MS = 1200000; // 20 minutes
  // ============================================================

  // Auto sync: push + pull
  useEffect(() => {
    let isMounted = true;
    let lastSyncTime = Date.now();

    const performSync = async () => {
      try {
        console.log('🔄 Syncing database...');
        
        // Dynamically import to avoid crash at module load
        const { pushToCloud, pullFromCloud } = require('../src/utils/dbSync');
        
        // Push local data to cloud
        console.log('📤 Pushing to cloud...');
        const pushResult = await pushToCloud();
        console.log('📤 Push completed at:', new Date().toLocaleTimeString(), pushResult ? 'OK' : 'FAILED');
        
        // Pull cloud data to local
        console.log('📥 Pulling from cloud...');
        const pullResult = await pullFromCloud();
        console.log('📥 Pull completed at:', new Date().toLocaleTimeString(), pullResult ? 'OK' : 'FAILED');
        
        lastSyncTime = Date.now();
        console.log('✅ Full sync completed at:', new Date().toLocaleTimeString());
      } catch (error: any) {
        console.warn('⚠️ Sync failed:', error?.message || error);
        console.warn('⚠️ Error stack:', error?.stack || 'No stack');
      }
    };

    // Initial sync after app loads (3 second delay)
    const initialTimeout = setTimeout(() => {
      if (isMounted) {
        console.log('⏰ Initial sync starting...');
        performSync();
      }
    }, 3000);

    // ============================================================
    // PERIODIC SYNC EVERY SYNC_INTERVAL_MS
    // ============================================================
    const intervalId = setInterval(() => {
      const timeSinceLastSync = Date.now() - lastSyncTime;
      
      if (timeSinceLastSync >= SYNC_INTERVAL_MS) {
        console.log(`⏰ ${SYNC_INTERVAL_MS / 60000} minutes elapsed, syncing...`);
        performSync();
      }
    }, 60000);
    // ============================================================

    // Sync when app comes back to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isMounted) {
        console.log('📱 App came to foreground, syncing...');
        performSync();
      }
    });

    // Cleanup
    return () => {
      isMounted = false;
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
      sub.remove();
    };
  }, []);

  // Show loader while app is preparing or loader is visible
  if (!appIsReady || showLoader) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#000000',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <RpmLoader onComplete={handleLoaderComplete} />
      </View>
    );
  }

  if (initError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#000' }}>
        <Text style={{ fontSize: 18, color: '#ef4444', textAlign: 'center' }}>
          Failed to start: {initError}
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HtmlRasterizerHost />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="home" />
          <Stack.Screen name="search-results" />
          <Stack.Screen name="customer-detail" />
          <Stack.Screen name="add-customer" />
          <Stack.Screen name="edit-customer" />
          <Stack.Screen name="add-vehicle" />
          <Stack.Screen name="edit-vehicle" />
          <Stack.Screen name="add-service" />
          <Stack.Screen name="edit-service" />
          <Stack.Screen name="report" />
          <Stack.Screen name="backup" />
          <Stack.Screen name="walkin-service" options={{ headerShown: false }} />
          <Stack.Screen name="supplier-debts" />
          <Stack.Screen name="reminders" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
