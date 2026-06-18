import { useState, useEffect, useMemo, useRef } from 'react';
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
import { Plus, Pencil, Trash2, ImageIcon, Check } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import {
  AD_ROTATION_INTERVAL_OPTIONS,
  getAdRotationSettings,
  getDefaultAdRotationSettings,
  updateAdRotationSettingsAuth,
} from '@/lib/supabase';
import {
  createAdPlacementAuth,
  deleteAdPlacementAuth,
  getAllAdPlacements,
  isHoleSponsorPlacement,
  PLACEMENT_TYPE_LABELS,
  DISPLAY_POSITION_LABELS,
  IMAGE_LAYOUT_LABELS,
  updateAdPlacementAuth,
  type AdPlacementInsert,
} from '@/lib/ad-placement-service';
import { AdPlacementLivePreview } from '@/components/admin/AdPlacementLivePreview';
import { AdPlacementHelpGuide } from '@/components/admin/AdPlacementHelpGuide';
import { useAdDraftPreviewStore } from '@/lib/ad-draft-preview-store';
import type { AdPlacement, AdDisplayPosition, AdImageLayout, AdPlacementType, AdRotationSettings } from '@/types';

const PLACEMENT_TYPES: AdPlacementType[] = [
  'scorecard_header',
  'hole_sponsor',
  'hole_sponsor_secondary',
  'the_turn',
  'leaderboard',
  'member_hub',
  'tournament_detail',
  'tournament_tab_schedule',
  'tournament_tab_match',
  'tournament_tab_teams',
];

const DISPLAY_POSITIONS: AdDisplayPosition[] = ['header_left', 'sidebar', 'footer'];

const IMAGE_LAYOUTS: AdImageLayout[] = ['banner', 'portrait', 'square'];

