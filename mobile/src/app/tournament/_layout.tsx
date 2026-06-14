import { Stack } from 'expo-router';

export default function TournamentAliasLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="scorecard" />
      <Stack.Screen name="wagering" />
    </Stack>
  );
}
