import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TournamentWageringAlias() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <Redirect href={`/tournament/wagering?id=${id}`} />;
}
