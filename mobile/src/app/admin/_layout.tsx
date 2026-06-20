import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" options={{ presentation: 'modal' }} />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="hub-preview" />
      <Stack.Screen name="ad-preview" />
      <Stack.Screen name="members" />
    </Stack>
  );
}
