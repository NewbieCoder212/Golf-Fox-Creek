import { useEffect, useRef, useCallback, useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Bell, Clock, MapPin, X, Navigation } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTeeTimeAlertStore, PRACTICE_RANGE_COORDS } from '@/lib/tee-time-alert-store';
import { calculateDistance } from '@/lib/geo';

export function TeeTimeAlertMonitor() {
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const teeTime = useTeeTimeAlertStore((s) => s.teeTime);
  const isAtRange = useTeeTimeAlertStore((s) => s.isAtRange);
  const hasAlerted = useTeeTimeAlertStore((s) => s.hasAlerted);
  const isAlertVisible = useTeeTimeAlertStore((s) => s.isAlertVisible);
  const setIsAtRange = useTeeTimeAlertStore((s) => s.setIsAtRange);
  const triggerAlert = useTeeTimeAlertStore((s) => s.triggerAlert);
  const dismissAlert = useTeeTimeAlertStore((s) => s.dismissAlert);
  const shouldTriggerAlert = useTeeTimeAlertStore((s) => s.shouldTriggerAlert);
  const getMinutesUntilTeeTime = useTeeTimeAlertStore((s) => s.getMinutesUntilTeeTime);
  const loadSavedTeeTime = useTeeTimeAlertStore((s) => s.loadSavedTeeTime);

  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  // Load saved tee time on mount
  useEffect(() => {
    loadSavedTeeTime();
  }, []);

  // Check if user is at the practice range
  const checkRangeProximity = useCallback((coords: { latitude: number; longitude: number }) => {
    const distance = calculateDistance(
      coords.latitude,
      coords.longitude,
      PRACTICE_RANGE_COORDS.lat,
      PRACTICE_RANGE_COORDS.lng
    );

    const atRange = distance <= PRACTICE_RANGE_COORDS.radius;
    setIsAtRange(atRange);
  }, [setIsAtRange]);

  // Start location monitoring when tee time is set
  useEffect(() => {
    if (!teeTime) {
      // Clean up if no tee time
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      return;
    }

    let isMounted = true;

    const setupLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || !isMounted) return;

        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 20,
            timeInterval: 30000, // Check every 30 seconds
          },
          (location) => {
            if (isMounted && location?.coords) {
              checkRangeProximity(location.coords);
            }
          }
        );
      } catch (error) {
        console.log('Location setup error:', error);
      }
    };

    setupLocation();

    return () => {
      isMounted = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, [teeTime, checkRangeProximity]);

  // Check for alert trigger every minute
  useEffect(() => {
    if (!teeTime || hasAlerted) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    const checkAlert = () => {
      const minutes = getMinutesUntilTeeTime();
      setMinutesLeft(minutes);

      if (shouldTriggerAlert()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        triggerAlert();
      }
    };

    // Check immediately
    checkAlert();

    // Then check every 30 seconds
    checkIntervalRef.current = setInterval(checkAlert, 30000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [teeTime, hasAlerted, isAtRange, shouldTriggerAlert, triggerAlert, getMinutesUntilTeeTime]);

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dismissAlert();
  };

  if (!isAlertVisible) return null;

  return (
    <Modal
      visible={isAlertVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View className="flex-1 bg-black/90 items-center justify-center px-6">
        <Animated.View
          entering={FadeInDown.duration(400)}
          className="bg-[#141414] rounded-3xl border border-amber-500/30 w-full max-w-sm overflow-hidden"
        >
          {/* Header */}
          <View className="bg-amber-500/20 p-6 items-center border-b border-amber-500/20">
            <View className="w-20 h-20 rounded-full bg-amber-500/30 items-center justify-center mb-4">
              <Bell size={40} color="#f59e0b" strokeWidth={1.5} />
            </View>
            <Text className="text-amber-400 text-xs uppercase tracking-[0.2em] font-medium">
              Tee Time Alert
            </Text>
            <Text className="text-white text-2xl font-bold text-center mt-2">
              Time to Head Out!
            </Text>
          </View>

          {/* Content */}
          <View className="p-6">
            <View className="flex-row items-center mb-4">
              <View className="w-10 h-10 rounded-full bg-amber-500/20 items-center justify-center mr-3">
                <Clock size={20} color="#f59e0b" />
              </View>
              <View>
                <Text className="text-neutral-400 text-xs">Your tee time is in</Text>
                <Text className="text-white text-xl font-bold">
                  {minutesLeft ?? 10} minutes
                </Text>
              </View>
            </View>

            <View className="flex-row items-center mb-6">
              <View className="w-10 h-10 rounded-full bg-lime-500/20 items-center justify-center mr-3">
                <Navigation size={20} color="#a3e635" />
              </View>
              <View className="flex-1">
                <Text className="text-neutral-400 text-xs">Head to</Text>
                <Text className="text-white text-lg font-medium">Hole 1 Tee Box</Text>
              </View>
            </View>

            <Pressable
              onPress={handleDismiss}
              className="bg-amber-500 rounded-xl py-4 items-center active:opacity-80"
            >
              <Text className="text-black font-bold text-lg">Got It</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
