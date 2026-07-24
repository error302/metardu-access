/**
 * Root layout — sets up providers, fonts, theme, auth gate.
 */

import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '@/global.css';
import '@/i18n';

import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const initialize = useAuthStore((s) => s.initialize);
  const loadSettings = useSettingsStore((s) => s.load);
  const outdoorMode = useSettingsStore((s) => s.outdoorMode);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    async function bootstrap() {
      try {
        await loadSettings();
        await initialize();
      } catch (e) {
        console.warn('Bootstrap error:', e);
      } finally {
        setReady(true);
        await SplashScreen.hideAsync();
      }
    }
    bootstrap();
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar
            style={outdoorMode ? 'light' : 'auto'}
            backgroundColor={'#0B1F3A'}
          />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: '#0B1F3A',
              },
              headerTintColor: '#FFFFFF',
              headerTitleStyle: {
                fontWeight: '600',
              },
              contentStyle: {
                backgroundColor: '#FAF7F2',
              },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth/login" options={{ title: 'Sign In', headerShown: false }} />
            <Stack.Screen name="auth/register" options={{ title: 'Register', headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
