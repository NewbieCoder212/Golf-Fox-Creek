import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { UserPlus, Trash2, Pencil, Check, X } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { webPressHandler } from '@/lib/web-press';

export interface RosterMemberOption {
  id: string;
  full_name: string;
  handicap_index: number | null;
  email?: string | null;
}

export interface RosterDraftEntry {
  key: string;
  display_name: string;
  handicap_index: number;
  user_id?: string | null;
}

export interface RosterPlayerEntry {
  id: string;
  display_name: string;
  handicap_index: number;
  user_id?: string | null;
  email?: string | null;
}

interface TournamentRosterEditorProps {
  members: RosterMemberOption[];
  mode: 'draft' | 'editing';
  draftRoster?: RosterDraftEntry[];
  editingRoster?: RosterPlayerEntry[];
  newPlayerName: string;
  newPlayerHandicap: string;
  onNewPlayerNameChange: (value: string) => void;
  onNewPlayerHandicapChange: (value: string) => void;
  onAddPlayerByName: () => void;
  onAddMember: (memberId: string) => void;
  onRemoveDraftPlayer?: (key: string) => void;
  onRemoveEditingPlayer?: (playerId: string) => void;
  canRemoveEditingPlayers?: boolean;
  canEditEditingPlayers?: boolean;
  canEditPlayerEmail?: boolean;
  editingPlayerId?: string | null;
  editPlayerName?: string;
  editPlayerHandicap?: string;
  editPlayerEmail?: string;
  onEditPlayerNameChange?: (value: string) => void;
  onEditPlayerHandicapChange?: (value: string) => void;
  onEditPlayerEmailChange?: (value: string) => void;
  onStartEditPlayer?: (player: RosterPlayerEntry) => void;
  onCancelEditPlayer?: () => void;
  onSaveEditPlayer?: (playerId: string) => void;
  isAddingPlayer?: boolean;
  isRemovingPlayer?: boolean;
  isSavingPlayer?: boolean;
  savingPlayerId?: string | null;
}

const fieldClassName =
  'bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white text-base';
const fieldStyle = { color: '#ffffff' as const };

