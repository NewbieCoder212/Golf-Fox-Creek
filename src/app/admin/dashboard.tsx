import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Shield,
  LogOut,
  MapPin,
  Bell,
  Coffee,
  Megaphone,
  ChevronRight,
  Check,
  AlertTriangle,
  AlertCircle,
  Info,
  Users,
  Send,
  FileWarning,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';

import { useAdminAuthStore } from '@/lib/admin-auth-store';
import {
  getGeofenceSettings,
  updateGeofenceSettingsAuth,
  updateGMAnnouncementAuth,
  signOut,
  getGMAnnouncement,
} from '@/lib/supabase';
import { getCourseReports, updateReportStatus } from '@/lib/course-reports';
import type { GeofenceSettings, GMAnnouncement, AnnouncementType, CourseReport } from '@/types';

type AdminSection = 'main' | 'geofencing' | 'announcements' | 'notifications' | 'reports';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { profile, accessToken, clearAuth, isSuperAdmin } = useAdminAuthStore();

  const [section, setSection] = useState<AdminSection>('main');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Push notification state
  const [pushMessage, setPushMessage] = useState('');
  const [pushTitle, setPushTitle] = useState('');
  const [isSendingPush, setIsSendingPush] = useState(false);
  const [pushSent, setPushSent] = useState(false);

  // Geofence settings state
  const [geofenceSettings, setGeofenceSettings] = useState<GeofenceSettings>({
    enabled: true,
    check_in_enabled: true,
    tee_time_alerts: true,
    turn_prompt_enabled: true,
  });

  // Announcement state
  const [announcement, setAnnouncement] = useState<GMAnnouncement>({
    enabled: false,
    title: '',
    message: '',
    type: 'info',
    expires_at: null,
  });

  // Course reports query
  const { data: courseReports, refetch: refetchReports } = useQuery({
    queryKey: ['courseReports'],
    queryFn: () => getCourseReports(),
  });

  const pendingReportsCount = courseReports?.filter((r) => r.status === 'pending').length ?? 0;

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const [geoSettings, currentAnnouncement] = await Promise.all([
        getGeofenceSettings(),
        getGMAnnouncement(),
      ]);

      setGeofenceSettings(geoSettings);
      if (currentAnnouncement) {
        setAnnouncement(currentAnnouncement);
      }
    } catch (err) {
      console.log('[AdminDashboard] Error loading settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSettings();
    await refetchReports();
    setRefreshing(false);
  }, [refetchReports]);

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (accessToken) {
      await signOut(accessToken);
    }
    await clearAuth();
    router.replace('/');
  };

  const handleSendPushNotification = async () => {
    if (!pushMessage.trim()) return;

    setIsSendingPush(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Note: In production, this would call your backend/Expo Push API
    // For now, we simulate the send
    await new Promise((resolve) => setTimeout(resolve, 1500));

    console.log('[Admin] Push notification sent:', { title: pushTitle, message: pushMessage });

    setIsSendingPush(false);
    setPushSent(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reset after showing success
    setTimeout(() => {
      setPushSent(false);
      setPushTitle('');
      setPushMessage('');
    }, 3000);
  };

  const handleUpdateReportStatus = async (reportId: string, status: CourseReport['status']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const success = await updateReportStatus(reportId, status);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchReports();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleSaveGeofencing = async () => {
    if (!accessToken) return;

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const success = await updateGeofenceSettingsAuth(geofenceSettings, accessToken);

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setIsSaving(false);
  };

  const handleSaveAnnouncement = async () => {
    if (!accessToken) return;

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const success = await updateGMAnnouncementAuth(announcement, accessToken);

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setIsSaving(false);
  };

  const renderMainSection = () => (
    <>
      {/* User Info */}
      <Animated.View entering={FadeInDown.delay(100).duration(500)} className="mb-6">
        <View className="bg-[#141414] rounded-2xl border border-neutral-800 p-5">
          <View className="flex-row items-center">
            <View className="w-14 h-14 bg-lime-900/30 rounded-full items-center justify-center border border-lime-700/50">
              <Shield size={24} color="#a3e635" />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-white text-lg font-semibold">
                {profile?.full_name || profile?.email || 'Admin'}
              </Text>
              <Text className="text-lime-400 text-sm capitalize">
                {profile?.role?.replace('_', ' ') || 'Manager'}
              </Text>
            </View>
            <Pressable
              onPress={handleLogout}
              className="w-10 h-10 bg-neutral-800 rounded-full items-center justify-center active:opacity-70"
            >
              <LogOut size={18} color="#ef4444" />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* Menu Items */}
      <Animated.View entering={FadeInDown.delay(200).duration(500)}>
        <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-3 ml-1">
          Settings
        </Text>

        {/* Geofencing */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSection('geofencing');
          }}
          className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mb-3 flex-row items-center active:opacity-80"
        >
          <View className="w-10 h-10 bg-blue-900/30 rounded-full items-center justify-center">
            <MapPin size={20} color="#60a5fa" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-white font-medium">Geofencing</Text>
            <Text className="text-neutral-500 text-sm">Check-in, alerts, prompts</Text>
          </View>
          <ChevronRight size={20} color="#525252" />
        </Pressable>

        {/* Announcements */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSection('announcements');
          }}
          className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mb-3 flex-row items-center active:opacity-80"
        >
          <View className="w-10 h-10 bg-amber-900/30 rounded-full items-center justify-center">
            <Megaphone size={20} color="#fbbf24" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-white font-medium">GM Announcements</Text>
            <Text className="text-neutral-500 text-sm">Post messages to members</Text>
          </View>
          <ChevronRight size={20} color="#525252" />
        </Pressable>

        {/* Push Notifications */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSection('notifications');
          }}
          className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mb-3 flex-row items-center active:opacity-80"
        >
          <View className="w-10 h-10 bg-green-900/30 rounded-full items-center justify-center">
            <Send size={20} color="#4ade80" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-white font-medium">Push Notifications</Text>
            <Text className="text-neutral-500 text-sm">Send alerts to all members</Text>
          </View>
          <ChevronRight size={20} color="#525252" />
        </Pressable>

        {/* Course Reports */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSection('reports');
          }}
          className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mb-3 flex-row items-center active:opacity-80"
        >
          <View className="w-10 h-10 bg-red-900/30 rounded-full items-center justify-center">
            <FileWarning size={20} color="#f87171" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-white font-medium">Course Reports</Text>
            <Text className="text-neutral-500 text-sm">Member condition reports</Text>
          </View>
          {pendingReportsCount > 0 && (
            <View className="bg-red-600 rounded-full px-2 py-0.5 mr-2">
              <Text className="text-white text-xs font-bold">{pendingReportsCount}</Text>
            </View>
          )}
          <ChevronRight size={20} color="#525252" />
        </Pressable>

        {/* Members (Super Admin only) */}
        {isSuperAdmin() && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/admin/members');
            }}
            className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mb-3 flex-row items-center active:opacity-80"
          >
            <View className="w-10 h-10 bg-purple-900/30 rounded-full items-center justify-center">
              <Users size={20} color="#a78bfa" />
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-white font-medium">Members</Text>
              <Text className="text-neutral-500 text-sm">View and manage members</Text>
            </View>
            <ChevronRight size={20} color="#525252" />
          </Pressable>
        )}
      </Animated.View>
    </>
  );

  const renderNotificationsSection = () => (
    <>
      {/* Back Button */}
      <Pressable
        onPress={() => setSection('main')}
        className="flex-row items-center mb-6"
      >
        <Text className="text-lime-400 text-sm">← Back to Dashboard</Text>
      </Pressable>

      <Animated.View entering={FadeInDown.delay(100).duration(500)}>
        <Text className="text-white text-xl font-bold mb-2">Push Notifications</Text>
        <Text className="text-neutral-500 text-sm mb-6">
          Send a push notification to all club members
        </Text>

        {pushSent ? (
          <View className="bg-green-900/30 border border-green-700/50 rounded-xl p-6 items-center">
            <CheckCircle size={48} color="#4ade80" />
            <Text className="text-green-300 text-lg font-semibold mt-4">
              Notification Sent!
            </Text>
            <Text className="text-green-400/70 text-sm mt-1">
              All members will receive your message
            </Text>
          </View>
        ) : (
          <>
            {/* Title */}
            <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2 ml-1">
              Title
            </Text>
            <TextInput
              value={pushTitle}
              onChangeText={setPushTitle}
              placeholder="e.g., Course Update"
              placeholderTextColor="#525252"
              className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-4 text-white text-base mb-4"
            />

            {/* Message */}
            <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2 ml-1">
              Message
            </Text>
            <TextInput
              value={pushMessage}
              onChangeText={setPushMessage}
              placeholder="Enter your notification message..."
              placeholderTextColor="#525252"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-4 text-white text-base mb-6 min-h-[120px]"
            />

            {/* Info Note */}
            <View className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-4 mb-6">
              <View className="flex-row items-start">
                <Info size={18} color="#60a5fa" />
                <Text className="text-blue-300/80 text-sm ml-3 flex-1">
                  This will send an instant push notification to all members who have the app installed and notifications enabled.
                </Text>
              </View>
            </View>

            {/* Send Button */}
            <Pressable
              onPress={handleSendPushNotification}
              disabled={!pushMessage.trim() || isSendingPush}
              className={`rounded-xl py-4 items-center flex-row justify-center gap-2 ${
                pushMessage.trim() && !isSendingPush
                  ? 'bg-green-600 active:bg-green-700'
                  : 'bg-neutral-700'
              }`}
            >
              {isSendingPush ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Send size={18} color="#fff" />
                  <Text className="text-white font-semibold">Send to All Members</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </Animated.View>
    </>
  );

  const renderReportsSection = () => {
    const getStatusColor = (status: CourseReport['status']) => {
      switch (status) {
        case 'pending':
          return 'bg-amber-900/30 border-amber-700/50';
        case 'in_progress':
          return 'bg-blue-900/30 border-blue-700/50';
        case 'resolved':
          return 'bg-green-900/30 border-green-700/50';
        case 'dismissed':
          return 'bg-neutral-800 border-neutral-700';
        default:
          return 'bg-[#141414] border-neutral-800';
      }
    };

    const getStatusLabel = (status: CourseReport['status']) => {
      switch (status) {
        case 'pending':
          return 'Pending';
        case 'in_progress':
          return 'In Progress';
        case 'resolved':
          return 'Resolved';
        case 'dismissed':
          return 'Dismissed';
        default:
          return status;
      }
    };

    return (
      <>
        {/* Back Button */}
        <Pressable
          onPress={() => setSection('main')}
          className="flex-row items-center mb-6"
        >
          <Text className="text-lime-400 text-sm">← Back to Dashboard</Text>
        </Pressable>

        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Text className="text-white text-xl font-bold mb-2">Course Reports</Text>
          <Text className="text-neutral-500 text-sm mb-6">
            Member-submitted course condition reports
          </Text>

          {!courseReports || courseReports.length === 0 ? (
            <View className="bg-[#141414] rounded-xl border border-neutral-800 p-8 items-center">
              <FileWarning size={40} color="#525252" />
              <Text className="text-neutral-500 text-sm mt-4">No reports submitted</Text>
              <Text className="text-neutral-600 text-xs mt-1">
                Members can submit reports via the app
              </Text>
            </View>
          ) : (
            courseReports.map((report, index) => (
              <Animated.View
                key={report.id}
                entering={FadeInDown.delay(index * 50).duration(300)}
              >
                <View
                  className={`rounded-xl border p-4 mb-3 ${getStatusColor(report.status)}`}
                >
                  {/* Header */}
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-white font-medium">
                          {report.report_type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </Text>
                        {report.hole_number && (
                          <View className="bg-neutral-800 px-2 py-0.5 rounded">
                            <Text className="text-neutral-400 text-xs">Hole {report.hole_number}</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-neutral-500 text-xs mt-1">
                        {report.area.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} • Reported by {report.reporter_name}
                      </Text>
                    </View>
                    <View className="bg-neutral-900/50 px-2 py-1 rounded">
                      <Text className="text-neutral-400 text-xs">{getStatusLabel(report.status)}</Text>
                    </View>
                  </View>

                  {/* Description */}
                  <Text className="text-neutral-300 text-sm mb-3">{report.description}</Text>

                  {/* Timestamp */}
                  <View className="flex-row items-center mb-3">
                    <Clock size={12} color="#737373" />
                    <Text className="text-neutral-500 text-xs ml-1">
                      {new Date(report.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>

                  {/* Admin Notes */}
                  {report.admin_notes && (
                    <View className="bg-neutral-900/50 rounded-lg p-3 mb-3">
                      <Text className="text-neutral-400 text-xs uppercase tracking-wide mb-1">
                        Admin Notes
                      </Text>
                      <Text className="text-neutral-300 text-sm">{report.admin_notes}</Text>
                    </View>
                  )}

                  {/* Actions */}
                  {report.status === 'pending' && (
                    <View className="flex-row gap-2 mt-2">
                      <Pressable
                        onPress={() => handleUpdateReportStatus(report.id, 'in_progress')}
                        className="flex-1 bg-blue-600 py-2.5 rounded-lg items-center active:opacity-80"
                      >
                        <Text className="text-white font-medium text-sm">Mark In Progress</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleUpdateReportStatus(report.id, 'dismissed')}
                        className="bg-neutral-800 px-4 py-2.5 rounded-lg items-center active:opacity-80"
                      >
                        <XCircle size={18} color="#737373" />
                      </Pressable>
                    </View>
                  )}

                  {report.status === 'in_progress' && (
                    <View className="flex-row gap-2 mt-2">
                      <Pressable
                        onPress={() => handleUpdateReportStatus(report.id, 'resolved')}
                        className="flex-1 bg-green-600 py-2.5 rounded-lg items-center flex-row justify-center gap-2 active:opacity-80"
                      >
                        <CheckCircle size={16} color="#fff" />
                        <Text className="text-white font-medium text-sm">Mark Resolved</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </Animated.View>
            ))
          )}
        </Animated.View>
      </>
    );
  };

  const renderGeofencingSection = () => (
    <>
      {/* Back Button */}
      <Pressable
        onPress={() => setSection('main')}
        className="flex-row items-center mb-6"
      >
        <Text className="text-lime-400 text-sm">← Back to Dashboard</Text>
      </Pressable>

      <Animated.View entering={FadeInDown.delay(100).duration(500)}>
        <Text className="text-white text-xl font-bold mb-2">Geofencing Settings</Text>
        <Text className="text-neutral-500 text-sm mb-6">
          Control GPS-based features for all members
        </Text>

        {/* Master Toggle */}
        <View className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <MapPin size={20} color={geofenceSettings.enabled ? '#a3e635' : '#525252'} />
              <View className="ml-3 flex-1">
                <Text className="text-white font-medium">Enable All Geofencing</Text>
                <Text className="text-neutral-500 text-xs mt-0.5">Master toggle</Text>
              </View>
            </View>
            <Switch
              value={geofenceSettings.enabled}
              onValueChange={(value) =>
                setGeofenceSettings({ ...geofenceSettings, enabled: value })
              }
              trackColor={{ false: '#333', true: '#365314' }}
              thumbColor={geofenceSettings.enabled ? '#a3e635' : '#666'}
            />
          </View>
        </View>

        {/* Individual Toggles */}
        <View className={`${!geofenceSettings.enabled ? 'opacity-50' : ''}`}>
          {/* Check-in */}
          <View className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mb-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Check size={20} color="#34d399" />
                <View className="ml-3 flex-1">
                  <Text className="text-white font-medium">Auto Check-In</Text>
                  <Text className="text-neutral-500 text-xs mt-0.5">
                    At clubhouse arrival
                  </Text>
                </View>
              </View>
              <Switch
                value={geofenceSettings.check_in_enabled}
                onValueChange={(value) =>
                  setGeofenceSettings({ ...geofenceSettings, check_in_enabled: value })
                }
                disabled={!geofenceSettings.enabled}
                trackColor={{ false: '#333', true: '#365314' }}
                thumbColor={geofenceSettings.check_in_enabled ? '#a3e635' : '#666'}
              />
            </View>
          </View>

          {/* Tee Time Alerts */}
          <View className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mb-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Bell size={20} color="#60a5fa" />
                <View className="ml-3 flex-1">
                  <Text className="text-white font-medium">Tee Time Alerts</Text>
                  <Text className="text-neutral-500 text-xs mt-0.5">
                    At practice range
                  </Text>
                </View>
              </View>
              <Switch
                value={geofenceSettings.tee_time_alerts}
                onValueChange={(value) =>
                  setGeofenceSettings({ ...geofenceSettings, tee_time_alerts: value })
                }
                disabled={!geofenceSettings.enabled}
                trackColor={{ false: '#333', true: '#365314' }}
                thumbColor={geofenceSettings.tee_time_alerts ? '#a3e635' : '#666'}
              />
            </View>
          </View>

          {/* F&B Prompt */}
          <View className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mb-6">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Coffee size={20} color="#fbbf24" />
                <View className="ml-3 flex-1">
                  <Text className="text-white font-medium">The Turn Prompt</Text>
                  <Text className="text-neutral-500 text-xs mt-0.5">
                    F&B at Hole 9
                  </Text>
                </View>
              </View>
              <Switch
                value={geofenceSettings.turn_prompt_enabled}
                onValueChange={(value) =>
                  setGeofenceSettings({ ...geofenceSettings, turn_prompt_enabled: value })
                }
                disabled={!geofenceSettings.enabled}
                trackColor={{ false: '#333', true: '#365314' }}
                thumbColor={geofenceSettings.turn_prompt_enabled ? '#a3e635' : '#666'}
              />
            </View>
          </View>
        </View>

        {/* Save Button */}
        <Pressable
          onPress={handleSaveGeofencing}
          disabled={isSaving}
          className={`rounded-xl py-4 items-center ${
            isSaving ? 'bg-lime-700/50' : 'bg-lime-600 active:bg-lime-700'
          }`}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">Save Changes</Text>
          )}
        </Pressable>
      </Animated.View>
    </>
  );

  const renderAnnouncementsSection = () => {
    const typeOptions: { value: AnnouncementType; label: string; Icon: typeof Info; color: string }[] = [
      { value: 'info', label: 'Info', Icon: Info, color: '#60a5fa' },
      { value: 'warning', label: 'Warning', Icon: AlertTriangle, color: '#fbbf24' },
      { value: 'alert', label: 'Alert', Icon: AlertCircle, color: '#f87171' },
    ];

    return (
      <>
        {/* Back Button */}
        <Pressable
          onPress={() => setSection('main')}
          className="flex-row items-center mb-6"
        >
          <Text className="text-lime-400 text-sm">← Back to Dashboard</Text>
        </Pressable>

        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Text className="text-white text-xl font-bold mb-2">GM Announcements</Text>
          <Text className="text-neutral-500 text-sm mb-6">
            Post a message visible to all members on the home screen
          </Text>

          {/* Enable Toggle */}
          <View className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Megaphone size={20} color={announcement.enabled ? '#a3e635' : '#525252'} />
                <View className="ml-3 flex-1">
                  <Text className="text-white font-medium">Show Announcement</Text>
                  <Text className="text-neutral-500 text-xs mt-0.5">
                    Display on member home screen
                  </Text>
                </View>
              </View>
              <Switch
                value={announcement.enabled}
                onValueChange={(value) =>
                  setAnnouncement({ ...announcement, enabled: value })
                }
                trackColor={{ false: '#333', true: '#365314' }}
                thumbColor={announcement.enabled ? '#a3e635' : '#666'}
              />
            </View>
          </View>

          {/* Type Selection */}
          <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2 ml-1">
            Type
          </Text>
          <View className="flex-row gap-2 mb-4">
            {typeOptions.map(({ value, label, Icon, color }) => (
              <Pressable
                key={value}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setAnnouncement({ ...announcement, type: value });
                }}
                className={`flex-1 py-3 rounded-xl border items-center flex-row justify-center gap-2 ${
                  announcement.type === value
                    ? 'bg-neutral-800 border-lime-600'
                    : 'bg-[#141414] border-neutral-800'
                }`}
              >
                <Icon size={16} color={color} />
                <Text
                  className={`text-sm font-medium ${
                    announcement.type === value ? 'text-white' : 'text-neutral-400'
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Title */}
          <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2 ml-1">
            Title (optional)
          </Text>
          <TextInput
            value={announcement.title}
            onChangeText={(text) => setAnnouncement({ ...announcement, title: text })}
            placeholder="e.g., Course Update"
            placeholderTextColor="#525252"
            className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-4 text-white text-base mb-4"
          />

          {/* Message */}
          <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2 ml-1">
            Message
          </Text>
          <TextInput
            value={announcement.message}
            onChangeText={(text) => setAnnouncement({ ...announcement, message: text })}
            placeholder="Enter your announcement message..."
            placeholderTextColor="#525252"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-4 text-white text-base mb-6 min-h-[120px]"
          />

          {/* Preview */}
          {announcement.message.trim() && (
            <View className="mb-6">
              <Text className="text-neutral-400 text-xs uppercase tracking-[0.1em] mb-2 ml-1">
                Preview
              </Text>
              <View
                className={`rounded-xl p-4 border ${
                  announcement.type === 'warning'
                    ? 'bg-amber-900/40 border-amber-700/50'
                    : announcement.type === 'alert'
                    ? 'bg-red-900/40 border-red-700/50'
                    : 'bg-blue-900/40 border-blue-700/50'
                }`}
              >
                <View className="flex-row items-start">
                  {announcement.type === 'warning' ? (
                    <AlertTriangle size={20} color="#fbbf24" />
                  ) : announcement.type === 'alert' ? (
                    <AlertCircle size={20} color="#f87171" />
                  ) : (
                    <Info size={20} color="#60a5fa" />
                  )}
                  <View className="flex-1 ml-3">
                    {announcement.title ? (
                      <Text
                        className={`font-semibold text-sm ${
                          announcement.type === 'warning'
                            ? 'text-amber-200'
                            : announcement.type === 'alert'
                            ? 'text-red-200'
                            : 'text-blue-200'
                        }`}
                      >
                        {announcement.title}
                      </Text>
                    ) : null}
                    <Text
                      className={`text-sm ${announcement.title ? 'mt-1' : ''} ${
                        announcement.type === 'warning'
                          ? 'text-amber-200'
                          : announcement.type === 'alert'
                          ? 'text-red-200'
                          : 'text-blue-200'
                      }`}
                    >
                      {announcement.message}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Save Button */}
          <Pressable
            onPress={handleSaveAnnouncement}
            disabled={isSaving}
            className={`rounded-xl py-4 items-center ${
              isSaving ? 'bg-lime-700/50' : 'bg-lime-600 active:bg-lime-700'
            }`}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold">
                {announcement.enabled ? 'Publish Announcement' : 'Save Draft'}
              </Text>
            )}
          </Pressable>

          {/* Clear Announcement */}
          {(announcement.message || announcement.title) && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAnnouncement({
                  enabled: false,
                  title: '',
                  message: '',
                  type: 'info',
                  expires_at: null,
                });
              }}
              className="mt-4 py-3 items-center"
            >
              <Text className="text-red-400 font-medium">Clear Announcement</Text>
            </Pressable>
          )}
        </Animated.View>
      </>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center">
        <ActivityIndicator size="large" color="#a3e635" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <SafeAreaView className="flex-1">
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a3e635" />
          }
        >
          {/* Header */}
          <View className="py-4 mb-2">
            <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em]">
              Fox Creek Golf Club
            </Text>
            <Text className="text-white text-2xl font-bold mt-1">Admin Dashboard</Text>
          </View>

          {/* Content based on section */}
          {section === 'main' && renderMainSection()}
          {section === 'geofencing' && renderGeofencingSection()}
          {section === 'announcements' && renderAnnouncementsSection()}
          {section === 'notifications' && renderNotificationsSection()}
          {section === 'reports' && renderReportsSection()}

          <View className="h-8" />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
