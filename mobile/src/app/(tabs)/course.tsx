import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import { useState } from 'react';
import { Flag, Ruler, TreePine, ChevronDown, ChevronUp } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '@/lib/cn';

interface HoleData {
  hole: number;
  par: number;
  blackYards: number;
  blueYards: number;
  whiteYards: number;
  greenYards: number;
  redYards: number;
  handicap: number;
}

// Fox Creek Golf Club - Dieppe, NB, Canada
// Traditional 18-hole sequence with GPS coordinates
const FRONT_NINE: HoleData[] = [
  { hole: 1, par: 5, blackYards: 555, blueYards: 532, whiteYards: 498, greenYards: 459, redYards: 416, handicap: 3 },
  { hole: 2, par: 3, blackYards: 180, blueYards: 165, whiteYards: 150, greenYards: 135, redYards: 120, handicap: 17 },
  { hole: 3, par: 4, blackYards: 410, blueYards: 390, whiteYards: 365, greenYards: 340, redYards: 310, handicap: 7 },
  { hole: 4, par: 3, blackYards: 195, blueYards: 175, whiteYards: 160, greenYards: 145, redYards: 125, handicap: 15 },
  { hole: 5, par: 5, blackYards: 540, blueYards: 515, whiteYards: 485, greenYards: 455, redYards: 420, handicap: 1 },
  { hole: 6, par: 4, blackYards: 385, blueYards: 365, whiteYards: 340, greenYards: 315, redYards: 285, handicap: 11 },
  { hole: 7, par: 4, blackYards: 420, blueYards: 395, whiteYards: 370, greenYards: 345, redYards: 315, handicap: 5 },
  { hole: 8, par: 3, blackYards: 170, blueYards: 155, whiteYards: 140, greenYards: 125, redYards: 110, handicap: 13 },
  { hole: 9, par: 5, blackYards: 525, blueYards: 500, whiteYards: 470, greenYards: 440, redYards: 405, handicap: 9 },
];

const BACK_NINE: HoleData[] = [
  { hole: 10, par: 5, blackYards: 545, blueYards: 520, whiteYards: 490, greenYards: 460, redYards: 425, handicap: 4 },
  { hole: 11, par: 4, blackYards: 395, blueYards: 375, whiteYards: 350, greenYards: 325, redYards: 295, handicap: 10 },
  { hole: 12, par: 4, blackYards: 430, blueYards: 405, whiteYards: 380, greenYards: 355, redYards: 320, handicap: 6 },
  { hole: 13, par: 3, blackYards: 185, blueYards: 165, whiteYards: 150, greenYards: 135, redYards: 115, handicap: 18 },
  { hole: 14, par: 4, blackYards: 405, blueYards: 385, whiteYards: 360, greenYards: 335, redYards: 305, handicap: 8 },
  { hole: 15, par: 5, blackYards: 550, blueYards: 525, whiteYards: 495, greenYards: 465, redYards: 430, handicap: 2 },
  { hole: 16, par: 4, blackYards: 415, blueYards: 390, whiteYards: 365, greenYards: 340, redYards: 310, handicap: 12 },
  { hole: 17, par: 3, blackYards: 190, blueYards: 170, whiteYards: 155, greenYards: 140, redYards: 120, handicap: 16 },
  { hole: 18, par: 4, blackYards: 440, blueYards: 415, whiteYards: 390, greenYards: 365, redYards: 330, handicap: 14 },
];

const COURSE_STATS = [
  { label: 'Total Par', value: '72' },
  { label: 'Black Tees', value: '6,925 yds' },
  { label: 'Blue Tees', value: '6,428 yds' },
  { label: 'White Tees', value: '6,033 yds' },
];

const AMENITIES = [
  { icon: TreePine, title: 'Driving Range', desc: 'Full practice facility' },
  { icon: Flag, title: 'Practice Greens', desc: 'Putting & Chipping' },
  { icon: Ruler, title: 'Golf Lessons', desc: 'PGA Pro Available' },
];

type TeeColor = 'black' | 'blue' | 'white' | 'green' | 'red';

