import { Stack } from 'expo-router';

export default function DisplayLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="tournament/[id]" />
    </Stack>
  );
}
