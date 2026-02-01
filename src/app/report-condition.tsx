import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  AlertTriangle,
  Droplets,
  TreeDeciduous,
  Circle,
  CheckCircle,
  MapPin,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMutation } from '@tanstack/react-query';

import { submitCourseReport } from '@/lib/course-reports';
import type { ReportType, CourseArea } from '@/types';

// Mock user - in production this would come from auth
const MOCK_USER_ID = 'demo-user-001';
const MOCK_USER_NAME = 'Demo User';

const REPORT_TYPES: { value: ReportType; label: string; icon: typeof Droplets }[] = [
  { value: 'wet_bunker', label: 'Wet Bunker', icon: Droplets },
  { value: 'damaged_turf', label: 'Damaged Turf', icon: AlertTriangle },
  { value: 'fallen_tree', label: 'Fallen Tree', icon: TreeDeciduous },
  { value: 'drainage_issue', label: 'Drainage Issue', icon: Droplets },
  { value: 'other', label: 'Other', icon: Circle },
];

const COURSE_AREAS: { value: CourseArea; label: string }[] = [
  { value: 'fairway', label: 'Fairway' },
  { value: 'green', label: 'Green' },
  { value: 'bunker', label: 'Bunker' },
  { value: 'tee_box', label: 'Tee Box' },
  { value: 'rough', label: 'Rough' },
  { value: 'cart_path', label: 'Cart Path' },
  { value: 'other', label: 'Other' },
];

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);

export default function ReportConditionScreen() {
  const router = useRouter();

  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [area, setArea] = useState<CourseArea | null>(null);
  const [holeNumber, setHoleNumber] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: submitCourseReport,
    onSuccess: () => {
      setSubmitted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleSubmit = () => {
    if (!reportType || !area || !description.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    submitMutation.mutate({
      user_id: MOCK_USER_ID,
      reporter_name: MOCK_USER_NAME,
      hole_number: holeNumber ?? undefined,
      area,
      report_type: reportType,
      description: description.trim(),
    });
  };

  const canSubmit = reportType && area && description.trim().length > 0;

  if (submitted) {
    return (
      <View className="flex-1 bg-[#0c0c0c]">
        <SafeAreaView className="flex-1 items-center justify-center px-6">
          <Animated.View entering={FadeInDown.duration(500)} className="items-center">
            <View className="w-24 h-24 bg-green-900/30 rounded-full items-center justify-center border border-green-700/50 mb-6">
              <CheckCircle size={48} color="#4ade80" />
            </View>
            <Text className="text-white text-2xl font-bold mb-2">Report Submitted</Text>
            <Text className="text-neutral-500 text-center mb-8">
              Thank you for helping us maintain the course.{'\n'}Our team will review your report.
            </Text>
            <Pressable
              onPress={() => router.back()}
              className="bg-lime-600 px-8 py-4 rounded-xl active:bg-lime-700"
            >
              <Text className="text-white font-semibold">Back to App</Text>
            </Pressable>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 py-4 border-b border-neutral-800">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="w-10 h-10 items-center justify-center rounded-full bg-neutral-900 active:opacity-70 mr-3"
          >
            <ArrowLeft size={20} color="#a3e635" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold">Report Condition</Text>
            <Text className="text-neutral-500 text-sm">Help us maintain the course</Text>
          </View>
        </View>

        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          <View className="py-4">
            {/* Report Type */}
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-3">
                Issue Type
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-6">
                {REPORT_TYPES.map(({ value, label, icon: Icon }) => (
                  <Pressable
                    key={value}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setReportType(value);
                    }}
                    className={`px-4 py-3 rounded-xl border flex-row items-center gap-2 ${
                      reportType === value
                        ? 'bg-lime-900/30 border-lime-600'
                        : 'bg-[#141414] border-neutral-800'
                    }`}
                  >
                    <Icon
                      size={16}
                      color={reportType === value ? '#a3e635' : '#737373'}
                    />
                    <Text
                      className={`text-sm ${
                        reportType === value ? 'text-lime-400' : 'text-neutral-400'
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>

            {/* Hole Number */}
            <Animated.View entering={FadeInDown.delay(150).duration(400)}>
              <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-3">
                Hole Number (optional)
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-6"
                style={{ flexGrow: 0 }}
              >
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setHoleNumber(null);
                  }}
                  className={`w-12 h-12 rounded-xl border items-center justify-center mr-2 ${
                    holeNumber === null
                      ? 'bg-neutral-800 border-lime-600'
                      : 'bg-[#141414] border-neutral-800'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      holeNumber === null ? 'text-lime-400' : 'text-neutral-500'
                    }`}
                  >
                    N/A
                  </Text>
                </Pressable>
                {HOLES.map((hole) => (
                  <Pressable
                    key={hole}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setHoleNumber(hole);
                    }}
                    className={`w-12 h-12 rounded-xl border items-center justify-center mr-2 ${
                      holeNumber === hole
                        ? 'bg-lime-900/30 border-lime-600'
                        : 'bg-[#141414] border-neutral-800'
                    }`}
                  >
                    <Text
                      className={`font-medium ${
                        holeNumber === hole ? 'text-lime-400' : 'text-neutral-400'
                      }`}
                    >
                      {hole}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>

            {/* Area */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-3">
                Area
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-6">
                {COURSE_AREAS.map(({ value, label }) => (
                  <Pressable
                    key={value}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setArea(value);
                    }}
                    className={`px-4 py-3 rounded-xl border ${
                      area === value
                        ? 'bg-lime-900/30 border-lime-600'
                        : 'bg-[#141414] border-neutral-800'
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        area === value ? 'text-lime-400' : 'text-neutral-400'
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>

            {/* Description */}
            <Animated.View entering={FadeInDown.delay(250).duration(400)}>
              <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-3">
                Description
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the issue in detail..."
                placeholderTextColor="#525252"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-4 text-white text-base mb-6 min-h-[120px]"
              />
            </Animated.View>

            {/* Future: GPS Location */}
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <View className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 mb-6">
                <View className="flex-row items-center">
                  <MapPin size={18} color="#737373" />
                  <Text className="text-neutral-500 text-sm ml-2">
                    GPS tagging coming soon
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Submit Button */}
            <Animated.View entering={FadeInDown.delay(350).duration(400)}>
              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit || submitMutation.isPending}
                className={`rounded-xl py-4 items-center ${
                  canSubmit && !submitMutation.isPending
                    ? 'bg-lime-600 active:bg-lime-700'
                    : 'bg-neutral-700'
                }`}
              >
                {submitMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Submit Report</Text>
                )}
              </Pressable>
            </Animated.View>
          </View>

          <View className="h-8" />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
