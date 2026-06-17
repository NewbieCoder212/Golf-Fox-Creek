import { View, Text, Pressable, Image, Platform, Linking, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { ChevronRight } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { SponsorAdRotator } from '@/components/SponsorAdRotator';
import {
  getActiveAdPlacements,
  getAdImageLayout,
  getRotationMinHeight,
  isAdPlacementServiceConfigured,
  resolveAdDisplayVariant,
} from '@/lib/ad-placement-service';
import { getAdRotationSettings, isSupabaseConfigured } from '@/lib/supabase';
import type { AdDisplayPosition, AdPlacement, AdPlacementType } from '@/types';

export const STANDARD_SPONSOR_BANNER_HEIGHT = 160;
export const COMPACT_SPONSOR_BANNER_HEIGHT = 120;
export const FOOTER_SPONSOR_BANNER_HEIGHT = 152;
export const STICKY_FOOTER_AD_EXTRA = 16;

const PORTRAIT_IMAGE_ASPECT = 0.72;
const SQUARE_IMAGE_ASPECT = 1;
const AD_POOL_LIMIT = 20;

function getStripThumbStyle(layout: ReturnType<typeof getAdImageLayout>) {
  if (layout === 'portrait') {
    const width = 96;
    const height = Math.round(width / PORTRAIT_IMAGE_ASPECT);
    return { width, height, imageWidth: width - 8, imageHeight: height - 8 };
  }
  if (layout === 'square') {
    return { width: 84, height: 84, imageWidth: 76, imageHeight: 76 };
  }
  return { width: 96, height: 56, imageWidth: 88, imageHeight: 44 };
}

interface UseAdPlacementOptions {
  holeNumber?: number;
  displayPosition?: AdDisplayPosition;
}

export function useAdPlacement(
  placementType: AdPlacementType | string,
  options?: UseAdPlacementOptions
) {
  return useQuery({
    queryKey: [
      'adPlacement',
      placementType,
      options?.holeNumber ?? null,
      options?.displayPosition ?? null,
    ],
    queryFn: () =>
      getActiveAdPlacements(placementType, {
        holeNumber: options?.holeNumber,
        displayPosition: options?.displayPosition,
        limit: AD_POOL_LIMIT,
      }),
    enabled: isAdPlacementServiceConfigured(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useAdRotationSettings() {
  return useQuery({
    queryKey: ['adRotationSettings'],
    queryFn: getAdRotationSettings,
    enabled: isSupabaseConfigured(),
    staleTime: 1000 * 60 * 2,
  });
}

interface SponsorBannerProps {
  ads?: AdPlacement[];
  ad?: AdPlacement;
  placementType: AdPlacementType | string;
  holeNumber?: number;
  displayPosition?: AdDisplayPosition;
  className?: string;
  compact?: boolean;
  variant?: 'default' | 'footer' | 'card' | 'strip' | 'mini-card' | 'auto';
}

function normalizeActionUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function openActionUrl(url: string) {
  const normalized = normalizeActionUrl(url);
  if (!normalized) return;

  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(normalized, '_blank', 'noopener,noreferrer');
      return;
    }
    await Linking.openURL(normalized);
  } catch {
    Alert.alert('Could not open link', 'Check that the ad action URL is valid and includes a website address.');
  }
}

function SponsorAdFooterStrip({
  ad,
  hasAction,
}: {
  ad: AdPlacement;
  hasAction: boolean;
}) {
  return (
    <View className="border-t border-neutral-800 px-4 py-3.5">
      <View className="flex-row items-center">
        <View className="flex-1 pr-3">
          <Text className="text-neutral-500 text-[10px] font-body-semibold uppercase tracking-[0.12em]">
            {ad.sponsor_name}
          </Text>
          <Text className="text-white font-body-semibold text-sm mt-1" numberOfLines={3}>
            {ad.banner_text}
          </Text>
          {hasAction ? (
            <Text className="text-lime-400/90 text-xs font-body mt-1.5">Tap to open offer</Text>
          ) : null}
        </View>
        {hasAction ? (
          <View className="w-8 h-8 rounded-full bg-lime-400/10 items-center justify-center">
            <ChevronRight size={18} color="#a3e635" strokeWidth={2} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SponsorAdCard({
  ad,
  className,
  compact = false,
  variant = 'default',
}: {
  ad: AdPlacement;
  className?: string;
  compact?: boolean;
  variant?: 'default' | 'footer' | 'card' | 'strip' | 'mini-card' | 'auto';
}) {
  const layout = getAdImageLayout(ad);
  const hasAction = Boolean(ad.action_url?.trim());

  const handlePress = () => {
    if (!ad.action_url?.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void openActionUrl(ad.action_url);
  };

  const cardShell = cn(
    'overflow-hidden rounded-2xl border border-neutral-800 bg-[#141414] active:opacity-95',
    hasAction && 'active:scale-[0.995]'
  );

  if (variant === 'strip') {
    const thumb = getStripThumbStyle(layout);

    return (
      <Animated.View entering={FadeInDown.duration(400)} className={className}>
        <Pressable
          onPress={hasAction ? handlePress : undefined}
          disabled={!hasAction}
          className={cn(
            'flex-row items-center rounded-xl border border-neutral-800 bg-[#0c0c0c] px-4 py-3.5 gap-4 active:opacity-90',
            hasAction && 'active:scale-[0.99]'
          )}
        >
          <View
            className="rounded-xl bg-white items-center justify-center overflow-hidden shrink-0"
            style={{ width: thumb.width, height: thumb.height }}
          >
            <Image
              source={{ uri: ad.image_url }}
              style={{ width: thumb.imageWidth, height: thumb.imageHeight }}
              resizeMode="contain"
            />
          </View>
          <View className="flex-1 min-w-0 self-center">
            <Text className="text-[10px] font-body-semibold uppercase tracking-[0.12em] text-neutral-500">
              Sponsored · {ad.sponsor_name}
            </Text>
            <Text className="text-white text-sm font-body-semibold mt-1 leading-5" numberOfLines={3}>
              {ad.banner_text}
            </Text>
            {hasAction ? (
              <Text className="text-lime-400/80 text-xs font-body mt-1.5">Tap to open offer</Text>
            ) : null}
          </View>
          {hasAction ? (
            <View className="w-9 h-9 rounded-full bg-lime-400/10 items-center justify-center shrink-0 self-center">
              <ChevronRight size={18} color="#a3e635" strokeWidth={2} />
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    );
  }

  if (variant === 'mini-card') {
    const maxImageHeight = layout === 'square' ? 168 : 240;
    const imageWidth =
      layout === 'square' ? maxImageHeight : Math.round(maxImageHeight * PORTRAIT_IMAGE_ASPECT);

    return (
      <Animated.View entering={FadeInDown.duration(400)} className={className}>
        <Pressable
          onPress={hasAction ? handlePress : undefined}
          disabled={!hasAction}
          className={cardShell}
        >
          <View className="bg-white px-4 pt-3 pb-4 items-center">
            <Text className="self-start text-[10px] font-body-semibold uppercase tracking-[0.18em] text-neutral-400 mb-2">
              Sponsored
            </Text>
            <Image
              source={{ uri: ad.image_url }}
              style={{ width: imageWidth, height: maxImageHeight }}
              resizeMode="contain"
            />
          </View>
          <SponsorAdFooterStrip ad={ad} hasAction={hasAction} />
        </Pressable>
      </Animated.View>
    );
  }

  if (layout === 'portrait' || layout === 'square' || variant === 'card') {
    const imageAspect = layout === 'square' ? SQUARE_IMAGE_ASPECT : PORTRAIT_IMAGE_ASPECT;

    return (
      <Animated.View entering={FadeInDown.duration(400)} className={className}>
        <Pressable
          onPress={hasAction ? handlePress : undefined}
          disabled={!hasAction}
          className={cardShell}
        >
          <View className="bg-white px-4 pt-3 pb-4">
            <Text className="text-[10px] font-body-semibold uppercase tracking-[0.18em] text-neutral-400 mb-2">
              Sponsored
            </Text>
            <Image
              source={{ uri: ad.image_url }}
              style={{ width: '100%', aspectRatio: imageAspect }}
              resizeMode="contain"
            />
          </View>
          <SponsorAdFooterStrip ad={ad} hasAction={hasAction} />
        </Pressable>
      </Animated.View>
    );
  }

  if (variant === 'footer') {
    return (
      <Animated.View entering={FadeInDown.duration(400)} className={className}>
        <Pressable
          onPress={hasAction ? handlePress : undefined}
          disabled={!hasAction}
          className={cardShell}
        >
          <View className="bg-white px-6 pt-4 pb-5 items-center">
            <Text className="self-start text-[10px] font-body-semibold uppercase tracking-[0.18em] text-neutral-400 mb-3">
              Sponsored
            </Text>
            <Image
              source={{ uri: ad.image_url }}
              style={{ width: '100%', height: 52, maxWidth: 280 }}
              resizeMode="contain"
            />
          </View>
          <SponsorAdFooterStrip ad={ad} hasAction={hasAction} />
        </Pressable>
      </Animated.View>
    );
  }

  const imageHeight = compact ? COMPACT_SPONSOR_BANNER_HEIGHT : STANDARD_SPONSOR_BANNER_HEIGHT;
  const imagePadding = compact ? 12 : 16;
  const logoHeight = imageHeight - imagePadding * 2;

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      className={cn('overflow-hidden', className)}
    >
      <Pressable
        onPress={hasAction ? handlePress : undefined}
        disabled={!hasAction}
        className={cn(
          'overflow-hidden rounded-2xl border border-fox-border active:opacity-90',
          hasAction && 'active:scale-[0.99]'
        )}
      >
        <View
          className="w-full items-center justify-center bg-white"
          style={{ height: imageHeight, paddingHorizontal: imagePadding, paddingVertical: imagePadding }}
        >
          <Image
            source={{ uri: ad.image_url }}
            style={{ width: '100%', height: logoHeight, maxHeight: logoHeight }}
            resizeMode="contain"
          />
        </View>

        <View className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
          <View
            className="absolute bg-fox-lime"
            style={{
              width: 80,
              height: 12,
              transform: [{ rotate: '45deg' }],
              top: 20,
              right: -20,
            }}
          />
        </View>

        <LinearGradient
          colors={['transparent', 'rgba(12,12,12,0.88)']}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: compact ? 68 : 88,
          }}
        />

        <View className="absolute bottom-3 left-4 right-4">
          <Text className="text-fox-lime text-[10px] font-body-semibold uppercase tracking-[0.15em]">
            {ad.sponsor_name}
          </Text>
          <Text
            className={cn(
              'text-white font-display mt-0.5',
              compact ? 'text-sm' : 'text-base'
            )}
            numberOfLines={2}
          >
            {ad.banner_text}
          </Text>
          {hasAction ? (
            <Text className="text-neutral-400 text-[10px] font-body mt-1">
              Tap to open offer
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function SponsorBanner({
  ads: adsProp,
  ad: adProp,
  placementType,
  holeNumber,
  displayPosition,
  className,
  compact = false,
  variant = 'default',
}: SponsorBannerProps) {
  const { data: rotationSettings } = useAdRotationSettings();
  const { data: fetchedAds = [] } = useAdPlacement(placementType, { holeNumber, displayPosition });

  const pool = adsProp ?? fetchedAds;
  const rotationEnabled = rotationSettings?.enabled ?? false;
  const adsToShow =
    rotationEnabled && !adProp && !adsProp ? pool : pool.slice(0, 1);

  const resolveVariant = (ad: AdPlacement) => {
    if (variant !== 'auto') {
      return { variant, compact };
    }
    return resolveAdDisplayVariant(
      placementType as AdPlacementType,
      ad,
      displayPosition ?? null
    );
  };

  if (adProp) {
    const display = resolveVariant(adProp);
    return (
      <SponsorAdCard
        ad={adProp}
        className={className}
        compact={display.compact ?? compact}
        variant={display.variant}
      />
    );
  }

  if (adsToShow.length === 0) {
    return null;
  }

  if (adsToShow.length === 1) {
    const display = resolveVariant(adsToShow[0]);
     return (
      <SponsorAdCard
        ad={adsToShow[0]}
        className={className}
        compact={display.compact ?? compact}
        variant={display.variant}
      />
    );
  }

  const intervalMs = (rotationSettings?.interval_seconds ?? 12) * 1000;
  const rotationMinHeight =
    variant === 'auto'
      ? getRotationMinHeight(
          placementType as AdPlacementType,
          adsToShow,
          displayPosition ?? null
        )
      : undefined;

  return (
    <SponsorAdRotator
      ads={adsToShow}
      intervalMs={intervalMs}
      className={className}
      minHeight={rotationMinHeight}
      renderAd={(ad) => {
        const display = resolveVariant(ad);
        return (
          <SponsorAdCard
            ad={ad}
            compact={display.compact ?? compact}
            variant={display.variant}
          />
        );
      }}
    />
  );
}
