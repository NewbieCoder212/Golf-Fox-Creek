import { View, Text, Pressable } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { cn } from '@/lib/cn';

interface HoleScoreStepperProps {
  hole: number;
  par: number;
  gross: number;
  net?: number;
  onChange: (gross: number) => void;
  compact?: boolean;
}

export function HoleScoreStepper({
  hole,
  par,
  gross,
  net,
  onChange,
  compact = false,
}: HoleScoreStepperProps) {
  const relativeToPar = gross - par;

  const scoreColor =
    relativeToPar < 0 ? 'text-lime-400' : relativeToPar === 0 ? 'text-white' : 'text-red-400';

  const adjust = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(Math.max(1, gross + delta));
  };

  return (
    <View
      className={cn(
        'flex-row items-center bg-[#141414] border border-neutral-800 rounded-xl',
        compact ? 'px-3 py-2' : 'px-4 py-3'
      )}
    >
      <View className="w-10">
        <Text className="text-white font-bold text-base">{hole}</Text>
        <Text className="text-neutral-500 text-xs">Par {par}</Text>
      </View>

      <View className="flex-1 flex-row items-center justify-center gap-3">
        <Pressable
          onPress={() => adjust(-1)}
          className="w-9 h-9 rounded-full bg-neutral-800 items-center justify-center active:opacity-70"
        >
          <Minus size={16} color="#a3e635" />
        </Pressable>

        <View className="items-center min-w-[48px]">
          <Text className={cn('text-2xl font-bold', scoreColor)}>{gross}</Text>
          {net !== undefined && (
            <Text className="text-neutral-500 text-xs">Net {net}</Text>
          )}
        </View>

        <Pressable
          onPress={() => adjust(1)}
          className="w-9 h-9 rounded-full bg-neutral-800 items-center justify-center active:opacity-70"
        >
          <Plus size={16} color="#a3e635" />
        </Pressable>
      </View>
    </View>
  );
}
