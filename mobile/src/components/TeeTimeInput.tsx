import { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Clock, X, Bell, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useTeeTimeAlertStore } from '@/lib/tee-time-alert-store';
import { useTranslations } from '@/lib/language-store';
import { foxColors } from '@/theme/tokens';

export function TeeTimeInput() {
  const [showPicker, setShowPicker] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());
  const t = useTranslations();

  const teeTime = useTeeTimeAlertStore((s) => s.teeTime);
  const isAtRange = useTeeTimeAlertStore((s) => s.isAtRange);
  const setTeeTime = useTeeTimeAlertStore((s) => s.setTeeTime);
  const clearTeeTime = useTeeTimeAlertStore((s) => s.clearTeeTime);
  const getMinutesUntilTeeTime = useTeeTimeAlertStore((s) => s.getMinutesUntilTeeTime);

  const minutesUntil = getMinutesUntilTeeTime();

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleOpenPicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!teeTime) {
      const now = new Date();
      now.setHours(now.getHours() + 1, 0, 0, 0);
      setTempTime(now);
    } else {
      setTempTime(teeTime);
    }
    setShowPicker(true);
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTeeTime(tempTime);
    setShowPicker(false);
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearTeeTime();
  };

  const alertSubtitle =
    minutesUntil !== null && minutesUntil > 0
      ? t.alertInMin.replace('{minutes}', String(minutesUntil))
      : t.teeTimePassed;

  return (
    <>
      <Animated.View entering={FadeInDown.delay(450).duration(600)} className="mx-5 mt-4">
        <SurfaceCard className="p-4">
          <View className="flex-row items-center justify-between mb-1">
            <SectionLabel label={t.practiceMode} className="mb-0" />
            {isAtRange && (
              <View className="flex-row items-center">
                <MapPin size={12} color={foxColors.lime} />
                <Text className="text-fox-lime text-xs ml-1 font-body-semibold">{t.atRange}</Text>
              </View>
            )}
          </View>

          {teeTime ? (
            <View className="flex-row items-center justify-between mt-3">
              <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-amber-500/20 items-center justify-center mr-3 border border-amber-500/30">
                  <Bell size={22} color="#f59e0b" />
                </View>
                <View>
                  <Text className="text-white text-lg font-display">{formatTime(teeTime)}</Text>
                  <Text className="text-neutral-500 text-xs font-body">{alertSubtitle}</Text>
                </View>
              </View>
              <Pressable
                onPress={handleClear}
                className="w-10 h-10 rounded-full bg-fox-surface-elevated items-center justify-center border border-fox-border active:opacity-70"
              >
                <X size={18} color="#737373" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handleOpenPicker}
              className="flex-row items-center justify-center py-3 mt-3 bg-fox-surface-elevated rounded-xl border border-fox-border active:opacity-70 active:scale-[0.99]"
            >
              <Clock size={18} color={foxColors.lime} />
              <Text className="text-neutral-300 font-body-semibold ml-2">{t.setTeeTimeAlert}</Text>
            </Pressable>
          )}

          {teeTime && (
            <Text className="text-neutral-600 text-xs text-center mt-3 font-body">{t.alertHint}</Text>
          )}
        </SurfaceCard>
      </Animated.View>

      <Modal visible={showPicker} transparent animationType="fade" statusBarTranslucent>
        <Pressable
          onPress={() => setShowPicker(false)}
          className="flex-1 bg-black/80 items-center justify-center"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-fox-surface-elevated rounded-2xl border border-fox-border w-full max-w-xs mx-6 overflow-hidden"
          >
            <View className="p-4 border-b border-fox-border">
              <Text className="text-white text-lg font-display text-center">{t.setTeeTimeModalTitle}</Text>
              <Text className="text-neutral-500 text-xs text-center mt-1 font-body">{t.alertModalHint}</Text>
            </View>

            <View className="items-center py-4">
              <DateTimePicker
                value={tempTime}
                mode="time"
                display="spinner"
                onChange={(_, date) => date && setTempTime(date)}
                textColor="#ffffff"
                themeVariant="dark"
              />
            </View>

            <View className="p-4 flex-row gap-3">
              <Pressable
                onPress={() => setShowPicker(false)}
                className="flex-1 bg-fox-surface rounded-xl py-3 items-center border border-fox-border active:opacity-80"
              >
                <Text className="text-neutral-300 font-body-medium">{t.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                className="flex-1 bg-fox-lime rounded-xl py-3 items-center active:opacity-80"
              >
                <Text className="text-black font-body-bold">{t.setAlert}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
