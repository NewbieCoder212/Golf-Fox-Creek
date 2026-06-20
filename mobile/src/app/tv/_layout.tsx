import { Stack } from 'expo-router';

export default function TvLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="[slug]" />
    </Stack>
  );
}
