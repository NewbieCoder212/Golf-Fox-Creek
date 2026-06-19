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
import { Plus, Pencil, Trash2, ImageIcon, Check, ChevronDown, ChevronUp } from 'lucide-react-native';

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
  isEventTabPlacement,
  PLACEMENT_TYPE_LABELS,
  DISPLAY_POSITION_LABELS,
  IMAGE_LAYOUT_LABELS,
  updateAdPlacementAuth,
  EVENT_TAB_KEYS,
  EVENT_TAB_LABELS,
  EVENT_TAB_PLACEMENTS,
  eventTabKeyFromPlacement,
  type AdPlacementInsert,
  type TournamentEventTabKey,
} from '@/lib/ad-placement-service';
import { AdPlacementLivePreview } from '@/components/admin/AdPlacementLivePreview';
import { AdPlacementHelpGuide } from '@/components/admin/AdPlacementHelpGuide';
import { AdminEventTabAdsPanel } from '@/components/admin/AdminEventTabAdsPanel';
import { useAdDraftPreviewStore } from '@/lib/ad-draft-preview-store';
import type { AdPlacement, AdDisplayPosition, AdImageLayout, AdPlacementType, AdRotationSettings } from '@/types';

const OTHER_PLACEMENT_TYPES: AdPlacementType[] = [
  'member_hub',
  'tournament_detail',
  'scorecard_header',
  'hole_sponsor',
  'hole_sponsor_secondary',
  'the_turn',
  'leaderboard',
];

const DISPLAY_POSITIONS: AdDisplayPosition[] = ['header_left', 'sidebar', 'footer'];

const IMAGE_LAYOUTS: AdImageLayout[] = ['banner', 'portrait', 'square'];

const EMPTY_FORM: AdPlacementInsert = {
  sponsor_name: '',
  placement_type: 'tournament_tab_standings',
  hole_number: null,
  image_url: '',
  banner_text: '',
  action_url: '',
  display_position: 'sidebar',
  image_layout: 'banner',
  is_active: true,
};

