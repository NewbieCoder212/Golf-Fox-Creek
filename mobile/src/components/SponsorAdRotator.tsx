import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { cn } from '@/lib/cn';
import type { AdPlacement } from '@/types';

interface SponsorAdRotatorProps {
  ads: AdPlacement[];
  intervalMs: number;
  className?: string;
  minHeight?: number;
  renderAd: (ad: AdPlacement) => ReactNode;
}

export function SponsorAdRotator({
  ads,
  intervalMs,
  className,
  minHeight,
  renderAd,
}: SponsorAdRotatorProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [ads.map((ad) => ad.id).join(',')]);

  useEffect(() => {
    if (ads.length <= 1) return;

    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % ads.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [ads.length, intervalMs]);

  const activeAd = ads[index];
  if (!activeAd) return null;

  return (
    <View className={className}>
      <View style={minHeight ? { minHeight } : undefined}>
        <Animated.View key={activeAd.id} entering={FadeIn.duration(350)}>
          {renderAd(activeAd)}
        </Animated.View>
      </View>

      {ads.length > 1 ? (
        <View className="flex-row items-center justify-center gap-1.5 mt-2">
          {ads.map((ad, dotIndex) => (
            <View
              key={ad.id}
              className={cn(
                'rounded-full',
                dotIndex === index ? 'w-2 h-2 bg-lime-400' : 'w-1.5 h-1.5 bg-neutral-600'
              )}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
