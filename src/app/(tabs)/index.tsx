import { View, Text, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Clock, ChevronRight, Sun, Wind, Droplets, ClipboardList, History, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useWeather, getWeatherIconType } from '@/lib/useWeather';
import { TeeTimeInput } from '@/components/TeeTimeInput';
import { TeeTimeAlertMonitor } from '@/components/TeeTimeAlertMonitor';

// Fallback data when API is unavailable
const FALLBACK_WEATHER = {
  temp: '--',
  condition: 'Weather Unavailable',
  wind: '--',
  humidity: '--',
};

const QUICK_LINKS = [
  { title: 'Book Tee Time', icon: Clock, route: '/(tabs)/teetimes' },
  { title: 'Scorecard', icon: ClipboardList, route: '/(tabs)/scorecard' },
  { title: 'History', icon: History, route: '/history' },
];

const UPCOMING_EVENTS = [
  { id: 1, title: 'Member Tournament', date: 'Jan 15', spots: 12 },
  { id: 2, title: 'Junior Golf Clinic', date: 'Jan 20', spots: 8 },
  { id: 3, title: 'Couples Scramble', date: 'Jan 25', spots: 20 },
];

// Helper to render the correct weather icon based on conditions
function WeatherIcon({ iconCode, size = 28 }: { iconCode?: string; size?: number }) {
  const iconType = iconCode ? getWeatherIconType(iconCode) : 'sun';
  const color = '#facc15';

  switch (iconType) {
    case 'cloud':
      return <Cloud size={size} color={color} />;
    case 'rain':
      return <CloudRain size={size} color={color} />;
    case 'snow':
      return <CloudSnow size={size} color={color} />;
    case 'storm':
      return <CloudLightning size={size} color={color} />;
    case 'mist':
      return <CloudFog size={size} color={color} />;
    default:
      return <Sun size={size} color={color} />;
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const { data: weather, isLoading, isError } = useWeather();

  // Use live data or fallback
  const weatherDisplay = weather ?? FALLBACK_WEATHER;
  const showUnavailable = isError || (!isLoading && !weather);

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Hero Section */}
        <View className="relative h-80">
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800&q=80' }}
            className="absolute inset-0 w-full h-full"
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(12, 12, 12, 0.7)', '#0c0c0c']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 180 }}
          />
          <View className="absolute bottom-6 left-5 right-5">
            <Animated.Text
              entering={FadeInDown.delay(200).duration(600)}
              className="text-neutral-400 text-sm uppercase tracking-[0.2em] font-medium"
            >
              Welcome to
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(300).duration(600)}
              className="text-white text-4xl font-bold tracking-tight mt-1"
            >
              Fox Creek
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(400).duration(600)}
              className="text-lime-400 text-lg font-light tracking-wide"
            >
              Golf Course
            </Animated.Text>
          </View>
        </View>

        {/* Weather Card */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(600)}
          className="mx-5 -mt-2"
        >
          <View className="bg-[#141414] rounded-2xl p-4 border border-neutral-800">
            <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-3">
              Course Conditions
            </Text>
            {isLoading ? (
              <View className="flex-row items-center justify-center py-2">
                <ActivityIndicator size="small" color="#a3e635" />
                <Text className="text-neutral-500 text-sm ml-2">Loading weather...</Text>
              </View>
            ) : showUnavailable ? (
              <View className="flex-row items-center py-2">
                <CloudFog size={28} color="#525252" />
                <Text className="text-neutral-500 text-lg ml-3">Weather Unavailable</Text>
              </View>
            ) : (
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <WeatherIcon iconCode={weather?.iconCode} />
                  <Text className="text-white text-3xl font-light ml-3">{weatherDisplay.temp}°</Text>
                  <Text className="text-neutral-400 text-lg ml-2">{weatherDisplay.condition}</Text>
                </View>
                <View className="flex-row gap-5">
                  <View className="items-center">
                    <Wind size={16} color="#a3e635" />
                    <Text className="text-neutral-500 text-xs mt-1">{weatherDisplay.wind}</Text>
                  </View>
                  <View className="items-center">
                    <Droplets size={16} color="#a3e635" />
                    <Text className="text-neutral-500 text-xs mt-1">{weatherDisplay.humidity}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Tee Time Alert Input */}
        <TeeTimeInput />

        {/* Quick Links */}
        <View className="px-5 mt-8">
          <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-4">Quick Access</Text>
          <View className="flex-row gap-3">
            {QUICK_LINKS.map((link, index) => (
              <Animated.View
                key={link.title}
                entering={FadeInRight.delay(600 + index * 100).duration(500)}
                className="flex-1"
              >
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(link.route as any);
                  }}
                  className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 items-center active:opacity-70 active:scale-[0.98]"
                  style={{ minHeight: 100 }}
                >
                  <View className="w-12 h-12 bg-neutral-900 rounded-full items-center justify-center mb-2 border border-neutral-800">
                    <link.icon size={20} color="#a3e635" strokeWidth={1.5} />
                  </View>
                  <Text className="text-neutral-300 text-xs font-medium text-center">{link.title}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Upcoming Events */}
        <View className="px-5 mt-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em]">Upcoming Events</Text>
            <Pressable className="active:opacity-70">
              <Text className="text-lime-400 text-xs font-medium">See All</Text>
            </Pressable>
          </View>

          {UPCOMING_EVENTS.map((event, index) => (
            <Animated.View
              key={event.id}
              entering={FadeInDown.delay(800 + index * 100).duration(500)}
            >
              <Pressable className="bg-[#141414] border border-neutral-800 rounded-xl p-4 mb-3 flex-row items-center justify-between active:opacity-70">
                <View className="flex-row items-center flex-1">
                  <View className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 mr-4">
                    <Text className="text-lime-400 text-xs font-bold tracking-wide">{event.date}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-medium">{event.title}</Text>
                    <Text className="text-neutral-600 text-xs mt-0.5">{event.spots} spots available</Text>
                  </View>
                </View>
                <ChevronRight size={18} color="#525252" />
              </Pressable>
            </Animated.View>
          ))}
        </View>

        {/* Pro Shop Promo */}
        <Animated.View
          entering={FadeInDown.delay(1100).duration(600)}
          className="mx-5 mt-6 mb-8"
        >
          <Pressable className="overflow-hidden rounded-2xl active:opacity-90">
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&q=80' }}
              className="w-full h-36"
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.9)']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 }}
            />
            <View className="absolute bottom-4 left-4 right-4">
              <Text className="text-lime-400 text-xs font-medium uppercase tracking-[0.15em]">Pro Shop</Text>
              <Text className="text-white text-lg font-semibold mt-1">New Season Gear Arrived</Text>
            </View>
          </Pressable>
        </Animated.View>

        <View className="h-4" />
      </ScrollView>

      {/* Tee Time Alert Monitor (global) */}
      <TeeTimeAlertMonitor />
    </View>
  );
}
