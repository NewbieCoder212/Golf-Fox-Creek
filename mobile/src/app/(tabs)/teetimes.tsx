import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useState, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, RotateCw } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const CHRONOGOLF_URL = 'https://www.chronogolf.ca/club/fox-creek-golf-club';

export default function TeeTimesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);

  const handleBack = () => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      router.back();
    }
  };

  const handleRefresh = () => {
    webViewRef.current?.reload();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      {/* Header */}
      <View
        style={{ paddingTop: insets.top }}
        className="bg-[#141414] border-b border-neutral-800"
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable
            onPress={handleBack}
            className="flex-row items-center active:opacity-60 py-1"
          >
            <ChevronLeft size={24} color="#a3e635" />
            <Text className="text-lime-400 text-base font-medium ml-1">
              {canGoBack ? 'Back' : 'Home'}
            </Text>
          </Pressable>

          <Text className="text-white text-lg font-semibold">Book Tee Time</Text>

          <Pressable
            onPress={handleRefresh}
            className="p-2 active:opacity-60"
          >
            <RotateCw size={20} color="#a3e635" />
          </Pressable>
        </View>
      </View>

      {/* WebView */}
      <View className="flex-1">
        <WebView
          ref={webViewRef}
          source={{ uri: CHRONOGOLF_URL }}
          style={{ flex: 1, backgroundColor: '#0c0c0c' }}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onNavigationStateChange={(navState) => {
            setCanGoBack(navState.canGoBack);
          }}
          startInLoadingState={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          allowsBackForwardNavigationGestures={true}
          pullToRefreshEnabled={true}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          decelerationRate="normal"
          contentMode="mobile"
          allowsInlineMediaPlayback={true}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <Animated.View
            entering={FadeIn.duration(200)}
            className="absolute inset-0 bg-[#0c0c0c] items-center justify-center"
          >
            <ActivityIndicator size="large" color="#a3e635" />
            <Text className="text-neutral-500 text-sm mt-4">Loading booking system...</Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
