import { View, Text, Pressable, Image, Switch, Alert } from 'react-native';
import { Plus, Pencil, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { cn } from '@/lib/cn';
import {
  EVENT_TAB_KEYS,
  EVENT_TAB_LABELS,
  EVENT_TAB_PLACEMENTS,
  eventTabKeyFromPlacement,
  isEventTabPlacement,
  type TournamentEventTabKey,
} from '@/lib/ad-placement-service';
import type { AdPlacement } from '@/types';

interface AdminEventTabAdsPanelProps {
  ads: AdPlacement[];
  rotationEnabled: boolean;
  onAddToTab: (tab: TournamentEventTabKey) => void;
  onAddToAllTabs: () => void;
  onEditAd: (ad: AdPlacement) => void;
  onToggleAd: (id: string, is_active: boolean) => void;
  onDeleteAd: (id: string) => void;
}

function slotSummary(tabAds: AdPlacement[], rotationEnabled: boolean): string {
  const active = tabAds.filter((ad) => ad.is_active);
  if (active.length === 0) return 'No sponsor';
  if (active.length === 1) return active[0]!.sponsor_name;
  return rotationEnabled
    ? `${active.length} sponsors · rotates`
    : `${active.length} sponsors · newest shows`;
}

export function AdminEventTabAdsPanel({
  ads,
  rotationEnabled,
  onAddToTab,
  onAddToAllTabs,
  onEditAd,
  onToggleAd,
  onDeleteAd,
}: AdminEventTabAdsPanelProps) {
  const eventAds = ads.filter((ad) => isEventTabPlacement(ad.placement_type));

  const adsByTab = EVENT_TAB_KEYS.reduce<Record<TournamentEventTabKey, AdPlacement[]>>(
    (acc, tab) => {
      acc[tab] = eventAds.filter((ad) => ad.placement_type === EVENT_TAB_PLACEMENTS[tab]);
      return acc;
    },
    { standings: [], schedule: [], match: [], teams: [] }
  );

  return (
    <View className="mb-6">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 pr-3">
          <Text className="text-white font-semibold text-base">Event tab sponsors</Text>
          <Text className="text-neutral-500 text-sm mt-1 leading-5">
            Standings, Schedule, Match, and Teams each have their own ad slot. Add the same sponsor
            to multiple tabs at once, or add extras in one tab to rotate.
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2 mb-3">
        {EVENT_TAB_KEYS.map((tab) => {
          const tabAds = adsByTab[tab];
          const activeCount = tabAds.filter((ad) => ad.is_active).length;
          const previewAd = tabAds.find((ad) => ad.is_active) ?? tabAds[0];

          return (
            <Pressable
              key={tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onAddToTab(tab);
              }}
              className="w-[48%] bg-[#141414] rounded-xl border border-neutral-800 p-3 active:opacity-80"
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-white font-semibold text-sm">{EVENT_TAB_LABELS[tab]}</Text>
                <View
                  className={cn(
                    'px-2 py-0.5 rounded',
                    activeCount > 0 ? 'bg-green-900/40' : 'bg-neutral-800'
                  )}
                >
                  <Text
                    className={cn(
                      'text-[10px] font-medium',
                      activeCount > 0 ? 'text-green-400' : 'text-neutral-500'
                    )}
                  >
                    {activeCount > 0 ? `${activeCount} live` : 'Empty'}
                  </Text>
                </View>
              </View>

              {previewAd ? (
                <Image
                  source={{ uri: previewAd.image_url }}
                  className="w-full rounded-lg bg-white mb-2"
                  style={{ height: 44 }}
                  resizeMode="contain"
                />
              ) : (
                <View className="h-11 rounded-lg bg-neutral-900 border border-dashed border-neutral-700 items-center justify-center mb-2">
                  <Plus size={16} color="#525252" />
                </View>
              )}

              <Text className="text-neutral-500 text-xs" numberOfLines={1}>
                {slotSummary(tabAds, rotationEnabled)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onAddToAllTabs();
        }}
        className="flex-row items-center justify-center bg-lime-600/20 border border-lime-700/50 py-3 rounded-xl mb-4 active:opacity-80"
      >
        <Plus size={16} color="#a3e635" />
        <Text className="text-lime-400 font-semibold text-sm ml-2">Add sponsor to all tabs</Text>
      </Pressable>

      {eventAds.length > 0 ? (
        <View>
          <Text className="text-neutral-400 text-xs uppercase tracking-wide mb-2">
            Event tab ads
          </Text>
          {eventAds.map((ad) => (
            <View
              key={ad.id}
              className="bg-[#141414] rounded-xl border border-neutral-800 mb-2 p-3 flex-row items-center"
            >
              <Image
                source={{ uri: ad.image_url }}
                className="w-14 h-10 rounded bg-white mr-3"
                resizeMode="contain"
              />
              <View className="flex-1 mr-2">
                <Text className="text-white font-medium text-sm" numberOfLines={1}>
                  {ad.sponsor_name}
                </Text>
                <Text className="text-lime-400/80 text-xs mt-0.5">
                  {eventTabKeyFromPlacement(ad.placement_type)
                    ? EVENT_TAB_LABELS[eventTabKeyFromPlacement(ad.placement_type)!]
                    : 'Event tab'}
                  {ad.is_active ? '' : ' · Off'}
                </Text>
              </View>
              <Switch
                value={ad.is_active}
                onValueChange={(v) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onToggleAd(ad.id, v);
                }}
                trackColor={{ false: '#404040', true: '#4d7c0f' }}
                thumbColor={ad.is_active ? '#a3e635' : '#737373'}
              />
              <Pressable
                onPress={() => onEditAd(ad)}
                className="w-8 h-8 ml-2 bg-neutral-800 rounded-lg items-center justify-center active:opacity-80"
              >
                <Pencil size={14} color="#a3e635" />
              </Pressable>
              <Pressable
                onPress={() => {
                  Alert.alert('Delete ad?', `Remove "${ad.sponsor_name}"?`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => onDeleteAd(ad.id),
                    },
                  ]);
                }}
                className="w-8 h-8 ml-1 bg-neutral-800 rounded-lg items-center justify-center active:opacity-80"
              >
                <Trash2 size={14} color="#f87171" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
