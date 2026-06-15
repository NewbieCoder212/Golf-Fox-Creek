import { View, Text, ScrollView, Pressable, Image, Linking } from 'react-native';
import {
  Flag,
  MapPin,
  Phone,
  Ruler,
  TreePine,
  ExternalLink,
  Calendar,
  User,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { FOX_CREEK_DATA } from '@/lib/course-data';
import {
  getScorecardTee,
  textColorForTeeColors,
  TEE_COLORS,
} from '@/lib/scorecard-tees';
import { foxColors } from '@/theme/tokens';
import { cn } from '@/lib/cn';
import type { ScorecardTeeName } from '@/types';

const FC_LOGO = require('@/assets/images/fc-logo.png');
const LOGO_SIZE = 220;

const PRACTICE_FACILITIES = [
  { icon: TreePine, title: 'Driving Range', desc: 'Full practice facility' },
  { icon: Flag, title: 'Practice Greens', desc: 'Putting & chipping areas' },
  { icon: Ruler, title: 'Golf Lessons', desc: 'PGA professional instruction' },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-3 font-body-semibold">
      {children}
    </Text>
  );
}

function InfoCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <View
      className={cn(
        'bg-fox-surface rounded-2xl border border-fox-border overflow-hidden',
        className
      )}
    >
      {children}
    </View>
  );
}

