import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/cn';

type SurfaceCardVariant = 'default' | 'accent' | 'live';

interface SurfaceCardProps extends ViewProps {
  variant?: SurfaceCardVariant;
  className?: string;
  children: React.ReactNode;
}

const variantClasses: Record<SurfaceCardVariant, string> = {
  default: 'bg-fox-surface border-fox-border',
  accent: 'bg-fox-surface border-fox-border-accent',
  live: 'bg-fox-surface border-fox-border-accent',
};

export function SurfaceCard({
  variant = 'default',
  className,
  children,
  ...props
}: SurfaceCardProps) {
  return (
    <View
      className={cn(
        'rounded-2xl border overflow-hidden',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {variant === 'live' && (
        <View className="absolute left-0 top-0 bottom-0 w-1 bg-fox-lime" />
      )}
      {variant === 'accent' && (
        <View className="absolute left-0 top-0 bottom-0 w-1 bg-fox-lime/60" />
      )}
      {children}
    </View>
  );
}
