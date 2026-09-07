import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';
import { Image, Platform, View, Text, AppState, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initDatabase } from '../src/db/database';
import RpmLoader from '../src/components/RpmLoader';
import HtmlRasterizerHost from '../src/components/HtmlRasterizerHost';
import { runAutoPush, runAutoPull, getAutoSyncState } from '../src/utils/autoSync';

declare const ErrorUtils: any;

SplashScreen.preventAutoHideAsync();

// ============================================================
// CRASH LOGGER — kept as a safety net even though the crash is fixed.
// ============================================================
function logCrash(error: any, extra?: Record<string, any>) {
  const payload = {
    message: error?.message || String(error),
    stack: error?.stack || null,
    time: new Date().toISOString(),
    ...extra,
  };
  console.error('🔴 CRASH CAUGHT:', payload);
  AsyncStorage.setItem('__last_crash__', JSON.stringify(payload)).catch(() => {});
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    logCrash(error, { componentStack: info?.componentStack, source: 'ErrorBoundary' });
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#000' }}>
          <Text style={{ fontSize: 16, color: '#ef4444', fontWeight: 'bold', marginBottom: 12 }}>
            App crashed — details below:
          </Text>
          <ScrollView style={{ maxHeight: 400 }}>
            <Text style={{ fontSize: 13, color: '#fff', marginBottom: 8 }}>
              {this.state.error?.message}
            </Text>
            <Text style={{ fontSize: 10, color: '#94a3b8' }}>{this.state.error?.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    if (typeof ErrorUtils !== 'undefined' && ErrorUtils?.setGlobalHandler) {
      const prevHandler = ErrorUtils.getGlobalHandler?.();
      ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
        logCrash(error, { isFatal, source: 'GlobalHandler' });
        if (prevHandler) prevHandler(error, isFatal);
      });
    }
    AsyncStorage.getItem('__last_crash__')
      .then((val) => {
        if (val) console.log('📋 Previous session crash log:', val);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        await initDatabase();

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
        logCrash(e, { source: 'prepare()' });
      } finally {
        await SplashScreen.hideAsync();
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const handleLoaderComplete = () => {
    setShowLoader(false);
  };

  // ============================================================
  // SYNC CONFIGURATION
  // ============================================================
  const SYNC_INTERVAL_MS = 1200000; // 20 minutes
  // ============================================================

  // Global auto-sync. Now uses runAutoPush() (awaited, non-debounced)
  // instead of triggerAutoPush() (fire-and-forget) so we can actually
  // see the result — both pushToCloud/pullFromCloud silently no-op if
  // isGithubConfigured() returns false, with no error thrown. Logging
  // getAutoSyncState() after every attempt exposes that.
  useEffect(() => {
    if (!appIsReady) return;

    let lastSyncTime = Date.now();
    let cancelled = false;

    const performSync = async () => {
      try {
        console.log('🔄 Syncing database...');
        await runAutoPush();
        console.log('📤 Push attempt finished at:', new Date().toLocaleTimeString());
        await runAutoPull();
        console.log('📥 Pull attempt finished at:', new Date().toLocaleTimeString());
        lastSyncTime = Date.now();

        // ★ This is the key diagnostic line — check it in your logs.
        const state = getAutoSyncState();
        console.log('📊 Sync state:', state);
        if (state.status === 'idle') {
          console.warn('⚠️ Sync ran but did nothing — GitHub sync is likely not configured (isGithubConfigured returned false). Check Settings on this device.');
        } else if (state.status === 'error') {
          console.warn('⚠️ Sync ran and FAILED:', state.lastError);
        } else if (state.status === 'ok') {
          console.log('✅ Sync actually completed. Last synced at:', state.lastSyncedAt);
        }
      } catch (error) {
        console.warn('⚠️ Sync threw an error:', error);
        logCrash(error, { source: 'performSync' });
      }
    };

    const initialTimer = setTimeout(() => {
      if (!cancelled) performSync();
    }, 3000);

    const intervalId = setInterval(() => {
      const timeSinceLastSync = Date.now() - lastSyncTime;
      if (timeSinceLastSync >= SYNC_INTERVAL_MS) {
        console.log(`⏰ ${SYNC_INTERVAL_MS / 60000} minutes elapsed, syncing...`);
        performSync();
      }
    }, 60000);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        console.log('📱 App came to foreground, syncing...');
        performSync();
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(intervalId);
      sub.remove();
    };
  }, [appIsReady]);

  if (!appIsReady || showLoader) {
    return (
      <ErrorBoundary>
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
      </ErrorBoundary>
    );
  }

  if (initError) {
    return (
      <ErrorBoundary>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#000' }}>
          <Text style={{ fontSize: 18, color: '#ef4444', textAlign: 'center' }}>
            Failed to start: {initError}
          </Text>
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
