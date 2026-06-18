import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
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
import { useAdminAuthStore } from '@/lib/admin-auth-store';
import { getPostLoginRoute, syncStoredAuthStores } from '@/lib/admin-auth-bridge';
import { getAuthCallbackRouteFromUrl } from '@/lib/supabase';
import { foxColors } from '@/theme/tokens';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'login',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/** Supabase email links may land on `/` with tokens in the hash — send users to the right screen. */
function useAuthEmailLinkRedirect() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const callbackRoute = getAuthCallbackRouteFromUrl(window.location.href);
    if (!callbackRoute) return;

    const segmentRoute =
      callbackRoute === '/reset-password' ? 'reset-password' : 'accept-invite';
    if (segments[0] === segmentRoute) return;

    // Keep hash tokens on the URL when moving to the auth callback route.
    window.history.replaceState(null, '', `${callbackRoute}${window.location.hash}`);
    router.replace(callbackRoute);
  }, [router, segments]);
}

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const isAuthenticated = useMemberAuthStore((s) => s.isAuthenticated);
  const isLoading = useMemberAuthStore((s) => s.isLoading);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  // Load stored auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const member = useMemberAuthStore.getState();
      const admin = useAdminAuthStore.getState();
      if (!member.accessToken && !admin.accessToken) {
        await useMemberAuthStore.getState().loadStoredAuth();
        await useAdminAuthStore.getState().loadStoredAuth();
      }
      await syncStoredAuthStores();
      setHasCheckedAuth(true);
      SplashScreen.hideAsync();
    };
    checkAuth();
  }, []);

  // Handle navigation based on auth state
  useEffect(() => {
    if (!hasCheckedAuth || isLoading) return;

    const inAuthGroup = segments[0] === 'login';
    const inAdminGroup = segments[0] === 'admin';
    const inResetPassword = segments[0] === 'reset-password';
    const inForgotPassword = segments[0] === 'forgot-password';
    const inAcceptInvite = segments[0] === 'accept-invite';
    const inDisplay = segments[0] === 'display';
    const isPublicAuthRoute =
      inAuthGroup || inAdminGroup || inResetPassword || inForgotPassword || inAcceptInvite || inDisplay;

    // If not authenticated and not on a public auth route, redirect to login
    // (Admin has its own auth system via Supabase)
    if (!isAuthenticated && !isPublicAuthRoute) {
      router.replace('/login');
    }
    // Managers/admins belong on the admin dashboard after sign-in — not member tabs.
    else if (isAuthenticated && inAuthGroup) {
      const profile = useMemberAuthStore.getState().profile;
      router.replace(getPostLoginRoute(profile?.role));
    }
  }, [isAuthenticated, segments, hasCheckedAuth, isLoading, router]);

  return { isLoading: isLoading || !hasCheckedAuth };
}

function RootLayoutNav({ colorScheme }: { colorScheme: 'light' | 'dark' | null | undefined }) {
  useAuthEmailLinkRedirect();
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
        <Stack.Screen name="admin/hub-preview" options={{ headerShown: false }} />
        <Stack.Screen name="admin/ad-preview" options={{ headerShown: false }} />
        <Stack.Screen name="admin/members" options={{ headerShown: false }} />
        <Stack.Screen name="report-condition" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="accept-invite" options={{ headerShown: false }} />
        <Stack.Screen name="tournaments" options={{ headerShown: false }} />
        <Stack.Screen name="tournament" options={{ headerShown: false }} />
        <Stack.Screen name="wagering/[sessionId]" options={{ headerShown: false }} />
        <Stack.Screen name="display" options={{ headerShown: false }} />
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
