import { useState } from 'react';
import { Pressable, Text, Alert, Platform, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import * as Haptics from 'expo-haptics';
import { Monitor, Check } from 'lucide-react-native';

import {
  formatTvShortUrlForTyping,
  getPreferredTournamentTvDisplayUrl,
} from '@/lib/display-service';
import { cn } from '@/lib/cn';

interface TournamentCopyTvLinkButtonProps {
  tournamentId: string;
  displayToken: string;
  displaySlug?: string | null;
  compact?: boolean;
  className?: string;
}

export function TournamentCopyTvLinkButton({
  tournamentId,
  displayToken,
  displaySlug,
  compact = false,
  className,
}: TournamentCopyTvLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const shortUrlHint = displaySlug?.trim()
    ? formatTvShortUrlForTyping(displaySlug)
    : null;

  const copyLink = async () => {
    const url = getPreferredTournamentTvDisplayUrl(tournamentId, displayToken, displaySlug);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    } else {
      Clipboard.setString(url);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    if (Platform.OS !== 'web') {
      Alert.alert(
        'TV link copied',
        shortUrlHint
          ? `Type on the TV browser: ${shortUrlHint}`
          : 'Open this URL on your clubhouse TV or cast from a browser tab.'
      );
    }
  };

  return (
    <View className={className}>
      <Pressable
        onPress={copyLink}
        className={cn(
          'flex-row items-center justify-center rounded-xl border active:opacity-80',
          compact ? 'px-3 py-2 border-neutral-700 bg-neutral-900' : 'px-4 py-3 border-lime-700/40 bg-lime-950/30'
        )}
      >
        {copied ? (
          <Check size={compact ? 16 : 18} color="#a3e635" />
        ) : (
          <Monitor size={compact ? 16 : 18} color="#a3e635" />
        )}
        <Text className={cn('text-lime-400 font-semibold ml-2', compact ? 'text-xs' : 'text-sm')}>
          {copied ? 'Copied!' : compact ? 'Copy TV Link' : 'Copy TV Display Link'}
        </Text>
      </Pressable>
      {shortUrlHint ? (
        <Text className="text-neutral-400 text-xs text-center mt-2">
          Type on TV:{' '}
          <Text className="text-lime-400/90 font-semibold">{shortUrlHint}</Text>
        </Text>
      ) : null}
    </View>
  );
}
