import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { MemberHubContent } from '@/components/hub/MemberHubContent';
import {
  HUB_PREVIEW_SCENARIOS,
  HubPreviewProvider,
  useHubPreviewContext,
} from '@/components/hub/HubPreviewContext';
import { useAdminAuthStore } from '@/lib/admin-auth-store';
import { cn } from '@/lib/cn';

function ScenarioPicker() {
  const { scenario, setScenario } = useHubPreviewContext()!;

  return (
    <View className="border-b border-fox-border/60 bg-fox-background">
      <Text className="text-neutral-500 text-xs uppercase tracking-[0.12em] px-5 pt-3 pb-2">
        Round Scenario
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}
        style={{ flexGrow: 0 }}
      >
        {HUB_PREVIEW_SCENARIOS.map((item) => {
          const isActive = scenario === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setScenario(item.id);
              }}
              className={cn(
                'rounded-full px-3.5 py-2 border active:opacity-80',
                isActive
                  ? 'bg-lime-900/40 border-lime-600/60'
                  : 'bg-fox-surface-elevated border-fox-border'
              )}
            >
              <Text
                className={cn(
                  'text-sm font-body-semibold',
                  isActive ? 'text-lime-300' : 'text-neutral-400'
                )}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function HubPreviewScreenContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile, user } = useAdminAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ['gmAnnouncement'] });
    void queryClient.invalidateQueries({ queryKey: ['turnMessaging'] });
    void queryClient.invalidateQueries({ queryKey: ['hubMyEvents'] });
    void queryClient.invalidateQueries({ queryKey: ['adPlacement'] });
  }, [queryClient]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['gmAnnouncement'] }),
      queryClient.invalidateQueries({ queryKey: ['turnMessaging'] }),
      queryClient.invalidateQueries({ queryKey: ['hubMyEvents'] }),
      queryClient.invalidateQueries({ queryKey: ['adPlacement'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  return (
    <View className="flex-1 bg-fox-background">
      <SafeAreaView edges={['top']} className="bg-fox-background border-b border-fox-border/60">
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="w-10 h-10 items-center justify-center rounded-full bg-fox-surface-elevated border border-fox-border active:opacity-70"
          >
            <ArrowLeft size={20} color="#a3e635" />
          </Pressable>
          <View className="flex-1 ml-3">
            <Text className="text-white text-base font-body-semibold">Member Hub Preview</Text>
            <Text className="text-neutral-500 text-xs mt-0.5">
              Live content · simulate scorecard states on the home screen
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScenarioPicker />

      <MemberHubContent
        previewMode
        userId={user?.id}
        userProfile={profile}
        contentPaddingTop={0}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#a3e635"
          />
        }
      />
    </View>
  );
}

export default function AdminHubPreviewScreen() {
  return (
    <HubPreviewProvider initialScenario="live">
      <HubPreviewScreenContent />
    </HubPreviewProvider>
  );
}
