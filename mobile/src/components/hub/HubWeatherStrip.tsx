import { View, Text } from 'react-native';
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
  embedded?: boolean;
  showTopDivider?: boolean;
}

function WeatherIcon({ iconCode, size = 24 }: { iconCode?: string; size?: number }) {
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
  embedded = false,
  showTopDivider = true,
}: HubWeatherStripProps) {
  const t = useTranslations();

  const content = (
    <>
      <SectionLabel label={t.courseConditions} className="mb-2" />
      {loading ? (
        <View className="flex-row items-center justify-center py-1">
          <ActivityIndicator size="small" color={foxColors.lime} />
          <Text className="text-neutral-500 text-sm ml-2 font-body">{t.loadingWeather}</Text>
        </View>
      ) : unavailable ? (
        <View className="flex-row items-center py-1">
          <CloudFog size={24} color="#525252" />
          <Text className="text-neutral-500 text-sm ml-3 font-body">{t.weatherUnavailable}</Text>
        </View>
      ) : (
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <WeatherIcon iconCode={iconCode} />
            <Text className="text-white text-2xl font-display ml-2">{weather.temp}°</Text>
            <Text className="text-neutral-400 text-sm ml-2 font-body flex-shrink" numberOfLines={1}>
              {weather.condition}
            </Text>
          </View>
          <View className="flex-row gap-2 ml-2">
            <View className="flex-row items-center bg-fox-surface-elevated rounded-full px-2 py-1 border border-fox-border gap-1">
              <Wind size={12} color={foxColors.lime} />
              <Text className="text-neutral-400 text-[10px] font-body">{weather.wind}</Text>
            </View>
            <View className="flex-row items-center bg-fox-surface-elevated rounded-full px-2 py-1 border border-fox-border gap-1">
              <Droplets size={12} color={foxColors.lime} />
              <Text className="text-neutral-400 text-[10px] font-body">{weather.humidity}</Text>
            </View>
          </View>
        </View>
      )}
    </>
  );

  if (embedded) {
    return (
      <Animated.View
        entering={FadeInDown.delay(300).duration(600)}
        className={showTopDivider ? 'mt-4 pt-4 border-t border-fox-border' : undefined}
      >
        {content}
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.delay(300).duration(600)} className="mx-5 mt-4">
      <View className="bg-fox-surface rounded-2xl border border-fox-border p-4">{content}</View>
    </Animated.View>
  );
}
