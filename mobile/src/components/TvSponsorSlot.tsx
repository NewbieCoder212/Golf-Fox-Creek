import { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import type { DisplaySponsor } from '@/types';
import { cn } from '@/lib/cn';

const TV_FOOTER_ROTATE_MS = 14_000;
const TV_SIDEBAR_ROTATE_MS = 12_000;

interface TvSponsorSlotProps {
  sponsor: DisplaySponsor;
  variant?: 'sidebar' | 'header';
  className?: string;
}

/** Compact logo card for header / sidebar rails — uses contain so transparent logos stay crisp. */
export function TvSponsorSlot({ sponsor, variant = 'sidebar', className }: TvSponsorSlotProps) {
  const imageHeight = variant === 'header' ? 56 : 150;

  return (
    <View
      className={cn(
        'overflow-hidden rounded-xl border border-neutral-800 bg-white items-center justify-center',
        className
      )}
      style={{ paddingHorizontal: 12, paddingVertical: variant === 'header' ? 8 : 10 }}
    >
      <Image
        source={{ uri: sponsor.image_url }}
        style={{ width: '100%', height: imageHeight, maxWidth: variant === 'header' ? 120 : 160 }}
        resizeMode="contain"
      />
    </View>
  );
}

interface TvFooterSponsorStripProps {
  sponsors: DisplaySponsor[];
  className?: string;
}

/** Bottom TV strip — logo on white, tagline beside it (no cover crop). */
export function TvFooterSponsorStrip({ sponsors, className }: TvFooterSponsorStripProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % sponsors.length);
    }, TV_FOOTER_ROTATE_MS);
    return () => clearInterval(timer);
  }, [sponsors.length]);

  if (sponsors.length === 0) return null;

  const sponsor = sponsors[index] ?? sponsors[0];

  return (
    <View className={cn('flex-row items-stretch gap-3', className)}>
      <View className="shrink-0 rounded-xl border border-neutral-800 bg-white px-5 py-2.5 items-center justify-center min-w-[200px] max-w-[320px]">
        <Image
          source={{ uri: sponsor.image_url }}
          style={{ width: '100%', height: 44, maxWidth: 260 }}
          resizeMode="contain"
        />
      </View>
      <View className="flex-1 min-w-0 justify-center py-1">
        <Text className="text-lime-400 text-[10px] font-semibold uppercase tracking-[0.18em]">
          Presented by {sponsor.sponsor_name}
        </Text>
        <Text className="text-white text-base font-bold mt-0.5" numberOfLines={2}>
          {sponsor.banner_text}
        </Text>
        {sponsors.length > 1 ? (
          <View className="flex-row items-center gap-1.5 mt-2">
            {sponsors.map((item, dotIndex) => (
              <View
                key={item.id}
                className={cn(
                  'h-1.5 rounded-full',
                  dotIndex === index ? 'w-4 bg-lime-400' : 'w-1.5 bg-neutral-700'
                )}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

interface TvSidebarSponsorStackProps {
  sponsors: DisplaySponsor[];
  className?: string;
  /** Shorter top-left rail — horizontal logo + tagline so standings fit below on lounge TVs */
  compactTop?: boolean;
}

export function TvSidebarSponsorStack({
  sponsors,
  className,
  compactTop = false,
}: TvSidebarSponsorStackProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % sponsors.length);
    }, TV_SIDEBAR_ROTATE_MS);
    return () => clearInterval(timer);
  }, [sponsors.length]);

  if (sponsors.length === 0) return null;

  const sponsor = sponsors[index] ?? sponsors[0];

  const partnerHeader = (
    <View className="flex-row items-center justify-between">
      <Text className="text-neutral-600 text-[9px] uppercase tracking-widest">Partners</Text>
      {sponsors.length > 1 ? (
        <Text className="text-neutral-600 text-[9px]">
          {index + 1}/{sponsors.length}
        </Text>
      ) : null}
    </View>
  );

  const partnerDots =
    sponsors.length > 1 ? (
      <View className="flex-row items-center justify-center gap-1.5 pt-0.5">
        {sponsors.map((item, dotIndex) => (
          <View
            key={item.id}
            className={cn(
              'h-1.5 rounded-full',
              dotIndex === index ? 'w-4 bg-lime-400' : 'w-1.5 bg-neutral-700'
            )}
          />
        ))}
      </View>
    ) : null;

  if (compactTop) {
    return (
      <View className={cn('gap-1.5 shrink-0', className)}>
        {partnerHeader}
        <View className="flex-row items-stretch gap-2">
          <View className="shrink-0 w-[108px] rounded-xl border border-neutral-800 bg-white px-2.5 py-2 items-center justify-center">
            <Image
              source={{ uri: sponsor.image_url }}
              style={{ width: '100%', height: 52, maxWidth: 92 }}
              resizeMode="contain"
            />
          </View>
          <View className="flex-1 min-w-0 justify-center py-0.5">
            <Text
              className="text-lime-400 text-[10px] font-semibold uppercase tracking-[0.14em]"
              numberOfLines={1}
            >
              {sponsor.sponsor_name}
            </Text>
            <Text className="text-neutral-300 text-[11px] font-semibold mt-0.5" numberOfLines={2}>
              {sponsor.banner_text}
            </Text>
          </View>
        </View>
        {partnerDots}
      </View>
    );
  }

  return (
    <View className={cn('gap-2', className)}>
      {partnerHeader}
      <TvSponsorSlot sponsor={sponsor} variant="sidebar" />
      <View className="px-1">
        <Text className="text-lime-400 text-[10px] font-semibold uppercase tracking-[0.16em]">
          {sponsor.sponsor_name}
        </Text>
        <Text className="text-neutral-300 text-xs font-semibold mt-0.5" numberOfLines={2}>
          {sponsor.banner_text}
        </Text>
      </View>
      {partnerDots}
    </View>
  );
}

interface TvSponsorCarouselProps {
  sponsors: DisplaySponsor[];
  variant?: 'sidebar' | 'footer';
}

/** @deprecated Prefer TvFooterSponsorStrip or TvSidebarSponsorStack */
export function TvSponsorCarousel({ sponsors, variant = 'sidebar' }: TvSponsorCarouselProps) {
  if (sponsors.length === 0) return null;

  if (variant === 'footer') {
    return <TvFooterSponsorStrip sponsors={sponsors} />;
  }

  return <TvSidebarSponsorStack sponsors={sponsors} />;
}
