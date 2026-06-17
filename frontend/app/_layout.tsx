import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';
import { Image, Platform, View, Text } from 'react-native';
import { initDatabase } from '../src/db/database';
import RpmLoader from '../src/components/RpmLoader';

SplashScreen.preventAutoHideAsync();

const MIN_LOADER_MS = 1800; // give the revving animation room to play

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    async function prepare() {
      const startedAt = Date.now();
      try {
        // Initialize local SQLite database
        await initDatabase();

        // Prewarm icon assets only on native (skip on web)
        if (Platform.OS !== 'web') {
          const iconAssets = [
            require('../assets/images/icon.png'),
            require('../assets/images/adaptive-icon.png'),
            require('../assets/images/mass-power-logo.png'),
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
        // Hide the native splash so our RpmLoader becomes visible
        await SplashScreen.hideAsync();
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, MIN_LOADER_MS - elapsed);
        if (remaining > 0) {
          await new Promise((r) => setTimeout(r, remaining));
        }
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  if (!appIsReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <RpmLoader />
      </View>
    );
  }

  if (initError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 18, color: '#ef4444', textAlign: 'center' }}>
          Failed to start: {initError}
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
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
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
