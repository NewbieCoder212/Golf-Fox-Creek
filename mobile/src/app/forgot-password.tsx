import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Mail, CheckCircle, Wrench } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { getPasswordResetRedirectUrl, requestPasswordReset } from '@/lib/supabase';

const DEV_AUTH_SECRET = process.env.EXPO_PUBLIC_DEV_AUTH_SECRET ?? 'foxcreek-dev-local';
const BACKEND_URL =
  process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? 'http://localhost:3000';

function isRateLimitError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes('rate limit') || lower.includes('too many requests');
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof emailParam === 'string' ? emailParam : '');
  const [devPassword, setDevPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDevLoading, setIsDevLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devError, setDevError] = useState<string | null>(null);
  const [devMessage, setDevMessage] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [resetRedirectUrl, setResetRedirectUrl] = useState<string | null>(null);
  const [showDevTools, setShowDevTools] = useState(false);

  const handleSendReset = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await requestPasswordReset(trimmedEmail);

    setIsLoading(false);

    if (!result.success) {
      setError(result.error ?? 'Failed to send reset email');
      if (isRateLimitError(result.error)) {
        setShowDevTools(true);
      }
      return;
    }

    setResetRedirectUrl(result.redirectTo ?? getPasswordResetRedirectUrl());
    setSent(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleGenerateDevLink = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setDevError('Enter your email above first');
      return;
    }

    setIsDevLoading(true);
    setDevError(null);
    setDevMessage(null);
    setGeneratedLink(null);

    try {
      const redirectTo = getPasswordResetRedirectUrl();
      const response = await fetch(`${BACKEND_URL}/api/dev/generate-reset-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dev-Secret': DEV_AUTH_SECRET,
        },
        body: JSON.stringify({ email: trimmedEmail, redirectTo }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDevError(data.error ?? 'Could not generate reset link');
        return;
      }

      setGeneratedLink(data.actionLink);
      setDevMessage('Reset link generated without sending email. Open it below.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setDevError('Backend not reachable. Start it with: cd backend && bun run dev');
    } finally {
      setIsDevLoading(false);
    }
  };

  const handleSetDevPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !devPassword.trim()) {
      setDevError('Enter your email and a new password');
      return;
    }
    if (devPassword.length < 6) {
      setDevError('Password must be at least 6 characters');
      return;
    }

    setIsDevLoading(true);
    setDevError(null);
    setDevMessage(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/dev/set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dev-Secret': DEV_AUTH_SECRET,
        },
        body: JSON.stringify({ email: trimmedEmail, password: devPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDevError(data.error ?? 'Could not set password');
        return;
      }

      setDevMessage('Password updated. You can sign in now.');
      setDevPassword('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setDevError('Backend not reachable. Start it with: cd backend && bun run dev');
    } finally {
      setIsDevLoading(false);
    }
  };

  const handleOpenGeneratedLink = () => {
    if (!generatedLink) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(generatedLink);
  };

  return (
    <View className="flex-1 bg-[#0a0a0a]">
      <LinearGradient
        colors={['rgba(26,46,26,0.6)', '#0a0a0a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280 }}
      />

      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
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

          <ScrollView className="flex-1 px-6 pt-4" keyboardShouldPersistTaps="handled">
            {sent ? (
              <Animated.View entering={FadeInDown.duration(500)} className="items-center pt-8">
                <View className="w-20 h-20 bg-lime-900/30 rounded-full items-center justify-center border border-lime-700/50 mb-6">
                  <CheckCircle size={40} color="#a3e635" />
                </View>
                <Text className="text-white text-2xl font-bold mb-2 text-center">Check Your Email</Text>
                <Text className="text-neutral-400 text-center leading-relaxed mb-4 px-2">
                  If an account exists for {email.trim()}, we sent a password reset link. Open it to set a new password.
                </Text>
                {resetRedirectUrl ? (
                  <Text className="text-neutral-500 text-xs text-center leading-relaxed mb-8 px-4">
                    The link should open at{' '}
                    <Text className="text-lime-400/80">{resetRedirectUrl}</Text>.
                  </Text>
                ) : null}
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
                      <Mail size={36} color="#a3e635" />
                    </View>
                    <Text className="text-white text-2xl font-bold">Forgot Password</Text>
                    <Text className="text-neutral-500 text-sm mt-2 text-center px-4">
                      Enter your email and we&apos;ll send you a link to reset your password.
                    </Text>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200).duration(500)}>
                  <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2 ml-1">
                    Email
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="#525252"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-4 text-white text-base mb-4"
                  />

                  {error ? (
                    <View className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-4">
                      <Text className="text-red-300 text-sm text-center">{error}</Text>
                      {isRateLimitError(error) ? (
                        <Text className="text-neutral-400 text-xs text-center mt-2">
                          Supabase limits how many reset emails can be sent per hour. Use the dev
                          tools below, wait about an hour, or set the password in the Supabase
                          dashboard.
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <Pressable
                    onPress={handleSendReset}
                    disabled={isLoading}
                    className={`rounded-xl py-4 items-center ${
                      isLoading ? 'bg-lime-700/50' : 'bg-lime-600 active:bg-lime-700'
                    }`}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-semibold text-base">Send Reset Link</Text>
                    )}
                  </Pressable>

                  {__DEV__ ? (
                    <View className="mt-8 border border-amber-800/40 bg-amber-950/20 rounded-2xl p-4">
                      <Pressable
                        onPress={() => setShowDevTools(!showDevTools)}
                        className="flex-row items-center justify-between"
                      >
                        <View className="flex-row items-center">
                          <Wrench size={16} color="#fbbf24" />
                          <Text className="text-amber-300 text-sm font-medium ml-2">
                            Dev bypass (no email)
                          </Text>
                        </View>
                        <Text className="text-amber-500 text-xs">{showDevTools ? 'Hide' : 'Show'}</Text>
                      </Pressable>

                      {showDevTools ? (
                        <View className="mt-4">
                          <Text className="text-neutral-400 text-xs leading-relaxed mb-4">
                            Requires backend running and{' '}
                            <Text className="text-amber-200/80">SUPABASE_SERVICE_ROLE_KEY</Text> in{' '}
                            <Text className="text-amber-200/80">backend/.env</Text> (Supabase → Settings → API).
                          </Text>

                          <Pressable
                            onPress={handleGenerateDevLink}
                            disabled={isDevLoading}
                            className="rounded-xl py-3 items-center bg-amber-900/40 border border-amber-700/40 mb-3"
                          >
                            {isDevLoading ? (
                              <ActivityIndicator color="#fbbf24" />
                            ) : (
                              <Text className="text-amber-200 text-sm font-medium">
                                Generate reset link (no email)
                              </Text>
                            )}
                          </Pressable>

                          <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2 ml-1">
                            Or set password directly
                          </Text>
                          <TextInput
                            value={devPassword}
                            onChangeText={setDevPassword}
                            placeholder="New password"
                            placeholderTextColor="#525252"
                            secureTextEntry
                            autoCapitalize="none"
                            className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-3 text-white text-base mb-3"
                          />
                          <Pressable
                            onPress={handleSetDevPassword}
                            disabled={isDevLoading}
                            className="rounded-xl py-3 items-center bg-amber-900/40 border border-amber-700/40"
                          >
                            <Text className="text-amber-200 text-sm font-medium">Set password now</Text>
                          </Pressable>

                          {devError ? (
                            <Text className="text-red-300 text-xs mt-3 text-center">{devError}</Text>
                          ) : null}
                          {devMessage ? (
                            <Text className="text-lime-300 text-xs mt-3 text-center">{devMessage}</Text>
                          ) : null}
                          {generatedLink ? (
                            <Pressable
                              onPress={handleOpenGeneratedLink}
                              className="mt-3 rounded-xl py-3 px-3 bg-lime-900/30 border border-lime-700/40"
                            >
                              <Text className="text-lime-300 text-xs text-center">
                                Open reset link in browser
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </Animated.View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
