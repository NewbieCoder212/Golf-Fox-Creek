import { View, type ViewProps } from 'react-native';

import { SectionLabel } from '@/components/ui/SectionLabel';
import { cn } from '@/lib/cn';

interface HubSectionProps extends ViewProps {
  title?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  className?: string;
  panelClassName?: string;
  dense?: boolean;
  children: React.ReactNode;
}

export function HubSection({
  title,
  actionLabel,
  onActionPress,
  className,
  panelClassName,
  dense = false,
  children,
  ...props
}: HubSectionProps) {
  return (
    <View className={cn(dense ? 'mt-2' : 'mt-6', className)} {...props}>
      {title ? (
        <View className={cn('px-5', dense ? 'mb-2' : 'mb-3')}>
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
