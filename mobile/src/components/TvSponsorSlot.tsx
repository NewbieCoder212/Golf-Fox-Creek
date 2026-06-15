import { View, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { DisplaySponsor } from '@/types';
import { cn } from '@/lib/cn';

interface TvSponsorSlotProps {
  sponsor: DisplaySponsor;
  variant?: 'sidebar' | 'header' | 'footer';
  className?: string;
}

export function TvSponsorSlot({ sponsor, variant = 'sidebar', className }: TvSponsorSlotProps) {
  const imageHeight = variant === 'header' ? 72 : variant === 'footer' ? 100 : 160;

  return (
    <View className={cn('overflow-hidden rounded-2xl border border-neutral-800', className)}>
      <Image
        source={{ uri: sponsor.image_url }}
        className="w-full"
        style={{ height: imageHeight }}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.95)']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: variant === 'footer' ? 80 : 96,
        }}
      />
      <View className="absolute bottom-3 left-3 right-3">
        <Text className="text-lime-400 text-[10px] font-semibold uppercase tracking-[0.2em]">
          {sponsor.sponsor_name}
        </Text>
        <Text
          className={cn(
            'text-white font-bold mt-0.5',
            variant === 'header' ? 'text-sm' : 'text-base'
          )}
          numberOfLines={variant === 'footer' ? 1 : 2}
        >
          {sponsor.banner_text}
        </Text>
      </View>
    </View>
  );
}

interface TvSponsorCarouselProps {
  sponsors: DisplaySponsor[];
  variant?: 'sidebar' | 'footer';
}

export function TvSponsorCarousel({ sponsors, variant = 'sidebar' }: TvSponsorCarouselProps) {
  if (sponsors.length === 0) return null;

  if (sponsors.length === 1) {
    return <TvSponsorSlot sponsor={sponsors[0]} variant={variant === 'footer' ? 'footer' : 'sidebar'} />;
  }

  return (
    <View className="gap-3">
      {sponsors.slice(0, 2).map((sponsor) => (
        <TvSponsorSlot
          key={sponsor.id}
          sponsor={sponsor}
          variant={variant === 'footer' ? 'footer' : 'sidebar'}
        />
      ))}
    </View>
  );
}
