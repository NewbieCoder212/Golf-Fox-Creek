import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  getAuthenticatedUserProfile,
  parseInviteTokenFromUrl,
  updatePasswordWithRecoveryToken,
} from '@/lib/supabase';
import { useMemberAuthStore } from '@/lib/member-auth-store';

function getTokenFromWebLocation(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return parseInviteTokenFromUrl(window.location.href);
}

export default function AcceptInviteScreen() {
  const router = useRouter();
  const setAuth = useMemberAuthStore((s) => s.setAuth);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const resolveToken = (url: string | null) => {
      if (!url) return null;
      return parseInviteTokenFromUrl(url);
    };

    const applyToken = (token: string | null) => {
      if (token) {
        setAccessToken(token);
        setError(null);
      } else {
        setError('Invalid or expired invite link. Ask your admin to resend the invitation.');
      }
      setIsCheckingToken(false);
    };

    const webToken = getTokenFromWebLocation();
    if (webToken) {
      applyToken(webToken);
      return;
    }

    Linking.getInitialURL()
      .then((initialUrl) => applyToken(resolveToken(initialUrl)))
      .catch(() => applyToken(null));

    const subscription = Linking.addEventListener('url', ({ url }) => {
      const token = resolveToken(url);
      if (token) {
        setAccessToken(token);
        setError(null);
        setIsCheckingToken(false);
      }
    });

    return () => subscription.remove();
  }, []);

  const handleCreateAccount = async () => {
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!accessToken) {
      setError('Invalid invite token');
      return;
    }

    setIsLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await updatePasswordWithRecoveryToken(accessToken, password);

    if (!result.success) {
      setError(result.error ?? 'Failed to create account');
      setIsLoading(false);
      return;
    }

    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
      const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (userResponse.ok) {
        const user = (await userResponse.json()) as { id: string; email?: string };
        const profile = await getAuthenticatedUserProfile(user.id, accessToken);
        if (profile) {
          await setAuth({
            accessToken,
            refreshToken: '',
            user: { id: user.id, email: user.email ?? profile.email ?? '' },
            profile,
          });
        }
      }
    } catch {
      // Password set succeeded; user can sign in manually
    }

    setSuccess(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsLoading(false);
  };

  const handleGoToPortal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(tabs)');
  };

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <LinearGradient
        colors={['#1a2e1a', '#0c0c0c']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300 }}
      />

      <SafeAreaView className="flex-1">
        <View className="flex-1 px-6 pt-16">
          {isCheckingToken ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#a3e635" />
            </View>
          ) : success ? (
            <Animated.View entering={FadeInDown.duration(500)} className="items-center">
              <View className="w-20 h-20 bg-lime-900/30 rounded-full items-center justify-center border border-lime-700/50 mb-6">
                <CheckCircle size={40} color="#a3e635" />
              </View>
              <Text className="text-white text-2xl font-bold mb-2">Welcome to Fox Creek</Text>
              <Text className="text-neutral-400 text-center mb-8">
                Your member account is ready. You can now access tournaments, scorecards, and the
                member portal.
              </Text>
              <Pressable
                onPress={handleGoToPortal}
                className="bg-lime-600 rounded-xl py-4 px-8 active:bg-lime-700"
              >
                <Text className="text-white font-semibold text-base">Go to Member Portal</Text>
              </Pressable>
            </Animated.View>
          ) : !accessToken ? (
            <Animated.View entering={FadeInDown.duration(500)} className="items-center pt-8">
              <View className="w-20 h-20 bg-red-900/30 rounded-full items-center justify-center border border-red-700/50 mb-6">
                <AlertCircle size={40} color="#f87171" />
              </View>
              <Text className="text-white text-2xl font-bold mb-2 text-center">Invite Expired</Text>
              <Text className="text-neutral-400 text-center leading-relaxed mb-8 px-2">
                {error ?? 'This invite link is invalid or has expired.'}
              </Text>
              <Pressable
                onPress={() => router.replace('/login')}
                className="bg-lime-600 rounded-xl py-4 px-8 active:bg-lime-700"
              >
                <Text className="text-white font-semibold text-base">Back to Sign In</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <>
              <Animated.View entering={FadeInDown.delay(100).duration(500)}>
                <View className="items-center mb-8">
                  <View className="w-20 h-20 bg-lime-900/30 rounded-full items-center justify-center border border-lime-700/50 mb-4">
                    <Lock size={36} color="#a3e635" />
                  </View>
                  <Text className="text-white text-2xl font-bold">Create Your Account</Text>
                  <Text className="text-neutral-500 text-sm mt-1 text-center">
                    Set a password to access the member portal
                  </Text>
                </View>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(200).duration(500)}>
                <View className="mb-4">
                  <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2 ml-1">
                    Password
                  </Text>
                  <View className="relative">
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#525252"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-4 text-white text-base pr-12"
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-4"
                    >
                      {showPassword ? (
                        <EyeOff size={20} color="#525252" />
                      ) : (
                        <Eye size={20} color="#525252" />
                      )}
                    </Pressable>
                  </View>
                </View>

                <View className="mb-6">
                  <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2 ml-1">
                    Confirm Password
                  </Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#525252"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-4 text-white text-base"
                  />
                </View>

                {error ? (
                  <View className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-4 flex-row items-center">
                    <AlertCircle size={20} color="#f87171" />
                    <Text className="text-red-300 text-sm ml-2 flex-1">{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={handleCreateAccount}
                  disabled={isLoading}
                  className={`rounded-xl py-4 items-center ${
                    isLoading ? 'bg-lime-700/50' : 'bg-lime-600 active:bg-lime-700'
                  }`}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-semibold text-base">Create Account</Text>
                  )}
                </Pressable>
              </Animated.View>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
