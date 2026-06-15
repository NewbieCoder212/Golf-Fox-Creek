import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { textColorForTeeColors } from '@/lib/scorecard-tees';

const INK = '#2C2416';

interface ComboTeeSwatchProps {
  colors: readonly string[];
  width: number;
  height: number;
  label?: string;
  subLabel?: string;
  onPress?: () => void;
  selected?: boolean;
}

export function ComboTeeSwatch({
  colors,
  width,
  height,
  label,
  subLabel,
  onPress,
  selected,
}: ComboTeeSwatchProps) {
  const textColor = textColorForTeeColors(colors);
  const isCombo = colors.length >= 2;

  const inner = (
    <View
      style={{
        width,
        height,
        borderWidth: selected ? 2 : 0,
        borderColor: '#2C2416',
      }}
      className="overflow-hidden"
    >
      {isCombo ? (
        <LinearGradient
          colors={[colors[0], colors[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          {label ? (
            <Text
              className="text-[8px] font-bold uppercase"
              style={{ color: textColor }}
              numberOfLines={1}
            >
              {label}
            </Text>
          ) : null}
          {subLabel ? (
            <Text className="text-[7px]" style={{ color: textColor }} numberOfLines={1}>
              {subLabel}
            </Text>
          ) : null}
        </LinearGradient>
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: colors[0],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {label ? (
            <Text
              className="text-[8px] font-bold uppercase"
              style={{ color: textColor }}
              numberOfLines={1}
            >
              {label}
            </Text>
          ) : null}
          {subLabel ? (
            <Text className="text-[7px]" style={{ color: textColor }} numberOfLines={1}>
              {subLabel}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className="active:opacity-80">
        {inner}
      </Pressable>
    );
  }

  return inner;
}

/** Small swatch for player tee picker (no label inside). */
export function ComboTeeBadge({
  colors,
  size = 20,
  onPress,
  selected,
}: {
  colors: readonly string[];
  size?: number;
  onPress?: () => void;
  selected?: boolean;
}) {
  return (
    <ComboTeeSwatch
      colors={colors}
      width={size}
      height={size}
      onPress={onPress}
      selected={selected}
    />
  );
}

export function ComboTeeDataCell({
  value,
  colors,
  width,
  height,
  bold,
}: {
  value: string | number;
  colors: readonly string[];
  width: number;
  height: number;
  bold?: boolean;
}) {
  const isCombo = colors.length >= 2;
  const textColor = isCombo ? '#fff' : textColorForTeeColors(colors);

  return (
    <View
      style={{ width, height }}
      className="border-r border-b border-[#C4B9A8] overflow-hidden"
    >
      {isCombo ? (
        <LinearGradient
          colors={[colors[0], colors[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text
            className={bold ? 'text-[10px] font-bold' : 'text-[10px] font-medium'}
            style={{ color: textColor }}
          >
            {value}
          </Text>
        </LinearGradient>
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: colors[0],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            className={bold ? 'text-[10px] font-bold' : 'text-[10px] font-medium'}
            style={{ color: textColor }}
          >
            {value}
          </Text>
        </View>
      )}
    </View>
  );
}