import { Pressable, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { cn } from '@/lib/cn';
import { foxColors } from '@/theme/tokens';

interface QuickActionTileProps {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  className?: string;
}

export function QuickActionTile({ icon: Icon, label, onPress, className }: QuickActionTileProps) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      className={cn(
        'flex-1 bg-fox-surface border border-fox-border rounded-2xl p-4 items-center justify-center active:opacity-70 active:scale-[0.97]',
        className
      )}
      style={{ minHeight: 108 }}
    >
      <View className="w-14 h-14 bg-fox-surface-elevated rounded-full items-center justify-center mb-3 border border-fox-border">
        <Icon size={22} color={foxColors.lime} strokeWidth={1.5} />
      </View>
      <Text className="text-neutral-300 text-xs font-body-semibold text-center">{label}</Text>
    </Pressable>
  );
}
