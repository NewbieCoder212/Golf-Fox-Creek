import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Flag } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { getScorecardOnboardingStorageKey } from '@/lib/scorecard-onboarding';
import { foxColors } from '@/theme/tokens';

interface ScorecardOnboardingModalProps {
  enabled: boolean;
  userId: string | null | undefined;
}

export function ScorecardOnboardingModal({ enabled, userId }: ScorecardOnboardingModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      return;
    }

    let cancelled = false;

    const checkSeen = async () => {
      try {
        const seen = await AsyncStorage.getItem(getScorecardOnboardingStorageKey(userId));
        if (!cancelled && seen !== '1') {
          setVisible(true);
        }
      } catch {
        if (!cancelled) setVisible(true);
      }
    };

    void checkSeen();

    return () => {
      cancelled = true;
    };
  }, [enabled, userId]);

  const dismiss = useCallback(async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(getScorecardOnboardingStorageKey(userId), '1');
    } catch {
      // Non-fatal — modal may reappear on next visit.
    }
  }, [userId]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 bg-black/85 items-center justify-center px-6">
        <Animated.View
          entering={FadeInDown.duration(400)}
          className="bg-[#141414] rounded-3xl border border-fox-border w-full max-w-sm overflow-hidden"
        >
          <View
            className="p-6 items-center border-b border-neutral-800"
            style={{ backgroundColor: 'rgba(163,230,53,0.08)' }}
          >
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(163,230,53,0.15)' }}
            >
              <Flag size={32} color={foxColors.lime} strokeWidth={1.5} />
            </View>
            <Text className="text-lime-400 text-xs uppercase tracking-[0.2em] font-medium">
              Generation Cup
            </Text>
            <Text className="text-white text-xl font-bold text-center mt-2">
              Welcome to the Generation Cup!
            </Text>
          </View>

          <View className="p-6">
            <Text className="text-neutral-300 text-base leading-6 text-center">
              This is a Ryder Cup-style match play format. Tap your team&apos;s side of the row
              whenever you win a hole.
            </Text>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                void dismiss();
              }}
              className="bg-lime-400 rounded-xl py-4 items-center mt-6 active:opacity-80"
            >
              <Text className="text-black font-bold text-lg">Got It</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
