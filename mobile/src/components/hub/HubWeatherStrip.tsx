import { View, Text, Pressable } from 'react-native';
import {
  Sun,
  Wind,
  Droplets,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ActivityIndicator } from 'react-native';

import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useTranslations } from '@/lib/language-store';
import { getWeatherIconType } from '@/lib/useWeather';
import { foxColors } from '@/theme/tokens';

interface WeatherDisplay {
  temp: string;
  condition: string;
  wind: string;
  humidity: string;
}

interface HubWeatherStripProps {
  weather: WeatherDisplay;
  iconCode?: string;
  loading?: boolean;
  unavailable?: boolean;
}

function WeatherIcon({ iconCode, size = 28 }: { iconCode?: string; size?: number }) {
  const iconType = iconCode ? getWeatherIconType(iconCode) : 'sun';
  const color = foxColors.gold;

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

export function HubWeatherStrip({
  weather,
  iconCode,
  loading,
  unavailable,
}: HubWeatherStripProps) {
  const t = useTranslations();

  return (
    <Animated.View entering={FadeInDown.delay(300).duration(600)} className="mx-5 mt-4">
      <SurfaceCard className="p-4">
        <SectionLabel label={t.courseConditions} className="mb-2" />
        {loading ? (
          <View className="flex-row items-center justify-center py-2">
            <ActivityIndicator size="small" color={foxColors.lime} />
            <Text className="text-neutral-500 text-sm ml-2 font-body">{t.loadingWeather}</Text>
          </View>
        ) : unavailable ? (
          <View className="flex-row items-center py-2">
            <CloudFog size={28} color="#525252" />
            <Text className="text-neutral-500 text-base ml-3 font-body">{t.weatherUnavailable}</Text>
          </View>
        ) : (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <WeatherIcon iconCode={iconCode} />
              <Text className="text-white text-3xl font-display ml-3">{weather.temp}°</Text>
              <Text className="text-neutral-400 text-base ml-2 font-body flex-shrink" numberOfLines={1}>
                {weather.condition}
              </Text>
            </View>
            <View className="flex-row gap-2 ml-2">
              <View className="flex-row items-center bg-fox-surface-elevated rounded-full px-2.5 py-1.5 border border-fox-border gap-1">
                <Wind size={14} color={foxColors.lime} />
                <Text className="text-neutral-400 text-xs font-body">{weather.wind}</Text>
              </View>
              <View className="flex-row items-center bg-fox-surface-elevated rounded-full px-2.5 py-1.5 border border-fox-border gap-1">
                <Droplets size={14} color={foxColors.lime} />
                <Text className="text-neutral-400 text-xs font-body">{weather.humidity}</Text>
              </View>
            </View>
          </View>
        )}
      </SurfaceCard>
    </Animated.View>
  );
}
