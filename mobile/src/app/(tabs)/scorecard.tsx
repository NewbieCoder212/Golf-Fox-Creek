import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Coffee, RotateCcw, Trophy, Timer, Target, Save, X, Trash2, Home } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useScorecardStore } from '@/lib/scorecard-store';
import { SponsorBanner } from '@/components/SponsorBanner';
import { FoxCreekPaperScorecard } from '@/components/FoxCreekPaperScorecard';
import { ScorecardAssistPanel } from '@/components/ScorecardAssistPanel';
import { useMemberAuthStore } from '@/lib/member-auth-store';
import { cn } from '@/lib/cn';
import { calculateDistance } from '@/lib/geo';
import type { ScorecardTeeName } from '@/types';
import { scorecardTeeToDbTee } from '@/lib/scorecard-tees';
import { useTranslations } from '@/lib/language-store';
import { useTournamentScorecardSession } from '@/hooks/useTournamentScorecardSession';
import { TournamentScorecardToolbar } from '@/components/TournamentScorecardToolbar';
import type { TournamentTeamSide } from '@/types';

// Fox Creek Golf Club - Dieppe, NB, Canada
// GPS coordinates for each hole tee box
const HOLE_COORDINATES = [
  { hole: 1, lat: 46.0665, lng: -64.7314 },
  { hole: 2, lat: 46.0652, lng: -64.7302 },
  { hole: 3, lat: 46.0629, lng: -64.7296 },
  { hole: 4, lat: 46.0608, lng: -64.7281 },
  { hole: 5, lat: 46.0614, lng: -64.7246 },
  { hole: 6, lat: 46.0633, lng: -64.7229 },
  { hole: 7, lat: 46.0654, lng: -64.7241 },
  { hole: 8, lat: 46.0677, lng: -64.7266 },
  { hole: 9, lat: 46.0686, lng: -64.7291 },
  { hole: 10, lat: 46.0691, lng: -64.7321 },
  { hole: 11, lat: 46.0714, lng: -64.7346 },
  { hole: 12, lat: 46.0731, lng: -64.7361 },
  { hole: 13, lat: 46.0719, lng: -64.7386 },
  { hole: 14, lat: 46.0706, lng: -64.7411 },
  { hole: 15, lat: 46.0689, lng: -64.7424 },
  { hole: 16, lat: 46.0671, lng: -64.7404 },
  { hole: 17, lat: 46.0656, lng: -64.7381 },
  { hole: 18, lat: 46.0672, lng: -64.7356 },
];

// GPS coordinates for each hole's green (approximate centers)
// Green for hole N is where you finish hole N
const GREEN_COORDINATES = [
  { hole: 1, lat: 46.0656, lng: -64.7306 },
  { hole: 2, lat: 46.0635, lng: -64.7298 },
  { hole: 3, lat: 46.0615, lng: -64.7285 },
  { hole: 4, lat: 46.0610, lng: -64.7258 },
  { hole: 5, lat: 46.0628, lng: -64.7235 },
  { hole: 6, lat: 46.0648, lng: -64.7238 },
  { hole: 7, lat: 46.0670, lng: -64.7258 },
  { hole: 8, lat: 46.0682, lng: -64.7285 },
  { hole: 9, lat: 46.0689, lng: -64.7315 },
  { hole: 10, lat: 46.0708, lng: -64.7340 },
  { hole: 11, lat: 46.0725, lng: -64.7355 },
  { hole: 12, lat: 46.0724, lng: -64.7378 },
  { hole: 13, lat: 46.0712, lng: -64.7402 },
  { hole: 14, lat: 46.0694, lng: -64.7420 },
  { hole: 15, lat: 46.0676, lng: -64.7410 },
  { hole: 16, lat: 46.0662, lng: -64.7388 },
  { hole: 17, lat: 46.0668, lng: -64.7362 },
  { hole: 18, lat: 46.0665, lng: -64.7320 },
];

const FIFTEEN_MINUTES = 15 * 60; // seconds
const WARNING_THRESHOLD = 12 * 60; // 12 minutes - yellow warning

