import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Eye, EyeOff, LogIn } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMemberAuthStore } from '@/lib/member-auth-store';
import { getAuthenticatedUserProfile, signIn } from '@/lib/supabase';
import { bridgeMemberAuthToAdmin, getPostLoginRoute } from '@/lib/admin-auth-bridge';

const GENERATION_CUP_LOGO = require('@/assets/images/generation-cup-logo.png');

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setAuth = useMemberAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInButtonScale = useSharedValue(1);

  const signInButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: signInButtonScale.value }],
  }));

  const handleMemberSignIn = async () => {
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

      const profile = await getAuthenticatedUserProfile(
        authResult.session.user.id,
        authResult.session.access_token
      );

      if (!profile) {
        setError('Could not load profile');
        setIsLoading(false);
        return;
      }

      await setAuth({
        accessToken: authResult.session.access_token,
        refreshToken: authResult.session.refresh_token,
        user: authResult.session.user,
        profile,
      });

      await bridgeMemberAuthToAdmin();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(getPostLoginRoute(profile.role));
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#0a0a0a]">
      {/* Background Image with Gradient Overlay */}
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=1200&q=80' }}
        className="absolute inset-0 w-full h-full"
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(10,10,10,0.3)', 'rgba(10,10,10,0.85)', 'rgba(10,10,10,0.98)']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View
          className="flex-1 px-6"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 20 }}
        >
          {/* Hero — logo and dates */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(800).springify()}
            className="items-center w-full pt-10"
          >
            <Image
              source={GENERATION_CUP_LOGO}
              style={{ width: 360, height: 360, alignSelf: 'center' }}
              resizeMode="contain"
            />

            <View className="items-center w-full mt-4">
              <Text className="text-neutral-400 text-sm text-center w-full">
                June 19 – June 20, 2026
              </Text>
            </View>
          </Animated.View>

          <View className="flex-1" />

          {/* Sign In Card */}
          <Animated.View
            entering={FadeInUp.delay(300).duration(800).springify()}
            className="overflow-hidden rounded-3xl"
          >
            <BlurView intensity={40} tint="dark" style={{ overflow: 'hidden' }}>
              <View className="p-6 border border-white/10 rounded-3xl">
                <View className="mb-6">
                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3">
                    Member Sign In
                  </Text>

                  {error ? (
                    <View className="bg-red-900/30 border border-red-800/50 rounded-xl px-4 py-3 mb-3">
                      <Text className="text-red-300 text-sm text-center">{error}</Text>
                    </View>
                  ) : null}

                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    placeholderTextColor="#737373"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white mb-3"
                  />

                  <View className="relative mb-2">
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Password"
                      placeholderTextColor="#737373"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white pr-12"
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 p-1"
                    >
                      {showPassword ? (
                        <EyeOff size={20} color="#737373" />
                      ) : (
                        <Eye size={20} color="#737373" />
                      )}
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({
                        pathname: '/forgot-password',
                        params: email.trim() ? { email: email.trim() } : undefined,
                      });
                    }}
                    className="self-end mb-4 py-1"
                  >
                    <Text className="text-lime-400/80 text-sm">Forgot password?</Text>
                  </Pressable>

                  <AnimatedPressable
                    onPress={handleMemberSignIn}
                    onPressIn={() => {
                      signInButtonScale.value = withSpring(0.96, { damping: 15 });
                    }}
                    onPressOut={() => {
                      signInButtonScale.value = withSpring(1, { damping: 15 });
                    }}
                    disabled={isLoading}
                    style={[
                      {
                        borderRadius: 16,
                        paddingVertical: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        backgroundColor: '#a3e635',
                        opacity: isLoading ? 0.7 : 1,
                      },
                      signInButtonStyle,
                    ]}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#0a0a0a" />
                    ) : (
                      <>
                        <LogIn size={20} color="#0a0a0a" strokeWidth={2} />
                        <Text className="text-black text-base font-semibold ml-2 tracking-wide">
                          Sign In
                        </Text>
                      </>
                    )}
                  </AnimatedPressable>
                </View>
              </View>
            </BlurView>
          </Animated.View>

          {/* Footer */}
          <Animated.View
            entering={FadeIn.delay(600).duration(800)}
            className="mt-4 items-center"
          >
            <Text className="text-neutral-600 text-xs text-center">
              Product of Acadia Venture Studio
            </Text>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
