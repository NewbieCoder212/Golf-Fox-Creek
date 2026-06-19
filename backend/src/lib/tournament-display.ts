/**
 * Build sanitized tournament display payload for TV / public leaderboard.
 */

export interface DisplaySponsor {
  id: string;
  sponsor_name: string;
  image_url: string;
  banner_text: string;
  action_url: string | null;
  display_position: 'header_left' | 'sidebar' | 'footer' | null;
}

export interface DisplayStandingRow {
  rank: number;
  name: string;
  score: number;
  detail: string;
}

export interface DisplayMatchPointsRow {
  rank: number;
  teamName: string;
  matchPoints: number;
  matchesWon: number;
  matchesPlayed: number;
}

export interface DisplayMatchPlaySummary {
  sideAName: string;
  sideBName: string;
  sideAHoles: number;
  sideBHoles: number;
  ties: number;
}

export interface DisplayTournamentMeta {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  round_schedule: Array<{ formats: string[] }>;
  rounds_count: number;
  match_use_net_scoring: boolean;
}

export interface DisplayTeamRow {
  id: string;
  tournament_id: string;
  team_name: string;
  side: string | null;
  logo_url: string | null;
}

export interface DisplayPlayerRow {
  id: string;
  tournament_id: string;
  display_name: string;
}

export interface DisplayMatchGroupRow {
  id: string;
  tournament_id: string;
  round_number: number;
  format: string;
  side_a_team_id: string;
  side_b_team_id: string;
  side_a_player_ids: string[];
  side_b_player_ids: string[];
  tee_time: string;
  starting_hole: number;
  group_number: number;
  notes: string | null;
  match_winner: 'side_a' | 'side_b' | 'tie' | null;
  match_points_a: number;
  match_points_b: number;
  created_at: string;
}

export interface DisplayScoreRow {
  id: string;
  tournament_id: string;
  team_id: string | null;
  user_id: string | null;
  tournament_player_id: string | null;
  match_group_id: string | null;
  round_number: number;
  hole_scores: Array<{ hole: number; gross?: number; net?: number; entered?: boolean }>;
  total_gross: number;
  total_net: number;
  created_at: string;
}

export interface DisplayHoleResultRow {
  id: string;
  match_group_id: string;
  round_number: number;
  hole: number;
  hole_winner: 'side_a' | 'side_b' | 'tie';
  pairing_index?: number;
  side_a_net?: number | null;
  side_b_net?: number | null;
}

export interface TournamentDisplayPayload {
  tournament: DisplayTournamentMeta;
  teams: DisplayTeamRow[];
  players: DisplayPlayerRow[];
  matchGroups: DisplayMatchGroupRow[];
  scores: DisplayScoreRow[];
  holeResults?: DisplayHoleResultRow[];
  grossStandings: DisplayStandingRow[];
  netStandings: DisplayStandingRow[];
  matchPoints: DisplayMatchPointsRow[];
  matchPlay: DisplayMatchPlaySummary | null;
  sponsors: {
    header_left: DisplaySponsor[];
    sidebar: DisplaySponsor[];
    footer: DisplaySponsor[];
  };
  mobileTournamentPath: string;
  updated_at: string;
}

type TournamentRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  display_token: string;
  round_schedule: Array<{ formats: string[] }>;
  rounds_count: number;
  match_use_net_scoring: boolean;
};

type TeamRow = {
  id: string;
  tournament_id: string;
  team_name: string;
  side: string | null;
  logo_url?: string | null;
};

type PlayerRow = {
  id: string;
  tournament_id: string;
  display_name: string;
};

type ScoreRow = {
  id: string;
  tournament_id: string;
  team_id: string | null;
  tournament_player_id: string | null;
  user_id: string | null;
  total_gross: number;
  total_net: number;
};

type MatchGroupRow = {
  tournament_id: string;
  side_a_team_id: string;
  side_b_team_id: string;
  match_points_a?: number;
  match_points_b?: number;
  match_winner?: string | null;
};

type HoleResultRow = {
  hole_winner: 'side_a' | 'side_b' | 'tie';
};

type AdRow = {
  id: string;
  sponsor_name: string;
  placement_type: string;
  image_url: string;
  banner_text: string;
  action_url: string | null;
  display_position: string | null;
  is_active: boolean;
};

function buildNameMap(teams: TeamRow[], players: PlayerRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const team of teams) map.set(team.id, team.team_name);
  for (const player of players) map.set(player.id, player.display_name);
  return map;
}

function buildLeaderboard(
  scores: ScoreRow[],
  nameByKey: Map<string, string>,
  mode: 'gross' | 'net'
): DisplayStandingRow[] {
  const totals = new Map<string, { total_gross: number; total_net: number; rounds: number }>();

  for (const score of scores) {
    const key = score.team_id ?? score.tournament_player_id ?? score.user_id ?? score.id;
    const current = totals.get(key) ?? { total_gross: 0, total_net: 0, rounds: 0 };
    totals.set(key, {
      total_gross: current.total_gross + score.total_gross,
      total_net: current.total_net + score.total_net,
      rounds: current.rounds + 1,
    });
  }

  const sorted = Array.from(totals.entries()).sort((a, b) =>
    mode === 'gross' ? a[1].total_gross - b[1].total_gross : a[1].total_net - b[1].total_net
  );

  return sorted.map(([key, stats], index) => ({
    rank: index + 1,
    name: nameByKey.get(key) ?? 'Player',
    score: mode === 'gross' ? stats.total_gross : stats.total_net,
    detail: `${stats.rounds} round${stats.rounds !== 1 ? 's' : ''}`,
  }));
}

