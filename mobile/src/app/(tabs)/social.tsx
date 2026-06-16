import { View, Text, ScrollView } from 'react-native';
import { Users, Construction } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useTabScreenPadding } from '@/components/navigation/TopTabBar';

export default function SocialScreen() {
  const topPadding = useTabScreenPadding(16);
  return (
    <View className="flex-1 bg-fox-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: 32,
          flexGrow: 1,
        }}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(500)} className="px-5 mb-6">
          <Text className="text-white text-2xl font-display tracking-tight">Social</Text>
          <Text className="text-neutral-500 text-sm font-body mt-1">Fox Creek Golf Club</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)} className="mx-5">
          <View className="bg-amber-950/30 border border-amber-700/50 rounded-2xl p-5">
            <View className="flex-row items-center mb-3">
              <Construction size={22} color="#fbbf24" strokeWidth={1.5} />
              <Text className="text-amber-200 text-lg font-display ml-3">Under Construction</Text>
            </View>
            <Text className="text-amber-100/90 text-sm font-body leading-6">
              Leaderboards, find-a-partner, and member challenges are coming soon. More information
              to follow.
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)} className="mx-5 mt-6">
          <View className="bg-fox-surface rounded-2xl border border-fox-border p-5">
            <View className="w-12 h-12 bg-fox-surface-elevated rounded-full items-center justify-center mb-4 border border-fox-border">
              <Users size={22} color={foxColors.lime} strokeWidth={1.5} />
            </View>
            <Text className="text-white text-base font-display">What&apos;s planned</Text>
            <Text className="text-neutral-400 text-sm font-body mt-2 leading-6">
              This area will help members connect for match play, casual rounds, and club
              tournaments. Check back for updates.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
