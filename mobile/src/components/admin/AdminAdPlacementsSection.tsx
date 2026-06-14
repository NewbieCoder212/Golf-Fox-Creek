import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Plus, Pencil, Trash2, ImageIcon } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import {
  createAdPlacementAuth,
  deleteAdPlacementAuth,
  getAllAdPlacements,
  PLACEMENT_TYPE_LABELS,
  updateAdPlacementAuth,
  type AdPlacementInsert,
} from '@/lib/ad-placement-service';
import type { AdPlacement, AdPlacementType } from '@/types';

const PLACEMENT_TYPES: AdPlacementType[] = [
  'scorecard_header',
  'hole_sponsor',
  'the_turn',
  'leaderboard',
];

const EMPTY_FORM: AdPlacementInsert = {
  sponsor_name: '',
  placement_type: 'scorecard_header',
  hole_number: null,
  image_url: '',
  banner_text: '',
  action_url: '',
  is_active: true,
};

interface AdminAdPlacementsSectionProps {
  accessToken: string;
  onBack: () => void;
  initialOpenForm?: boolean;
  onFormOpened?: () => void;
}

export function AdminAdPlacementsSection({
  accessToken,
  onBack,
  initialOpenForm = false,
  onFormOpened,
}: AdminAdPlacementsSectionProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(initialOpenForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AdPlacementInsert>(EMPTY_FORM);

  useEffect(() => {
    if (initialOpenForm) {
      setShowForm(true);
      setEditingId(null);
      setForm(EMPTY_FORM);
      onFormOpened?.();
    }
  }, [initialOpenForm, onFormOpened]);

  const { data: ads = [], isLoading } = useQuery({
    queryKey: ['adminAdPlacements'],
    queryFn: getAllAdPlacements,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['adminAdPlacements'] });
    queryClient.invalidateQueries({ queryKey: ['adPlacement'] });
  };

  const createMutation = useMutation({
    mutationFn: () => createAdPlacementAuth(accessToken, form),
    onSuccess: (result) => {
      if (result.error) {
        Alert.alert('Could not create ad', result.error);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      editingId
        ? updateAdPlacementAuth(accessToken, editingId, form)
        : Promise.resolve({ data: null, error: 'No ad selected' }),
    onSuccess: (result) => {
      if (result.error) {
        Alert.alert('Could not update ad', result.error);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdPlacementAuth(accessToken, id),
    onSuccess: (result, id) => {
      if (result.error) {
        Alert.alert('Could not delete ad', result.error);
        return;
      }
      if (editingId === id) resetForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateAdPlacementAuth(accessToken, id, { is_active }),
    onSuccess: (result) => {
      if (result.error) {
        Alert.alert('Could not update ad', result.error);
        return;
      }
      invalidate();
    },
  });

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const startCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const startEdit = (ad: AdPlacement) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingId(ad.id);
    setForm({
      sponsor_name: ad.sponsor_name,
      placement_type: ad.placement_type,
      hole_number: ad.hole_number,
      image_url: ad.image_url,
      banner_text: ad.banner_text,
      action_url: ad.action_url ?? '',
      is_active: ad.is_active,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.sponsor_name.trim() || !form.image_url.trim() || !form.banner_text.trim()) {
      Alert.alert('Missing fields', 'Sponsor name, image URL, and banner text are required.');
      return;
    }
    if (form.placement_type === 'hole_sponsor' && !form.hole_number) {
      Alert.alert('Hole required', 'Pick a hole number for hole sponsor ads.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (editingId) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Pressable onPress={onBack} className="flex-row items-center mb-6">
        <Text className="text-lime-400 text-sm">← Back to Dashboard</Text>
      </Pressable>

      <Animated.View entering={FadeInDown.delay(100).duration(500)}>
        <Text className="text-white text-xl font-bold mb-2">Sponsor Ads</Text>
        <Text className="text-neutral-500 text-sm mb-4">
          Manage banners shown on scorecards, holes, and The Turn
        </Text>

        <Pressable
          onPress={startCreate}
          className="flex-row items-center justify-center bg-lime-600 py-3.5 rounded-xl mb-6 active:opacity-80"
        >
          <Plus size={18} color="#fff" />
          <Text className="text-white font-semibold text-base ml-2">New Ad</Text>
        </Pressable>

        {showForm && (
          <View className="bg-[#141414] rounded-2xl border border-neutral-800 p-4 mb-6">
            <Text className="text-white font-semibold mb-4">
              {editingId ? 'Edit Ad' : 'Create Ad'}
            </Text>

            <Text className="text-neutral-400 text-xs uppercase tracking-wide mb-2">
              Placement
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {PLACEMENT_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() =>
                    setForm((f) => ({
                      ...f,
                      placement_type: type,
                      hole_number: type === 'hole_sponsor' ? f.hole_number ?? 1 : null,
                    }))
                  }
                  className={cn(
                    'px-3 py-2 rounded-lg border',
                    form.placement_type === type
                      ? 'bg-lime-900/40 border-lime-600'
                      : 'bg-[#0c0c0c] border-neutral-800'
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs',
                      form.placement_type === type ? 'text-lime-400' : 'text-neutral-400'
                    )}
                  >
                    {PLACEMENT_TYPE_LABELS[type]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {form.placement_type === 'hole_sponsor' && (
              <View className="mb-4">
                <Text className="text-neutral-400 text-xs uppercase tracking-wide mb-2">
                  Hole Number
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((hole) => (
                    <Pressable
                      key={hole}
                      onPress={() => setForm((f) => ({ ...f, hole_number: hole }))}
                      className={cn(
                        'w-10 h-10 rounded-lg items-center justify-center border',
                        form.hole_number === hole
                          ? 'bg-lime-900/40 border-lime-600'
                          : 'bg-[#0c0c0c] border-neutral-800'
                      )}
                    >
                      <Text
                        className={cn(
                          'font-semibold',
                          form.hole_number === hole ? 'text-lime-400' : 'text-neutral-500'
                        )}
                      >
                        {hole}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <Field label="Sponsor Name" value={form.sponsor_name} onChangeText={(v) => setForm((f) => ({ ...f, sponsor_name: v }))} placeholder="Fox Creek Canteen" />
            <Field label="Image URL" value={form.image_url} onChangeText={(v) => setForm((f) => ({ ...f, image_url: v }))} placeholder="https://..." />
            <Field label="Banner Text" value={form.banner_text} onChangeText={(v) => setForm((f) => ({ ...f, banner_text: v }))} placeholder="Show this screen for 10% off!" multiline />
            <Field label="Action URL (optional)" value={form.action_url ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, action_url: v }))} placeholder="https://..." />

            {form.image_url.trim() ? (
              <Image
                source={{ uri: form.image_url.trim() }}
                className="w-full h-24 rounded-xl mb-4"
                resizeMode="cover"
              />
            ) : null}

            <View className="flex-row items-center justify-between py-3 mb-4">
              <Text className="text-white font-medium">Active</Text>
              <Switch
                value={form.is_active ?? true}
                onValueChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                trackColor={{ false: '#404040', true: '#4d7c0f' }}
                thumbColor={form.is_active ? '#a3e635' : '#737373'}
              />
            </View>

            <View className="flex-row gap-3">
              <Pressable
                onPress={resetForm}
                className="flex-1 bg-neutral-800 rounded-xl py-3 items-center active:opacity-80"
              >
                <Text className="text-neutral-300 font-medium">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                className="flex-1 bg-lime-600 rounded-xl py-3 items-center active:opacity-80"
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">
                    {editingId ? 'Save Changes' : 'Create Ad'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator color="#a3e635" className="mt-8" />
        ) : ads.length === 0 ? (
          <View className="bg-[#141414] rounded-xl border border-neutral-800 p-8 items-center">
            <ImageIcon size={40} color="#525252" />
            <Text className="text-neutral-500 text-sm mt-4">No sponsor ads yet</Text>
            <Text className="text-neutral-600 text-xs mt-1 text-center">
              Tap New Ad to create your first banner
            </Text>
          </View>
        ) : (
          ads.map((ad, index) => (
            <Animated.View key={ad.id} entering={FadeInDown.delay(index * 40).duration(300)}>
              <View className="bg-[#141414] rounded-xl border border-neutral-800 mb-3 overflow-hidden">
                <Image
                  source={{ uri: ad.image_url }}
                  className="w-full h-24"
                  resizeMode="cover"
                />
                <View className="p-4">
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 mr-2">
                      <Text className="text-white font-semibold">{ad.sponsor_name}</Text>
                      <Text className="text-lime-400/80 text-xs mt-0.5">
                        {PLACEMENT_TYPE_LABELS[ad.placement_type]}
                        {ad.hole_number ? ` · Hole ${ad.hole_number}` : ''}
                      </Text>
                    </View>
                    <View
                      className={cn(
                        'px-2 py-0.5 rounded',
                        ad.is_active ? 'bg-green-900/40' : 'bg-neutral-800'
                      )}
                    >
                      <Text
                        className={cn(
                          'text-xs font-medium',
                          ad.is_active ? 'text-green-400' : 'text-neutral-500'
                        )}
                      >
                        {ad.is_active ? 'Live' : 'Off'}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-neutral-400 text-sm mb-3" numberOfLines={2}>
                    {ad.banner_text}
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <Switch
                      value={ad.is_active}
                      onValueChange={(v) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toggleMutation.mutate({ id: ad.id, is_active: v });
                      }}
                      trackColor={{ false: '#404040', true: '#4d7c0f' }}
                      thumbColor={ad.is_active ? '#a3e635' : '#737373'}
                    />
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => startEdit(ad)}
                        className="w-9 h-9 bg-neutral-800 rounded-lg items-center justify-center active:opacity-80"
                      >
                        <Pencil size={16} color="#a3e635" />
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          Alert.alert(
                            'Delete ad?',
                            `Remove "${ad.sponsor_name}"?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => deleteMutation.mutate(ad.id),
                              },
                            ]
                          );
                        }}
                        className="w-9 h-9 bg-neutral-800 rounded-lg items-center justify-center active:opacity-80"
                      >
                        <Trash2 size={16} color="#f87171" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>
          ))
        )}
      </Animated.View>
    </>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View className="mb-4">
      <Text className="text-neutral-400 text-xs uppercase tracking-wide mb-2">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#525252"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        className={cn(
          'bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white text-base',
          multiline && 'min-h-[80px]'
        )}
      />
    </View>
  );
}
