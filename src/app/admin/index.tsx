import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, Eye, EyeOff, ArrowLeft } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useAdminAuthStore } from '@/lib/admin-auth-store';
import { signIn, getAuthenticatedUserProfile } from '@/lib/supabase';

export default function AdminLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setAuth, isAuthenticated, loadStoredAuth, canAccessAdmin } = useAdminAuthStore();

  // Check for existing auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const hasAuth = await loadStoredAuth();
      if (hasAuth && canAccessAdmin()) {
        router.replace('/admin/dashboard');
      }
    };
    checkAuth();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }

    setIsLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const authResult = await signIn(email.trim(), password);

      if (!authResult.success || !authResult.session) {
        setError(authResult.error ?? 'Login failed');
        setIsLoading(false);
        return;
      }

      // Get user profile to check role
      const profile = await getAuthenticatedUserProfile(
        authResult.session.user.id,
        authResult.session.access_token
      );

      if (!profile) {
        setError('Could not load profile');
        setIsLoading(false);
        return;
      }

      // Check if user has admin access
      if (profile.role !== 'manager' && profile.role !== 'super_admin') {
        setError('Access denied. Manager or Admin role required.');
        setIsLoading(false);
        return;
      }

      // Save auth state
      await setAuth({
        accessToken: authResult.session.access_token,
        refreshToken: authResult.session.refresh_token,
        user: authResult.session.user,
        profile,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/admin/dashboard');
    } catch (err) {
      console.log('[AdminLogin] Error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <LinearGradient
        colors={['#1a2e1a', '#0c0c0c']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300 }}
      />

      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          {/* Header */}
          <View className="flex-row items-center px-5 py-4">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              className="w-10 h-10 items-center justify-center rounded-full bg-neutral-900/50 active:opacity-70"
            >
              <ArrowLeft size={20} color="#a3e635" />
            </Pressable>
          </View>

          {/* Content */}
          <View className="flex-1 px-6 pt-8">
            <Animated.View entering={FadeInDown.delay(100).duration(500)}>
              <View className="items-center mb-8">
                <View className="w-20 h-20 bg-lime-900/30 rounded-full items-center justify-center border border-lime-700/50 mb-4">
                  <Shield size={36} color="#a3e635" />
                </View>
                <Text className="text-white text-2xl font-bold">Admin Portal</Text>
                <Text className="text-neutral-500 text-sm mt-1">
                  Manager & Admin Access Only
                </Text>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(500)}>
              {/* Email Input */}
              <View className="mb-4">
                <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2 ml-1">
                  Email
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="admin@foxcreek.golf"
                  placeholderTextColor="#525252"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-4 text-white text-base"
                />
              </View>

              {/* Password Input */}
              <View className="mb-6">
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

              {/* Error Message */}
              {error && (
                <View className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-4">
                  <Text className="text-red-300 text-sm text-center">{error}</Text>
                </View>
              )}

              {/* Login Button */}
              <Pressable
                onPress={handleLogin}
                disabled={isLoading}
                className={`rounded-xl py-4 items-center ${
                  isLoading ? 'bg-lime-700/50' : 'bg-lime-600 active:bg-lime-700'
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-base">Sign In</Text>
                )}
              </Pressable>
            </Animated.View>
          </View>

          {/* Footer */}
          <View className="px-6 pb-8">
            <Text className="text-neutral-600 text-xs text-center">
              Contact your administrator if you need access
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