export function TournamentRosterEditor({
  members,
  mode,
  draftRoster = [],
  editingRoster = [],
  newPlayerName,
  newPlayerHandicap,
  onNewPlayerNameChange,
  onNewPlayerHandicapChange,
  onAddPlayerByName,
  onAddMember,
  onRemoveDraftPlayer,
  onRemoveEditingPlayer,
  canRemoveEditingPlayers = false,
  canEditEditingPlayers = false,
  canEditPlayerEmail = false,
  editingPlayerId = null,
  editPlayerName = '',
  editPlayerHandicap = '',
  editPlayerEmail = '',
  onEditPlayerNameChange,
  onEditPlayerHandicapChange,
  onEditPlayerEmailChange,
  onStartEditPlayer,
  onCancelEditPlayer,
  onSaveEditPlayer,
  isAddingPlayer = false,
  isRemovingPlayer = false,
  isSavingPlayer = false,
  savingPlayerId = null,
}: TournamentRosterEditorProps) {
  const rosterOnTeam = (memberId: string) => {
    if (mode === 'draft') {
      return draftRoster.some((entry) => entry.user_id === memberId);
    }
    return editingRoster.some((entry) => entry.user_id === memberId);
  };

  return (
    <View>
      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
        Add Player by Name
      </Text>
      <View className="flex-row gap-2 mb-2">
        <TextInput
          value={newPlayerName}
          onChangeText={onNewPlayerNameChange}
          placeholder="Player name"
          placeholderTextColor="#525252"
          autoCorrect={false}
          className="flex-1 bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white text-base"
          style={fieldStyle}
        />
        <TextInput
          value={newPlayerHandicap}
          onChangeText={onNewPlayerHandicapChange}
          placeholder="HI"
          placeholderTextColor="#525252"
          keyboardType="decimal-pad"
          className="w-16 bg-[#0c0c0c] border border-neutral-800 rounded-xl px-3 py-3 text-white text-center text-base"
          style={fieldStyle}
        />
      </View>
      <Pressable
        onPress={webPressHandler(onAddPlayerByName)}
        disabled={!newPlayerName.trim() || isAddingPlayer}
        className="flex-row items-center justify-center bg-neutral-800 rounded-xl py-3 mb-4 active:opacity-80"
      >
        <UserPlus size={16} color="#a3e635" />
        <Text className="text-lime-400 font-semibold ml-2">Add Player</Text>
      </Pressable>

      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
        Or Add Club Member
      </Text>
      <View className="mb-4">
        {members.map((member) => {
          const onRoster = rosterOnTeam(member.id);
          return (
            <Pressable
              key={member.id}
              onPress={() => onAddMember(member.id)}
              disabled={onRoster || isAddingPlayer}
              className={cn(
                'flex-row items-center justify-between px-4 py-3 rounded-xl mb-2 border',
                onRoster
                  ? 'bg-neutral-900 border-neutral-800 opacity-50'
                  : 'bg-[#0c0c0c] border-neutral-800 active:opacity-80'
              )}
            >
              <Text className="text-white font-medium">{member.full_name}</Text>
              <Text className="text-neutral-500 text-sm">
                {onRoster ? 'Added' : `${member.handicap_index?.toFixed(1) ?? '--'} HI`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
        {mode === 'editing' ? 'Current Roster' : `Roster (${draftRoster.length})`}
      </Text>
      {mode === 'draft' ? (
        draftRoster.length === 0 ? (
          <Text className="text-neutral-500 text-sm mb-4">Add at least one player.</Text>
        ) : (
          draftRoster.map((entry) => (
            <View
              key={entry.key}
              className="flex-row items-center justify-between bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 mb-2"
            >
              <View>
                <Text className="text-white font-medium">{entry.display_name}</Text>
                <Text className="text-neutral-500 text-xs mt-0.5">
                  {entry.handicap_index.toFixed(1)} HI
                  {entry.user_id ? ' · Member' : ' · Guest'}
                </Text>
              </View>
              <Pressable onPress={webPressHandler(() => onRemoveDraftPlayer?.(entry.key))}>
                <Trash2 size={16} color="#737373" />
              </Pressable>
            </View>
          ))
        )
      ) : editingRoster.length === 0 ? (
        <Text className="text-neutral-500 text-sm mb-4">Add at least one player.</Text>
      ) : (
        editingRoster.map((entry) => {
          const isEditing = editingPlayerId === entry.id;
          const isSaving = isSavingPlayer && savingPlayerId === entry.id;

          if (isEditing) {
            return (
              <View
                key={entry.id}
                className="bg-[#141414] border border-lime-600/40 rounded-xl px-4 py-3 mb-2"
              >
                <TextInput
                  value={editPlayerName}
                  onChangeText={onEditPlayerNameChange}
                  placeholder="Player name"
                  placeholderTextColor="#525252"
                  autoCorrect={false}
                  className={cn(fieldClassName, 'mb-2')}
                  style={fieldStyle}
                  autoFocus
                />
                {canEditPlayerEmail ? (
                  <TextInput
                    value={editPlayerEmail}
                    onChangeText={onEditPlayerEmailChange}
                    placeholder="Email (optional)"
                    placeholderTextColor="#525252"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className={cn(fieldClassName, 'mb-2')}
                    style={fieldStyle}
                  />
                ) : null}
                <TextInput
                  value={editPlayerHandicap}
                  onChangeText={onEditPlayerHandicapChange}
                  placeholder="Handicap index"
                  placeholderTextColor="#525252"
                  keyboardType="decimal-pad"
                  className={cn(fieldClassName, 'mb-3')}
                  style={fieldStyle}
                />
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={webPressHandler(onCancelEditPlayer ?? (() => {}))}
                    disabled={isSaving}
                    className="flex-1 flex-row items-center justify-center border border-neutral-700 rounded-xl py-2.5 active:opacity-80"
                  >
                    <X size={16} color="#a3a3a3" />
                    <Text className="text-neutral-300 font-semibold ml-1.5">Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={webPressHandler(() => onSaveEditPlayer?.(entry.id))}
                    disabled={isSaving || !editPlayerName.trim()}
                    className={cn(
                      'flex-1 flex-row items-center justify-center rounded-xl py-2.5 border',
                      isSaving || !editPlayerName.trim()
                        ? 'border-neutral-800 bg-neutral-900/50 opacity-50'
                        : 'border-lime-700 bg-lime-900/30 active:opacity-80'
                    )}
                  >
                    {isSaving ? (
                      <ActivityIndicator color="#a3e635" />
                    ) : (
                      <>
                        <Check size={16} color="#a3e635" />
                        <Text className="text-lime-400 font-semibold ml-1.5">Save</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          }

          return (
            <View
              key={entry.id}
              className="flex-row items-center justify-between bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 mb-2"
            >
              <View className="flex-1 mr-2">
                <Text className="text-white font-medium">{entry.display_name}</Text>
                <Text className="text-neutral-500 text-xs mt-0.5">
                  {entry.handicap_index.toFixed(1)} HI
                  {entry.user_id ? ' · Member' : ' · Guest'}
                  {entry.email ? ` · ${entry.email}` : ''}
                </Text>
              </View>
              <View className="flex-row items-center gap-3">
                {canEditEditingPlayers ? (
                  <Pressable
                    onPress={webPressHandler(() => onStartEditPlayer?.(entry))}
                    disabled={isSavingPlayer || isRemovingPlayer}
                  >
                    <Pencil size={16} color="#a3e635" />
                  </Pressable>
                ) : null}
                {canRemoveEditingPlayers && editingRoster.length > 1 ? (
                  <Pressable
                    onPress={webPressHandler(() => onRemoveEditingPlayer?.(entry.id))}
                    disabled={isRemovingPlayer || isSavingPlayer}
                  >
                    <Trash2 size={16} color="#737373" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}
