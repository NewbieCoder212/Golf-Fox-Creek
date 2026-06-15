import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
} from '@expo-google-fonts/barlow';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { useColorScheme } from '@/lib/useColorScheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useMemberAuthStore } from '@/lib/member-auth-store';
import { foxColors } from '@/theme/tokens';

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
    const inResetPassword = segments[0] === 'reset-password';
    const inForgotPassword = segments[0] === 'forgot-password';
    const inAcceptInvite = segments[0] === 'accept-invite';
    const isPublicAuthRoute =
      inAuthGroup || inAdminGroup || inResetPassword || inForgotPassword || inAcceptInvite;

    // If not authenticated and not on a public auth route, redirect to login
    // (Admin has its own auth system via Supabase)
    if (!isAuthenticated && !isPublicAuthRoute) {
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
      <View className="flex-1 bg-fox-background items-center justify-center">
        <ActivityIndicator size="large" color={foxColors.lime} />
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
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="accept-invite" options={{ headerShown: false }} />
        <Stack.Screen name="tournaments" options={{ headerShown: false }} />
        <Stack.Screen name="tournament" options={{ headerShown: false }} />
        <Stack.Screen name="wagering/[sessionId]" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    BarlowCondensed_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View className="flex-1 bg-fox-background items-center justify-center">
        <ActivityIndicator size="large" color={foxColors.lime} />
      </View>
    );
  }

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