function TeeGuideBadge({ teeName }: { teeName: string }) {
  const tee = getScorecardTee(teeName as ScorecardTeeName);
  const colors = tee?.colors ?? [TEE_COLORS.white];
  const textColor = textColorForTeeColors(colors);
  const isCombo = colors.length >= 2;
  const needsBorder = colors.some((c) => c === TEE_COLORS.white);

  const label = (
    <Text
      className="text-[10px] font-body-bold text-center"
      style={{ color: textColor }}
      numberOfLines={1}
    >
      {teeName}
    </Text>
  );

  if (isCombo) {
    return (
      <LinearGradient
        colors={[colors[0], colors[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 6,
          borderWidth: needsBorder ? 1 : 0,
          borderColor: '#525252',
        }}
        className="flex-1"
      >
        {label}
      </LinearGradient>
    );
  }

  return (
    <View
      style={{
        backgroundColor: colors[0],
        borderWidth: needsBorder ? 1 : 0,
        borderColor: '#525252',
      }}
      className="flex-1 rounded-lg px-2 py-1.5 items-center justify-center"
    >
      {label}
    </View>
  );
}

export default function CourseScreen() {
  const insets = useSafeAreaInsets();

  const handleCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${FOX_CREEK_DATA.phone.replace(/[^0-9]/g, '')}`);
  };

  const handleDirections = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(FOX_CREEK_DATA.address)}`);
  };

  const blackTees = FOX_CREEK_DATA.teeRatings.find((t) => t.name === 'Black');
  const whiteTees = FOX_CREEK_DATA.teeRatings.find((t) => t.name === 'White');

  return (
    <View className="flex-1 bg-fox-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ width: '100%' }}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 32,
          width: '100%',
          alignItems: 'stretch',
        }}
      >
        <Animated.View
          entering={FadeInDown.delay(100).duration(500)}
          style={{
            width: '100%',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 24,
          }}
        >
          <Image
            source={FC_LOGO}
            style={{ width: LOGO_SIZE, height: LOGO_SIZE, alignSelf: 'center' }}
            resizeMode="contain"
          />
          <Text className="text-white text-2xl font-display mt-6 text-center tracking-tight w-full">
            {FOX_CREEK_DATA.name}
          </Text>
          <Text className="text-neutral-500 text-sm font-body mt-3 text-center leading-5 w-full">
            Dieppe, New Brunswick
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(500)} className="px-5 mt-6">
          <InfoCard className="p-4">
            <Text className="text-neutral-300 text-sm font-body leading-6">
              An 18-hole championship layout designed by{' '}
              <Text className="text-white font-body-semibold">{FOX_CREEK_DATA.designer}</Text>, opened in{' '}
              {FOX_CREEK_DATA.yearOpened}. Fox Creek offers a full practice range, tournament-ready
              conditions, and tee options for every skill level.
            </Text>
          </InfoCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)} className="px-5 mt-6">
          <View className="flex-row flex-wrap gap-3">
            {[
              { label: 'Par', value: String(FOX_CREEK_DATA.par) },
              { label: 'Holes', value: String(FOX_CREEK_DATA.holes) },
              {
                label: 'Black Tees',
                value: blackTees ? `${blackTees.yards.toLocaleString()} yds` : '—',
              },
              {
                label: 'White Tees',
                value: whiteTees ? `${whiteTees.yards.toLocaleString()} yds` : '—',
              },
            ].map((stat) => (
              <View
                key={stat.label}
                className="flex-1 min-w-[44%] bg-fox-surface rounded-xl p-4 border border-fox-border"
              >
                <Text className="text-neutral-500 text-[10px] uppercase tracking-wider font-body-semibold">
                  {stat.label}
                </Text>
                <Text className="text-white text-xl font-display mt-1">{stat.value}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(500)} className="px-5 mt-8">
          <SectionLabel>Course & Slope Ratings</SectionLabel>
          <InfoCard>
            <View className="flex-row bg-fox-surface-elevated py-2.5 px-3 border-b border-fox-border">
              <Text className="text-neutral-500 text-[10px] font-body-semibold flex-[1.2]">Tee</Text>
              <Text className="text-neutral-500 text-[10px] font-body-semibold flex-1 text-center">
                Yards
              </Text>
              <Text className="text-neutral-500 text-[10px] font-body-semibold flex-1 text-center">
                Men&apos;s
              </Text>
              <Text className="text-neutral-500 text-[10px] font-body-semibold flex-1 text-center">
                Ladies
              </Text>
            </View>
            {FOX_CREEK_DATA.teeRatings.map((tee, index) => (
              <View
                key={tee.name}
                className={cn(
                  'flex-row py-2.5 px-3',
                  index < FOX_CREEK_DATA.teeRatings.length - 1 && 'border-b border-fox-border/60'
                )}
              >
                <Text className="text-white text-xs font-body-semibold flex-[1.2]" numberOfLines={1}>
                  {tee.name}
                </Text>
                <Text className="text-neutral-300 text-xs font-body flex-1 text-center">
                  {tee.yards.toLocaleString()}
                </Text>
                <Text className="text-neutral-400 text-xs font-body flex-1 text-center">
                  {tee.mensRating}/{tee.mensSlope}
                </Text>
                <Text className="text-neutral-400 text-xs font-body flex-1 text-center">
                  {tee.womensRating}/{tee.womensSlope}
                </Text>
              </View>
            ))}
          </InfoCard>
          <Text className="text-neutral-600 text-[10px] font-body mt-2 px-1">
            Rating / slope from the official Fox Creek scorecard.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)} className="px-5 mt-8">
          <SectionLabel>Tee Selection Guide</SectionLabel>
          <InfoCard>
            <View className="flex-row bg-fox-surface-elevated py-2.5 px-3 border-b border-fox-border">
              <Text className="text-neutral-500 text-[10px] font-body-semibold flex-1">Tee</Text>
              <Text className="text-neutral-500 text-[10px] font-body-semibold flex-1 text-center">
                Handicap
              </Text>
              <Text className="text-neutral-500 text-[10px] font-body-semibold flex-1 text-center">
                Drive
              </Text>
            </View>
            {FOX_CREEK_DATA.handicapRecommendations.map((rec, index) => (
              <View
                key={rec.teeName}
                className={cn(
                  'flex-row items-center gap-2 py-2.5 px-3',
                  index < FOX_CREEK_DATA.handicapRecommendations.length - 1 &&
                    'border-b border-fox-border/60'
                )}
              >
                <View className="flex-[1.1]">
                  <TeeGuideBadge teeName={rec.teeName} />
                </View>
                <Text className="text-neutral-400 text-xs font-body flex-1 text-center">
                  {rec.handicapRange}
                </Text>
                <Text className="text-neutral-400 text-xs font-body flex-1 text-center">
                  {rec.drivingDistance}
                </Text>
              </View>
            ))}
          </InfoCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).duration(500)} className="px-5 mt-8">
          <SectionLabel>Practice Facilities</SectionLabel>
          {PRACTICE_FACILITIES.map((facility) => (
            <View
              key={facility.title}
              className="flex-row items-center bg-fox-surface rounded-xl p-4 mb-3 border border-fox-border"
            >
              <View className="w-12 h-12 bg-fox-surface-elevated rounded-full items-center justify-center mr-4 border border-fox-border">
                <facility.icon size={20} color={foxColors.lime} strokeWidth={1.5} />
              </View>
              <View className="flex-1">
                <Text className="text-white font-body-semibold">{facility.title}</Text>
                <Text className="text-neutral-500 text-sm font-body mt-0.5">{facility.desc}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(500)} className="px-5 mt-8">
          <SectionLabel>Visit Us</SectionLabel>
          <InfoCard>
            <Pressable
              onPress={handleDirections}
              className="flex-row items-center p-4 border-b border-fox-border/60 active:opacity-80"
            >
              <View className="w-10 h-10 bg-fox-surface-elevated rounded-full items-center justify-center mr-4 border border-fox-border">
                <MapPin size={16} color={foxColors.lime} strokeWidth={1.5} />
              </View>
              <View className="flex-1">
                <Text className="text-neutral-500 text-[10px] uppercase tracking-wider font-body-semibold">
                  Address
                </Text>
                <Text className="text-white font-body mt-0.5">{FOX_CREEK_DATA.address}</Text>
              </View>
              <ExternalLink size={16} color="#525252" />
            </Pressable>

            <Pressable onPress={handleCall} className="flex-row items-center p-4 active:opacity-80">
              <View className="w-10 h-10 bg-fox-surface-elevated rounded-full items-center justify-center mr-4 border border-fox-border">
                <Phone size={16} color={foxColors.lime} strokeWidth={1.5} />
              </View>
              <View className="flex-1">
                <Text className="text-neutral-500 text-[10px] uppercase tracking-wider font-body-semibold">
                  Phone
                </Text>
                <Text className="text-white font-body mt-0.5">{FOX_CREEK_DATA.phone}</Text>
              </View>
              <ExternalLink size={16} color="#525252" />
            </Pressable>
          </InfoCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(450).duration(500)} className="px-5 mt-6">
          <View className="flex-row items-center justify-center gap-6">
            <View className="flex-row items-center">
              <Calendar size={14} color="#525252" strokeWidth={1.5} />
              <Text className="text-neutral-600 text-xs font-body ml-2">
                Est. {FOX_CREEK_DATA.yearOpened}
              </Text>
            </View>
            <View className="flex-row items-center">
              <User size={14} color="#525252" strokeWidth={1.5} />
              <Text className="text-neutral-600 text-xs font-body ml-2">
                {FOX_CREEK_DATA.designer}, Course Architect
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
