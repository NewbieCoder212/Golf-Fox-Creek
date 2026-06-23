import { View, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-[#0a0a0a]">
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

      <View
        className="flex-1 px-8 justify-center items-center"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 20 }}
      >
        <Animated.View
          entering={FadeInDown.delay(100).duration(800).springify()}
          className="items-center w-full max-w-md"
        >
          <View className="w-12 h-0.5 bg-lime-400/60 rounded-full mb-8" />

          <Text
            className="text-white text-3xl text-center tracking-tight"
            style={{ fontFamily: 'BarlowCondensed_700Bold' }}
          >
            Something new is coming
          </Text>

          <Text className="text-neutral-400 text-base text-center mt-4 leading-6 px-2">
            A fresh experience is on the way. Check back soon.
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
