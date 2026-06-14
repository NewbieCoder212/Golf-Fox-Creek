import { Pressable, Text, View, ActivityIndicator } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { cn } from '@/lib/cn';

interface StatPillProps {
  icon: LucideIcon;
  iconColor: string;
  value: string | React.ReactNode;
  label: string;
  onPress?: () => void;
  loading?: boolean;
  className?: string;
}

export function StatPill({
  icon: Icon,
  iconColor,
  value,
  label,
  onPress,
  loading,
  className,
}: StatPillProps) {
  const content = (
    <>
      <View className="flex-row items-center gap-2">
        <Icon size={18} color={iconColor} strokeWidth={1.5} />
        <Text className="text-neutral-500 text-xs font-body-medium uppercase tracking-wide">
          {label}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} className="mt-2" />
      ) : (
        <Text className="text-white text-2xl font-display mt-1">{value}</Text>
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        className={cn(
          'flex-1 bg-fox-surface-elevated border border-fox-border rounded-xl p-4 active:opacity-80 active:scale-[0.98]',
          className
        )}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      className={cn(
        'flex-1 bg-fox-surface-elevated border border-fox-border rounded-xl p-4',
        className
      )}
    >
      {content}
    </View>
  );
}