type FormMode = 'event' | 'other';

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
  const [formMode, setFormMode] = useState<FormMode>('event');
  const [selectedEventTabs, setSelectedEventTabs] = useState<TournamentEventTabKey[]>(['standings']);
  const [alsoEventHeader, setAlsoEventHeader] = useState(false);
  const [showOtherLocations, setShowOtherLocations] = useState(false);
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
      setFormMode('event');
      setSelectedEventTabs(['standings']);
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
    mutationFn: async () => {
      if (formMode === 'event' && !editingId) {
        const tabs = selectedEventTabs.length > 0 ? selectedEventTabs : ['standings' as const];
        const placementTypes: AdPlacementType[] = [
          ...tabs.map((tab) => EVENT_TAB_PLACEMENTS[tab]),
          ...(alsoEventHeader ? (['tournament_detail'] as AdPlacementType[]) : []),
        ];

        let lastError: string | null = null;
        for (const placement_type of placementTypes) {
          const result = await createAdPlacementAuth(accessToken, { ...form, placement_type });
          if (result.error) lastError = result.error;
        }
        return lastError ? { data: null, error: lastError } : { data: [], error: null };
      }

      return createAdPlacementAuth(accessToken, form);
    },
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
    setFormMode('event');
    setSelectedEventTabs(['standings']);
    setAlsoEventHeader(false);
  };

  const startCreateEvent = (tabs: TournamentEventTabKey[]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingId(null);
    setForm({ ...EMPTY_FORM, placement_type: EVENT_TAB_PLACEMENTS[tabs[0] ?? 'standings'] });
    setFormMode('event');
    setSelectedEventTabs(tabs);
    setAlsoEventHeader(false);
    setShowForm(true);
  };

  const startCreateOther = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingId(null);
    setForm({ ...EMPTY_FORM, placement_type: 'member_hub' });
    setFormMode('other');
    setShowForm(true);
  };

  const startEdit = (ad: AdPlacement) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingId(ad.id);
    const isEvent = isEventTabPlacement(ad.placement_type);
    setFormMode(isEvent ? 'event' : 'other');
    const tabKey = eventTabKeyFromPlacement(ad.placement_type);
    setSelectedEventTabs(tabKey ? [tabKey] : ['standings']);
    setAlsoEventHeader(false);
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

  const toggleEventTab = (tab: TournamentEventTabKey) => {
    if (editingId) return;
    setSelectedEventTabs((current) => {
      const next = current.includes(tab)
        ? current.filter((item) => item !== tab)
        : [...current, tab];
      const primary = next[0] ?? tab;
      setForm((f) => ({ ...f, placement_type: EVENT_TAB_PLACEMENTS[primary] }));
      return next.length > 0 ? next : [tab];
    });
  };

  const handleSave = () => {
    if (!form.sponsor_name.trim() || !form.image_url.trim() || !form.banner_text.trim()) {
      Alert.alert('Missing fields', 'Sponsor name, image URL, and banner text are required.');
      return;
    }
    if (formMode === 'event' && !editingId && selectedEventTabs.length === 0) {
      Alert.alert('Pick a tab', 'Choose at least one event tab for this sponsor.');
      return;
    }
    if (formMode === 'other' && isHoleSponsorPlacement(form.placement_type) && !form.hole_number) {
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
  const otherAds = ads.filter((ad) => !isEventTabPlacement(ad.placement_type));

  return (
    <>
      <Pressable onPress={onBack} className="flex-row items-center mb-6">
        <Text className="text-lime-400 text-sm">← Back to Dashboard</Text>
      </Pressable>

      <Animated.View entering={FadeInDown.delay(100).duration(500)}>
        <Text className="text-white text-xl font-bold mb-2">Sponsor Ads</Text>
        <Text className="text-neutral-500 text-sm mb-4">
          Event tab sponsors are the fastest way to get ads in front of members during a tournament.
          Turn on rotation to cycle multiple sponsors in each tab.
        </Text>

        <View className="bg-[#141414] rounded-2xl border border-neutral-800 p-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1 pr-4">
              <Text className="text-white font-semibold">Rotation</Text>
              <Text className="text-neutral-500 text-xs mt-1">
                {savedRotation.enabled
                  ? `On · ${savedRotation.interval_seconds}s per sponsor`
                  : 'Off · newest ad only'}
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

          <View className="flex-row flex-wrap gap-2 mb-3">
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

          <Pressable
            onPress={handleSaveRotation}
            disabled={isSavingRotation || (!isRotationDirty && rotationSaveStatus !== 'error')}
            className={cn(
              'rounded-xl py-2.5 items-center flex-row justify-center active:opacity-80',
              isSavingRotation || (!isRotationDirty && rotationSaveStatus !== 'error')
                ? 'bg-neutral-800'
                : 'bg-lime-600'
            )}
          >
            {isSavingRotation ? (
              <ActivityIndicator color="#fff" />
            ) : rotationSaveStatus === 'saved' ? (
              <>
                <Check size={16} color="#fff" />
                <Text className="text-white font-semibold text-sm ml-2">Saved</Text>
              </>
            ) : (
              <Text className="text-white font-semibold text-sm">
                {isRotationDirty ? 'Save rotation' : 'Rotation saved'}
              </Text>
            )}
          </Pressable>
        </View>

        {!showForm ? (
          <AdminEventTabAdsPanel
            ads={ads}
            rotationEnabled={savedRotation.enabled}
            onAddToTab={(tab) => startCreateEvent([tab])}
            onAddToAllTabs={() => startCreateEvent([...EVENT_TAB_KEYS])}
            onEditAd={startEdit}
            onToggleAd={(id, is_active) => toggleMutation.mutate({ id, is_active })}
            onDeleteAd={(id) => deleteMutation.mutate(id)}
          />
        ) : null}

        {showForm && (
          <View className="bg-[#141414] rounded-2xl border border-neutral-800 p-4 mb-6">
            <Text className="text-white font-semibold mb-4">
              {editingId ? 'Edit sponsor' : formMode === 'event' ? 'Add event sponsor' : 'Add sponsor'}
            </Text>

            <AdPlacementHelpGuide
              form={form}
              onApplyRecommendedLayout={(layout) =>
                setForm((current) => ({ ...current, image_layout: layout }))
              }
            />

            {formMode === 'event' ? (
              <>
                <Text className="text-neutral-400 text-xs uppercase tracking-wide mb-2">
                  Event tabs
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {EVENT_TAB_KEYS.map((tab) => {
                    const selected = selectedEventTabs.includes(tab);
                    return (
                      <Pressable
                        key={tab}
                        disabled={Boolean(editingId)}
                        onPress={() => toggleEventTab(tab)}
                        className={cn(
                          'px-3 py-2 rounded-lg border',
                          selected
                            ? 'bg-lime-900/40 border-lime-600'
                            : 'bg-[#0c0c0c] border-neutral-800',
                          editingId && 'opacity-60'
                        )}
                      >
                        <Text
                          className={cn(
                            'text-xs font-medium',
                            selected ? 'text-lime-400' : 'text-neutral-400'
                          )}
                        >
                          {EVENT_TAB_LABELS[tab]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {!editingId ? (
                  <>
                    <Pressable
                      onPress={() => setSelectedEventTabs([...EVENT_TAB_KEYS])}
                      className="mb-3 active:opacity-80"
                    >
                      <Text className="text-lime-400 text-xs font-semibold">Select all tabs</Text>
                    </Pressable>
                    <View className="flex-row items-center justify-between py-2 mb-4">
                      <View className="flex-1 pr-4">
                        <Text className="text-white font-medium text-sm">Also show above tabs</Text>
                        <Text className="text-neutral-500 text-xs mt-0.5">
                          Optional banner under the event name on every tab
                        </Text>
                      </View>
                      <Switch
                        value={alsoEventHeader}
                        onValueChange={setAlsoEventHeader}
                        trackColor={{ false: '#404040', true: '#4d7c0f' }}
                        thumbColor={alsoEventHeader ? '#a3e635' : '#737373'}
                      />
                    </View>
                  </>
                ) : (
                  <Text className="text-neutral-600 text-xs mb-4">
                    Editing one tab slot. Create a new ad to add the same sponsor to more tabs.
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text className="text-neutral-400 text-xs uppercase tracking-wide mb-2">
                  Location
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {OTHER_PLACEMENT_TYPES.map((type) => (
                    <Pressable
                      key={type}
                      onPress={() =>
                        setForm((f) => ({
                          ...f,
                          placement_type: type,
                          hole_number: isHoleSponsorPlacement(type) ? f.hole_number ?? 1 : null,
                          display_position:
                            type === 'leaderboard' ? f.display_position ?? 'sidebar' : null,
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
              </>
            )}

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

            {formMode === 'other' && isHoleSponsorPlacement(form.placement_type) && (
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
                    {editingId
                      ? 'Save Changes'
                      : formMode === 'event' && selectedEventTabs.length > 1
                        ? `Create for ${selectedEventTabs.length} tabs`
                        : 'Create Ad'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {!showForm ? (
          <Pressable
            onPress={() => setShowOtherLocations((current) => !current)}
            className="flex-row items-center justify-between bg-[#141414] rounded-xl border border-neutral-800 px-4 py-3 mb-3 active:opacity-80"
          >
            <View>
              <Text className="text-white font-semibold">Other ad locations</Text>
              <Text className="text-neutral-500 text-xs mt-0.5">
                Home, scorecard, TV display, event header
              </Text>
            </View>
            {showOtherLocations ? (
              <ChevronUp size={18} color="#737373" />
            ) : (
              <ChevronDown size={18} color="#737373" />
            )}
          </Pressable>
        ) : null}

        {!showForm && showOtherLocations ? (
          <>
            <Pressable
              onPress={startCreateOther}
              className="flex-row items-center justify-center bg-neutral-800 border border-neutral-700 py-3 rounded-xl mb-4 active:opacity-80"
            >
              <Plus size={16} color="#a3e635" />
              <Text className="text-neutral-200 font-semibold text-sm ml-2">Add other sponsor</Text>
            </Pressable>

            {isLoading ? (
              <ActivityIndicator color="#a3e635" className="mt-4" />
            ) : otherAds.length === 0 ? (
              <View className="bg-[#141414] rounded-xl border border-neutral-800 p-6 items-center mb-4">
                <ImageIcon size={32} color="#525252" />
                <Text className="text-neutral-500 text-sm mt-3">No other sponsors yet</Text>
              </View>
            ) : (
              otherAds.map((ad, index) => (
                <Animated.View key={ad.id} entering={FadeInDown.delay(index * 40).duration(300)}>
                  <View className="bg-[#141414] rounded-xl border border-neutral-800 mb-3 overflow-hidden">
                    <Image
                      source={{ uri: ad.image_url }}
                      className="w-full bg-white"
                      style={{
                        height:
                          ad.image_layout === 'portrait'
                            ? 180
                            : ad.image_layout === 'square'
                              ? 140
                              : 96,
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
                              Alert.alert('Delete ad?', `Remove "${ad.sponsor_name}"?`, [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Delete',
                                  style: 'destructive',
                                  onPress: () => deleteMutation.mutate(ad.id),
                                },
                              ]);
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
          </>
        ) : null}
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