function buildMatchPoints(
  teams: TeamRow[],
  matchGroups: MatchGroupRow[]
): DisplayMatchPointsRow[] {
  const byTeamId = new Map<
    string,
    { teamName: string; matchPoints: number; matchesWon: number; matchesPlayed: number }
  >();

  for (const team of teams) {
    if (!team.side) continue;
    byTeamId.set(team.id, {
      teamName: team.team_name,
      matchPoints: 0,
      matchesWon: 0,
      matchesPlayed: 0,
    });
  }

  for (const group of matchGroups) {
    if (group.match_winner == null) continue;

    const teamA = byTeamId.get(group.side_a_team_id);
    const teamB = byTeamId.get(group.side_b_team_id);
    const pointsA = Number(group.match_points_a ?? 0);
    const pointsB = Number(group.match_points_b ?? 0);
    if (pointsA === 0 && pointsB === 0) continue;

    if (teamA) {
      teamA.matchPoints += pointsA;
      teamA.matchesPlayed += 1;
      if (group.match_winner === 'side_a') teamA.matchesWon += 1;
    }
    if (teamB) {
      teamB.matchPoints += pointsB;
      teamB.matchesPlayed += 1;
      if (group.match_winner === 'side_b') teamB.matchesWon += 1;
    }
  }

  return Array.from(byTeamId.values())
    .sort((a, b) => {
      if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
      return b.matchesWon - a.matchesWon;
    })
    .map((row, index) => ({
      rank: index + 1,
      teamName: row.teamName,
      matchPoints: row.matchPoints,
      matchesWon: row.matchesWon,
      matchesPlayed: row.matchesPlayed,
    }));
}

function aggregateHoleWins(results: HoleResultRow[]) {
  let side_a = 0;
  let side_b = 0;
  let ties = 0;
  for (const row of results) {
    if (row.hole_winner === 'side_a') side_a += 1;
    else if (row.hole_winner === 'side_b') side_b += 1;
    else ties += 1;
  }
  return { side_a, side_b, ties };
}

function sanitizeSponsors(ads: AdRow[]): TournamentDisplayPayload['sponsors'] {
  const active = ads.filter((ad) => ad.is_active && ad.placement_type === 'leaderboard');
  const bucket = (position: 'header_left' | 'sidebar' | 'footer') =>
    active
      .filter((ad) => (ad.display_position ?? 'sidebar') === position)
      .map((ad) => ({
        id: ad.id,
        sponsor_name: ad.sponsor_name,
        image_url: ad.image_url,
        banner_text: ad.banner_text,
        action_url: ad.action_url,
        display_position: (ad.display_position as DisplaySponsor['display_position']) ?? position,
      }));

  return {
    header_left: bucket('header_left'),
    sidebar: bucket('sidebar'),
    footer: bucket('footer'),
  };
}

export function buildTournamentDisplayPayload(params: {
  tournament: TournamentRow;
  teams: TeamRow[];
  players: PlayerRow[];
  scores: ScoreRow[];
  matchGroups: MatchGroupRow[];
  holeResults: HoleResultRow[];
  ads: AdRow[];
  fullMatchGroups?: DisplayMatchGroupRow[];
  fullScores?: DisplayScoreRow[];
  fullHoleResults?: DisplayHoleResultRow[];
}): TournamentDisplayPayload {
  const { tournament, teams, players, scores, matchGroups, holeResults, ads, fullMatchGroups, fullScores, fullHoleResults } =
    params;
  const nameByKey = buildNameMap(teams, players);

  const sideATeam = teams.find((t) => t.side === 'side_a');
  const sideBTeam = teams.find((t) => t.side === 'side_b');
  const holeWins = aggregateHoleWins(holeResults);

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      start_date: tournament.start_date,
      end_date: tournament.end_date,
      round_schedule: tournament.round_schedule,
      rounds_count: tournament.rounds_count,
      match_use_net_scoring: tournament.match_use_net_scoring,
    },
    teams: teams.map((team) => ({
      id: team.id,
      tournament_id: team.tournament_id,
      team_name: team.team_name,
      side: team.side,
      logo_url: team.logo_url ?? null,
    })),
    players: players.map((player) => ({
      id: player.id,
      tournament_id: player.tournament_id,
      display_name: player.display_name,
    })),
    matchGroups: fullMatchGroups ?? [],
    scores: fullScores ?? [],
    holeResults: params.fullHoleResults ?? [],
    grossStandings: buildLeaderboard(scores, nameByKey, 'gross'),
    netStandings: buildLeaderboard(scores, nameByKey, 'net'),
    matchPoints: buildMatchPoints(teams, matchGroups),
    matchPlay:
      sideATeam && sideBTeam && holeResults.length > 0
        ? {
            sideAName: sideATeam.team_name,
            sideBName: sideBTeam.team_name,
            sideAHoles: holeWins.side_a,
            sideBHoles: holeWins.side_b,
            ties: holeWins.ties,
          }
        : null,
    sponsors: sanitizeSponsors(ads),
    mobileTournamentPath: `/tournaments/${tournament.id}`,
    updated_at: new Date().toISOString(),
  };
}
