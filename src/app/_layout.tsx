import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/lib/useColorScheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useMemberAuthStore } from '@/lib/member-auth-store';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'login',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const isAuthenticated = useMemberAuthStore((s) => s.isAuthenticated);
  const isLoading = useMemberAuthStore((s) => s.isLoading);
  const loadStoredAuth = useMemberAuthStore((s) => s.loadStoredAuth);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  // Load stored auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      await loadStoredAuth();
      setHasCheckedAuth(true);
      SplashScreen.hideAsync();
    };
    checkAuth();
  }, [loadStoredAuth]);

  // Handle navigation based on auth state
  useEffect(() => {
    if (!hasCheckedAuth || isLoading) return;

    const inAuthGroup = segments[0] === 'login';
    const inAdminGroup = segments[0] === 'admin';

    // If not authenticated and not on login page, redirect to login
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    }
    // If authenticated and on login page, redirect to home
    else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, hasCheckedAuth, isLoading, router]);

  return { isLoading: isLoading || !hasCheckedAuth };
}

function RootLayoutNav({ colorScheme }: { colorScheme: 'light' | 'dark' | null | undefined }) {
  const { isLoading } = useProtectedRoute();

  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center">
        <ActivityIndicator size="large" color="#a3e635" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="history" options={{ headerShown: false }} />
        <Stack.Screen name="admin/index" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="admin/dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="admin/members" options={{ headerShown: false }} />
        <Stack.Screen name="report-condition" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}



export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <StatusBar style="light" />
          <RootLayoutNav colorScheme={colorScheme} />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}