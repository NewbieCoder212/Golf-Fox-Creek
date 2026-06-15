import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, ImageIcon, Upload } from 'lucide-react-native';

import { TournamentTeamMatchupBoard } from '@/components/TournamentTeamMatchupBoard';
import {
  buildMatchPointsLeaderboard,
  getTournamentsResult,
  getTournamentTeams,
  updateTournamentTeam,
} from '@/lib/tournament-service';
import { getTeamBySide, getTournamentMatchGroups } from '@/lib/tournament-match-service';
import { pickTeamLogoImage, uploadTeamLogoImage } from '@/lib/team-logo-upload';
import { formatTournamentDates } from '@/lib/tournament-labels';
import type { TournamentTeam } from '@/types';

interface AdminEventTeamsSectionProps {
  accessToken: string;
  onBack: () => void;
}

function TeamLogoUploadCard({
  team,
  accessToken,
  onUploaded,
  uploading,
  onUploadStart,
}: {
  team: TournamentTeam;
  accessToken: string;
  onUploaded: () => void;
  uploading: boolean;
  onUploadStart: (teamId: string) => void;
}) {
  const handleUpload = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const uri = await pickTeamLogoImage();
      if (!uri) return;

      onUploadStart(team.id);
      const uploadResult = await uploadTeamLogoImage(accessToken, team.id, uri);
      if (uploadResult.error || !uploadResult.data) {
        Alert.alert('Upload failed', uploadResult.error ?? 'Could not upload logo.');
        onUploadStart('');
        return;
      }

      const updateResult = await updateTournamentTeam(team.id, { logo_url: uploadResult.data });
      if (updateResult.error) {
        Alert.alert('Save failed', updateResult.error);
        onUploadStart('');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUploaded();
      onUploadStart('');
    } catch (error) {
      onUploadStart('');
      Alert.alert(
        'Upload failed',
        error instanceof Error ? error.message : 'Could not upload team logo.'
      );
    }
  };

  const sideLabel = team.side === 'side_a' ? 'Team A' : team.side === 'side_b' ? 'Team B' : 'Team';

  return (
    <View className="bg-[#141414] rounded-2xl border border-neutral-800 p-4 mb-3">
      <Text className="text-lime-400 text-[10px] font-bold uppercase tracking-widest">{sideLabel}</Text>
      <Text className="text-white font-semibold text-base mt-1">{team.team_name}</Text>

      <View className="flex-row items-center mt-4 gap-4">
        {team.logo_url ? (
          <Image
            source={{ uri: team.logo_url }}
            className="w-16 h-16 rounded-full border border-neutral-700"
            resizeMode="cover"
          />
        ) : (
          <View className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 items-center justify-center">
            <ImageIcon size={22} color="#525252" />
          </View>
        )}

        <Pressable
          onPress={handleUpload}
          disabled={uploading}
          className="flex-1 flex-row items-center justify-center bg-lime-600 rounded-xl py-3 active:opacity-80"
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Upload size={16} color="#fff" />
              <Text className="text-white font-semibold ml-2">
                {team.logo_url ? 'Change Logo' : 'Upload Logo'}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export function AdminEventTeamsSection({ accessToken, onBack }: AdminEventTeamsSectionProps) {
  const queryClient = useQueryClient();
  const [uploadingTeamId, setUploadingTeamId] = useState('');

  const { data: tournaments = [], isLoading: tournamentsLoading } = useQuery({
    queryKey: ['adminEventTeamsTournaments'],
    queryFn: async () => {
      const result = await getTournamentsResult({ limit: 5 });
      return result.data ?? [];
    },
  });

  const activeTournament = tournaments[0] ?? null;
  const tournamentId = activeTournament?.id;

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['tournamentTeams', tournamentId],
    queryFn: () => getTournamentTeams(tournamentId!),
    enabled: Boolean(tournamentId),
  });

  const { data: matchGroups = [] } = useQuery({
    queryKey: ['tournamentMatchGroups', tournamentId],
    queryFn: () => getTournamentMatchGroups(tournamentId!),
    enabled: Boolean(tournamentId),
  });

  const sideA = getTeamBySide(teams, 'side_a');
  const sideB = getTeamBySide(teams, 'side_b');
  const standings = buildMatchPointsLeaderboard(teams, matchGroups);
  const teamStats = standings.map((row) => ({
    teamId: row.teamId,
    matchPoints: row.matchPoints,
    matchesWon: row.matchesWon,
  }));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tournamentTeams', tournamentId] });
    queryClient.invalidateQueries({ queryKey: ['adminLeaderboardTournament'] });
  };

  const isLoading = tournamentsLoading || teamsLoading;

  return (
    <View className="flex-1">
      <View className="flex-row items-center mb-4">
        <Pressable onPress={onBack} className="mr-3 p-1 active:opacity-70">
          <ArrowLeft size={22} color="#a3e635" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-white text-xl font-bold">Event Teams</Text>
          <Text className="text-neutral-500 text-sm">Upload logos & preview matchup</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator color="#a3e635" />
          </View>
        ) : !activeTournament ? (
          <Text className="text-neutral-500 text-sm text-center px-4">
            No active tournament. Create one from Tournaments first.
          </Text>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(400)} className="mb-4">
              <Text className="text-white font-semibold text-lg">{activeTournament.name}</Text>
              <Text className="text-neutral-500 text-sm mt-0.5">
                {formatTournamentDates(activeTournament.start_date, activeTournament.end_date)}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mb-5">
              <TournamentTeamMatchupBoard
                teams={teams}
                teamStats={teamStats}
                subtitle="Live matchup preview"
              />
            </Animated.View>

            <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-3">
              Team Logos
            </Text>

            {sideA ? (
              <TeamLogoUploadCard
                team={sideA}
                accessToken={accessToken}
                uploading={uploadingTeamId === sideA.id}
                onUploadStart={setUploadingTeamId}
                onUploaded={invalidate}
              />
            ) : (
              <Text className="text-neutral-500 text-sm mb-3">Team A not created yet.</Text>
            )}

            {sideB ? (
              <TeamLogoUploadCard
                team={sideB}
                accessToken={accessToken}
                uploading={uploadingTeamId === sideB.id}
                onUploadStart={setUploadingTeamId}
                onUploaded={invalidate}
              />
            ) : (
              <Text className="text-neutral-500 text-sm">Team B not created yet.</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
