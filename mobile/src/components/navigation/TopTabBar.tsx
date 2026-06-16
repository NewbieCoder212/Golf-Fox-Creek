import { View, Platform } from 'react-native';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const TOP_TAB_BAR_CONTENT_HEIGHT = Platform.OS === 'web' ? 64 : 60;
export const HUB_MEMBER_TOOLBAR_HEIGHT = 52;

export function useTopTabBarHeight() {
  const insets = useSafeAreaInsets();
  return TOP_TAB_BAR_CONTENT_HEIGHT + insets.top;
}

export function useTabScreenPadding(extra = 0) {
  return useTopTabBarHeight() + extra;
}

export function TopTabBar(props: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        elevation: 100,
        paddingTop: insets.top,
        backgroundColor: '#0c0c0c',
        borderBottomWidth: 0.5,
        borderBottomColor: '#262626',
      }}
    >
      <BottomTabBar {...props} insets={{ top: 0, bottom: 0, left: 0, right: 0 }} />
    </View>
  );
}
