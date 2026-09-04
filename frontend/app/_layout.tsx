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
import { runAutoPull } from '../src/utils/autoSync';

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

  // Safe auto-pull: merges cloud changes in
  useEffect(() => {
    runAutoPull().catch(() => { /* swallowed intentionally */ });

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        runAutoPull().catch(() => { /* swallowed intentionally */ });
      }
    });
    return () => sub.remove();
  }, []);

  // Show loader while app is preparing or loader is visible
  if (!appIsReady || showLoader) {
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
