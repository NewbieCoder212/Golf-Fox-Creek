import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Share, Smartphone, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import {
  type BeforeInstallPromptEvent,
  getA2hsDismissStorageKey,
  isAndroidWeb,
  isIosWeb,
  shouldOfferAddToHomeScreen,
} from '@/lib/pwa-install';
import { foxColors } from '@/theme/tokens';

interface AddToHomeScreenPromptProps {
  visible: boolean;
}

export function AddToHomeScreenPrompt({ visible }: AddToHomeScreenPromptProps) {
  const insets = useSafeAreaInsets();
  const [shouldShow, setShouldShow] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || !shouldOfferAddToHomeScreen()) {
      setShouldShow(false);
      return;
    }

    let cancelled = false;

    const checkDismissed = async () => {
      try {
        const dismissed = await AsyncStorage.getItem(getA2hsDismissStorageKey());
        if (!cancelled && dismissed !== '1') {
          setShouldShow(true);
        }
      } catch {
        if (!cancelled) setShouldShow(true);
      }
    };

    void checkDismissed();

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    };
  }, [visible]);

  const dismiss = useCallback(async () => {
    setShouldShow(false);
    try {
      await AsyncStorage.setItem(getA2hsDismissStorageKey(), '1');
    } catch {
      // Non-fatal — banner simply may reappear next visit.
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;

    setIsInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShouldShow(false);
        await AsyncStorage.setItem(getA2hsDismissStorageKey(), '1');
      }
    } catch {
      // Browser blocked or cancelled install.
    } finally {
      setIsInstalling(false);
      setInstallPrompt(null);
    }
  }, [installPrompt]);

  if (!shouldShow) return null;

  const showAndroidInstall = isAndroidWeb() && installPrompt !== null;
  const showIosSteps = isIosWeb();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        paddingHorizontal: 16,
        paddingBottom: Math.max(insets.bottom, 12) + 8,
      }}
    >
      <View
        className="rounded-2xl border border-fox-border overflow-hidden"
        style={{ backgroundColor: foxColors.surfaceElevated }}
      >
        <View className="flex-row items-start p-4 gap-3">
          <View
            className="w-10 h-10 rounded-xl items-center justify-center"
            style={{ backgroundColor: 'rgba(163,230,53,0.12)' }}
          >
            <Smartphone size={20} color={foxColors.lime} strokeWidth={2} />
          </View>

          <View className="flex-1">
            <Text className="text-white text-base font-body-semibold">Add to Home Screen</Text>
            <Text className="text-neutral-400 text-sm font-body mt-1 leading-5">
              {showAndroidInstall
                ? 'Install the app icon for one-tap access and stay signed in all weekend.'
                : showIosSteps
                  ? 'Tap Share, then "Add to Home Screen" for quick access and to stay signed in.'
                  : 'Add this app to your home screen for one-tap access all weekend.'}
            </Text>

            {showIosSteps ? (
              <View className="flex-row items-center mt-3 gap-2">
                <Share size={16} color={foxColors.lime} strokeWidth={2} />
                <Text className="text-fox-lime text-xs font-body-semibold uppercase tracking-wide">
                  Share → Add to Home Screen
                </Text>
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void dismiss();
            }}
            hitSlop={8}
            className="p-1 active:opacity-70"
            accessibilityLabel="Dismiss add to home screen prompt"
          >
            <X size={18} color="#737373" strokeWidth={2} />
          </Pressable>
        </View>

        {showAndroidInstall ? (
          <View className="px-4 pb-4 pt-0">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                void handleInstall();
              }}
              disabled={isInstalling}
              className="rounded-xl py-3 items-center active:opacity-90"
              style={{ backgroundColor: foxColors.lime }}
            >
              <Text className="text-black text-sm font-body-bold uppercase tracking-wide">
                {isInstalling ? 'Installing…' : 'Install App'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}
