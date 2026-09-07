import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';
import { Image, Platform, View, Text, AppState, ScrollView } from 'react-native';
import { initDatabase } from '../src/db/database';
import RpmLoader from '../src/components/RpmLoader';
import HtmlRasterizerHost from '../src/components/HtmlRasterizerHost';
import { pushToCloud, pullFromCloud } from '../src/utils/dbSync';
import { loadSettings, isGithubConfigured } from '../src/utils/settings';
import AsyncStorage from '@react-native-async-storage/async-storage';

SplashScreen.preventAutoHideAsync();

// Debug log storage
const DEBUG_LOG_KEY = 'mp_debug_logs';
let debugLogs: string[] = [];

async function addDebugLog(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;
  console.log(logEntry);
  
  debugLogs.push(logEntry);
  if (debugLogs.length > 100) {
    debugLogs = debugLogs.slice(-100);
  }
  
  try {
    await AsyncStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(debugLogs));
  } catch (e) {
    // ignore
  }
}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [showLoader, setShowLoader] = useState(true);
  const [debugScreen, setDebugScreen] = useState<string | null>(null);

  useEffect(() => {
    async function prepare() {
      try {
        addDebugLog('📦 [1] Starting app initialization...');
        
        // Initialize local SQLite database
        addDebugLog('📦 [2] Initializing database...');
        await initDatabase();
        addDebugLog('📦 [3] Database initialized successfully');

        // Prewarm icon assets only on native (skip on web)
        if (Platform.OS !== 'web') {
          addDebugLog('📦 [4] Prewarming icon assets...');
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
          addDebugLog('📦 [5] Icon assets prewarmed');
        }
      } catch (e: any) {
        addDebugLog('📦 [ERROR] Initialization failed: ' + (e?.message || e));
        setInitError(e?.message || 'Failed to initialize database');
      } finally {
        addDebugLog('📦 [6] Hiding splash screen...');
        await SplashScreen.hideAsync();
        setAppIsReady(true);
        addDebugLog('📦 [7] App is ready');
      }
    }

    prepare();
  }, []);

  // Handle RpmLoader completion
  const handleLoaderComplete = () => {
    addDebugLog('🔄 [8] Loader complete');
    setShowLoader(false);
  };

  // ============================================================
  // SYNC CONFIGURATION
  // ============================================================
  const SYNC_INTERVAL_MS = 60000; // 1 minute (TESTING)
  // ============================================================

  // Auto sync: push + pull on launch and every 1 minute
  useEffect(() => {
    addDebugLog('🔄 [9] Auto-sync effect mounted');
    let isMounted = true;

    const performSync = async () => {
      addDebugLog('🔄 [10] performSync called');
      try {
        addDebugLog('🔄 [11] Loading settings...');
        const settings = await loadSettings();
        addDebugLog('🔄 [12] Settings loaded: ' + (settings ? 'yes' : 'no'));
        
        if (!isGithubConfigured(settings)) {
          addDebugLog('🔄 [13] GitHub not configured, skipping sync');
          return;
        }
        addDebugLog('🔄 [14] GitHub is configured, continuing...');

        addDebugLog('🔄 [15] Pushing to cloud...');
        await pushToCloud(settings);
        addDebugLog('🔄 [16] Push completed');
        
        addDebugLog('🔄 [17] Pulling from cloud...');
        await pullFromCloud(settings);
        addDebugLog('🔄 [18] Pull completed');
        
        addDebugLog('🔄 [19] Full sync completed successfully');
      } catch (e: any) {
        addDebugLog('🔄 [ERROR] Sync failed: ' + (e?.message || e));
        addDebugLog('🔄 [ERROR] Stack: ' + (e?.stack || 'No stack available'));
        setDebugScreen('Sync Error: ' + (e?.message || e));
      }
    };

    // Initial sync after app loads (2 second delay)
    addDebugLog('🔄 [20] Setting initial sync timeout...');
    const initialTimeout = setTimeout(() => {
      addDebugLog('🔄 [21] Initial sync timeout fired');
      if (isMounted) {
        performSync();
      }
    }, 2000);

    // Periodic sync every 1 minute
    addDebugLog('🔄 [22] Setting interval...');
    const intervalId = setInterval(() => {
      addDebugLog('🔄 [23] Interval fired');
      if (isMounted) {
        performSync();
      }
    }, SYNC_INTERVAL_MS);

    // Sync when app comes back to foreground
    addDebugLog('🔄 [24] Setting AppState listener...');
    const sub = AppState.addEventListener('change', (state) => {
      addDebugLog('🔄 [25] AppState changed to: ' + state);
      if (state === 'active' && isMounted) {
        addDebugLog('🔄 [26] App came to foreground, syncing...');
        performSync();
      }
    });

    // Cleanup
    return () => {
      addDebugLog('🔄 [27] Cleanup called');
      isMounted = false;
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
      sub.remove();
    };
  }, []);

  // Show debug screen if error occurred
  if (debugScreen) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', padding: 20, justifyContent: 'center' }}>
        <Text style={{ color: '#ff4444', fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
          DEBUG ERROR:
        </Text>
        <Text style={{ color: '#fff', fontSize: 14, marginBottom: 20 }}>
          {debugScreen}
        </Text>
        <TouchableOpacity
          onPress={() => setDebugScreen(null)}
          style={{ backgroundColor: '#444', padding: 10, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', textAlign: 'center' }}>Continue Anyway</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
