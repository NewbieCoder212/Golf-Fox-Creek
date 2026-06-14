import { useLocalSearchParams } from 'expo-router';

import TournamentDigitalScorecardScreen from '@/components/TournamentDigitalScorecardScreen';

/** Spec route: /tournament/scorecard?id=... */
export default function TournamentScorecardRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <TournamentDigitalScorecardScreen />;
}
