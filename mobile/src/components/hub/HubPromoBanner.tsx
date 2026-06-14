import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useTranslations } from '@/lib/language-store';

export function HubPromoBanner() {
  const t = useTranslations();

  return (
    <Animated.View
      entering={FadeInDown.delay(700).duration(600)}
      className="mx-5 mt-8 mb-8"
    >
      <Pressable
        className="overflow-hidden rounded-2xl active:opacity-90 border border-fox-border"
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <Image
          source={{
            uri: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&q=80',
          }}
          className="w-full h-40"
          resizeMode="cover"
        />
        <View className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
          <View
            className="absolute bg-fox-lime"
            style={{
              width: 80,
              height: 12,
              transform: [{ rotate: '45deg' }],
              top: 20,
              right: -20,
            }}
          />
        </View>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.92)']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 100 }}
        />
        <View className="absolute bottom-4 left-4 right-4">
          <Text className="text-fox-lime text-xs font-body-semibold uppercase tracking-[0.15em]">
            {t.proShop}
          </Text>
          <Text className="text-white text-lg font-display mt-1">{t.newSeasonGear}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
