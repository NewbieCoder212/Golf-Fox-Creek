import { View } from 'react-native';

import { MemberHubContent } from '@/components/hub/MemberHubContent';
import { TeeTimeAlertMonitor } from '@/components/TeeTimeAlertMonitor';
import { GeofenceMonitor } from '@/components/GeofenceMonitor';

export default function HomeScreen() {
  return (
    <View className="flex-1">
      <MemberHubContent />
      <TeeTimeAlertMonitor />
      <GeofenceMonitor />
    </View>
  );
}
