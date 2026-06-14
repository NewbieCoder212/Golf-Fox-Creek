import { View, type ViewProps } from 'react-native';

import { SectionLabel } from '@/components/ui/SectionLabel';
import { cn } from '@/lib/cn';

interface HubSectionProps extends ViewProps {
  title?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  className?: string;
  panelClassName?: string;
  children: React.ReactNode;
}

export function HubSection({
  title,
  actionLabel,
  onActionPress,
  className,
  panelClassName,
  children,
  ...props
}: HubSectionProps) {
  return (
    <View className={cn('mt-6', className)} {...props}>
      {title ? (
        <View className="px-5 mb-3">
          <SectionLabel
            label={title}
            actionLabel={actionLabel}
            onActionPress={onActionPress}
            className="mb-0"
          />
        </View>
      ) : null}
      <View className={cn('mx-5 bg-fox-surface rounded-3xl p-4 border border-fox-border', panelClassName)}>
        {children}
      </View>
    </View>
  );
}
