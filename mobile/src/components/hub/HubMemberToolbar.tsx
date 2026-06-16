import { View, Text, Pressable } from 'react-native';
import { Globe, LogOut } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { HUB_MEMBER_TOOLBAR_HEIGHT } from '@/components/navigation/TopTabBar';
import { useTranslations, useLanguageStore } from '@/lib/language-store';
import { foxColors } from '@/theme/tokens';

interface HubMemberToolbarProps {
  onLogout: () => void;
}

export function HubMemberToolbar({ onLogout }: HubMemberToolbarProps) {
  const t = useTranslations();
  const language = useLanguageStore((s) => s.language);
  const toggleLanguage = useLanguageStore((s) => s.toggleLanguage);

  const handleLanguageToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleLanguage();
  };

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLogout();
  };

  return (
    <View
      className="px-5 flex-row items-center justify-between border-b border-fox-border bg-fox-background"
      style={{ height: HUB_MEMBER_TOOLBAR_HEIGHT }}
    >
      <Pressable
        onPress={handleLanguageToggle}
        className="flex-row items-center bg-fox-surface-elevated rounded-full px-3 py-2 border border-fox-border active:opacity-70"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Globe size={15} color={foxColors.lime} strokeWidth={2} />
        <Text className="text-neutral-200 text-xs font-body-semibold ml-1.5 tracking-wide">
          {language.toUpperCase()}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleLogout}
        className="flex-row items-center rounded-full px-4 py-2.5 border-2 border-red-500 bg-red-600 active:opacity-90"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={t.logOut}
      >
        <LogOut size={17} color="#ffffff" strokeWidth={2.5} />
        <Text className="text-white text-sm font-body-bold ml-2">{t.logOut}</Text>
      </Pressable>
    </View>
  );
}
