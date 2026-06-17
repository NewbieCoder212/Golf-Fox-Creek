import { View, Text, Pressable } from 'react-native';
import { BookOpen, CheckCircle2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { cn } from '@/lib/cn';
import {
  AD_PLACEMENT_GUIDES,
  IMAGE_LAYOUT_LABELS,
  type AdPlacementInsert,
  type AdImageLayout,
} from '@/lib/ad-placement-service';

interface AdPlacementHelpGuideProps {
  form: AdPlacementInsert;
  onApplyRecommendedLayout?: (layout: AdImageLayout) => void;
}

export function AdPlacementHelpGuide({ form, onApplyRecommendedLayout }: AdPlacementHelpGuideProps) {
  const guide = AD_PLACEMENT_GUIDES[form.placement_type];
  const currentLayout = form.image_layout ?? 'banner';
  const isRecommended = currentLayout === guide.recommendedLayout;

  return (
    <View className="mb-4 rounded-2xl border border-neutral-800 bg-[#0c0c0c] p-4">
      <View className="flex-row items-center mb-2">
        <BookOpen size={16} color="#a3e635" />
        <Text className="text-white font-semibold text-sm ml-2">Placement guide</Text>
      </View>
      <Text className="text-neutral-400 text-sm leading-5 mb-3">{guide.summary}</Text>

      {guide.tips.map((tip) => (
        <View key={tip} className="flex-row items-start mb-2">
          <Text className="text-lime-500 mr-2">•</Text>
          <Text className="text-neutral-500 text-xs leading-5 flex-1">{tip}</Text>
        </View>
      ))}

      <View className="mt-3 pt-3 border-t border-neutral-800">
        <Text className="text-neutral-500 text-[10px] uppercase tracking-wide mb-1">
          Recommended image
        </Text>
        <Text className="text-neutral-400 text-xs leading-5">{guide.imageSizeHint}</Text>
      </View>

      <View className="mt-3 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          {isRecommended ? (
            <CheckCircle2 size={14} color="#4ade80" />
          ) : (
            <View className="w-3.5 h-3.5 rounded-full border border-neutral-600" />
          )}
          <Text className="text-neutral-400 text-xs ml-2">
            Best shape: {IMAGE_LAYOUT_LABELS[guide.recommendedLayout]}
          </Text>
        </View>
        {!isRecommended && onApplyRecommendedLayout ? (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onApplyRecommendedLayout(guide.recommendedLayout);
            }}
            className="px-3 py-1.5 rounded-lg bg-lime-900/30 border border-lime-700/40 active:opacity-80"
          >
            <Text className="text-lime-400 text-xs font-semibold">Use recommended</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
