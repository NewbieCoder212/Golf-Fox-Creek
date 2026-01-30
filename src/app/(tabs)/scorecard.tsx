import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, MapPin, Clock, AlertTriangle, Coffee, RotateCcw, Flag, Trophy, Timer, Target, Save, X } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolateColor,
  Easing
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useScorecardStore } from '@/lib/scorecard-store';
import { cn } from '@/lib/cn';
import { calculateDistance } from '@/lib/geo';

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
  const [locationPermission, setLocationPermission] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<number | null>(null);
  const [playerNameInput, setPlayerNameInput] = useState('');
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
  const discardSavedRound = useScorecardStore((s) => s.discardSavedRound);
  const showRoundSummary = useScorecardStore((s) => s.showRoundSummary);
  const finishRound = useScorecardStore((s) => s.finishRound);
  const saveRoundToHistory = useScorecardStore((s) => s.saveRoundToHistory);
  const dismissRoundSummary = useScorecardStore((s) => s.dismissRoundSummary);
  const resetRound = useScorecardStore((s) => s.resetRound);
  const getTotalScore = useScorecardStore((s) => s.getTotalScore);
  const getCoursePar = useScorecardStore((s) => s.getCoursePar);
  const getTotalRoundTime = useScorecardStore((s) => s.getTotalRoundTime);
  const isRoundComplete = useScorecardStore((s) => s.isRoundComplete);

  // Check for saved round on mount
  useEffect(() => {
    const checkSavedRound = async () => {
      try {
        await loadSavedRound();
      } catch (error) {
        console.log('Error checking saved round:', error);
      }
    };
    checkSavedRound();
  }, []);

  // Animation for warning state
  const pulseAnim = useSharedValue(0);
  const isOverTime = elapsedSeconds >= FIFTEEN_MINUTES;
  const isWarning = elapsedSeconds >= WARNING_THRESHOLD && !isOverTime;

  // Handle overtime - turn status bar red and send haptic vibrate
  useEffect(() => {
    if (isOverTime) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      // Only fire haptic once when first going overtime
      if (!overTimeHapticFired.current) {
        overTimeHapticFired.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } else {
      pulseAnim.value = 0;
      overTimeHapticFired.current = false;
    }
  }, [isOverTime]);

  const tempoBarStyle = useAnimatedStyle(() => {
    if (isOverTime) {
      const backgroundColor = interpolateColor(
        pulseAnim.value,
        [0, 1],
        ['#dc2626', '#991b1b']
      );
      return { backgroundColor };
    }
    return {};
  });

  // Timer effect
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
    const currentScore = scores[hole - 1]?.scores[playerId] ?? 0;
    const newScore = Math.max(1, Math.min(15, currentScore + increment));
    setScore(hole, playerId, newScore);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePlayerNameEdit = (playerId: number) => {
    setEditingPlayer(playerId);
    setPlayerNameInput(players[playerId]?.name ?? '');
  };

  const handlePlayerNameSave = () => {
    if (editingPlayer !== null && playerNameInput.trim()) {
      setPlayerName(editingPlayer, playerNameInput.trim());
    }
    setEditingPlayer(null);
    setPlayerNameInput('');
  };

  const currentHoleData = scores[currentHole - 1];

  // Format turn time remaining
  const formatTurnTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      {/* Resume Round Prompt */}
      {showResumePrompt && (
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
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    discardSavedRound();
                  }}
                  className="flex-1 bg-neutral-800 rounded-xl py-4 items-center active:opacity-80"
                >
                  <Text className="text-neutral-300 font-medium">Start New</Text>
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
      {isScorePromptVisible && pendingHoleTransition !== null && (
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
      {isTurnPaused && (
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

            <View className="bg-[#141414] rounded-2xl border border-neutral-800 p-4 w-full items-center mb-8">
              <Text className="text-neutral-500 text-sm text-center">
                Grab a snack, refresh your drink, and get ready for the back nine
              </Text>
            </View>

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

      {/* Tempo Tracker Bar */}
      <Animated.View
        style={[
          {
            paddingTop: insets.top,
            backgroundColor: isOverTime ? '#dc2626' : isWarning ? '#ca8a04' : '#1a1a1a',
          },
          isOverTime ? tempoBarStyle : {},
        ]}
      >
        <View className="px-5 py-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            {isOverTime ? (
              <AlertTriangle size={18} color="#fff" />
            ) : (
              <Clock size={18} color={isWarning ? '#fef3c7' : '#a3e635'} />
            )}
            <Text
              className={cn(
                'ml-2 font-mono text-lg font-bold',
                isOverTime ? 'text-white' : isWarning ? 'text-amber-100' : 'text-lime-400'
              )}
            >
              {formatTime(elapsedSeconds)}
            </Text>
          </View>

          <View className="flex-row items-center">
            {isTracking && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  triggerHoleComplete(currentHole);
                }}
                className="flex-row items-center bg-neutral-800/80 px-2 py-1 rounded-lg mr-3 active:opacity-60"
              >
                <Flag size={12} color="#737373" />
                <Text className="text-neutral-500 text-xs ml-1">Advance</Text>
              </Pressable>
            )}
            <View className="flex-row items-center mr-4">
              <MapPin size={14} color={locationPermission ? '#a3e635' : '#525252'} />
              <Text className="text-neutral-500 text-xs ml-1">
                {locationPermission ? 'GPS Active' : 'GPS Off'}
              </Text>
            </View>
            <Text className="text-neutral-400 text-sm">
              Hole <Text className="text-white font-bold">{currentHole}</Text>/18
            </Text>
          </View>
        </View>

        {isOverTime && (
          <View className="bg-red-900/50 px-5 py-2">
            <Text className="text-red-200 text-xs text-center font-medium">
              Pace Alert: Please pick up the pace to maintain course flow
            </Text>
          </View>
        )}
      </Animated.View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Current Hole Card */}
        <Animated.View entering={FadeIn.duration(400)} className="mx-5 mt-5">
          <View className="bg-[#141414] rounded-2xl border border-neutral-800 overflow-hidden">
            {/* Hole Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-neutral-800">
              <Pressable
                onPress={() => currentHole > 1 && setCurrentHole(currentHole - 1)}
                disabled={currentHole === 1}
                className="p-2 active:opacity-50"
              >
                <ChevronLeft size={24} color={currentHole === 1 ? '#404040' : '#a3e635'} />
              </Pressable>

              <View className="items-center">
                <Text className="text-neutral-500 text-xs uppercase tracking-widest">Hole</Text>
                <Text className="text-white text-4xl font-bold">{currentHole}</Text>
                <Text className="text-lime-400 text-sm font-medium">
                  Par {currentHoleData?.par}
                </Text>
              </View>

              <Pressable
                onPress={() => currentHole < 18 && setCurrentHole(currentHole + 1)}
                disabled={currentHole === 18}
                className="p-2 active:opacity-50"
              >
                <ChevronRight size={24} color={currentHole === 18 ? '#404040' : '#a3e635'} />
              </Pressable>
            </View>

            {/* Score Grid */}
            <View className="p-4">
              {players.map((player, index) => {
                const score = currentHoleData?.scores[index];
                const relativeToPar = getRelativeToPar(index);

                return (
                  <View
                    key={player.id}
                    className={cn(
                      'flex-row items-center py-3',
                      index < players.length - 1 && 'border-b border-neutral-800/50'
                    )}
                  >
                    {/* Player Info */}
                    <Pressable
                      onPress={() => handlePlayerNameEdit(index)}
                      className="flex-row items-center flex-1 active:opacity-70"
                    >
                      <View className="w-10 h-10 rounded-full bg-neutral-800 items-center justify-center mr-3">
                        <Text className="text-lime-400 font-bold text-sm">
                          {player.initials}
                        </Text>
                      </View>
                      <View>
                        <Text className="text-white font-medium">{player.name}</Text>
                        <Text
                          className={cn(
                            'text-xs',
                            relativeToPar === 0
                              ? 'text-neutral-500'
                              : relativeToPar > 0
                              ? 'text-red-400'
                              : 'text-lime-400'
                          )}
                        >
                          {relativeToPar === 0
                            ? 'E'
                            : relativeToPar > 0
                            ? `+${relativeToPar}`
                            : relativeToPar}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Score Controls */}
                    <View className="flex-row items-center">
                      <Pressable
                        onPress={() => handleScoreChange(currentHole, index, -1)}
                        className="w-10 h-10 rounded-full bg-neutral-800 items-center justify-center active:bg-neutral-700"
                      >
                        <Text className="text-lime-400 text-xl font-bold">−</Text>
                      </Pressable>

                      <View className="w-16 items-center">
                        <Text
                          className={cn(
                            'text-3xl font-bold',
                            score === null
                              ? 'text-neutral-600'
                              : score === currentHoleData?.par
                              ? 'text-white'
                              : score !== undefined && currentHoleData?.par !== undefined && score < currentHoleData.par
                              ? 'text-lime-400'
                              : 'text-red-400'
                          )}
                        >
                          {score ?? '–'}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => handleScoreChange(currentHole, index, 1)}
                        className="w-10 h-10 rounded-full bg-neutral-800 items-center justify-center active:bg-neutral-700"
                      >
                        <Text className="text-lime-400 text-xl font-bold">+</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* Full Scorecard */}
        <View className="mx-5 mt-6 mb-8">
          <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3">
            Full Scorecard
          </Text>

          <View className="bg-[#141414] rounded-2xl border border-neutral-800 overflow-hidden">
            {/* Header Row */}
            <View className="flex-row bg-[#1a1a1a] border-b border-neutral-800">
              <View className="w-14 py-3 items-center border-r border-neutral-800">
                <Text className="text-neutral-500 text-xs font-medium">Hole</Text>
              </View>
              <View className="w-12 py-3 items-center border-r border-neutral-800">
                <Text className="text-neutral-500 text-xs font-medium">Par</Text>
              </View>
              {players.map((player, index) => (
                <View key={player.id} className="flex-1 py-3 items-center">
                  <Text className="text-lime-400 text-xs font-bold">{player.initials}</Text>
                </View>
              ))}
            </View>

            {/* Score Rows */}
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {scores.map((hole, holeIndex) => (
                <Pressable
                  key={hole.hole}
                  onPress={() => setCurrentHole(hole.hole)}
                  className={cn(
                    'flex-row border-b border-neutral-800/50',
                    hole.hole === currentHole && 'bg-lime-400/5'
                  )}
                >
                  <View
                    className={cn(
                      'w-14 py-3 items-center border-r border-neutral-800/50',
                      hole.hole === currentHole && 'bg-lime-400/10'
                    )}
                  >
                    <Text
                      className={cn(
                        'font-bold',
                        hole.hole === currentHole ? 'text-lime-400' : 'text-white'
                      )}
                    >
                      {hole.hole}
                    </Text>
                  </View>
                  <View className="w-12 py-3 items-center border-r border-neutral-800/50">
                    <Text className="text-neutral-500">{hole.par}</Text>
                  </View>
                  {hole.scores.map((score, playerIndex) => (
                    <View key={playerIndex} className="flex-1 py-3 items-center">
                      <Text
                        className={cn(
                          'font-medium',
                          score === null
                            ? 'text-neutral-700'
                            : score === hole.par
                            ? 'text-white'
                            : score < hole.par
                            ? 'text-lime-400'
                            : 'text-red-400'
                        )}
                      >
                        {score ?? '–'}
                      </Text>
                    </View>
                  ))}
                </Pressable>
              ))}
            </ScrollView>

            {/* Totals Row */}
            <View className="flex-row bg-[#1a1a1a] border-t border-neutral-700">
              <View className="w-14 py-3 items-center border-r border-neutral-800">
                <Text className="text-neutral-400 text-xs font-bold">Total</Text>
              </View>
              <View className="w-12 py-3 items-center border-r border-neutral-800">
                <Text className="text-neutral-400 font-bold">72</Text>
              </View>
              {players.map((player, index) => {
                const total = useScorecardStore.getState().getTotalScore(index);
                const relativeToPar = useScorecardStore.getState().getRelativeToPar(index);
                return (
                  <View key={player.id} className="flex-1 py-3 items-center">
                    <Text className="text-white font-bold">{total || '–'}</Text>
                    {total > 0 && (
                      <Text
                        className={cn(
                          'text-xs',
                          relativeToPar === 0
                            ? 'text-neutral-500'
                            : relativeToPar > 0
                            ? 'text-red-400'
                            : 'text-lime-400'
                        )}
                      >
                        {relativeToPar === 0
                          ? 'E'
                          : relativeToPar > 0
                          ? `+${relativeToPar}`
                          : relativeToPar}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Start Round Button */}
        {!isTracking && !showRoundSummary && (
          <View className="mx-5 mb-8">
            <Pressable
              onPress={handleStartRound}
              className="bg-lime-400 rounded-xl py-4 items-center active:opacity-80"
            >
              <Text className="text-black font-bold text-lg">Start Round</Text>
            </Pressable>
          </View>
        )}

        {/* End Round Button - Shows when tracking and not on hole 18 */}
        {isTracking && !(currentHole === 18 && scores[17]?.scores.some((s) => s !== null)) && (
          <View className="mx-5 mb-4">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                finishRound();
              }}
              className="bg-neutral-800 border border-neutral-700 rounded-xl py-3 items-center active:opacity-70"
            >
              <Text className="text-neutral-400 font-medium">End Round Early</Text>
            </Pressable>
          </View>
        )}

        {/* Finish Round Button - Shows when hole 18 has scores */}
        {isTracking && currentHole === 18 && scores[17]?.scores.some((s) => s !== null) && (
          <View className="mx-5 mb-8">
            <Pressable
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                finishRound();
              }}
              className="bg-lime-400 rounded-xl py-4 items-center active:opacity-80"
            >
              <Text className="text-black font-bold text-lg">Finish Round</Text>
            </Pressable>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>

      {/* Round Summary Modal */}
      {showRoundSummary && (
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
                  onPress={async () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    await saveRoundToHistory();
                    await resetRound();
                  }}
                  className="bg-lime-400 rounded-xl py-4 flex-row items-center justify-center mb-3 active:opacity-80"
                >
                  <Save size={20} color="black" />
                  <Text className="text-black font-bold text-lg ml-2">Save to History</Text>
                </Pressable>

                <Pressable
                  onPress={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    await resetRound();
                  }}
                  className="bg-neutral-800 rounded-xl py-4 items-center mb-3 active:opacity-80"
                >
                  <Text className="text-neutral-300 font-medium">Start New Round</Text>
                </Pressable>

                <Pressable
                  onPress={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    await resetRound();
                  }}
                  className="py-3 items-center active:opacity-50"
                >
                  <Text className="text-red-400 text-sm">Discard Round</Text>
                </Pressable>
              </Animated.View>
            </View>

            <View className="h-12" />
          </ScrollView>
        </Animated.View>
      )}

      {/* Player Name Edit Modal */}
      {editingPlayer !== null && (
        <Pressable
          onPress={handlePlayerNameSave}
          className="absolute inset-0 bg-black/80 items-center justify-center"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-[#1a1a1a] rounded-2xl p-6 mx-8 w-full max-w-sm border border-neutral-800"
          >
            <Text className="text-white text-lg font-bold mb-4">Edit Player Name</Text>
            <TextInput
              value={playerNameInput}
              onChangeText={setPlayerNameInput}
              placeholder="Enter name"
              placeholderTextColor="#525252"
              autoFocus
              className="bg-neutral-900 text-white px-4 py-3 rounded-xl border border-neutral-700 mb-4"
              onSubmitEditing={handlePlayerNameSave}
            />
            <Pressable
              onPress={handlePlayerNameSave}
              className="bg-lime-400 rounded-xl py-3 items-center active:opacity-80"
            >
              <Text className="text-black font-bold">Save</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}
