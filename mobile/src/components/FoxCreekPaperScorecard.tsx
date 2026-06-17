import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import type { HoleData, ScorecardTeeName, ScorecardYardageRow } from '@/types';
import { FOX_CREEK_DATA } from '@/lib/course-data';
import { computeNineTotals } from '@/lib/scorecard-totals';
import {
  MENS_YARDAGE_ROWS,
  LADIES_YARDAGE_ROWS,
  SCORECARD_TEES,
  getScorecardTee,
} from '@/lib/scorecard-tees';
import { ComboTeeBadge, ComboTeeDataCell, ComboTeeSwatch } from '@/components/ComboTeeSwatch';
import { cn } from '@/lib/cn';

const PAPER_BG = '#F4EFE4';
const PAPER_BORDER = '#C4B9A8';
const INK = '#2C2416';

export interface PaperScorecardPlayer {
  id: string;
  name: string;
  tee?: ScorecardTeeName;
  playingHandicap?: number;
}

export interface FoxCreekPaperScorecardProps {
  players: PaperScorecardPlayer[];
  scores: Record<string, Record<number, number | null>>;
  currentHole?: number;
  onHoleSelect?: (hole: number) => void;
  onNameChange?: (playerId: string, name: string) => void;
  onTeeChange?: (playerId: string, tee: ScorecardTeeName) => void;
  onScoreChange: (playerId: string, hole: number, score: number | null) => void;
  netScores?: Record<string, Record<number, number>>;
  showNetColumn?: boolean;
  teamMode?: boolean;
  teamLabel?: string;
  teamScores?: Record<number, number>;
  onTeamScoreChange?: (hole: number, score: number) => void;
  bestBallByHole?: Record<number, string | string[]>;
  highlightedPlayerTee?: ScorecardTeeName;
}

const LABEL_W = 120;
const PLAYER_ROW_H = 44;
const HOLE_COL_W = 32;
const SUM_COL_W = 36;
const ROW_H = 28;

type ScoreColumn =
  | { kind: 'hole'; hole: number }
  | { kind: 'out' }
  | { kind: 'in' }
  | { kind: 'total' };

function buildColumns(): ScoreColumn[] {
  const cols: ScoreColumn[] = [];
  for (let h = 1; h <= 9; h++) cols.push({ kind: 'hole', hole: h });
  cols.push({ kind: 'out' });
  for (let h = 10; h <= 18; h++) cols.push({ kind: 'hole', hole: h });
  cols.push({ kind: 'in' });
  cols.push({ kind: 'total' });
  return cols;
}

const SCORE_COLUMNS = buildColumns();

function colWidth(col: ScoreColumn): number {
  if (col.kind === 'hole') return HOLE_COL_W;
  return SUM_COL_W;
}

function scoreStyle(gross: number, par: number): string {
  const diff = gross - par;
  if (diff < 0) return 'text-green-700 font-bold';
  if (diff === 0) return 'text-[#2C2416] font-semibold';
  return 'text-red-700 font-semibold';
}

