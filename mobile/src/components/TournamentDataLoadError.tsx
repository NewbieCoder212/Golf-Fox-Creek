import { View, Text, Pressable } from 'react-native';

interface TournamentDataLoadErrorProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function TournamentDataLoadError({
  title = 'Could not load tournament data',
  message,
  onRetry,
  className,
}: TournamentDataLoadErrorProps) {
  return (
    <View
      className={`bg-red-950/30 border border-red-800/50 rounded-xl px-4 py-3 ${className ?? ''}`}
    >
      <Text className="text-red-300 text-sm font-semibold">{title}</Text>
      <Text className="text-red-200/80 text-xs mt-1">{message}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          className="self-start mt-2 px-3 py-1.5 rounded-lg bg-red-900/40 active:opacity-80"
        >
          <Text className="text-red-200 text-xs font-semibold">Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
