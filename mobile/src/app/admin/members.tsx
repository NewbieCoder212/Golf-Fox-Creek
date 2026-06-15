import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, Shield, Crown, Plus, Mail, X } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useAdminAuthStore } from '@/lib/admin-auth-store';
import { getAllMembers } from '@/lib/supabase';
import { inviteMember, resendMemberInvite } from '@/lib/member-service';
import type { UserProfile, UserRole } from '@/types';
import { cn } from '@/lib/cn';

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

function displayName(member: UserProfile): string {
  if (member.first_name || member.last_name) {
    return `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim();
  }
  return member.full_name || 'Unnamed Member';
}

export default function MembersScreen() {
  const router = useRouter();
  const { accessToken, isSuperAdmin, isManager } = useAdminAuthStore();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [handicap, setHandicap] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin() && !isManager()) {
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

  const handleInvite = async () => {
    if (!accessToken) return;
    const trimmedEmail = email.trim();
    if (!firstName.trim() || !lastName.trim() || !trimmedEmail) {
      Alert.alert('Missing fields', 'First name, last name, and email are required.');
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const handicapValue = Number(handicap);
    const result = await inviteMember({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: trimmedEmail,
      handicapIndex: Number.isFinite(handicapValue) ? handicapValue : undefined,
      accessToken,
    });

    setIsSubmitting(false);

    if (!result.success) {
      Alert.alert('Invite failed', result.error ?? 'Could not send invite');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowAddModal(false);
    setFirstName('');
    setLastName('');
    setEmail('');
    setHandicap('');
    await loadMembers();
    Alert.alert('Invite sent', `An email was sent to ${trimmedEmail} to create their account.`);
  };

  const handleResend = async (member: UserProfile) => {
    if (!accessToken || !member.email) return;
    setResendingId(member.id);
    const result = await resendMemberInvite(member.email, accessToken);
    setResendingId(null);

    if (!result.success) {
      Alert.alert('Resend failed', result.error ?? 'Could not resend invite');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Invite resent', `A new invite email was sent to ${member.email}.`);
  };

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <SafeAreaView className="flex-1">
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
            <Text className="text-neutral-500 text-sm">{members.length} registered</Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowAddModal(true);
            }}
            className="flex-row items-center bg-lime-600 rounded-full px-3 py-2 active:opacity-80"
          >
            <Plus size={16} color="#fff" />
            <Text className="text-white text-sm font-semibold ml-1">Add</Text>
          </Pressable>
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
                  <Text className="text-neutral-500 text-sm mt-4">No members yet</Text>
                  <Text className="text-neutral-600 text-xs mt-1 text-center">
                    Tap Add to invite players by email
                  </Text>
                </View>
              ) : (
                members.map((member, index) => {
                  const inviteStatus = member.invite_status ?? 'active';
                  return (
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
                            <Text className="text-white font-medium">{displayName(member)}</Text>
                            <Text className="text-neutral-500 text-sm">{member.email}</Text>
                          </View>
                          <View className="items-end">
                            <View
                              className={cn(
                                'px-2 py-1 rounded-full mb-1',
                                inviteStatus === 'pending'
                                  ? 'bg-amber-900/30'
                                  : member.role === 'super_admin'
                                    ? 'bg-amber-900/30'
                                    : member.role === 'manager'
                                      ? 'bg-lime-900/30'
                                      : 'bg-neutral-800'
                              )}
                            >
                              <Text
                                className={cn(
                                  'text-xs',
                                  inviteStatus === 'pending'
                                    ? 'text-amber-400'
                                    : member.role === 'super_admin'
                                      ? 'text-amber-400'
                                      : member.role === 'manager'
                                        ? 'text-lime-400'
                                        : 'text-neutral-400'
                                )}
                              >
                                {inviteStatus === 'pending'
                                  ? 'Invited'
                                  : getRoleLabel(member.role)}
                              </Text>
                            </View>
                            {member.handicap_index !== null &&
                              member.handicap_index !== undefined && (
                                <Text className="text-neutral-500 text-xs">
                                  HCP: {member.handicap_index.toFixed(1)}
                                </Text>
                              )}
                          </View>
                        </View>
                        {inviteStatus === 'pending' && member.email && (
                          <Pressable
                            onPress={() => handleResend(member)}
                            disabled={resendingId === member.id}
                            className="mt-3 flex-row items-center justify-center border border-amber-700/40 rounded-lg py-2 active:opacity-80"
                          >
                            {resendingId === member.id ? (
                              <ActivityIndicator size="small" color="#fbbf24" />
                            ) : (
                              <>
                                <Mail size={14} color="#fbbf24" />
                                <Text className="text-amber-400 text-xs font-semibold ml-1.5">
                                  Resend Invite
                                </Text>
                              </>
                            )}
                          </Pressable>
                        )}
                      </View>
                    </Animated.View>
                  );
                })
              )}
            </View>
            <View className="h-8" />
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#141414] rounded-t-3xl border-t border-neutral-800 px-5 pt-5 pb-10">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-lg font-bold">Invite Member</Text>
              <Pressable onPress={() => setShowAddModal(false)}>
                <X size={22} color="#737373" />
              </Pressable>
            </View>

            <Text className="text-neutral-500 text-sm mb-4">
              An email will be sent so they can set a password and access the member portal.
            </Text>

            <View className="flex-row gap-2 mb-3">
              <View className="flex-1">
                <Text className="text-neutral-500 text-xs mb-1">First Name</Text>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="John"
                  placeholderTextColor="#525252"
                  className="bg-[#0c0c0c] border border-neutral-800 rounded-lg px-3 py-3 text-white"
                />
              </View>
              <View className="flex-1">
                <Text className="text-neutral-500 text-xs mb-1">Last Name</Text>
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Smith"
                  placeholderTextColor="#525252"
                  className="bg-[#0c0c0c] border border-neutral-800 rounded-lg px-3 py-3 text-white"
                />
              </View>
            </View>

            <View className="mb-3">
              <Text className="text-neutral-500 text-xs mb-1">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="player@email.com"
                placeholderTextColor="#525252"
                keyboardType="email-address"
                autoCapitalize="none"
                className="bg-[#0c0c0c] border border-neutral-800 rounded-lg px-3 py-3 text-white"
              />
            </View>

            <View className="mb-5">
              <Text className="text-neutral-500 text-xs mb-1">Handicap (optional)</Text>
              <TextInput
                value={handicap}
                onChangeText={setHandicap}
                placeholder="12.4"
                placeholderTextColor="#525252"
                keyboardType="decimal-pad"
                className="bg-[#0c0c0c] border border-neutral-800 rounded-lg px-3 py-3 text-white"
              />
            </View>

            <Pressable
              onPress={handleInvite}
              disabled={isSubmitting}
              className="bg-lime-600 rounded-xl py-3.5 items-center active:opacity-80"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold">Send Invite</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
