import { type ReactNode } from 'react';
import { View, Text } from 'react-native';

import { SponsorBanner } from '@/components/SponsorBanner';
import { cn } from '@/lib/cn';
import {
  draftToPreviewAd,
  getAdPreviewConfig,
  isTournamentTabPlacement,
  type AdPlacementInsert,
  type AdPlacementType,
  type MemberPreviewScreen,
  resolvePreviewPlacement,
} from '@/lib/ad-placement-service';
import type { AdPlacement } from '@/types';

export function PreviewChrome({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View className="rounded-xl border border-neutral-700 bg-[#0c0c0c] overflow-hidden">
      <View className="px-3 py-2 border-b border-neutral-800 bg-[#141414]">
        <Text className="text-neutral-500 text-[10px] uppercase tracking-[0.12em]">{title}</Text>
        {subtitle ? (
          <Text className="text-white text-xs font-semibold mt-0.5">{subtitle}</Text>
        ) : null}
      </View>
      <View className="p-3">{children}</View>
    </View>
  );
}

export function AdPlacementPreviewFrame({
  form,
  previewScreen = 'selected',
  previewAd,
  large = false,
}: {
  form: AdPlacementInsert;
  previewScreen?: MemberPreviewScreen;
  previewAd?: AdPlacement | null;
  large?: boolean;
}) {
  const placementType = resolvePreviewPlacement(previewScreen, form.placement_type);
  const imageLayout = form.image_layout ?? 'banner';
  const preview = getAdPreviewConfig(
    placementType,
    imageLayout,
    form.display_position ?? 'sidebar'
  );
  const ad = previewAd ?? (form.image_url.trim() ? draftToPreviewAd({ ...form, placement_type: placementType }) : null);

  if (!ad) {
    return null;
  }

  const bannerProps = {
    ad,
    placementType,
    holeNumber: form.hole_number ?? undefined,
    displayPosition: form.display_position ?? undefined,
    variant: preview.variant,
    compact: preview.compact,
  } as const;

  if (placementType === 'member_hub' && preview.variant === 'footer') {
    return (
      <PreviewChrome title="Home tab" subtitle="Member hub">
        <View className="rounded-lg border border-neutral-800 bg-[#0c0c0c] overflow-hidden">
          <View
            className={cn(
              'bg-[#141414] border-b border-neutral-800 px-3 justify-center',
              large ? 'h-28' : 'h-16'
            )}
          >
            <Text className="text-neutral-600 text-[10px]">Welcome · Today&apos;s match · Standings</Text>
          </View>
          <View className={large ? 'h-32' : 'h-20'} />
          <View className="border-t border-neutral-800 pt-2 px-1">
            <SponsorBanner {...bannerProps} />
          </View>
        </View>
      </PreviewChrome>
    );
  }

  if (placementType === 'member_hub') {
    return (
      <PreviewChrome title="Home tab" subtitle="Sponsored section">
        <SponsorBanner {...bannerProps} />
      </PreviewChrome>
    );
  }

  if (placementType === 'tournament_detail') {
    return (
      <PreviewChrome title="Event screen" subtitle="Header · all tabs">
        <View className="mb-2">
          <Text className="text-white font-bold text-sm">Generation Cup</Text>
          <Text className="text-neutral-500 text-xs">Jun 19 – Jun 20, 2026</Text>
        </View>
        <SponsorBanner {...bannerProps} />
        <View className="flex-row gap-2 mt-3">
          {['Schedule', 'Match', 'Teams'].map((label) => (
            <View key={label} className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800">
              <Text className="text-neutral-500 text-[10px]">{label}</Text>
            </View>
          ))}
        </View>
      </PreviewChrome>
    );
  }

  if (isTournamentTabPlacement(placementType)) {
    const tabLabel =
      placementType === 'tournament_tab_standings'
        ? 'Standings'
        : placementType === 'tournament_tab_schedule'
          ? 'Schedule'
          : placementType === 'tournament_tab_match'
            ? 'Match'
            : 'Teams';

    return (
      <PreviewChrome title="Event screen" subtitle={`${tabLabel} tab content`}>
        <View className="flex-row flex-wrap gap-2 mb-3">
          {(['Standings', 'Schedule', 'Match', 'Teams'] as const).map((label) => (
            <View
              key={label}
              className={cn(
                'px-3 py-1.5 rounded-lg border',
                label === tabLabel
                  ? 'bg-lime-900/40 border-lime-600'
                  : 'bg-neutral-900 border-neutral-800'
              )}
            >
              <Text
                className={cn(
                  'text-[10px]',
                  label === tabLabel ? 'text-lime-400' : 'text-neutral-500'
                )}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
        <SponsorBanner {...bannerProps} />
      </PreviewChrome>
    );
  }

  if (placementType === 'scorecard_header') {
    return (
      <PreviewChrome title="Scorecard tab" subtitle="Top of scorecard">
        <SponsorBanner {...bannerProps} />
        <View className="mt-3 h-24 rounded-lg bg-[#141414] border border-neutral-800 items-center justify-center">
          <Text className="text-neutral-600 text-xs">Paper scorecard grid</Text>
        </View>
      </PreviewChrome>
    );
  }

  if (placementType === 'hole_sponsor' || placementType === 'hole_sponsor_secondary') {
    return (
      <PreviewChrome title="Score entry" subtitle={`Hole ${form.hole_number ?? 1}`}>
        <View className="mb-2">
          <Text className="text-neutral-600 text-[10px] mb-2">Match panel while entering scores</Text>
        </View>
        <SponsorBanner {...bannerProps} />
      </PreviewChrome>
    );
  }

  if (placementType === 'the_turn') {
    return (
      <PreviewChrome title="Scorecard" subtitle="Mid-round Turn break">
        <View className="items-center py-2 mb-2">
          <Text className="text-amber-400 text-2xl font-bold">04:32</Text>
          <Text className="text-neutral-500 text-xs mt-1">Turn countdown</Text>
        </View>
        <SponsorBanner {...bannerProps} />
      </PreviewChrome>
    );
  }

  return (
    <PreviewChrome title={preview.screenLabel} subtitle="Clubhouse TV">
      <View className="rounded-lg bg-black p-2">
        <SponsorBanner {...bannerProps} />
      </View>
    </PreviewChrome>
  );
}
