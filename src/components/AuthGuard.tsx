/**
 * Auth gate — if not authenticated, redirect to login.
 */

import React from 'react';
import { Redirect, useRootNavigationState } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useThemeColors } from '@/hooks/useThemeColors';

export function withAuth(WrappedComponent: React.ComponentType) {
  return function AuthenticatedScreen(props: any) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const isLoading = useAuthStore((s) => s.isLoading);
    const navState = useRootNavigationState();
    const Colors = useThemeColors();

    if (!navState?.key || isLoading) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg }}>
          <ActivityIndicator size="large" color={Colors.metarduOrange} />
        </View>
      );
    }

    if (!isAuthenticated) {
      return <Redirect href="/auth/login" />;
    }

    return <WrappedComponent {...props} />;
  };
}