export default function ScorecardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTranslations();
  const { id: tournamentId, matchGroupId, round, side } = useLocalSearchParams<{
    id?: string;
    matchGroupId?: string;
    round?: string;
    side?: TournamentTeamSide;
  }>();
  const isTournamentMode = Boolean(tournamentId);

  const tournamentSession = useTournamentScorecardSession(
    tournamentId
      ? { id: tournamentId, matchGroupId, round, side }
      : null
  );
  const [locationPermission, setLocationPermission] = useState(false);
  const [playerTees, setPlayerTees] = useState<Record<string, ScorecardTeeName>>({});
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const overTimeHapticFired = useRef(false);

  const players = useScorecardStore((s) => s.players);
  const scores = useScorecardStore((s) => s.scores);
  const currentHole = useScorecardStore((s) => s.currentHole);
  const elapsedSeconds = useScorecardStore((s) => s.elapsedSeconds);
  const isTracking = useScorecardStore((s) => s.isTracking);
  const isTurnPaused = useScorecardStore((s) => s.isTurnPaused);
  const turnTimeRemaining = useScorecardStore((s) => s.turnTimeRemaining);
  const isScorePromptVisible = useScorecardStore((s) => s.isScorePromptVisible);
  const pendingHoleTransition = useScorecardStore((s) => s.pendingHoleTransition);
  const showResumePrompt = useScorecardStore((s) => s.showResumePrompt);
  const setPlayerName = useScorecardStore((s) => s.setPlayerName);
  const setScore = useScorecardStore((s) => s.setScore);
  const setCurrentHole = useScorecardStore((s) => s.setCurrentHole);
  const resetHoleTimer = useScorecardStore((s) => s.resetHoleTimer);
  const updateElapsedTime = useScorecardStore((s) => s.updateElapsedTime);
  const startTracking = useScorecardStore((s) => s.startTracking);
  const startTurn = useScorecardStore((s) => s.startTurn);
  const updateTurnTime = useScorecardStore((s) => s.updateTurnTime);
  const skipTurn = useScorecardStore((s) => s.skipTurn);
  const triggerHoleComplete = useScorecardStore((s) => s.triggerHoleComplete);
  const confirmScoreAndAdvance = useScorecardStore((s) => s.confirmScoreAndAdvance);
  const dismissScorePrompt = useScorecardStore((s) => s.dismissScorePrompt);
  const getRelativeToPar = useScorecardStore((s) => s.getRelativeToPar);
  const loadSavedRound = useScorecardStore((s) => s.loadSavedRound);
  const resumeRound = useScorecardStore((s) => s.resumeRound);
  const showRoundSummary = useScorecardStore((s) => s.showRoundSummary);
  const finishRound = useScorecardStore((s) => s.finishRound);
  const saveRoundToHistory = useScorecardStore((s) => s.saveRoundToHistory);
  const completeRound = useScorecardStore((s) => s.completeRound);
  const dismissRoundSummary = useScorecardStore((s) => s.dismissRoundSummary);
  const resetRound = useScorecardStore((s) => s.resetRound);
  const leaveForMainMenu = useScorecardStore((s) => s.leaveForMainMenu);
  const authUser = useMemberAuthStore((s) => s.user);
  const getTotalScore = useScorecardStore((s) => s.getTotalScore);
  const getCoursePar = useScorecardStore((s) => s.getCoursePar);
  const getTotalRoundTime = useScorecardStore((s) => s.getTotalRoundTime);
  const isRoundComplete = useScorecardStore((s) => s.isRoundComplete);

  const handleSaveRound = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const primaryTee = playerTees[String(players[0]?.id)] ?? 'White';
    const dbTee = scorecardTeeToDbTee(primaryTee);

    if (authUser?.id) {
      const result = await completeRound(authUser.id, dbTee, primaryTee);
      if (!result.success && result.error) {
        Alert.alert('Round Saved Locally', result.error);
      }
      return;
    }

    await saveRoundToHistory();
    await resetRound();
  };

  const handleDeleteRound = () => {
    Alert.alert(
      'Delete Round?',
      'All scores will be cleared and you will return to a blank scorecard. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Round',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await resetRound();
          },
        },
      ]
    );
  };

  const handleGoToMainMenu = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isTournamentMode) {
      if (tournamentSession.isDirty) {
        await tournamentSession.handleSync();
      } else {
        await tournamentSession.persistSession();
      }
    } else {
      await leaveForMainMenu();
    }
    router.push('/(tabs)/' as never);
  };

  const handleTournamentSync = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await tournamentSession.handleSync();
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Saved',
        tournamentSession.activeMatchGroup
          ? 'Scores synced. Match hole wins updated automatically.'
          : 'Tournament scores synced to Supabase.'
      );
      return;
    }
    Alert.alert('Save failed', result.error ?? 'Could not sync scores.');
  };

  const hasRoundProgress = useMemo(
    () => isTracking || scores.some((hole) => hole.scores.some((score) => score !== null)),
    [isTracking, scores]
  );

  // Check for saved round on mount (casual only)
  useEffect(() => {
    if (isTournamentMode) return;
    const checkSavedRound = async () => {
      try {
        await loadSavedRound();
      } catch (error) {
        console.log('Error checking saved round:', error);
      }
    };
    checkSavedRound();
  }, [isTournamentMode]);

  useEffect(() => {
    if (!isTracking || isTurnPaused) return;

    const interval = setInterval(() => {
      updateElapsedTime();
    }, 1000);

    return () => clearInterval(interval);
  }, [isTracking, isTurnPaused, updateElapsedTime]);

  // Turn countdown timer
  useEffect(() => {
    if (!isTurnPaused) return;

    const interval = setInterval(() => {
      updateTurnTime();
    }, 1000);

    return () => clearInterval(interval);
  }, [isTurnPaused, updateTurnTime]);

  const checkHoleTransition = useCallback((coords: { latitude: number; longitude: number }) => {
    // Skip if score prompt is already visible
    if (isScorePromptVisible) return;

    // Skip if turn is paused
    if (isTurnPaused) return;

    // Get the current hole's green coordinates (0-indexed array)
    const currentGreen = GREEN_COORDINATES[currentHole - 1];
    if (!currentGreen) return;

    // Calculate distance to current hole's green
    const distanceToGreen = calculateDistance(
      coords.latitude,
      coords.longitude,
      currentGreen.lat,
      currentGreen.lng
    );

    // If within 30 meters of the green, stop timer and prompt for score
    if (distanceToGreen < 30) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      triggerHoleComplete(currentHole);
    }
  }, [currentHole, isTurnPaused, isScorePromptVisible, triggerHoleComplete]);

  // GPS Location tracking
  useEffect(() => {
    let isMounted = true;

    const setupLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (!isMounted) return;
        setLocationPermission(status === 'granted');

        if (status === 'granted' && isTracking) {
          locationSubscription.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              distanceInterval: 15,
              timeInterval: 5000,
            },
            (location) => {
              if (isMounted && location?.coords) {
                checkHoleTransition(location.coords);
              }
            }
          );
        }
      } catch (error) {
        console.log('Location setup error:', error);
      }
    };

    setupLocation();

    return () => {
      isMounted = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, [isTracking, checkHoleTransition]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRound = () => {
    startTracking();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleScoreChange = (hole: number, playerId: number, increment: number) => {
    const holePar = scores[hole - 1]?.par ?? 4;
    const currentScore = scores[hole - 1]?.scores[playerId] ?? holePar;
    const newScore = Math.max(1, Math.min(15, currentScore + increment));
    setScore(hole, playerId, newScore);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const isOverTime = elapsedSeconds >= FIFTEEN_MINUTES;
  const isWarning = elapsedSeconds >= WARNING_THRESHOLD && !isOverTime;

  useEffect(() => {
    if (isOverTime && !overTimeHapticFired.current) {
      overTimeHapticFired.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (!isOverTime) {
      overTimeHapticFired.current = false;
    }
  }, [isOverTime]);

  const currentHoleData = scores[currentHole - 1];

  const paperPlayers = useMemo(
    () =>
      players.map((player) => ({
        id: String(player.id),
        name: player.name,
        tee: playerTees[String(player.id)] ?? 'White',
      })),
    [players, playerTees]
  );

  const paperScores = useMemo(() => {
    const map: Record<string, Record<number, number | null>> = {};
    players.forEach((player, index) => {
      map[String(player.id)] = {};
      scores.forEach((holeScore) => {
        map[String(player.id)][holeScore.hole] = holeScore.scores[index];
      });
    });
    return map;
  }, [players, scores]);

  const handlePaperScoreChange = (playerId: string, hole: number, score: number | null) => {
    const playerIndex = players.findIndex((p) => String(p.id) === playerId);
    if (playerIndex >= 0) {
      setScore(hole, playerIndex, score);
    }
  };

  const handlePaperNameChange = (playerId: string, name: string) => {
    const playerIndex = players.findIndex((p) => String(p.id) === playerId);
    if (playerIndex >= 0 && name.trim()) {
      setPlayerName(playerIndex, name.trim());
    }
  };

  const handlePaperTeeChange = (playerId: string, tee: ScorecardTeeName) => {
    setPlayerTees((prev) => ({ ...prev, [playerId]: tee }));
  };

  // Format turn time remaining
  const formatTurnTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isTournamentMode && tournamentSession.isLoading) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center">
        <ActivityIndicator color="#a3e635" />
      </View>
    );
  }

  const assistPanelProps = isTournamentMode
    ? {
        currentHole: tournamentSession.currentHole,
        holePar: tournamentSession.currentHolePar,
        elapsedSeconds: 0,
        isOverTime: false,
        isWarning: false,
        isTracking: false,
        locationPermission: false,
        players: tournamentSession.assistPlayers,
        holeScores: tournamentSession.currentHoleScores,
        onSetCurrentHole: tournamentSession.setCurrentHole,
        onScoreAdjust: tournamentSession.handleTournamentScoreAdjust,
        onTriggerHoleComplete: () => {},
        formatTime,
        getRelativeToPar: tournamentSession.getTournamentRelativeToPar,
      }
    : {
        currentHole,
        holePar: currentHoleData?.par ?? 4,
        elapsedSeconds,
        isOverTime,
        isWarning,
        isTracking,
        locationPermission,
        players,
        holeScores: currentHoleData?.scores ?? [],
        onSetCurrentHole: setCurrentHole,
        onScoreAdjust: (playerIndex: number, delta: number) =>
          handleScoreChange(currentHole, playerIndex, delta),
        onTriggerHoleComplete: () => triggerHoleComplete(currentHole),
        formatTime,
        getRelativeToPar,
        onDeleteRound: hasRoundProgress ? handleDeleteRound : undefined,
      };

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      {/* Resume Round Prompt */}
      {!isTournamentMode && showResumePrompt && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ paddingTop: insets.top }}
          className="absolute inset-0 z-50 bg-black/95"
        >
          <View className="flex-1 items-center justify-center px-6">
            <View className="bg-[#141414] rounded-2xl border border-neutral-800 w-full max-w-sm overflow-hidden">
              <View className="bg-lime-400/10 border-b border-neutral-800 p-6 items-center">
                <View className="w-16 h-16 rounded-full bg-lime-400/20 items-center justify-center mb-4">
                  <RotateCcw size={32} color="#a3e635" strokeWidth={1.5} />
                </View>
                <Text className="text-white text-xl font-bold text-center">
                  Unfinished Round Found
                </Text>
                <Text className="text-neutral-400 text-sm text-center mt-2">
                  Would you like to resume your previous round?
                </Text>
              </View>

              <View className="p-4 flex-row gap-3">
                <Pressable
                  onPress={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    await resetRound();
                  }}
                  className="flex-1 bg-neutral-800 rounded-xl py-4 items-center active:opacity-80"
                >
                  <Text className="text-neutral-300 font-medium">Delete & Start New</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    resumeRound();
                  }}
                  className="flex-1 bg-lime-400 rounded-xl py-4 items-center active:opacity-80"
                >
                  <Text className="text-black font-bold">Resume</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Score Prompt Modal */}
      {!isTournamentMode && isScorePromptVisible && pendingHoleTransition !== null && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ paddingTop: insets.top }}
          className="absolute inset-0 z-50 bg-black/90"
        >
          <View className="flex-1 items-center justify-center px-6">
            <View className="bg-[#141414] rounded-2xl border border-neutral-800 w-full max-w-sm overflow-hidden">
              <View className="bg-lime-400/10 border-b border-neutral-800 p-4 items-center">
                <Text className="text-lime-400 text-xs uppercase tracking-widest mb-1">
                  Hole Complete
                </Text>
                <Text className="text-white text-3xl font-bold">
                  Hole {pendingHoleTransition}
                </Text>
                <Text className="text-neutral-400 text-sm mt-1">
                  Par {scores[pendingHoleTransition - 1]?.par} • {formatTime(scores[pendingHoleTransition - 1]?.duration ?? 0)}
                </Text>
              </View>

              <View className="p-4">
                <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3 text-center">
                  Enter Scores
                </Text>
                {players.map((player, index) => {
                  const score = scores[pendingHoleTransition - 1]?.scores[index];
                  const holePar = scores[pendingHoleTransition - 1]?.par ?? 4;

                  return (
                    <View
                      key={player.id}
                      className={cn(
                        'flex-row items-center py-3',
                        index < players.length - 1 && 'border-b border-neutral-800/50'
                      )}
                    >
                      <View className="w-8 h-8 rounded-full bg-neutral-800 items-center justify-center mr-3">
                        <Text className="text-lime-400 font-bold text-xs">
                          {player.initials}
                        </Text>
                      </View>
                      <Text className="text-white font-medium flex-1">{player.name}</Text>

                      <View className="flex-row items-center">
                        <Pressable
                          onPress={() => {
                            const currentScore = score ?? holePar;
                            if (currentScore > 1) {
                              setScore(pendingHoleTransition, index, currentScore - 1);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }
                          }}
                          className="w-8 h-8 rounded-full bg-neutral-800 items-center justify-center active:bg-neutral-700"
                        >
                          <Text className="text-lime-400 text-lg font-bold">−</Text>
                        </Pressable>

                        <View className="w-12 items-center">
                          <Text
                            className={cn(
                              'text-2xl font-bold',
                              score === null
                                ? 'text-neutral-600'
                                : score === holePar
                                ? 'text-white'
                                : score < holePar
                                ? 'text-lime-400'
                                : 'text-red-400'
                            )}
                          >
                            {score ?? '–'}
                          </Text>
                        </View>

                        <Pressable
                          onPress={() => {
                            const currentScore = score ?? (holePar - 1);
                            if (currentScore < 15) {
                              setScore(pendingHoleTransition, index, currentScore + 1);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }
                          }}
                          className="w-8 h-8 rounded-full bg-neutral-800 items-center justify-center active:bg-neutral-700"
                        >
                          <Text className="text-lime-400 text-lg font-bold">+</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View className="p-4 pt-0 flex-row gap-3">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    dismissScorePrompt();
                  }}
                  className="flex-1 bg-neutral-800 rounded-xl py-3 items-center active:opacity-80"
                >
                  <Text className="text-neutral-300 font-medium">Skip</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    confirmScoreAndAdvance();
                  }}
                  className="flex-1 bg-lime-400 rounded-xl py-3 items-center active:opacity-80"
                >
                  <Text className="text-black font-bold">
                    {pendingHoleTransition === 18 ? 'Finish Round' : 'Next Hole'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Animated.View>
      )}

      {/* The Turn Overlay */}
      {!isTournamentMode && isTurnPaused && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ paddingTop: insets.top }}
          className="absolute inset-0 z-50 bg-[#0c0c0c]"
        >
          <View className="flex-1 items-center justify-center px-8">
            <View className="w-24 h-24 rounded-full bg-amber-500/20 items-center justify-center mb-6">
              <Coffee size={48} color="#f59e0b" strokeWidth={1.5} />
            </View>
            <Text className="text-white text-3xl font-bold text-center mb-2">
              Enjoy the Turn
            </Text>
            <Text className="text-neutral-400 text-center mb-2">
              Back 9 starts in...
            </Text>

            <Text className="text-amber-400 text-6xl font-mono font-bold mb-6">
              {formatTurnTime(turnTimeRemaining)}
            </Text>

            <View className="bg-[#141414] rounded-2xl border border-neutral-800 p-4 w-full items-center mb-6">
              <Text className="text-neutral-500 text-sm text-center">
                Grab a snack, refresh your drink, and get ready for the back nine
              </Text>
            </View>

            <SponsorBanner placementType="the_turn" className="w-full mb-6" />

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                skipTurn();
              }}
              className="bg-lime-400 rounded-xl py-4 px-8 active:opacity-80"
            >
              <Text className="text-black font-bold text-lg">Skip & Start Hole 10</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      <View style={{ paddingTop: insets.top }} className="bg-[#0c0c0c] border-b border-neutral-800">
        <View className="flex-row items-center justify-between px-4 py-2">
          <Pressable
            onPress={handleGoToMainMenu}
            className="flex-row items-center active:opacity-70"
          >
            <Home size={18} color="#a3e635" />
            <Text className="text-lime-400 font-semibold text-sm ml-2">{t.mainMenu}</Text>
          </Pressable>
          {!isTournamentMode && hasRoundProgress ? (
            <Text className="text-neutral-500 text-xs">
              Hole {currentHole}/18 · saved on exit
            </Text>
          ) : !isTournamentMode ? null : (
            <Text className="text-neutral-500 text-xs">
              Hole {tournamentSession.currentHole}/18 · saved on exit
            </Text>
          )}
        </View>
        {isTournamentMode && tournamentSession.tournament ? (
          <TournamentScorecardToolbar
            tournament={tournamentSession.tournament}
            roundNumber={tournamentSession.roundNumber}
            isDirty={tournamentSession.isDirty}
            teeTimeLabel={tournamentSession.matchTeeTimeLabel}
            onRoundChange={tournamentSession.handleRoundChange}
          />
        ) : null}
        <ScorecardAssistPanel {...assistPanelProps} />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          isTournamentMode ? { paddingBottom: insets.bottom + 100 } : undefined
        }
      >
        <View className="mx-4 mt-4">
          <SponsorBanner placementType="scorecard_header" />
        </View>

        <Animated.View entering={FadeIn.duration(400)} className="mx-4 mt-4">
          <FoxCreekPaperScorecard
            players={isTournamentMode ? tournamentSession.paperPlayers : paperPlayers}
            scores={isTournamentMode && tournamentSession.isTeamFormat ? {} : isTournamentMode ? tournamentSession.paperScores : paperScores}
            currentHole={isTournamentMode ? tournamentSession.currentHole : currentHole}
            onHoleSelect={isTournamentMode ? tournamentSession.setCurrentHole : setCurrentHole}
            onNameChange={isTournamentMode ? undefined : handlePaperNameChange}
            onTeeChange={isTournamentMode ? undefined : handlePaperTeeChange}
            onScoreChange={(playerId, hole, score) => {
              if (isTournamentMode) {
                if (score !== null) {
                  tournamentSession.setPlayerGross(playerId, hole, score);
                }
              } else {
                handlePaperScoreChange(playerId, hole, score);
              }
            }}
            netScores={
              isTournamentMode && !tournamentSession.isTeamFormat
                ? tournamentSession.paperNetScores
                : undefined
            }
            showNetColumn={isTournamentMode && !tournamentSession.isTeamFormat}
            teamMode={isTournamentMode && tournamentSession.isTeamFormat}
            teamLabel={tournamentSession.teamName ?? 'Team'}
            teamScores={isTournamentMode ? tournamentSession.teamGrossScores : undefined}
            onTeamScoreChange={
              isTournamentMode ? tournamentSession.setTeamGross : undefined
            }
            bestBallByHole={
              isTournamentMode ? tournamentSession.bestBallByHole : undefined
            }
          />
        </Animated.View>

        <View className="mx-4 mt-4">
          <SponsorBanner
            placementType="hole_sponsor"
            holeNumber={isTournamentMode ? tournamentSession.currentHole : currentHole}
          />
        </View>

        {/* Round actions */}
        {!isTournamentMode && hasRoundProgress && !showRoundSummary && (
          <View className="mx-5 mb-4 gap-3">
            {isTracking && !(currentHole === 18 && scores[17]?.scores.some((s) => s !== null)) && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  finishRound();
                }}
                className="bg-neutral-800 border border-neutral-700 rounded-xl py-3 items-center active:opacity-70"
              >
                <Text className="text-neutral-400 font-medium">End Round Early</Text>
              </Pressable>
            )}

            {isTracking && currentHole === 18 && scores[17]?.scores.some((s) => s !== null) && (
              <Pressable
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  finishRound();
                }}
                className="bg-lime-400 rounded-xl py-4 items-center active:opacity-80"
              >
                <Text className="text-black font-bold text-lg">Finish Round</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleDeleteRound}
              className="flex-row items-center justify-center border border-red-900/50 bg-red-950/30 rounded-xl py-3 active:opacity-70"
            >
              <Trash2 size={16} color="#f87171" />
              <Text className="text-red-400 font-medium ml-2">Delete Round</Text>
            </Pressable>
          </View>
        )}

        {!isTournamentMode && !hasRoundProgress && !showRoundSummary && (
          <View className="mx-5 mb-8">
            <Pressable
              onPress={handleStartRound}
              className="bg-lime-400 rounded-xl py-4 items-center active:opacity-80"
            >
              <Text className="text-black font-bold text-lg">Start Round</Text>
            </Pressable>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>

      {isTournamentMode ? (
        <View
          style={{ paddingBottom: insets.bottom + 12 }}
          className="absolute bottom-0 left-0 right-0 bg-[#141414] border-t border-neutral-800 px-5 pt-4"
        >
          <Pressable
            onPress={handleTournamentSync}
            disabled={tournamentSession.isSyncing}
            className="flex-row items-center justify-center bg-lime-600 rounded-xl py-4 active:opacity-80"
          >
            {tournamentSession.isSyncing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Save size={18} color="#fff" />
                <Text className="text-white font-bold text-base ml-2">Sync to Supabase</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}

      {/* Round Summary Modal */}
      {!isTournamentMode && showRoundSummary && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ paddingTop: insets.top }}
          className="absolute inset-0 z-50 bg-[#0c0c0c]"
        >
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View className="px-5 pt-6 pb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-neutral-500 text-xs uppercase tracking-widest">Round Complete</Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    dismissRoundSummary();
                  }}
                  className="p-2 -mr-2"
                >
                  <X size={20} color="#737373" />
                </Pressable>
              </View>
              <Text className="text-white text-3xl font-bold">Fox Creek</Text>
              <Text className="text-lime-400 text-lg">Round Summary</Text>
            </View>

            {/* Bento Box Grid */}
            <View className="px-5 mt-2">
              {/* Top Row - Big Stats */}
              <View className="flex-row gap-3 mb-3">
                {/* Total Score Box */}
                <Animated.View
                  entering={FadeInDown.delay(100).duration(400)}
                  className="flex-1 bg-[#141414] rounded-2xl border border-neutral-800 p-5"
                >
                  <View className="flex-row items-center mb-3">
                    <Trophy size={16} color="#a3e635" />
                    <Text className="text-neutral-500 text-xs uppercase tracking-widest ml-2">Total Score</Text>
                  </View>
                  <Text className="text-white text-5xl font-bold">{getTotalScore(0)}</Text>
                  <Text className="text-neutral-600 text-sm mt-1">strokes</Text>
                </Animated.View>

                {/* vs Par Box */}
                <Animated.View
                  entering={FadeInDown.delay(200).duration(400)}
                  className="flex-1 bg-[#141414] rounded-2xl border border-neutral-800 p-5"
                >
                  <View className="flex-row items-center mb-3">
                    <Target size={16} color="#a3e635" />
                    <Text className="text-neutral-500 text-xs uppercase tracking-widest ml-2">vs Par</Text>
                  </View>
                  {(() => {
                    const relPar = getRelativeToPar(0);
                    return (
                      <>
                        <Text className={cn(
                          'text-5xl font-bold',
                          relPar === 0 ? 'text-white' : relPar > 0 ? 'text-red-400' : 'text-lime-400'
                        )}>
                          {relPar === 0 ? 'E' : relPar > 0 ? `+${relPar}` : relPar}
                        </Text>
                        <Text className="text-neutral-600 text-sm mt-1">par {getCoursePar()}</Text>
                      </>
                    );
                  })()}
                </Animated.View>
              </View>

              {/* Time Box */}
              <Animated.View
                entering={FadeInDown.delay(300).duration(400)}
                className="bg-[#141414] rounded-2xl border border-neutral-800 p-5 mb-3"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Timer size={16} color="#a3e635" />
                    <Text className="text-neutral-500 text-xs uppercase tracking-widest ml-2">Round Time</Text>
                  </View>
                  {(() => {
                    const totalSeconds = getTotalRoundTime();
                    const hours = Math.floor(totalSeconds / 3600);
                    const mins = Math.floor((totalSeconds % 3600) / 60);
                    return (
                      <Text className="text-white text-2xl font-bold">
                        {hours > 0 ? `${hours}h ${mins}m` : `${mins} min`}
                      </Text>
                    );
                  })()}
                </View>
              </Animated.View>

              {/* Player Scores */}
              <Animated.View
                entering={FadeInDown.delay(400).duration(400)}
                className="bg-[#141414] rounded-2xl border border-neutral-800 overflow-hidden mb-3"
              >
                <View className="p-4 border-b border-neutral-800">
                  <Text className="text-neutral-500 text-xs uppercase tracking-widest">Final Scores</Text>
                </View>
                {players.map((player, index) => {
                  const total = getTotalScore(index);
                  const relPar = getRelativeToPar(index);
                  if (total === 0) return null;
                  return (
                    <View
                      key={player.id}
                      className={cn(
                        'flex-row items-center justify-between px-4 py-3',
                        index < players.length - 1 && 'border-b border-neutral-800/50'
                      )}
                    >
                      <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-full bg-neutral-800 items-center justify-center mr-3">
                          <Text className="text-lime-400 font-bold text-sm">{player.initials}</Text>
                        </View>
                        <Text className="text-white font-medium">{player.name}</Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-white text-xl font-bold">{total}</Text>
                        <Text className={cn(
                          'text-xs',
                          relPar === 0 ? 'text-neutral-500' : relPar > 0 ? 'text-red-400' : 'text-lime-400'
                        )}>
                          {relPar === 0 ? 'E' : relPar > 0 ? `+${relPar}` : relPar}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </Animated.View>

              {/* Front 9 / Back 9 Split */}
              <Animated.View
                entering={FadeInDown.delay(500).duration(400)}
                className="flex-row gap-3 mb-6"
              >
                <View className="flex-1 bg-[#141414] rounded-2xl border border-neutral-800 p-4">
                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">Front 9</Text>
                  <Text className="text-white text-2xl font-bold">
                    {scores.slice(0, 9).reduce((sum, h) => sum + (h.scores[0] ?? 0), 0) || '–'}
                  </Text>
                </View>
                <View className="flex-1 bg-[#141414] rounded-2xl border border-neutral-800 p-4">
                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">Back 9</Text>
                  <Text className="text-white text-2xl font-bold">
                    {scores.slice(9, 18).reduce((sum, h) => sum + (h.scores[0] ?? 0), 0) || '–'}
                  </Text>
                </View>
              </Animated.View>

              {/* Action Buttons */}
              <Animated.View entering={FadeInDown.delay(600).duration(400)}>
                <Pressable
                  onPress={handleSaveRound}
                  className="bg-lime-400 rounded-xl py-4 flex-row items-center justify-center mb-3 active:opacity-80"
                >
                  <Save size={20} color="black" />
                  <Text className="text-black font-bold text-lg ml-2">Save to History</Text>
                </Pressable>

                <Pressable
                  onPress={handleDeleteRound}
                  className="flex-row items-center justify-center bg-neutral-800 rounded-xl py-4 mb-3 active:opacity-80"
                >
                  <Trash2 size={18} color="#f87171" />
                  <Text className="text-red-400 font-medium ml-2">Delete Round & Return to Scorecard</Text>
                </Pressable>
              </Animated.View>
            </View>

            <View className="h-12" />
          </ScrollView>
        </Animated.View>
      )}

    </View>
  );
}
