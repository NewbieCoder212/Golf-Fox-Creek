import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AdPlacementPreviewFrame } from '@/components/admin/AdPlacementPreviewFrame';
import { cn } from '@/lib/cn';
import { useAdDraftPreviewStore } from '@/lib/ad-draft-preview-store';
import {
  MEMBER_PREVIEW_SCREENS,
  PLACEMENT_TYPE_LABELS,
  type MemberPreviewScreen,
} from '@/lib/ad-placement-service';

function parsePreviewScreen(param: string | string[] | undefined): MemberPreviewScreen {
  const raw = Array.isArray(param) ? param[0] : param;
  if (
    raw === 'member_hub' ||
    raw === 'tournament_detail' ||
    raw === 'tournament_tab_schedule' ||
    raw === 'tournament_tab_match' ||
    raw === 'tournament_tab_teams' ||
    raw === 'scorecard_header' ||
    raw === 'hole_sponsor' ||
    raw === 'the_turn' ||
    raw === 'selected'
  ) {
    return raw;
  }
  if (raw === 'leaderboard') {
    return 'selected';
  }
  return 'selected';
}

export default function AdminAdPreviewScreen() {
  const router = useRouter();
  const { screen: screenParam } = useLocalSearchParams<{ screen?: string | string[] }>();
  const draft = useAdDraftPreviewStore((s) => s.draft);
  const [previewScreen, setPreviewScreen] = useState<MemberPreviewScreen>(() =>
    parsePreviewScreen(screenParam)
  );

  useEffect(() => {
    setPreviewScreen(parsePreviewScreen(screenParam));
  }, [screenParam]);

  if (!draft?.image_url.trim()) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center px-8">
        <Text className="text-white text-lg font-semibold text-center">No ad draft to preview</Text>
        <Text className="text-neutral-500 text-sm text-center mt-2">
          Go back to Sponsor Ads, fill in the form, and tap Full screen again.
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 px-5 py-3 rounded-xl bg-lime-600 active:opacity-80"
        >
          <Text className="text-white font-semibold">Back to Sponsor Ads</Text>
        </Pressable>
      </View>
    );
  }

  const screens =
    draft.placement_type === 'leaderboard'
      ? [{ id: 'selected' as const, label: 'TV' }]
      : MEMBER_PREVIEW_SCREENS;

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <SafeAreaView edges={['top']} className="border-b border-neutral-800 bg-[#141414]">
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="w-10 h-10 items-center justify-center rounded-full bg-neutral-900 border border-neutral-800 active:opacity-70"
          >
            <ArrowLeft size={20} color="#a3e635" />
          </Pressable>
          <View className="flex-1 ml-3">
            <Text className="text-white text-base font-semibold">Ad preview</Text>
            <Text className="text-neutral-500 text-xs mt-0.5">
              {draft.sponsor_name.trim() || 'Draft ad'} · how members will see it
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {screens.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          className="border-b border-neutral-800 bg-[#141414]"
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
        >
          {screens.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPreviewScreen(item.id);
              }}
              className={cn(
                'px-4 py-2 rounded-full border',
                previewScreen === item.id
                  ? 'bg-lime-900/40 border-lime-600'
                  : 'bg-[#0c0c0c] border-neutral-800'
              )}
            >
              <Text
                className={cn(
                  'text-sm font-medium',
                  previewScreen === item.id ? 'text-lime-300' : 'text-neutral-400'
                )}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-neutral-500 text-xs mb-4 text-center">
          Saved placement: {PLACEMENT_TYPE_LABELS[draft.placement_type]}
        </Text>
        <AdPlacementPreviewFrame form={draft} previewScreen={previewScreen} large />
      </ScrollView>
    </View>
  );
}
