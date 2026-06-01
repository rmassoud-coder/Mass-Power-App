import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/contexts/AuthContext';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';
import { Image } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Prewarm icon assets for Expo Go Android
        const iconAssets = [
          require('../assets/icon.png'),
          require('../assets/adaptive-icon.png'),
        ];

        const cacheImages = iconAssets.map((icon) => {
          return Asset.fromModule(icon).downloadAsync();
        });

        await Promise.all(cacheImages);

        // Preload the images into React Native's Image cache
        iconAssets.forEach((icon) => {
          Image.prefetch(Image.resolveAssetSource(icon).uri);
        });
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!appIsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="home" />
            <Stack.Screen name="search-results" />
            <Stack.Screen name="customer-detail" />
            <Stack.Screen name="add-customer" />
            <Stack.Screen name="edit-customer" />
            <Stack.Screen name="add-vehicle" />
            <Stack.Screen name="add-service" />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
