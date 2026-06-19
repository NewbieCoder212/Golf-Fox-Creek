import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  Linking,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  getAuthenticatedUserProfile,
  parseAuthTokensFromUrl,
  signIn,
  updatePasswordWithRecoveryToken,
  type AuthLinkTokens,
} from '@/lib/supabase';
import { useMemberAuthStore } from '@/lib/member-auth-store';
import {
  hasSeenInviteSignInReminder,
  INVITE_SIGN_IN_REMINDER_COPY,
  markInviteSignInReminderSeen,
} from '@/lib/invite-sign-in-reminder';
import { getPostLoginRoute, bridgeMemberAuthToAdmin } from '@/lib/admin-auth-bridge';

function getTokensFromWebLocation(): AuthLinkTokens | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return parseAuthTokensFromUrl(window.location.href);
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
  const [memberEmail, setMemberEmail] = useState<string | null>(null);
  const [authTokens, setAuthTokens] = useState<AuthLinkTokens | null>(null);
  const [showSignInReminder, setShowSignInReminder] = useState(false);

  useEffect(() => {
    const resolveTokens = (url: string | null) => {
      if (!url) return null;
      return parseAuthTokensFromUrl(url);
    };

    const applyTokens = (tokens: AuthLinkTokens | null) => {
      if (tokens) {
        setAuthTokens(tokens);
        setError(null);
      } else {
        setError('Invalid or expired invite link. Ask your admin to resend the invitation.');
      }
      setIsCheckingToken(false);
    };

    const webTokens = getTokensFromWebLocation();
    if (webTokens) {
      applyTokens(webTokens);
      return;
    }

    Linking.getInitialURL()
      .then((initialUrl) => applyTokens(resolveTokens(initialUrl)))
      .catch(() => applyTokens(null));

    const subscription = Linking.addEventListener('url', ({ url }) => {
      const tokens = resolveTokens(url);
      if (tokens) {
        setAuthTokens(tokens);
        setError(null);
        setIsCheckingToken(false);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!success) return;

    let cancelled = false;
    void hasSeenInviteSignInReminder().then((seen) => {
      if (!cancelled && !seen) {
        setShowSignInReminder(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [success]);

  const establishMemberSession = async (
    email: string,
    nextPassword: string,
    inviteTokens: AuthLinkTokens
  ): Promise<boolean> => {
    const signInResult = await signIn(email.trim(), nextPassword);
    if (signInResult.success && signInResult.session) {
      const profile = await getAuthenticatedUserProfile(
        signInResult.session.user.id,
        signInResult.session.access_token
      );
      if (!profile) return false;

      await setAuth({
        accessToken: signInResult.session.access_token,
        refreshToken: signInResult.session.refresh_token,
        user: signInResult.session.user,
        profile,
      });
      await bridgeMemberAuthToAdmin();
      return true;
    }

    const userResponse = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/auth/v1/user`,
      {
        headers: {
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${inviteTokens.accessToken}`,
        },
      }
    );

    if (!userResponse.ok) return false;

    const user = (await userResponse.json()) as { id: string; email?: string };
    const profile = await getAuthenticatedUserProfile(user.id, inviteTokens.accessToken);
    if (!profile) return false;

    await setAuth({
      accessToken: inviteTokens.accessToken,
      refreshToken: inviteTokens.refreshToken ?? '',
      user: { id: user.id, email: user.email ?? profile.email ?? email },
      profile,
    });
    await bridgeMemberAuthToAdmin();
    return true;
  };

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
    if (!authTokens?.accessToken) {
      setError('Invalid invite token');
      return;
    }

    setIsLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await updatePasswordWithRecoveryToken(authTokens.accessToken, password);

    if (!result.success) {
      setError(result.error ?? 'Failed to create account');
      setIsLoading(false);
      return;
    }

    let resolvedEmail = memberEmail;
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
      const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${authTokens.accessToken}`,
        },
      });

      if (userResponse.ok) {
        const user = (await userResponse.json()) as { id: string; email?: string };
        resolvedEmail = user.email?.trim().toLowerCase() ?? resolvedEmail;
        if (resolvedEmail) {
          setMemberEmail(resolvedEmail);
        }
        await establishMemberSession(resolvedEmail ?? '', password, authTokens);
      }
    } catch {
      // Password set succeeded; user can sign in manually from login.
    }

    setSuccess(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsLoading(false);
  };

  const handleDismissReminder = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await markInviteSignInReminderSeen();
    setShowSignInReminder(false);
  };

  const handleGoToPortal = () => {
    if (showSignInReminder) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const profile = useMemberAuthStore.getState().profile;
    router.replace(getPostLoginRoute(profile?.role));
  };

  const handleGoToSignIn = () => {
    if (showSignInReminder) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace({
      pathname: '/login',
      params: memberEmail ? { email: memberEmail } : undefined,
    });
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
              <Text className="text-neutral-400 text-center mb-4 leading-relaxed">
                Your password is set. You can open the member portal now, or sign in again anytime
                from the home page.
              </Text>
              <Text className="text-neutral-500 text-center text-sm mb-8 leading-relaxed px-2">
                Next visit: use Member Sign In at foxcreek.golf — not the invite email link.
              </Text>
              <Pressable
                onPress={handleGoToPortal}
                disabled={showSignInReminder}
                className={`rounded-xl py-4 px-8 mb-3 w-full items-center ${
                  showSignInReminder ? 'bg-lime-700/40' : 'bg-lime-600 active:bg-lime-700'
                }`}
              >
                <Text className="text-white font-semibold text-base">Go to Member Portal</Text>
              </Pressable>
              <Pressable
                onPress={handleGoToSignIn}
                disabled={showSignInReminder}
                className="py-3 px-4"
              >
                <Text
                  className={`text-sm ${showSignInReminder ? 'text-neutral-600' : 'text-lime-400/90'}`}
                >
                  Practice signing in
                </Text>
              </Pressable>
            </Animated.View>
          ) : !authTokens?.accessToken ? (
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

      <Modal
        visible={showSignInReminder}
        transparent
        animationType="fade"
        onRequestClose={() => void handleDismissReminder()}
      >
        <View className="flex-1 justify-center px-6 bg-black/70">
          <BlurView intensity={50} tint="dark" style={{ overflow: 'hidden', borderRadius: 24 }}>
            <View className="p-6 border border-white/10 rounded-3xl">
              <Text className="text-white text-xl font-bold mb-3 text-center">
                {INVITE_SIGN_IN_REMINDER_COPY.title}
              </Text>
              <Text className="text-neutral-300 text-center leading-relaxed mb-6">
                {INVITE_SIGN_IN_REMINDER_COPY.body}
              </Text>
              <Pressable
                onPress={() => void handleDismissReminder()}
                className="bg-lime-600 rounded-xl py-4 items-center active:bg-lime-700"
              >
                <Text className="text-white font-semibold text-base">
                  {INVITE_SIGN_IN_REMINDER_COPY.confirmLabel}
                </Text>
              </Pressable>
            </View>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}
