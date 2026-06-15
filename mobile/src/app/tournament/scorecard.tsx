import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

/**
 * Legacy route — forwards to the unified Quick Play scorecard tab.
 * /tournament/scorecard?id=... → /(tabs)/scorecard?id=...
 */
export default function TournamentScorecardRedirect() {
  const params = useLocalSearchParams<Record<string, string>>();
  const router = useRouter();

  useEffect(() => {
    router.replace({
      pathname: '/(tabs)/scorecard',
      params: {
        id: params.id,
        matchGroupId: params.matchGroupId,
        round: params.round,
        side: params.side,
      },
    });
  }, [router, params.id, params.matchGroupId, params.round, params.side]);

  return (
    <View className="flex-1 bg-[#0c0c0c] items-center justify-center">
      <ActivityIndicator color="#a3e635" />
    </View>
  );
}
