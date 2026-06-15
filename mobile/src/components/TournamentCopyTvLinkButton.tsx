import { useState } from 'react';
import { Pressable, Text, Alert, Platform } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import * as Haptics from 'expo-haptics';
import { Monitor, Check } from 'lucide-react-native';

import { buildTournamentTvDisplayUrl } from '@/lib/display-service';
import { cn } from '@/lib/cn';

interface TournamentCopyTvLinkButtonProps {
  tournamentId: string;
  displayToken: string;
  compact?: boolean;
  className?: string;
}

export function TournamentCopyTvLinkButton({
  tournamentId,
  displayToken,
  compact = false,
  className,
}: TournamentCopyTvLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const url = buildTournamentTvDisplayUrl(tournamentId, displayToken);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    } else {
      Clipboard.setString(url);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    if (Platform.OS !== 'web') {
      Alert.alert('TV link copied', 'Open this URL on your clubhouse TV or cast from a browser tab.');
    }
  };

  return (
    <Pressable
      onPress={copyLink}
      className={cn(
        'flex-row items-center justify-center rounded-xl border active:opacity-80',
        compact ? 'px-3 py-2 border-neutral-700 bg-neutral-900' : 'px-4 py-3 border-lime-700/40 bg-lime-950/30',
        className
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
  );
}
