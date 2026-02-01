import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
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
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Clock, Shield } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Animation values
  const adminButtonScale = useSharedValue(1);

  const adminButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: adminButtonScale.value }],
  }));

  const handleAdminPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/admin');
  };

  const handleAdminPressIn = () => {
    adminButtonScale.value = withSpring(0.96, { damping: 15 });
  };

  const handleAdminPressOut = () => {
    adminButtonScale.value = withSpring(1, { damping: 15 });
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
          className="flex-1 justify-end px-6"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 20 }}
        >
          {/* Logo and Title Section */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(800).springify()}
            className="items-center mb-10"
          >
            {/* FC Logo */}
            <View className="w-28 h-28 rounded-full overflow-hidden mb-6 border-2 border-white/20 bg-white">
              <Image
                source={{ uri: '/fc-logo.png' }}
                className="w-full h-full"
                resizeMode="contain"
              />
            </View>

            <Text className="text-white text-3xl font-light tracking-widest text-center">
              FOX CREEK
            </Text>
            <Text className="text-lime-400/80 text-xs tracking-[0.3em] mt-2 uppercase">
              Golf Club
            </Text>
          </Animated.View>

          {/* Coming Soon Card */}
          <Animated.View
            entering={FadeInUp.delay(300).duration(800).springify()}
            className="overflow-hidden rounded-3xl"
          >
            <BlurView intensity={40} tint="dark" style={{ overflow: 'hidden' }}>
              <View className="p-6 border border-white/10 rounded-3xl">
                {/* Coming Soon Badge */}
                <View className="items-center mb-6">
                  <View className="bg-amber-900/40 border border-amber-700/50 rounded-full px-4 py-2 flex-row items-center">
                    <Clock size={16} color="#fbbf24" />
                    <Text className="text-amber-300 text-sm font-medium ml-2">
                      Coming Soon
                    </Text>
                  </View>
                </View>

                {/* Message */}
                <Text className="text-white text-xl font-semibold text-center mb-3">
                  Member Portal
                </Text>
                <Text className="text-neutral-400 text-sm text-center leading-relaxed mb-6">
                  We're connecting to Chronogolf to bring you seamless access to your membership, tee times, and more.
                </Text>

                {/* Features Preview */}
                <View className="bg-white/5 rounded-2xl p-4 mb-6">
                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3">
                    What's Coming
                  </Text>
                  <View className="gap-2">
                    <Text className="text-neutral-300 text-sm">• Book tee times instantly</Text>
                    <Text className="text-neutral-300 text-sm">• Track your handicap & scores</Text>
                    <Text className="text-neutral-300 text-sm">• Earn loyalty points</Text>
                    <Text className="text-neutral-300 text-sm">• Course conditions & weather</Text>
                  </View>
                </View>

                {/* Admin Portal Button */}
                <AnimatedPressable
                  onPress={handleAdminPress}
                  onPressIn={handleAdminPressIn}
                  onPressOut={handleAdminPressOut}
                  style={[
                    {
                      borderRadius: 16,
                      paddingVertical: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      backgroundColor: '#1a472a',
                      borderWidth: 1,
                      borderColor: 'rgba(163, 230, 53, 0.3)',
                    },
                    adminButtonStyle,
                  ]}
                >
                  <Shield size={20} color="#a3e635" strokeWidth={2} />
                  <Text className="text-lime-400 text-base font-semibold ml-2 tracking-wide">
                    Staff Login
                  </Text>
                </AnimatedPressable>
              </View>
            </BlurView>
          </Animated.View>

          {/* Footer */}
          <Animated.View
            entering={FadeIn.delay(600).duration(800)}
            className="mt-8 items-center"
          >
            <Text className="text-neutral-600 text-xs text-center">
              Questions? Contact the Pro Shop
            </Text>
            <Text className="text-neutral-500 text-xs text-center mt-1">
              (506) 855-7383
            </Text>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
