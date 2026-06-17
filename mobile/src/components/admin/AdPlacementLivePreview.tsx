import { useState } from 'react';
import { type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, Smartphone, Maximize2, Lightbulb } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AdPlacementPreviewFrame } from '@/components/admin/AdPlacementPreviewFrame';
import { cn } from '@/lib/cn';
import { useAdDraftPreviewStore } from '@/lib/ad-draft-preview-store';
import {
  getAdLayoutRecommendation,
  getAdPreviewConfig,
  MEMBER_PREVIEW_SCREENS,
  PLACEMENT_TYPE_LABELS,
  resolvePreviewPlacement,
  type AdPlacementInsert,
  type MemberPreviewScreen,
} from '@/lib/ad-placement-service';

interface AdPlacementLivePreviewProps {
  form: AdPlacementInsert;
}

export function AdPlacementLivePreview({ form }: AdPlacementLivePreviewProps) {
  const router = useRouter();
  const setDraft = useAdDraftPreviewStore((s) => s.setDraft);
  const [previewScreen, setPreviewScreen] = useState<MemberPreviewScreen>('selected');

  const hasImage = Boolean(form.image_url.trim());
  const imageLayout = form.image_layout ?? 'banner';
  const activePlacement = resolvePreviewPlacement(previewScreen, form.placement_type);
  const preview = getAdPreviewConfig(
    activePlacement,
    imageLayout,
    form.display_position ?? 'sidebar'
  );
  const layoutTip = getAdLayoutRecommendation(form.placement_type, imageLayout);
  const comparingScreens = previewScreen !== 'selected';

  const openFullPreview = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraft(form);
    router.push({
      pathname: '/admin/ad-preview',
      params: { screen: previewScreen === 'selected' ? form.placement_type : previewScreen },
    });
  };

  return (
    <View className="mb-4 rounded-2xl border border-lime-700/30 bg-lime-950/10 p-4">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center flex-1">
          <Eye size={16} color="#a3e635" />
          <Text className="text-lime-300 font-semibold text-sm ml-2">Live member preview</Text>
        </View>
        <Pressable
          onPress={openFullPreview}
          disabled={!hasImage}
          className={cn(
            'flex-row items-center px-3 py-1.5 rounded-lg border active:opacity-80',
            hasImage ? 'border-lime-700/50 bg-lime-900/20' : 'border-neutral-800 opacity-40'
          )}
        >
          <Maximize2 size={14} color="#a3e635" />
          <Text className="text-lime-400 text-xs font-semibold ml-1.5">Full screen</Text>
        </Pressable>
      </View>

      <Text className="text-neutral-400 text-xs leading-5 mb-3">
        {comparingScreens
          ? `Previewing on ${PLACEMENT_TYPE_LABELS[activePlacement]} (your saved placement is ${PLACEMENT_TYPE_LABELS[form.placement_type]})`
          : `${PLACEMENT_TYPE_LABELS[form.placement_type]} · ${preview.screenLabel}`}
      </Text>

      {form.placement_type !== 'leaderboard' ? (
        <>
          <Text className="text-neutral-500 text-[10px] uppercase tracking-wide mb-2">
            Compare screens
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
          >
            {MEMBER_PREVIEW_SCREENS.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPreviewScreen(item.id);
                }}
                className={cn(
                  'px-3 py-2 rounded-lg border',
                  previewScreen === item.id
                    ? 'bg-lime-900/40 border-lime-600'
                    : 'bg-[#0c0c0c] border-neutral-800'
                )}
              >
                <Text
                  className={cn(
                    'text-xs font-medium',
                    previewScreen === item.id ? 'text-lime-400' : 'text-neutral-400'
                  )}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      <Text className="text-neutral-500 text-xs leading-5 mb-3">{preview.locationHint}</Text>

      <View
        className={cn(
          'rounded-xl px-3 py-2.5 mb-4 border',
          layoutTip.ok ? 'bg-[#0c0c0c] border-neutral-800' : 'bg-amber-950/20 border-amber-700/40'
        )}
      >
        <View className="flex-row items-start">
          <Lightbulb size={14} color={layoutTip.ok ? '#737373' : '#fbbf24'} style={{ marginTop: 2 }} />
          <Text
            className={cn(
              'text-xs leading-5 ml-2 flex-1',
              layoutTip.ok ? 'text-neutral-400' : 'text-amber-100/90'
            )}
          >
            {layoutTip.message}
          </Text>
        </View>
      </View>

      {!hasImage ? (
        <View className="rounded-xl border border-dashed border-neutral-700 bg-[#0c0c0c] px-4 py-8 items-center">
          <Smartphone size={28} color="#525252" />
          <Text className="text-neutral-500 text-sm mt-3 text-center">
            Add an image URL to see how this ad will look for members
          </Text>
        </View>
      ) : (
        <AdPlacementPreviewFrame form={form} previewScreen={previewScreen} />
      )}

      <Text className="text-neutral-600 text-[11px] mt-3 leading-4">
        Tap Full screen for a larger preview. After saving, use Member Hub Preview on the dashboard
        to see saved home ads in context.
      </Text>
    </View>
  );
}
