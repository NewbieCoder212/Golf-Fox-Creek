import { View, Text, Pressable } from 'react-native';
import { cn } from '@/lib/cn';

interface SectionLabelProps {
  label: string;
  actionLabel?: string;
  onActionPress?: () => void;
  className?: string;
}

export function SectionLabel({
  label,
  actionLabel,
  onActionPress,
  className,
}: SectionLabelProps) {
  return (
    <View className={cn('flex-row items-center justify-between mb-3', className)}>
      <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] font-body-semibold">
        {label}
      </Text>
      {actionLabel && onActionPress ? (
        <Pressable onPress={onActionPress} hitSlop={8} className="active:opacity-70">
          <Text className="text-fox-lime text-xs font-body-semibold">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
