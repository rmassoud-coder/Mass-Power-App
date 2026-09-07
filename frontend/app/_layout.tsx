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
import { pushToCloud, pullFromCloud } from '../src/utils/dbSync';
import { loadSettings, isGithubConfigured } from '../src/utils/settings';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('📦 [1] Starting app initialization...');
        
        // Initialize local SQLite database
        console.log('📦 [2] Initializing database...');
        await initDatabase();
        console.log('📦 [3] Database initialized successfully');

        // Prewarm icon assets only on native (skip on web)
        if (Platform.OS !== 'web') {
          console.log('📦 [4] Prewarming icon assets...');
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
          console.log('📦 [5] Icon assets prewarmed');
        }
      } catch (e: any) {
        console.warn('📦 [ERROR] Initialization failed:', e);
        setInitError(e?.message || 'Failed to initialize database');
      } finally {
        // Hide the native splash
        console.log('📦 [6] Hiding splash screen...');
        await SplashScreen.hideAsync();
        setAppIsReady(true);
        console.log('📦 [7] App is ready');
      }
    }

    prepare();
  }, []);

  // Handle RpmLoader completion
  const handleLoaderComplete = () => {
    console.log('🔄 [8] Loader complete, hiding loader');
    setShowLoader(false);
  };

  // ============================================================
  // SYNC CONFIGURATION
  // ============================================================
  const SYNC_INTERVAL_MS = 60000; // 1 minute (TESTING)
  // ============================================================

  // Auto sync: push + pull on launch and every 1 minute
  useEffect(() => {
    console.log('🔄 [9] Auto-sync effect mounted');
    let isMounted = true;

    const performSync = async () => {
      console.log('🔄 [10] performSync called');
      try {
        // Check if GitHub is configured first
        console.log('🔄 [11] Loading settings...');
        const settings = await loadSettings();
        console.log('🔄 [12] Settings loaded:', settings ? 'yes' : 'no');
        
        if (!isGithubConfigured(settings)) {
          console.log('🔄 [13] GitHub not configured, skipping sync');
          return;
        }
        console.log('🔄 [14] GitHub is configured, continuing...');

        console.log('🔄 [15] Auto-sync started...');
        
        // Push local data to cloud
        console.log('🔄 [16] Pushing to cloud...');
        await pushToCloud(settings);
        console.log('🔄 [17] Push completed at:', new Date().toLocaleTimeString());
        
        // Pull cloud data to local
        console.log('🔄 [18] Pulling from cloud...');
        await pullFromCloud(settings);
        console.log('🔄 [19] Pull completed at:', new Date().toLocaleTimeString());
        
        console.log('🔄 [20] Full sync completed at:', new Date().toLocaleTimeString());
      } catch (e: any) {
        console.warn('🔄 [21] Sync failed:', e?.message || e);
        console.warn('🔄 [22] Error stack:', e?.stack || 'No stack');
      }
    };

    // Initial sync after app loads (2 second delay)
    console.log('🔄 [23] Setting initial sync timeout...');
    const initialTimeout = setTimeout(() => {
      console.log('🔄 [24] Initial sync timeout fired');
      if (isMounted) {
        performSync();
      }
    }, 2000);

    // Periodic sync every 1 minute
    console.log('🔄 [25] Setting interval...');
    const intervalId = setInterval(() => {
      console.log('🔄 [26] Interval fired');
      if (isMounted) {
        performSync();
      }
    }, SYNC_INTERVAL_MS);

    // Sync when app comes back to foreground
    console.log('🔄 [27] Setting AppState listener...');
    const sub = AppState.addEventListener('change', (state) => {
      console.log('🔄 [28] AppState changed to:', state);
      if (state === 'active' && isMounted) {
        console.log('🔄 [29] App came to foreground, syncing...');
        performSync();
      }
    });

    // Cleanup
    return () => {
      console.log('🔄 [30] Cleanup called');
      isMounted = false;
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
      sub.remove();
    };
  }, []);

  // Show loader while app is preparing or loader is visible
  if (!appIsReady || showLoader) {
    console.log('🔄 [31] Showing loader (appIsReady:', appIsReady, ', showLoader:', showLoader, ')');
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#000000', // Pure black background
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <RpmLoader onComplete={handleLoaderComplete} />
      </View>
    );
  }

  if (initError) {
    console.log('🔄 [32] Showing error screen:', initError);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#000' }}>
        <Text style={{ fontSize: 18, color: '#ef4444', textAlign: 'center' }}>
          Failed to start: {initError}
        </Text>
      </View>
    );
  }

  console.log('🔄 [33] Rendering main app');
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
