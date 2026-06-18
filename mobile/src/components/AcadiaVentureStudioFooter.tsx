import { View, Text } from 'react-native';

import { cn } from '@/lib/cn';

interface AcadiaVentureStudioFooterProps {
  variant?: 'default' | 'tv';
  className?: string;
}

export function AcadiaVentureStudioFooter({
  variant = 'default',
  className,
}: AcadiaVentureStudioFooterProps) {
  return (
    <View className={cn('items-center', variant === 'tv' ? 'pt-2' : 'py-3', className)}>
      <Text
        className={cn(
          'text-neutral-600 text-center',
          variant === 'tv' ? 'text-[10px]' : 'text-xs'
        )}
      >
        Powered by Acadia Venture Studio
      </Text>
    </View>
  );
}
