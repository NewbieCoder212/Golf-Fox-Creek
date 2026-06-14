import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, Shield, Crown } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useAdminAuthStore } from '@/lib/admin-auth-store';
import { getAllMembers } from '@/lib/supabase';
import type { UserProfile, UserRole } from '@/types';

function getRoleIcon(role: UserRole) {
  switch (role) {
    case 'super_admin':
      return <Crown size={16} color="#fbbf24" />;
    case 'manager':
      return <Shield size={16} color="#a3e635" />;
    default:
      return <User size={16} color="#525252" />;
  }
}

function getRoleLabel(role: UserRole) {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'manager':
      return 'Manager';
    default:
      return 'Member';
  }
}

export default function MembersScreen() {
  const router = useRouter();
  const { accessToken, isSuperAdmin } = useAdminAuthStore();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only super admin can view this page
    if (!isSuperAdmin()) {
      router.replace('/admin/dashboard');
      return;
    }

    loadMembers();
  }, []);

  const loadMembers = async () => {
    if (!accessToken) return;

    setIsLoading(true);
    try {
      const data = await getAllMembers(accessToken);
      setMembers(data);
    } catch (err) {
      console.log('[Members] Error loading:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
            <Text className="text-white text-xl font-bold">Members</Text>
            <Text className="text-neutral-500 text-sm">
              {members.length} registered
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#a3e635" />
          </View>
        ) : (
          <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
            <View className="py-4">
              {members.length === 0 ? (
                <View className="bg-[#141414] rounded-xl border border-neutral-800 p-8 items-center">
                  <User size={40} color="#525252" />
                  <Text className="text-neutral-500 text-sm mt-4">No members found</Text>
                  <Text className="text-neutral-600 text-xs mt-1 text-center">
                    Members will appear here once they sign up
                  </Text>
                </View>
              ) : (
                members.map((member, index) => (
                  <Animated.View
                    key={member.id}
                    entering={FadeInDown.delay(index * 50).duration(300)}
                  >
                    <View className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mb-3">
                      <View className="flex-row items-center">
                        <View className="w-12 h-12 bg-neutral-900 rounded-full items-center justify-center border border-neutral-800">
                          {getRoleIcon(member.role)}
                        </View>
                        <View className="flex-1 ml-4">
                          <Text className="text-white font-medium">
                            {member.full_name || 'Unnamed Member'}
                          </Text>
                          <Text className="text-neutral-500 text-sm">
                            {member.email}
                          </Text>
                        </View>
                        <View className="items-end">
                          <View
                            className={`px-2 py-1 rounded-full ${
                              member.role === 'super_admin'
                                ? 'bg-amber-900/30'
                                : member.role === 'manager'
                                ? 'bg-lime-900/30'
                                : 'bg-neutral-800'
                            }`}
                          >
                            <Text
                              className={`text-xs ${
                                member.role === 'super_admin'
                                  ? 'text-amber-400'
                                  : member.role === 'manager'
                                  ? 'text-lime-400'
                                  : 'text-neutral-400'
                              }`}
                            >
                              {getRoleLabel(member.role)}
                            </Text>
                          </View>
                          {member.handicap_index !== null && member.handicap_index !== undefined && (
                            <Text className="text-neutral-500 text-xs mt-1">
                              HCP: {member.handicap_index.toFixed(1)}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                ))
              )}
            </View>
            <View className="h-8" />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