const EMPTY_FORM: AdPlacementInsert = {
  sponsor_name: '',
  placement_type: 'scorecard_header',
  hole_number: null,
  image_url: '',
  banner_text: '',
  action_url: '',
  display_position: 'sidebar',
  image_layout: 'banner',
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
  const [rotationSettings, setRotationSettings] = useState<AdRotationSettings>(
    getDefaultAdRotationSettings()
  );
  const [savedRotation, setSavedRotation] = useState<AdRotationSettings>(
    getDefaultAdRotationSettings()
  );
  const [isSavingRotation, setIsSavingRotation] = useState(false);
  const [rotationSaveStatus, setRotationSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const rotationSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRotationDirty = useMemo(
    () =>
      rotationSettings.enabled !== savedRotation.enabled ||
      rotationSettings.interval_seconds !== savedRotation.interval_seconds,
    [rotationSettings, savedRotation]
  );

  const rotationStatusLabel = useMemo(() => {
    const mode = savedRotation.enabled ? 'Rotation on' : 'Rotation off';
    const interval = `${savedRotation.interval_seconds}s per sponsor`;
    return `${mode} · ${interval}`;
  }, [savedRotation]);

  const { data: loadedRotationSettings } = useQuery({
    queryKey: ['adRotationSettings'],
    queryFn: getAdRotationSettings,
  });

  useEffect(() => {
    if (loadedRotationSettings) {
      setRotationSettings(loadedRotationSettings);
      setSavedRotation(loadedRotationSettings);
    }
  }, [loadedRotationSettings]);

  useEffect(() => {
    return () => {
      if (rotationSaveTimerRef.current) {
        clearTimeout(rotationSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (initialOpenForm) {
      setShowForm(true);
      setEditingId(null);
      setForm(EMPTY_FORM);
      onFormOpened?.();
    }
  }, [initialOpenForm, onFormOpened]);

  useEffect(() => {
    if (showForm) {
      useAdDraftPreviewStore.getState().setDraft(form);
    }
  }, [form, showForm]);

  const { data: ads = [], isLoading } = useQuery({
    queryKey: ['adminAdPlacements'],
    queryFn: getAllAdPlacements,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['adminAdPlacements'] });
    queryClient.invalidateQueries({ queryKey: ['adPlacement'] });
    queryClient.invalidateQueries({ queryKey: ['adRotationSettings'] });
  };

  const handleSaveRotation = async () => {
    if (!accessToken) {
      Alert.alert('Not signed in', 'Log out of admin and sign in again to save settings.');
      return;
    }

    setIsSavingRotation(true);
    setRotationSaveStatus('idle');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const ok = await updateAdRotationSettingsAuth(rotationSettings, accessToken);
    setIsSavingRotation(false);

    if (!ok) {
      setRotationSaveStatus('error');
      Alert.alert('Could not save rotation settings', 'Try again in a moment.');
      return;
    }

    setSavedRotation(rotationSettings);
    setRotationSaveStatus('saved');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    invalidate();

    if (rotationSaveTimerRef.current) {
      clearTimeout(rotationSaveTimerRef.current);
    }
    rotationSaveTimerRef.current = setTimeout(() => {
      setRotationSaveStatus('idle');
    }, 4000);
  };

  const activeAdsBySlot = ads.reduce<Record<string, number>>((counts, ad) => {
    if (!ad.is_active) return counts;
    const slotKey = [
      ad.placement_type,
      ad.hole_number ?? '',
      ad.display_position ?? '',
      ad.image_layout ?? 'banner',
    ].join('|');
    counts[slotKey] = (counts[slotKey] ?? 0) + 1;
    return counts;
  }, {});

  const getRotationPoolSize = (ad: AdPlacement) => {
    const slotKey = [
      ad.placement_type,
      ad.hole_number ?? '',
      ad.display_position ?? '',
      ad.image_layout ?? 'banner',
    ].join('|');
    return activeAdsBySlot[slotKey] ?? 0;
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
      display_position: ad.display_position ?? 'sidebar',
      image_layout: ad.image_layout ?? 'banner',
      is_active: ad.is_active,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.sponsor_name.trim() || !form.image_url.trim() || !form.banner_text.trim()) {
      Alert.alert('Missing fields', 'Sponsor name, image URL, and banner text are required.');
      return;
    }
    if (isHoleSponsorPlacement(form.placement_type) && !form.hole_number) {
      Alert.alert('Hole required', 'Pick a hole number (1–18) for match hole ads.');
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
          Manage sponsor ads across the home screen, events, scorecards, and TV display. Use the live
          preview when creating ads to pick the right placement and image shape.
        </Text>

        <View className="bg-[#141414] rounded-2xl border border-neutral-800 p-4 mb-6">
          <Text className="text-white font-semibold mb-1">Ad Rotation</Text>
          <Text className="text-neutral-500 text-sm mb-4 leading-5">
            Turn on rotation, then create multiple active ads with the same placement (and hole /
            TV position when applicable). Each ad renders in the layout that fits its image shape
            (Banner, Portrait, or Square). Home uses two streams: banners in the footer, flyers in
            the feed.
          </Text>

          <View className="flex-row items-center justify-between py-2 mb-3">
            <View className="flex-1 pr-4">
              <Text className="text-white font-medium">Rotate multiple sponsors</Text>
              <Text className="text-neutral-500 text-xs mt-1">
                Off = newest ad only. On = carousel through all active ads in each slot.
              </Text>
            </View>
            <Switch
              value={rotationSettings.enabled}
              onValueChange={(enabled) =>
                setRotationSettings((current) => ({ ...current, enabled }))
              }
              trackColor={{ false: '#404040', true: '#4d7c0f' }}
              thumbColor={rotationSettings.enabled ? '#a3e635' : '#737373'}
            />
          </View>

          <Text className="text-neutral-400 text-xs uppercase tracking-wide mb-2">
            Seconds per sponsor
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {AD_ROTATION_INTERVAL_OPTIONS.map((seconds) => (
              <Pressable
                key={seconds}
                onPress={() =>
                  setRotationSettings((current) => ({ ...current, interval_seconds: seconds }))
                }
                className={cn(
                  'px-3 py-2 rounded-lg border',
                  rotationSettings.interval_seconds === seconds
                    ? 'bg-lime-900/40 border-lime-600'
                    : 'bg-[#0c0c0c] border-neutral-800'
                )}
              >
                <Text
                  className={cn(
                    'text-xs',
                    rotationSettings.interval_seconds === seconds
                      ? 'text-lime-400'
                      : 'text-neutral-400'
                  )}
                >
                  {seconds}s
                </Text>
              </Pressable>
            ))}
          </View>

          <View
            className={cn(
              'rounded-lg px-3 py-2 mb-3 border',
              rotationSaveStatus === 'saved'
                ? 'bg-lime-900/30 border-lime-700'
                : rotationSaveStatus === 'error'
                  ? 'bg-red-900/30 border-red-700'
                  : isRotationDirty
                    ? 'bg-amber-950/30 border-amber-800'
                    : 'bg-neutral-900/50 border-neutral-800'
            )}
          >
            <Text
              className={cn(
                'text-xs font-medium',
                rotationSaveStatus === 'saved'
                  ? 'text-lime-300'
                  : rotationSaveStatus === 'error'
                    ? 'text-red-300'
                    : isRotationDirty
                      ? 'text-amber-200'
                      : 'text-neutral-400'
              )}
            >
              {rotationSaveStatus === 'saved'
                ? 'Rotation settings saved.'
                : rotationSaveStatus === 'error'
                  ? 'Save failed — try again.'
                  : isRotationDirty
                    ? 'You have unsaved changes.'
                    : `Saved: ${rotationStatusLabel}`}
            </Text>
          </View>

          <Pressable
            onPress={handleSaveRotation}
            disabled={isSavingRotation || (!isRotationDirty && rotationSaveStatus !== 'error')}
            className={cn(
              'rounded-xl py-3 items-center flex-row justify-center active:opacity-80',
              isSavingRotation || (!isRotationDirty && rotationSaveStatus !== 'error')
                ? 'bg-neutral-800'
                : rotationSaveStatus === 'saved'
                  ? 'bg-lime-700'
                  : 'bg-lime-600'
            )}
          >
            {isSavingRotation ? (
              <ActivityIndicator color="#fff" />
            ) : rotationSaveStatus === 'saved' ? (
              <>
                <Check size={18} color="#fff" />
                <Text className="text-white font-semibold ml-2">Saved</Text>
              </>
            ) : (
              <Text className="text-white font-semibold">Save Rotation Settings</Text>
            )}
          </Pressable>
        </View>

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

            <AdPlacementHelpGuide
              form={form}
              onApplyRecommendedLayout={(layout) =>
                setForm((current) => ({ ...current, image_layout: layout }))
              }
            />

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
                      hole_number: isHoleSponsorPlacement(type) ? f.hole_number ?? 1 : null,
                      display_position: type === 'leaderboard' ? f.display_position ?? 'sidebar' : null,
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
            <Text className="text-neutral-600 text-xs mb-4 leading-5">
              Member Hub: Banner = home footer; Portrait/Square = home feed. Event · Schedule /
              Match / Teams = one ad slot per tab. Event Header = optional ad above all tabs.
            </Text>

            <Text className="text-neutral-400 text-xs uppercase tracking-wide mb-2">
              Image Shape
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {IMAGE_LAYOUTS.map((layout) => (
                <Pressable
                  key={layout}
                  onPress={() => setForm((f) => ({ ...f, image_layout: layout }))}
                  className={cn(
                    'px-3 py-2 rounded-lg border',
                    form.image_layout === layout
                      ? 'bg-lime-900/40 border-lime-600'
                      : 'bg-[#0c0c0c] border-neutral-800'
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs',
                      form.image_layout === layout ? 'text-lime-400' : 'text-neutral-400'
                    )}
                  >
                    {IMAGE_LAYOUT_LABELS[layout]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-neutral-600 text-xs mb-4 leading-5">
              Banner = wide logos & short ads. Portrait = tall flyers, lot maps, posters (shows as a
              card in the home feed). Square = social-style graphics.
            </Text>

            {isHoleSponsorPlacement(form.placement_type) && (
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

            {form.placement_type === 'leaderboard' && (
              <View className="mb-4">
                <Text className="text-neutral-400 text-xs uppercase tracking-wide mb-2">
                  TV Display Position
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {DISPLAY_POSITIONS.map((position) => (
                    <Pressable
                      key={position}
                      onPress={() => setForm((f) => ({ ...f, display_position: position }))}
                      className={cn(
                        'px-3 py-2 rounded-lg border',
                        form.display_position === position
                          ? 'bg-lime-900/40 border-lime-600'
                          : 'bg-[#0c0c0c] border-neutral-800'
                      )}
                    >
                      <Text
                        className={cn(
                          'text-xs',
                          form.display_position === position ? 'text-lime-400' : 'text-neutral-400'
                        )}
                      >
                        {DISPLAY_POSITION_LABELS[position]}
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

            <AdPlacementLivePreview form={form} />

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
                  className="w-full bg-white"
                  style={{
                    height: ad.image_layout === 'portrait' ? 180 : ad.image_layout === 'square' ? 140 : 96,
                  }}
                  resizeMode="contain"
                />
                <View className="p-4">
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 mr-2">
                      <Text className="text-white font-semibold">{ad.sponsor_name}</Text>
                      <Text className="text-lime-400/80 text-xs mt-0.5">
                        {PLACEMENT_TYPE_LABELS[ad.placement_type]}
                        {` · ${IMAGE_LAYOUT_LABELS[ad.image_layout ?? 'banner']}`}
                        {ad.hole_number ? ` · Hole ${ad.hole_number}` : ''}
                        {ad.display_position
                          ? ` · ${DISPLAY_POSITION_LABELS[ad.display_position]}`
                          : ''}
                        {ad.is_active && getRotationPoolSize(ad) > 1
                          ? ` · Rotation pool (${getRotationPoolSize(ad)})`
                          : ''}
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
