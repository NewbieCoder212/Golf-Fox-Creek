import { View, Text, Pressable, TextInput } from 'react-native';
import { UserPlus, Trash2 } from 'lucide-react-native';

import { cn } from '@/lib/cn';

export interface RosterMemberOption {
  id: string;
  full_name: string;
  handicap_index: number | null;
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
  isAddingPlayer?: boolean;
  isRemovingPlayer?: boolean;
}

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
  isAddingPlayer = false,
  isRemovingPlayer = false,
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
          className="flex-1 bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white"
        />
        <TextInput
          value={newPlayerHandicap}
          onChangeText={onNewPlayerHandicapChange}
          placeholder="HI"
          placeholderTextColor="#525252"
          keyboardType="decimal-pad"
          className="w-16 bg-[#0c0c0c] border border-neutral-800 rounded-xl px-3 py-3 text-white text-center"
        />
      </View>
      <Pressable
        onPress={onAddPlayerByName}
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
              <Pressable onPress={() => onRemoveDraftPlayer?.(entry.key)}>
                <Trash2 size={16} color="#737373" />
              </Pressable>
            </View>
          ))
        )
      ) : editingRoster.length === 0 ? (
        <Text className="text-neutral-500 text-sm mb-4">Add at least one player.</Text>
      ) : (
        editingRoster.map((entry) => (
          <View
            key={entry.id}
            className="flex-row items-center justify-between bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 mb-2"
          >
            <View>
              <Text className="text-white font-medium">{entry.display_name}</Text>
              <Text className="text-neutral-500 text-xs mt-0.5">
                {entry.handicap_index.toFixed(1)} HI
                {entry.user_id ? ' · Member' : ' · Guest'}
              </Text>
            </View>
            {canRemoveEditingPlayers && editingRoster.length > 1 ? (
              <Pressable
                onPress={() => onRemoveEditingPlayer?.(entry.id)}
                disabled={isRemovingPlayer}
              >
                <Trash2 size={16} color="#737373" />
              </Pressable>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}