function LabelCell({
  label,
  subLabel,
  bold,
}: {
  label: string;
  subLabel?: string;
  bold?: boolean;
}) {
  return (
    <View
      style={[{ width: LABEL_W, height: ROW_H }, { backgroundColor: '#E8DFD0' }]}
      className="items-center justify-center border-r border-b border-[#C4B9A8] px-1"
    >
      <Text
        className={cn('text-[9px] uppercase', bold && 'font-bold')}
        style={{ color: INK }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {subLabel ? (
        <Text className="text-[8px]" style={{ color: '#6B5E4A' }} numberOfLines={1}>
          {subLabel}
        </Text>
      ) : null}
    </View>
  );
}

function DataCell({
  value,
  width = HOLE_COL_W,
  bold,
  onPress,
  highlight,
}: {
  value: string | number;
  width?: number;
  bold?: boolean;
  onPress?: () => void;
  highlight?: boolean;
}) {
  const content = (
    <View
      style={[
        { width, height: ROW_H },
        highlight ? { backgroundColor: '#FEF3C7' } : undefined,
      ]}
      className="items-center justify-center border-r border-b border-[#C4B9A8]"
    >
      <Text className={cn('text-[10px]', bold && 'font-bold')} style={{ color: INK }}>
        {value}
      </Text>
    </View>
  );
  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

function ScoreCell({
  value,
  par,
  isCurrentHole,
  width = HOLE_COL_W,
  height = ROW_H,
  onChange,
  onPress,
  highlightBest,
}: {
  value: number | null;
  par: number;
  isCurrentHole: boolean;
  width?: number;
  height?: number;
  onChange?: (val: number | null) => void;
  onPress?: () => void;
  highlightBest?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  const handleBlur = () => {
    setEditing(false);
    if (!onChange) return;
    const trimmed = text.trim();
    if (trimmed === '') {
      onChange(null);
      return;
    }
    const num = parseInt(trimmed, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= 15) {
      onChange(num);
    }
  };

  if (editing && onChange) {
    return (
      <View
        style={{ width, height }}
        className="items-center justify-center border-r border-b border-[#C4B9A8]"
      >
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={handleBlur}
          keyboardType="number-pad"
          maxLength={2}
          autoFocus
          className="text-center text-sm font-bold text-[#2C2416] w-full"
          style={{ backgroundColor: '#fff', borderRadius: 4, padding: 2 }}
        />
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => {
        if (onPress) onPress();
        if (onChange) {
          setText(value !== null ? String(value) : '');
          setEditing(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }}
      style={{ width, height }}
      className={cn(
        'items-center justify-center border-r border-b border-[#C4B9A8]',
        isCurrentHole && 'bg-amber-100/80',
        highlightBest && 'bg-green-100'
      )}
    >
      <Text
        className={cn(
          'text-sm',
          value !== null ? scoreStyle(value, par) : 'text-neutral-400'
        )}
      >
        {value !== null ? value : '–'}
      </Text>
    </Pressable>
  );
}

function YardageReferenceRow({
  row,
  holes,
}: {
  row: ScorecardYardageRow;
  holes: HoleData[];
}) {
  const holeMap = new Map(holes.map((h) => [h.holeNumber, h]));
  const frontHoles = holes.filter((h) => h.holeNumber <= 9);
  const backHoles = holes.filter((h) => h.holeNumber > 9);
  const frontSum = frontHoles.reduce((s, h) => s + h.scorecardYardages[row.yardageKey], 0);
  const backSum = backHoles.reduce((s, h) => s + h.scorecardYardages[row.yardageKey], 0);
  const comboLabel = row.isCombo ? row.ratingName.replace('/', '·') : undefined;

  return (
    <View className="flex-row">
      <View className="border-r border-b border-[#C4B9A8]">
        <ComboTeeSwatch
          colors={row.colors}
          width={LABEL_W}
          height={ROW_H}
          label={row.isCombo ? undefined : row.ratingName.slice(0, 5)}
          subLabel={comboLabel}
        />
      </View>
      {SCORE_COLUMNS.map((col) => {
        if (col.kind === 'hole') {
          const hole = holeMap.get(col.hole);
          if (!hole) return null;
          return (
            <ComboTeeDataCell
              key={`${row.yardageKey}-${col.hole}`}
              value={hole.scorecardYardages[row.yardageKey]}
              colors={row.colors}
              width={HOLE_COL_W}
              height={ROW_H}
            />
          );
        }
        if (col.kind === 'out') {
          return (
            <ComboTeeDataCell
              key={`${row.yardageKey}-out`}
              value={frontSum}
              colors={row.colors}
              width={SUM_COL_W}
              height={ROW_H}
              bold
            />
          );
        }
        if (col.kind === 'in') {
          return (
            <ComboTeeDataCell
              key={`${row.yardageKey}-in`}
              value={backSum}
              colors={row.colors}
              width={SUM_COL_W}
              height={ROW_H}
              bold
            />
          );
        }
        return (
          <ComboTeeDataCell
            key={`${row.yardageKey}-tot`}
            value={frontSum + backSum}
            colors={row.colors}
            width={SUM_COL_W}
            height={ROW_H}
            bold
          />
        );
      })}
    </View>
  );
}

function ReferenceRow({
  label,
  subLabel,
  holes,
  getValue,
  bold,
}: {
  label: string;
  subLabel?: string;
  holes: HoleData[];
  getValue: (hole: HoleData) => string | number;
  bold?: boolean;
}) {
  const holeMap = new Map(holes.map((h) => [h.holeNumber, h]));
  const frontHoles = holes.filter((h) => h.holeNumber <= 9);
  const backHoles = holes.filter((h) => h.holeNumber > 9);
  const frontPar = frontHoles.reduce((s, h) => s + h.par, 0);
  const backPar = backHoles.reduce((s, h) => s + h.par, 0);

  return (
    <View className="flex-row">
      <LabelCell label={label} subLabel={subLabel} bold={bold} />
      {SCORE_COLUMNS.map((col) => {
        if (col.kind === 'hole') {
          const hole = holeMap.get(col.hole);
          if (!hole) return null;
          return (
            <DataCell
              key={`ref-${label}-${col.hole}`}
              value={getValue(hole)}
              bold={bold}
            />
          );
        }
        if (col.kind === 'out') {
          return (
            <DataCell key={`ref-${label}-out`} value={bold ? frontPar : '–'} width={SUM_COL_W} bold={bold} />
          );
        }
        if (col.kind === 'in') {
          return (
            <DataCell key={`ref-${label}-in`} value={bold ? backPar : '–'} width={SUM_COL_W} bold={bold} />
          );
        }
        return (
          <DataCell
            key={`ref-${label}-tot`}
            value={bold ? frontPar + backPar : '–'}
            width={SUM_COL_W}
            bold={bold}
          />
        );
      })}
    </View>
  );
}

function BackCoverPanel() {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="mt-2 mb-4">
      <Pressable
        onPress={() => setExpanded(!expanded)}
        className="flex-row items-center justify-between py-3 px-2"
      >
        <Text className="text-[#6B5E4A] text-xs font-bold uppercase tracking-widest">
          Course Rating & Recommendations
        </Text>
        {expanded ? (
          <ChevronUp size={16} color="#6B5E4A" />
        ) : (
          <ChevronDown size={16} color="#6B5E4A" />
        )}
      </Pressable>

      {expanded ? (
        <View
          style={{ backgroundColor: PAPER_BG, borderColor: PAPER_BORDER, borderWidth: 1 }}
          className="rounded-lg p-3"
        >
          <Text className="text-[10px] font-bold text-[#2C2416] text-center mb-2">
            ÉVALUATION DE LA PENTE ET DU TERRAIN / COURSE AND SLOPE RATING
          </Text>
          <View className="border border-[#C4B9A8] mb-3">
            <View className="flex-row bg-[#E8DFD0] border-b border-[#C4B9A8]">
              <Text className="flex-1 text-[9px] font-bold text-center py-1 text-[#2C2416]">Tee</Text>
              <Text className="flex-1 text-[9px] font-bold text-center py-1 text-[#2C2416]">Men's</Text>
              <Text className="flex-1 text-[9px] font-bold text-center py-1 text-[#2C2416]">Ladies</Text>
            </View>
            {FOX_CREEK_DATA.teeRatings.map((tee) => (
              <View key={tee.name} className="flex-row border-b border-[#C4B9A8]">
                <Text className="flex-1 text-[9px] text-center py-1 text-[#2C2416]">{tee.name}</Text>
                <Text className="flex-1 text-[9px] text-center py-1 text-[#6B5E4A]">
                  {tee.mensRating}/{tee.mensSlope}
                </Text>
                <Text className="flex-1 text-[9px] text-center py-1 text-[#6B5E4A]">
                  {tee.womensRating}/{tee.womensSlope}
                </Text>
              </View>
            ))}
          </View>

          <Text className="text-[10px] font-bold text-[#2C2416] text-center mb-2">
            HANDICAP / Distance de frappe
          </Text>
          <View className="border border-[#C4B9A8] mb-3">
            {FOX_CREEK_DATA.handicapRecommendations.map((rec) => (
              <View key={rec.teeName} className="flex-row border-b border-[#C4B9A8]">
                <Text className="flex-1 text-[9px] text-center py-1 text-[#2C2416]">{rec.teeName}</Text>
                <Text className="flex-1 text-[9px] text-center py-1 text-[#6B5E4A]">{rec.handicapRange}</Text>
                <Text className="flex-1 text-[9px] text-center py-1 text-[#6B5E4A]">{rec.drivingDistance}</Text>
              </View>
            ))}
          </View>

          <Text className="text-[10px] text-center text-[#6B5E4A]">
            T {FOX_CREEK_DATA.phone}
          </Text>
          <Text className="text-[10px] text-center text-[#6B5E4A] mt-1">
            {FOX_CREEK_DATA.designer.toUpperCase()}, ARCHITECTE PAYSAGISTE • COURSE ARCHITECT
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function FoxCreekPaperScorecard({
  players,
  scores,
  currentHole,
  onHoleSelect,
  onNameChange,
  onTeeChange,
  onScoreChange,
  netScores,
  showNetColumn,
  teamMode,
  teamLabel,
  teamScores,
  onTeamScoreChange,
  bestBallByHole,
}: FoxCreekPaperScorecardProps) {
  const allHoles = FOX_CREEK_DATA.holeData;
  const holeMap = new Map(allHoles.map((h) => [h.holeNumber, h]));
  const playerTotals = computeNineTotals(players.map((p) => p.id), scores);

  const tableWidth =
    LABEL_W + SCORE_COLUMNS.reduce((sum, col) => sum + colWidth(col), 0);

  type ScoreRow = PaperScorecardPlayer & { isTeamRow?: boolean; readOnly?: boolean };

  const scoreRows: ScoreRow[] = teamMode
    ? [
        ...players.map((player) => ({ ...player, readOnly: true })),
        {
          id: '__team__',
          name: teamLabel ?? 'Team',
          playingHandicap: undefined,
          isTeamRow: true,
        },
      ]
    : players;

  const cyclePlayerTee = (playerId: string, current?: ScorecardTeeName) => {
    if (!onTeeChange) return;
    const idx = SCORECARD_TEES.findIndex((t) => t.id === current);
    const next = SCORECARD_TEES[(idx + 1) % SCORECARD_TEES.length];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTeeChange(playerId, next.id);
  };

  return (
    <View
      style={{ backgroundColor: PAPER_BG, alignSelf: 'flex-start', maxWidth: '100%' }}
      className="rounded-xl overflow-hidden"
    >
      <View className="items-center py-5 px-4 border-b border-[#C4B9A8]">
        <View
          className="w-20 h-20 rounded-full border-2 border-[#2C2416] items-center justify-center mb-3"
          style={{ backgroundColor: '#fff' }}
        >
          <Text className="text-2xl font-black text-[#2C2416]">FC</Text>
        </View>
        <Text className="text-lg font-black tracking-wider text-[#2C2416]">
          FOX CREEK GOLF CLUB
        </Text>
        <Text className="text-xs text-[#6B5E4A] mt-1 tracking-widest">
          DIEPPE • NEW BRUNSWICK
        </Text>
        <Text className="text-[10px] text-[#6B5E4A] mt-2">Est. {FOX_CREEK_DATA.yearOpened}</Text>
      </View>

      <View className="px-2 pt-3">
        <Text className="text-[#6B5E4A] text-[10px] font-bold uppercase tracking-widest mb-1 px-1">
          Trou / Hole →
        </Text>
        <Text className="text-[#6B5E4A] text-[9px] mb-2 px-1">
          Split-color squares are combo tees (e.g. Blue/White). Tap a player tee swatch to change.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <View
            style={{
              width: tableWidth,
              backgroundColor: PAPER_BG,
              borderColor: PAPER_BORDER,
              borderWidth: 1,
            }}
          >
            {/* Hole number header row */}
            <View className="flex-row">
              <LabelCell label="Trou" subLabel="Hole" bold />
              {SCORE_COLUMNS.map((col) => {
                if (col.kind === 'hole') {
                  const isCurrent = currentHole === col.hole;
                  return (
                    <DataCell
                      key={`hdr-${col.hole}`}
                      value={col.hole}
                      bold
                      highlight={isCurrent}
                      onPress={() => onHoleSelect?.(col.hole)}
                    />
                  );
                }
                const label = col.kind === 'out' ? 'OUT' : col.kind === 'in' ? 'IN' : 'TOT';
                return (
                  <DataCell
                    key={`hdr-${col.kind}`}
                    value={label}
                    width={SUM_COL_W}
                    bold
                  />
                );
              })}
            </View>

            {MENS_YARDAGE_ROWS.map((row) => (
              <YardageReferenceRow key={row.yardageKey} row={row} holes={allHoles} />
            ))}

            <ReferenceRow
              label="M"
              subLabel="Hcp"
              holes={allHoles}
              getValue={(h) => h.handicapIndex}
            />
            <ReferenceRow label="Par" holes={allHoles} getValue={(h) => h.par} bold />
            <ReferenceRow
              label="L"
              subLabel="Hcp"
              holes={allHoles}
              getValue={(h) => h.womensHandicapIndex}
            />

            {LADIES_YARDAGE_ROWS.map((row) => (
              <YardageReferenceRow key={`ladies-${row.yardageKey}`} row={row} holes={allHoles} />
            ))}

            {/* Player score rows — names on left, scores across holes */}
            {scoreRows.map((player) => {
              const isTeamRow = Boolean(player.isTeamRow);
              const isReadOnly = Boolean(player.readOnly);
              const totals = isTeamRow ? undefined : playerTotals[player.id];
              const playerTeeDef = getScorecardTee(player.tee ?? 'White');
              return (
                <View
                  key={player.id}
                  className={cn('flex-row', isTeamRow ? 'bg-amber-50/60' : 'bg-white/40')}
                >
                  <View
                    style={{ width: LABEL_W, minHeight: PLAYER_ROW_H }}
                    className="border-r border-b border-[#C4B9A8] bg-[#F5F0E6] px-2 py-2 justify-center"
                  >
                    <View className="flex-row items-center gap-2">
                      {!teamMode && onTeeChange && playerTeeDef ? (
                        <ComboTeeBadge
                          colors={playerTeeDef.colors}
                          size={24}
                          onPress={() => cyclePlayerTee(player.id, player.tee)}
                          selected
                        />
                      ) : null}
                      <View className="flex-1 min-w-0">
                        {teamMode || isReadOnly ? (
                          <Text
                            className="text-sm font-bold text-[#2C2416] tracking-tight"
                            numberOfLines={2}
                          >
                            {player.name}
                          </Text>
                        ) : onNameChange ? (
                          <TextInput
                            value={player.name}
                            onChangeText={(t) => onNameChange(player.id, t)}
                            placeholder="Player name"
                            placeholderTextColor="#9CA3AF"
                            multiline={false}
                            className="w-full text-[#2C2416]"
                            style={{
                              fontSize: 15,
                              fontWeight: '700',
                              letterSpacing: 0.2,
                              paddingVertical: 2,
                              paddingHorizontal: 0,
                            }}
                          />
                        ) : (
                          <Text
                            className="text-sm font-bold text-[#2C2416] tracking-tight"
                            numberOfLines={2}
                          >
                            {player.name}
                          </Text>
                        )}
                      </View>
                    </View>
                    {playerTeeDef && !teamMode && !isReadOnly ? (
                      <Text className="text-[9px] text-[#6B5E4A] mt-1 tracking-wide">
                        {playerTeeDef.shortLabel}
                        {player.playingHandicap !== undefined
                          ? ` · ${player.playingHandicap} hcp`
                          : ''}
                      </Text>
                    ) : player.playingHandicap !== undefined ? (
                      <Text className="text-[9px] text-[#6B5E4A] mt-1">
                        {player.playingHandicap} hcp
                      </Text>
                    ) : null}
                  </View>

                  {SCORE_COLUMNS.map((col) => {
                    if (col.kind === 'hole') {
                      const hole = holeMap.get(col.hole);
                      if (!hole) return null;
                      const isCurrent = currentHole === col.hole;

                      if (isReadOnly) {
                        return (
                          <ScoreCell
                            key={`${player.id}-${col.hole}`}
                            value={null}
                            par={hole.par}
                            isCurrentHole={isCurrent}
                            width={HOLE_COL_W}
                            height={PLAYER_ROW_H}
                            onPress={() => onHoleSelect?.(col.hole)}
                          />
                        );
                      }

                      if (isTeamRow) {
                        return (
                          <ScoreCell
                            key={`${player.id}-${col.hole}`}
                            value={teamScores?.[col.hole] ?? null}
                            par={hole.par}
                            isCurrentHole={isCurrent}
                            height={PLAYER_ROW_H}
                            onChange={(val) => {
                              if (val !== null && onTeamScoreChange) {
                                onTeamScoreChange(col.hole, val);
                              }
                            }}
                            onPress={() => onHoleSelect?.(col.hole)}
                          />
                        );
                      }

                      const gross = scores[player.id]?.[col.hole] ?? null;
                      const countingIds = bestBallByHole?.[col.hole];
                      const isBest = Array.isArray(countingIds)
                        ? countingIds.includes(player.id)
                        : countingIds === player.id;

                      return (
                        <ScoreCell
                          key={`${player.id}-${col.hole}`}
                          value={gross}
                          par={hole.par}
                          isCurrentHole={isCurrent}
                          highlightBest={isBest}
                          width={HOLE_COL_W}
                          height={PLAYER_ROW_H}
                          onChange={(val) => onScoreChange(player.id, col.hole, val)}
                          onPress={() => onHoleSelect?.(col.hole)}
                        />
                      );
                    }

                    const width = SUM_COL_W;
                    let display: string | number = '–';
                    if (col.kind === 'out') {
                      display = totals?.out != null ? totals.out : '–';
                    } else if (col.kind === 'in') {
                      display = totals?.in != null ? totals.in : '–';
                    } else if (col.kind === 'total') {
                      if (isTeamRow && teamScores) {
                        const sum = Object.values(teamScores).reduce((a, b) => a + b, 0);
                        display = sum > 0 ? sum : '–';
                      } else {
                        display = totals?.total != null ? totals.total : '–';
                      }
                    }

                    return (
                      <View
                        key={`${player.id}-${col.kind}`}
                        style={{ width, height: PLAYER_ROW_H }}
                        className="items-center justify-center border-r border-b border-[#C4B9A8] bg-[#E8DFD0]"
                      >
                        <Text className="text-xs font-bold text-[#2C2416]">{display}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {/* Net rows (tournament) */}
            {showNetColumn && !teamMode
              ? players.map((player) => (
                  <View key={`net-${player.id}`} className="flex-row">
                    <LabelCell label="Net" subLabel={player.name.split(' ')[0]} />
                    {SCORE_COLUMNS.map((col) => {
                      if (col.kind === 'hole') {
                        const net = netScores?.[player.id]?.[col.hole];
                        return (
                          <DataCell
                            key={`net-${player.id}-${col.hole}`}
                            value={net !== undefined ? net : '–'}
                          />
                        );
                      }
                      return (
                        <DataCell
                          key={`net-${player.id}-${col.kind}`}
                          value="–"
                          width={SUM_COL_W}
                        />
                      );
                    })}
                  </View>
                ))
              : null}
          </View>
        </ScrollView>

        <BackCoverPanel />
      </View>
    </View>
  );
}
