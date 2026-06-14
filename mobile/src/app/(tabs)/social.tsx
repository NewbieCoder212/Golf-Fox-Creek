import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Trophy,
  Users,
  Swords,
  ChevronRight,
  Calendar,
  Clock,
  User,
  Target,
  Medal,
  Send,
  X,
  Check,
  MessageSquare,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  getLeaderboard,
  getLookingForGame,
  postLookingForGame,
  cancelLookingForGame,
  getUserLookingForGame,
  getUserChallenges,
  createChallenge,
  respondToChallenge,
  getMembersForChallenge,
} from '@/lib/social-service';
import type {
  LeaderboardPeriod,
  LeaderboardScoreType,
  LeaderboardEntry,
  LookingForGame,
  Challenge,
} from '@/types';

// Mock user ID - in production this would come from auth
const MOCK_USER_ID = 'demo-user-001';

type SocialSection = 'leaderboard' | 'findPartner' | 'challenges';

export default function SocialScreen() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<SocialSection>('leaderboard');
  const [refreshing, setRefreshing] = useState(false);

  // Leaderboard state
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [scoreType, setScoreType] = useState<LeaderboardScoreType>('gross');

  // Find Partner state
  const [showPostForm, setShowPostForm] = useState(false);
  const [partnerDate, setPartnerDate] = useState('');
  const [partnerTime, setPartnerTime] = useState<'morning' | 'midday' | 'afternoon' | 'any'>('any');
  const [partnerNotes, setPartnerNotes] = useState('');

  // Challenge state
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null);
  const [challengeType, setChallengeType] = useState<'gross' | 'net'>('net');
  const [challengeMessage, setChallengeMessage] = useState('');

  // Queries
  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['leaderboard', period, scoreType],
    queryFn: () => getLeaderboard(period, scoreType),
  });

  const { data: lookingForGame, isLoading: lfgLoading } = useQuery({
    queryKey: ['lookingForGame'],
    queryFn: getLookingForGame,
  });

  const { data: myPost } = useQuery({
    queryKey: ['myLookingForGame', MOCK_USER_ID],
    queryFn: () => getUserLookingForGame(MOCK_USER_ID),
  });

  const { data: challenges, isLoading: challengesLoading } = useQuery({
    queryKey: ['challenges', MOCK_USER_ID],
    queryFn: () => getUserChallenges(MOCK_USER_ID),
  });

  const { data: members } = useQuery({
    queryKey: ['membersForChallenge'],
    queryFn: getMembersForChallenge,
  });

  // Mutations
  const postLfgMutation = useMutation({
    mutationFn: postLookingForGame,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookingForGame'] });
      queryClient.invalidateQueries({ queryKey: ['myLookingForGame'] });
      setShowPostForm(false);
      setPartnerDate('');
      setPartnerNotes('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const cancelLfgMutation = useMutation({
    mutationFn: cancelLookingForGame,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookingForGame'] });
      queryClient.invalidateQueries({ queryKey: ['myLookingForGame'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const createChallengeMutation = useMutation({
    mutationFn: createChallenge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      setShowChallengeForm(false);
      setSelectedOpponent(null);
      setChallengeMessage('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const respondChallengeMutation = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      respondToChallenge(id, accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient]);

  const handlePostLookingForGame = () => {
    if (!partnerDate) return;

    postLfgMutation.mutate({
      user_id: MOCK_USER_ID,
      preferred_date: partnerDate,
      preferred_time: partnerTime,
      notes: partnerNotes || undefined,
    });
  };

  const handleCreateChallenge = () => {
    if (!selectedOpponent) return;

    const today = new Date().toISOString().split('T')[0];

    createChallengeMutation.mutate({
      challenger_id: MOCK_USER_ID,
      challenged_id: selectedOpponent,
      round_date: today,
      challenge_type: challengeType,
      message: challengeMessage || undefined,
    });
  };

  const renderSectionTabs = () => (
    <View className="flex-row mx-5 mb-4 bg-[#141414] rounded-xl p-1 border border-neutral-800">
      {[
        { key: 'leaderboard' as const, label: 'Leaderboard', Icon: Trophy },
        { key: 'findPartner' as const, label: 'Find Partner', Icon: Users },
        { key: 'challenges' as const, label: 'Challenges', Icon: Swords },
      ].map(({ key, label, Icon }) => (
        <Pressable
          key={key}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveSection(key);
          }}
          className={`flex-1 py-2.5 rounded-lg items-center flex-row justify-center gap-1.5 ${
            activeSection === key ? 'bg-lime-600' : ''
          }`}
        >
          <Icon
            size={16}
            color={activeSection === key ? '#fff' : '#737373'}
          />
          <Text
            className={`text-xs font-medium ${
              activeSection === key ? 'text-white' : 'text-neutral-500'
            }`}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const renderLeaderboard = () => (
    <Animated.View entering={FadeIn.duration(300)}>
      {/* Period & Score Type Filters */}
      <View className="mx-5 mb-4">
        <View className="flex-row gap-2 mb-3">
          {(['weekly', 'monthly', 'all_time'] as LeaderboardPeriod[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPeriod(p);
              }}
              className={`flex-1 py-2 rounded-lg border items-center ${
                period === p
                  ? 'bg-neutral-800 border-lime-600'
                  : 'bg-[#141414] border-neutral-800'
              }`}
            >
              <Text
                className={`text-xs font-medium capitalize ${
                  period === p ? 'text-lime-400' : 'text-neutral-500'
                }`}
              >
                {p.replace('_', ' ')}
              </Text>
            </Pressable>
          ))}
        </View>
        <View className="flex-row gap-2">
          {(['gross', 'net'] as LeaderboardScoreType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setScoreType(t);
              }}
              className={`flex-1 py-2 rounded-lg border items-center ${
                scoreType === t
                  ? 'bg-neutral-800 border-lime-600'
                  : 'bg-[#141414] border-neutral-800'
              }`}
            >
              <Text
                className={`text-sm font-medium capitalize ${
                  scoreType === t ? 'text-lime-400' : 'text-neutral-500'
                }`}
              >
                {t} Score
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Leaderboard List */}
      {leaderboardLoading ? (
        <View className="items-center py-8">
          <ActivityIndicator color="#a3e635" />
        </View>
      ) : (
        <View className="mx-5">
          {leaderboard?.map((entry, index) => (
            <Animated.View
              key={entry.user_id}
              entering={FadeInDown.delay(index * 50).duration(300)}
            >
              <View className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mb-3 flex-row items-center">
                {/* Rank */}
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${
                    index === 0
                      ? 'bg-amber-900/50'
                      : index === 1
                      ? 'bg-neutral-600/50'
                      : index === 2
                      ? 'bg-orange-900/50'
                      : 'bg-neutral-800'
                  }`}
                >
                  {index < 3 ? (
                    <Medal
                      size={20}
                      color={
                        index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : '#f97316'
                      }
                    />
                  ) : (
                    <Text className="text-neutral-400 font-bold">{index + 1}</Text>
                  )}
                </View>

                {/* Player Info */}
                <View className="flex-1">
                  <Text className="text-white font-medium">{entry.full_name}</Text>
                  <View className="flex-row items-center mt-1">
                    <Target size={12} color="#737373" />
                    <Text className="text-neutral-500 text-xs ml-1">
                      HCP: {entry.handicap_index?.toFixed(1) ?? 'N/A'}
                    </Text>
                    <Text className="text-neutral-600 mx-2">•</Text>
                    <Text className="text-neutral-500 text-xs">
                      {entry.rounds_played} round{entry.rounds_played !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {/* Score */}
                <View className="items-end">
                  <Text className="text-lime-400 text-xl font-bold">
                    {scoreType === 'gross' ? entry.best_gross : entry.best_net}
                  </Text>
                  <Text className="text-neutral-500 text-xs">
                    Best {scoreType}
                  </Text>
                </View>
              </View>
            </Animated.View>
          ))}
        </View>
      )}
    </Animated.View>
  );

  const renderFindPartner = () => (
    <Animated.View entering={FadeIn.duration(300)}>
      {/* My Post or Post Button */}
      <View className="mx-5 mb-4">
        {myPost ? (
          <View className="bg-lime-900/30 border border-lime-700/50 rounded-xl p-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-lime-300 font-medium">Your Post is Active</Text>
                <Text className="text-lime-400/70 text-sm mt-1">
                  {new Date(myPost.preferred_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  • {myPost.preferred_time}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  cancelLfgMutation.mutate(myPost.id);
                }}
                className="bg-red-900/50 px-4 py-2 rounded-lg active:opacity-70"
              >
                <Text className="text-red-300 font-medium">Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : showPostForm ? (
          <View className="bg-[#141414] border border-neutral-800 rounded-xl p-4">
            <Text className="text-white font-medium mb-4">Post Looking for Game</Text>

            {/* Date Input */}
            <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2">
              Preferred Date
            </Text>
            <TextInput
              value={partnerDate}
              onChangeText={setPartnerDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#525252"
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white mb-4"
            />

            {/* Time Preference */}
            <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2">
              Preferred Time
            </Text>
            <View className="flex-row gap-2 mb-4">
              {(['morning', 'midday', 'afternoon', 'any'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setPartnerTime(t)}
                  className={`flex-1 py-2 rounded-lg border items-center ${
                    partnerTime === t
                      ? 'bg-neutral-800 border-lime-600'
                      : 'bg-neutral-900 border-neutral-700'
                  }`}
                >
                  <Text
                    className={`text-xs capitalize ${
                      partnerTime === t ? 'text-lime-400' : 'text-neutral-500'
                    }`}
                  >
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Notes */}
            <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2">
              Notes (optional)
            </Text>
            <TextInput
              value={partnerNotes}
              onChangeText={setPartnerNotes}
              placeholder="e.g., Walking preferred, 9 holes only..."
              placeholderTextColor="#525252"
              multiline
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white mb-4 min-h-[80px]"
              textAlignVertical="top"
            />

            {/* Actions */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowPostForm(false)}
                className="flex-1 bg-neutral-800 py-3 rounded-lg items-center active:opacity-70"
              >
                <Text className="text-neutral-300 font-medium">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handlePostLookingForGame}
                disabled={!partnerDate || postLfgMutation.isPending}
                className={`flex-1 py-3 rounded-lg items-center ${
                  partnerDate ? 'bg-lime-600 active:bg-lime-700' : 'bg-neutral-700'
                }`}
              >
                {postLfgMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-medium">Post</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowPostForm(true);
            }}
            className="bg-lime-600 rounded-xl py-4 items-center active:bg-lime-700"
          >
            <Text className="text-white font-semibold">Post Looking for Game</Text>
          </Pressable>
        )}
      </View>

      {/* Available Partners List */}
      {lfgLoading ? (
        <View className="items-center py-8">
          <ActivityIndicator color="#a3e635" />
        </View>
      ) : lookingForGame && lookingForGame.length > 0 ? (
        <View className="mx-5">
          <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-3">
            Members Looking for Game
          </Text>
          {lookingForGame.map((post, index) => (
            <Animated.View
              key={post.id}
              entering={FadeInDown.delay(index * 50).duration(300)}
            >
              <View className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mb-3">
                <View className="flex-row items-start justify-between">
                  <View className="flex-row items-center">
                    <View className="w-12 h-12 bg-neutral-800 rounded-full items-center justify-center mr-3">
                      <User size={20} color="#737373" />
                    </View>
                    <View>
                      <Text className="text-white font-medium">{post.full_name}</Text>
                      <View className="flex-row items-center mt-1">
                        <Target size={12} color="#a3e635" />
                        <Text className="text-lime-400 text-xs ml-1">
                          {post.handicap_index?.toFixed(1) ?? 'N/A'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View className="items-end">
                    <View className="flex-row items-center">
                      <Calendar size={12} color="#737373" />
                      <Text className="text-neutral-400 text-xs ml-1">
                        {new Date(post.preferred_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>
                    <View className="flex-row items-center mt-1">
                      <Clock size={12} color="#737373" />
                      <Text className="text-neutral-400 text-xs ml-1 capitalize">
                        {post.preferred_time}
                      </Text>
                    </View>
                  </View>
                </View>
                {post.notes && (
                  <Text className="text-neutral-500 text-sm mt-3 italic">
                    "{post.notes}"
                  </Text>
                )}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    // TODO: Open contact/message flow
                  }}
                  className="mt-3 bg-neutral-800 py-2.5 rounded-lg items-center active:opacity-70"
                >
                  <Text className="text-lime-400 font-medium">Contact</Text>
                </Pressable>
              </View>
            </Animated.View>
          ))}
        </View>
      ) : (
        <View className="mx-5 bg-[#141414] rounded-xl border border-neutral-800 p-8 items-center">
          <Users size={40} color="#525252" />
          <Text className="text-neutral-500 text-sm mt-4">No one looking for a game</Text>
          <Text className="text-neutral-600 text-xs mt-1">Be the first to post!</Text>
        </View>
      )}
    </Animated.View>
  );

  const renderChallenges = () => (
    <Animated.View entering={FadeIn.duration(300)}>
      {/* Create Challenge Button or Form */}
      <View className="mx-5 mb-4">
        {showChallengeForm ? (
          <View className="bg-[#141414] border border-neutral-800 rounded-xl p-4">
            <Text className="text-white font-medium mb-4">Challenge a Friend</Text>

            {/* Opponent Selection */}
            <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2">
              Select Opponent
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
              style={{ flexGrow: 0 }}
            >
              {members
                ?.filter((m) => m.id !== MOCK_USER_ID)
                .map((member) => (
                  <Pressable
                    key={member.id}
                    onPress={() => setSelectedOpponent(member.id)}
                    className={`mr-2 px-4 py-2 rounded-lg border ${
                      selectedOpponent === member.id
                        ? 'bg-lime-900/30 border-lime-600'
                        : 'bg-neutral-900 border-neutral-700'
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        selectedOpponent === member.id ? 'text-lime-400' : 'text-neutral-300'
                      }`}
                    >
                      {member.full_name}
                    </Text>
                    <Text className="text-neutral-500 text-xs">
                      HCP: {member.handicap_index?.toFixed(1) ?? 'N/A'}
                    </Text>
                  </Pressable>
                ))}
            </ScrollView>

            {/* Challenge Type */}
            <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2">
              Challenge Type
            </Text>
            <View className="flex-row gap-2 mb-4">
              {(['gross', 'net'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setChallengeType(t)}
                  className={`flex-1 py-2 rounded-lg border items-center ${
                    challengeType === t
                      ? 'bg-neutral-800 border-lime-600'
                      : 'bg-neutral-900 border-neutral-700'
                  }`}
                >
                  <Text
                    className={`text-sm capitalize ${
                      challengeType === t ? 'text-lime-400' : 'text-neutral-500'
                    }`}
                  >
                    {t} Score
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Message */}
            <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2">
              Message (optional)
            </Text>
            <TextInput
              value={challengeMessage}
              onChangeText={setChallengeMessage}
              placeholder="Add a friendly message..."
              placeholderTextColor="#525252"
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white mb-4"
            />

            {/* Actions */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setShowChallengeForm(false);
                  setSelectedOpponent(null);
                }}
                className="flex-1 bg-neutral-800 py-3 rounded-lg items-center active:opacity-70"
              >
                <Text className="text-neutral-300 font-medium">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateChallenge}
                disabled={!selectedOpponent || createChallengeMutation.isPending}
                className={`flex-1 py-3 rounded-lg items-center flex-row justify-center gap-2 ${
                  selectedOpponent ? 'bg-lime-600 active:bg-lime-700' : 'bg-neutral-700'
                }`}
              >
                {createChallengeMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Send size={16} color="#fff" />
                    <Text className="text-white font-medium">Send</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowChallengeForm(true);
            }}
            className="bg-lime-600 rounded-xl py-4 items-center flex-row justify-center gap-2 active:bg-lime-700"
          >
            <Swords size={18} color="#fff" />
            <Text className="text-white font-semibold">Challenge a Friend</Text>
          </Pressable>
        )}
      </View>

      {/* Challenges List */}
      {challengesLoading ? (
        <View className="items-center py-8">
          <ActivityIndicator color="#a3e635" />
        </View>
      ) : challenges && challenges.length > 0 ? (
        <View className="mx-5">
          <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-3">
            Your Challenges
          </Text>
          {challenges.map((challenge, index) => (
            <Animated.View
              key={challenge.id}
              entering={FadeInDown.delay(index * 50).duration(300)}
            >
              <ChallengeCard
                challenge={challenge}
                currentUserId={MOCK_USER_ID}
                onRespond={(accept) =>
                  respondChallengeMutation.mutate({ id: challenge.id, accept })
                }
              />
            </Animated.View>
          ))}
        </View>
      ) : (
        <View className="mx-5 bg-[#141414] rounded-xl border border-neutral-800 p-8 items-center">
          <Swords size={40} color="#525252" />
          <Text className="text-neutral-500 text-sm mt-4">No active challenges</Text>
          <Text className="text-neutral-600 text-xs mt-1">
            Challenge a friend to compete!
          </Text>
        </View>
      )}
    </Animated.View>
  );

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a3e635" />
          }
        >
          {/* Header */}
          <View className="px-5 py-4">
            <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em]">
              Fox Creek
            </Text>
            <Text className="text-white text-2xl font-bold mt-1">Social</Text>
          </View>

          {/* Section Tabs */}
          {renderSectionTabs()}

          {/* Content */}
          {activeSection === 'leaderboard' && renderLeaderboard()}
          {activeSection === 'findPartner' && renderFindPartner()}
          {activeSection === 'challenges' && renderChallenges()}

          <View className="h-8" />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// Challenge Card Component
function ChallengeCard({
  challenge,
  currentUserId,
  onRespond,
}: {
  challenge: Challenge;
  currentUserId: string;
  onRespond: (accept: boolean) => void;
}) {
  const isChallenger = challenge.challenger_id === currentUserId;
  const opponentName = isChallenger ? challenge.challenged_name : challenge.challenger_name;
  const myScore = isChallenger ? challenge.challenger_score : challenge.challenged_score;
  const theirScore = isChallenger ? challenge.challenged_score : challenge.challenger_score;

  const getStatusColor = () => {
    switch (challenge.status) {
      case 'pending':
        return 'bg-amber-900/30 border-amber-700/50';
      case 'accepted':
        return 'bg-blue-900/30 border-blue-700/50';
      case 'completed':
        return challenge.winner_id === currentUserId
          ? 'bg-lime-900/30 border-lime-700/50'
          : 'bg-red-900/30 border-red-700/50';
      case 'declined':
      case 'expired':
        return 'bg-neutral-800 border-neutral-700';
      default:
        return 'bg-[#141414] border-neutral-800';
    }
  };

  const getStatusLabel = () => {
    switch (challenge.status) {
      case 'pending':
        return isChallenger ? 'Waiting for response' : 'Challenge received';
      case 'accepted':
        return 'In progress';
      case 'completed':
        if (challenge.winner_id === currentUserId) return 'You won!';
        if (challenge.winner_id) return 'You lost';
        return 'Tie';
      case 'declined':
        return 'Declined';
      case 'expired':
        return 'Expired';
      default:
        return challenge.status;
    }
  };

  return (
    <View className={`rounded-xl border p-4 mb-3 ${getStatusColor()}`}>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Swords size={16} color="#a3e635" />
          <Text className="text-white font-medium ml-2">vs {opponentName}</Text>
        </View>
        <View className="bg-neutral-800/50 px-2 py-1 rounded">
          <Text className="text-neutral-400 text-xs capitalize">
            {challenge.challenge_type}
          </Text>
        </View>
      </View>

      {challenge.message && (
        <View className="flex-row items-start mb-3">
          <MessageSquare size={14} color="#737373" />
          <Text className="text-neutral-500 text-sm ml-2 flex-1 italic">
            "{challenge.message}"
          </Text>
        </View>
      )}

      {/* Scores */}
      {(myScore !== null || theirScore !== null) && (
        <View className="flex-row items-center justify-center gap-8 py-3 bg-neutral-900/50 rounded-lg mb-3">
          <View className="items-center">
            <Text className="text-neutral-500 text-xs">You</Text>
            <Text className="text-white text-2xl font-bold">
              {myScore ?? '-'}
            </Text>
          </View>
          <Text className="text-neutral-600 text-lg">vs</Text>
          <View className="items-center">
            <Text className="text-neutral-500 text-xs">{opponentName}</Text>
            <Text className="text-white text-2xl font-bold">
              {theirScore ?? '-'}
            </Text>
          </View>
        </View>
      )}

      {/* Status */}
      <Text className="text-neutral-400 text-xs text-center mb-3">
        {getStatusLabel()}
      </Text>

      {/* Actions */}
      {challenge.status === 'pending' && !isChallenger && (
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onRespond(false);
            }}
            className="flex-1 bg-neutral-800 py-2.5 rounded-lg items-center flex-row justify-center gap-2 active:opacity-70"
          >
            <X size={16} color="#ef4444" />
            <Text className="text-red-400 font-medium">Decline</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onRespond(true);
            }}
            className="flex-1 bg-lime-600 py-2.5 rounded-lg items-center flex-row justify-center gap-2 active:bg-lime-700"
          >
            <Check size={16} color="#fff" />
            <Text className="text-white font-medium">Accept</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