export default function CourseScreen() {
  const insets = useSafeAreaInsets();
  const [showBackNine, setShowBackNine] = useState(false);
  const [selectedTee, setSelectedTee] = useState<TeeColor>('white');

  const getYards = (hole: HoleData): number => {
    switch (selectedTee) {
      case 'black': return hole.blackYards;
      case 'blue': return hole.blueYards;
      case 'white': return hole.whiteYards;
      case 'green': return hole.greenYards;
      case 'red': return hole.redYards;
    }
  };

  const calculateTotal = (holes: HoleData[]) => ({
    par: holes.reduce((sum, h) => sum + h.par, 0),
    yards: holes.reduce((sum, h) => sum + getYards(h), 0),
  });

  const frontTotals = calculateTotal(FRONT_NINE);
  const backTotals = calculateTotal(BACK_NINE);

  const getTeeStyle = (tee: TeeColor, isSelected: boolean) => {
    if (!isSelected) return 'bg-[#141414] border-neutral-800';
    switch (tee) {
      case 'black': return 'bg-neutral-900 border-neutral-600';
      case 'blue': return 'bg-blue-600 border-blue-500';
      case 'white': return 'bg-neutral-200 border-neutral-300';
      case 'green': return 'bg-green-600 border-green-500';
      case 'red': return 'bg-red-600 border-red-500';
    }
  };

  const getTeeTextStyle = (tee: TeeColor, isSelected: boolean) => {
    if (!isSelected) return 'text-neutral-500';
    if (tee === 'white') return 'text-neutral-900';
    if (tee === 'black') return 'text-white';
    return 'text-white';
  };

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Course Hero Image */}
        <View className="relative h-56">
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&q=80' }}
            className="absolute inset-0 w-full h-full"
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', '#0c0c0c']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }}
          />
          <View className="absolute bottom-4 left-5 right-5">
            <Animated.Text
              entering={FadeInDown.delay(100).duration(500)}
              className="text-white text-2xl font-bold tracking-tight"
            >
              Course Information
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(150).duration(500)}
              className="text-neutral-400 text-sm mt-1"
            >
              Dieppe, NB • Graham Cooke Design
            </Animated.Text>
          </View>
        </View>

        {/* Course Stats */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(500)}
          className="px-5 -mt-2"
        >
          <View className="flex-row flex-wrap gap-3">
            {COURSE_STATS.map((stat, index) => (
              <View
                key={stat.label}
                className="flex-1 min-w-[45%] bg-[#141414] rounded-xl p-4 border border-neutral-800"
              >
                <Text className="text-neutral-500 text-xs uppercase tracking-wider">{stat.label}</Text>
                <Text className="text-white text-xl font-bold mt-1">{stat.value}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Tee Selection */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(500)}
          className="px-5 mt-6"
        >
          <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-3">Select Tees</Text>
          <View className="flex-row gap-2">
            {(['black', 'blue', 'white', 'green', 'red'] as const).map((tee) => (
              <Pressable
                key={tee}
                onPress={() => setSelectedTee(tee)}
                className={cn(
                  'flex-1 py-3 rounded-xl border items-center',
                  getTeeStyle(tee, selectedTee === tee)
                )}
              >
                <Text className={cn(
                  'font-semibold capitalize text-xs',
                  getTeeTextStyle(tee, selectedTee === tee)
                )}>
                  {tee}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Scorecard */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(500)}
          className="px-5 mt-6"
        >
          <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-3">Scorecard</Text>

          {/* Front Nine */}
          <View className="bg-[#141414] rounded-xl border border-neutral-800 overflow-hidden">
            <View className="flex-row bg-neutral-900 py-2 px-3">
              <Text className="text-neutral-500 font-medium w-12 text-xs">Hole</Text>
              <Text className="text-neutral-500 font-medium flex-1 text-center text-xs">Par</Text>
              <Text className="text-neutral-500 font-medium flex-1 text-center text-xs">Yards</Text>
              <Text className="text-neutral-500 font-medium flex-1 text-center text-xs">Hcp</Text>
            </View>
            {FRONT_NINE.map((hole, index) => (
              <Animated.View
                key={hole.hole}
                entering={FadeIn.delay(450 + index * 30).duration(200)}
                className={cn(
                  'flex-row py-2.5 px-3',
                  index % 2 === 0 ? 'bg-neutral-900/30' : 'bg-transparent'
                )}
              >
                <Text className="text-white font-medium w-12">{hole.hole}</Text>
                <Text className="text-white flex-1 text-center">{hole.par}</Text>
                <Text className="text-white flex-1 text-center">{getYards(hole)}</Text>
                <Text className="text-neutral-500 flex-1 text-center">{hole.handicap}</Text>
              </Animated.View>
            ))}
            <View className="flex-row bg-neutral-800/50 py-2 px-3">
              <Text className="text-white font-bold w-12">Out</Text>
              <Text className="text-white font-bold flex-1 text-center">{frontTotals.par}</Text>
              <Text className="text-lime-400 font-bold flex-1 text-center">{frontTotals.yards.toLocaleString()}</Text>
              <Text className="text-neutral-500 font-bold flex-1 text-center">-</Text>
            </View>
          </View>

          {/* Back Nine Toggle */}
          <Pressable
            onPress={() => setShowBackNine(!showBackNine)}
            className="flex-row items-center justify-center mt-4 py-3 bg-[#141414] border border-neutral-800 rounded-xl active:opacity-70"
          >
            <Text className="text-lime-400 font-medium mr-2">
              {showBackNine ? 'Hide Back Nine' : 'Show Back Nine'}
            </Text>
            {showBackNine ? (
              <ChevronUp size={18} color="#a3e635" />
            ) : (
              <ChevronDown size={18} color="#a3e635" />
            )}
          </Pressable>

          {/* Back Nine */}
          {showBackNine && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              className="bg-[#141414] rounded-xl border border-neutral-800 overflow-hidden mt-4"
            >
              <View className="flex-row bg-neutral-900 py-2 px-3">
                <Text className="text-neutral-500 font-medium w-12 text-xs">Hole</Text>
                <Text className="text-neutral-500 font-medium flex-1 text-center text-xs">Par</Text>
                <Text className="text-neutral-500 font-medium flex-1 text-center text-xs">Yards</Text>
                <Text className="text-neutral-500 font-medium flex-1 text-center text-xs">Hcp</Text>
              </View>
              {BACK_NINE.map((hole, index) => (
                <View
                  key={hole.hole}
                  className={cn(
                    'flex-row py-2.5 px-3',
                    index % 2 === 0 ? 'bg-neutral-900/30' : 'bg-transparent'
                  )}
                >
                  <Text className="text-white font-medium w-12">{hole.hole}</Text>
                  <Text className="text-white flex-1 text-center">{hole.par}</Text>
                  <Text className="text-white flex-1 text-center">{getYards(hole)}</Text>
                  <Text className="text-neutral-500 flex-1 text-center">{hole.handicap}</Text>
                </View>
              ))}
              <View className="flex-row bg-neutral-800/50 py-2 px-3">
                <Text className="text-white font-bold w-12">In</Text>
                <Text className="text-white font-bold flex-1 text-center">{backTotals.par}</Text>
                <Text className="text-lime-400 font-bold flex-1 text-center">{backTotals.yards.toLocaleString()}</Text>
                <Text className="text-neutral-500 font-bold flex-1 text-center">-</Text>
              </View>

              {/* Total */}
              <View className="flex-row bg-lime-400/10 py-2.5 px-3 border-t border-neutral-700">
                <Text className="text-lime-400 font-bold w-12">Tot</Text>
                <Text className="text-lime-400 font-bold flex-1 text-center">{frontTotals.par + backTotals.par}</Text>
                <Text className="text-lime-400 font-bold flex-1 text-center">{(frontTotals.yards + backTotals.yards).toLocaleString()}</Text>
                <Text className="text-neutral-500 font-bold flex-1 text-center">-</Text>
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* Amenities */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(500)}
          className="px-5 mt-8 mb-8"
        >
          <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-4">Practice Facilities</Text>
          {AMENITIES.map((amenity, index) => (
            <View
              key={amenity.title}
              className="flex-row items-center bg-[#141414] rounded-xl p-4 mb-3 border border-neutral-800"
            >
              <View className="w-12 h-12 bg-neutral-900 rounded-full items-center justify-center mr-4 border border-neutral-800">
                <amenity.icon size={20} color="#a3e635" strokeWidth={1.5} />
              </View>
              <View>
                <Text className="text-white font-medium">{amenity.title}</Text>
                <Text className="text-neutral-500 text-sm">{amenity.desc}</Text>
              </View>
            </View>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
