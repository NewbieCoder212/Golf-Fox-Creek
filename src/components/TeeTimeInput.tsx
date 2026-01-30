import { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Clock, X, Bell, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTeeTimeAlertStore } from '@/lib/tee-time-alert-store';

export function TeeTimeInput() {
  const [showPicker, setShowPicker] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());

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
    // Set initial time to next hour if no tee time set
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

  return (
    <>
      <Animated.View entering={FadeInDown.delay(450).duration(600)} className="mx-5 mt-4">
        <View className="bg-[#141414] rounded-2xl p-4 border border-neutral-800">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em]">
              Practice Mode
            </Text>
            {isAtRange && (
              <View className="flex-row items-center">
                <MapPin size={12} color="#a3e635" />
                <Text className="text-lime-400 text-xs ml-1">At Range</Text>
              </View>
            )}
          </View>

          {teeTime ? (
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-amber-500/20 items-center justify-center mr-3">
                  <Bell size={22} color="#f59e0b" />
                </View>
                <View>
                  <Text className="text-white text-lg font-semibold">
                    {formatTime(teeTime)}
                  </Text>
                  <Text className="text-neutral-500 text-xs">
                    {minutesUntil !== null && minutesUntil > 0
                      ? `Alert in ${minutesUntil} min`
                      : 'Tee time passed'}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={handleClear}
                className="w-10 h-10 rounded-full bg-neutral-800 items-center justify-center active:opacity-70"
              >
                <X size={18} color="#737373" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handleOpenPicker}
              className="flex-row items-center justify-center py-3 bg-neutral-900 rounded-xl border border-neutral-800 active:opacity-70"
            >
              <Clock size={18} color="#a3e635" />
              <Text className="text-neutral-300 font-medium ml-2">
                Set Tee Time for Alert
              </Text>
            </Pressable>
          )}

          {teeTime && (
            <Text className="text-neutral-600 text-xs text-center mt-3">
              You'll be alerted 10 min before when at the range
            </Text>
          )}
        </View>
      </Animated.View>

      {/* Time Picker Modal */}
      <Modal visible={showPicker} transparent animationType="fade" statusBarTranslucent>
        <Pressable
          onPress={() => setShowPicker(false)}
          className="flex-1 bg-black/80 items-center justify-center"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-[#1a1a1a] rounded-2xl border border-neutral-800 w-full max-w-xs mx-6 overflow-hidden"
          >
            <View className="p-4 border-b border-neutral-800">
              <Text className="text-white text-lg font-bold text-center">
                Set Tee Time
              </Text>
              <Text className="text-neutral-500 text-xs text-center mt-1">
                You'll be alerted 10 minutes before
              </Text>
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
                className="flex-1 bg-neutral-800 rounded-xl py-3 items-center active:opacity-80"
              >
                <Text className="text-neutral-300 font-medium">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                className="flex-1 bg-lime-400 rounded-xl py-3 items-center active:opacity-80"
              >
                <Text className="text-black font-bold">Set Alert</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
