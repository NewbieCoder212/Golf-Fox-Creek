// src/vercel.ts
import { handle } from "@hono/node-server/vercel";

// src/env.ts
import { z } from "zod";
function resolveBackendUrl() {
  const fromEnv = process.env.BACKEND_URL?.trim();
  if (fromEnv)
    return fromEnv;
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl)
    return `https://${vercelUrl}`;
  return "http://localhost:3000";
}
var envSchema = z.object({
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.string().optional(),
  BACKEND_URL: z.preprocess((val) => typeof val === "string" && val.trim() === "" ? undefined : val, z.string().url().optional()).optional()
});
function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env);
    const env = {
      ...parsed,
      BACKEND_URL: parsed.BACKEND_URL ?? resolveBackendUrl()
    };
    console.log("✅ Environment variables validated successfully");
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment variable validation failed:");
      error.issues.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      if (process.env.VERCEL) {
        console.warn("Using safe defaults on Vercel");
        return {
          PORT: process.env.PORT ?? "3000",
          NODE_ENV: "development",
          BACKEND_URL: resolveBackendUrl()
        };
      }
      console.error(`
Please check your .env file and ensure all required variables are set.`);
      process.exit(1);
    }
    throw error;
  }
}
var env = validateEnv();

// src/app.ts
import { Hono as Hono7 } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

// src/lib/supabase-admin.ts
var ADMIN_FETCH_TIMEOUT_MS = 12000;
function readSupabaseUrl() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}
function readServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}
function getSupabaseAnonKey() {
  return process.env.SUPABASE_ANON_KEY?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
}
function isSupabaseAdminConfigured() {
  return Boolean(readSupabaseUrl() && readServiceRoleKey());
}
function getSupabaseAdminConfig() {
  const supabaseUrl = readSupabaseUrl();
  const serviceRoleKey = readServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin is not configured");
  }
  return { supabaseUrl, serviceRoleKey };
}
function getErrorMessage(data) {
  return typeof data.error_description === "string" && data.error_description || typeof data.msg === "string" && data.msg || typeof data.message === "string" && data.message || "Request failed";
}
async function supabaseFetch(url, init = {}, timeoutMs = ADMIN_FETCH_TIMEOUT_MS) {
  const controller = new AbortController;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: init.signal ?? controller.signal,
      cache: "no-store"
    });
  } finally {
    clearTimeout(timeout);
  }
}
async function adminFetch(path, options = {}) {
  const { supabaseUrl: url, serviceRoleKey: key } = getSupabaseAdminConfig();
  const method = options.method ?? "GET";
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
  if (options.prefer) {
    headers.Prefer = options.prefer;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  let response;
  try {
    response = await supabaseFetch(`${url}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Supabase request timed out" : "Supabase request failed";
    return { ok: false, status: 504, data: { message } };
  }
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {
        message: text.slice(0, 200)
      };
    }
  }
  return { ok: response.ok, status: response.status, data };
}

// src/routes/sample.ts
import { Hono } from "hono";
var sampleRouter = new Hono;
sampleRouter.get("/", (c) => {
  return c.json({
    data: {
      message: `${["Hello", "Hola", "Namaste", "Bonjour"][Math.floor(Math.random() * 4)]} from the backend!`,
      timestamp: new Date().toLocaleTimeString()
    }
  });
});

// src/routes/dev-auth.ts
import { Hono as Hono2 } from "hono";
var devAuthRouter = new Hono2;
function isDevAuthEnabled() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) && Boolean(process.env.SUPABASE_URL?.trim());
}
function assertDevSecret(provided) {
  const expected = process.env.DEV_AUTH_SECRET?.trim() || "foxcreek-dev-local";
  return Boolean(provided && provided === expected);
}
async function findUserIdByEmail(email) {
  const supabaseUrl = process.env.SUPABASE_URL.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });
  if (!response.ok)
    return null;
  const data = await response.json();
  const user = data.users?.find((entry) => entry.email?.toLowerCase() === email.toLowerCase());
  return user?.id ?? null;
}
function getErrorMessage2(data) {
  return typeof data.error_description === "string" && data.error_description || typeof data.msg === "string" && data.msg || typeof data.message === "string" && data.message || "Request failed";
}
devAuthRouter.post("/generate-reset-link", async (c) => {
  if (!isDevAuthEnabled()) {
    return c.json({ error: "Dev auth is not configured on the backend" }, 503);
  }
  if (!assertDevSecret(c.req.header("x-dev-secret"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  const email = body.email?.trim();
  const redirectTo = body.redirectTo?.trim() || "http://localhost:8081/reset-password";
  if (!email) {
    return c.json({ error: "Email is required" }, 400);
  }
  const supabaseUrl = process.env.SUPABASE_URL.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "recovery",
      email,
      options: { redirect_to: redirectTo }
    })
  });
  const data = await response.json();
  if (!response.ok) {
    return c.json({ error: getErrorMessage2(data) }, 400);
  }
  const properties = data.properties;
  const actionLink = typeof data.action_link === "string" && data.action_link || typeof properties?.action_link === "string" && properties.action_link || typeof properties?.redirect_to === "string" && properties.redirect_to || null;
  if (!actionLink) {
    return c.json({ error: "No reset link returned from Supabase" }, 500);
  }
  return c.json({ actionLink, redirectTo });
});
devAuthRouter.post("/set-password", async (c) => {
  if (!isDevAuthEnabled()) {
    return c.json({ error: "Dev auth is not configured on the backend" }, 503);
  }
  if (!assertDevSecret(c.req.header("x-dev-secret"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  const email = body.email?.trim();
  const password = body.password?.trim();
  if (!email) {
    return c.json({ error: "Email is required" }, 400);
  }
  if (!password || password.length < 6) {
    return c.json({ error: "Password must be at least 6 characters" }, 400);
  }
  const supabaseUrl = process.env.SUPABASE_URL.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  const userId = await findUserIdByEmail(email);
  if (!userId) {
    return c.json({ error: "User not found" }, 404);
  }
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ password })
  });
  const data = await response.json();
  if (!response.ok) {
    return c.json({ error: getErrorMessage2(data) }, 400);
  }
  return c.json({ success: true, email });
});

// src/routes/members.ts
import { Hono as Hono3 } from "hono";

// src/middleware/auth.ts
var AUTH_FETCH_TIMEOUT_MS = 8000;
async function authFetch(url, headers) {
  const controller = new AbortController;
  const timeout = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers,
      signal: controller.signal,
      cache: "no-store"
    });
  } finally {
    clearTimeout(timeout);
  }
}
async function fetchUserRole(userId, _accessToken) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();
  const response = await authFetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}&select=role&limit=1`, {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  });
  if (!response.ok)
    return null;
  const rows = await response.json();
  return rows[0]?.role ?? null;
}
async function validateAccessToken(token) {
  if (!isSupabaseAdminConfigured()) {
    return null;
  }
  const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();
  const anonKey = getSupabaseAnonKey();
  const apikey = anonKey || serviceRoleKey;
  const response = await authFetch(`${supabaseUrl}/auth/v1/user`, {
    apikey,
    Authorization: `Bearer ${token}`
  });
  if (!response.ok) {
    return null;
  }
  return await response.json();
}
async function requireMemberAuth(c, next) {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const user = await validateAccessToken(token);
    if (!user) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }
    const role = await fetchUserRole(user.id, token);
    if (!role) {
      return c.json({ error: "Profile not found" }, 403);
    }
    c.set("authUser", { id: user.id, email: user.email ?? "", role });
    await next();
  } catch {
    return c.json({ error: "Auth service unavailable" }, 503);
  }
}
async function requireManagerAuth(c, next) {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const user = await validateAccessToken(token);
    if (!user) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }
    const role = await fetchUserRole(user.id, token);
    if (!role || role !== "manager" && role !== "super_admin") {
      return c.json({ error: "Manager access required" }, 403);
    }
    c.set("authUser", { id: user.id, email: user.email ?? "", role });
    await next();
  } catch {
    return c.json({ error: "Auth service unavailable" }, 503);
  }
}

// src/routes/members.ts
var membersRouter = new Hono3;
function buildFullName(firstName, lastName) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
async function updateProfileAfterInvite(params) {
  const body = {
    first_name: params.firstName.trim(),
    last_name: params.lastName.trim(),
    full_name: buildFullName(params.firstName, params.lastName),
    email: params.email.trim().toLowerCase(),
    invite_status: "pending",
    updated_at: new Date().toISOString()
  };
  if (params.handicapIndex !== undefined) {
    body.handicap_index = params.handicapIndex;
  }
  const { ok, data } = await adminFetch(`/rest/v1/user_profiles?id=eq.${params.userId}`, {
    method: "PATCH",
    body
  });
  if (!ok) {
    throw new Error(getErrorMessage(data));
  }
}
async function inviteUserByEmail(params) {
  const fullName = buildFullName(params.firstName, params.lastName);
  const { ok, data } = await adminFetch("/auth/v1/invite", {
    method: "POST",
    body: {
      email: params.email.trim().toLowerCase(),
      data: {
        first_name: params.firstName.trim(),
        last_name: params.lastName.trim(),
        full_name: fullName
      },
      redirect_to: params.redirectTo
    }
  });
  if (!ok) {
    throw new Error(getErrorMessage(data));
  }
  const user = data.user;
  const userId = user?.id ?? (typeof data.id === "string" ? data.id : null);
  if (!userId) {
    throw new Error("Invite succeeded but no user id returned");
  }
  return { userId };
}
async function generateInviteLink(params) {
  const fullName = params.firstName && params.lastName ? buildFullName(params.firstName, params.lastName) : undefined;
  const { ok, data } = await adminFetch("/auth/v1/admin/generate_link", {
    method: "POST",
    body: {
      type: "invite",
      email: params.email.trim().toLowerCase(),
      options: {
        redirect_to: params.redirectTo,
        data: fullName ? {
          first_name: params.firstName,
          last_name: params.lastName,
          full_name: fullName
        } : undefined
      }
    }
  });
  if (!ok) {
    throw new Error(getErrorMessage(data));
  }
}
membersRouter.use("*", async (c, next) => {
  if (!isSupabaseAdminConfigured()) {
    return c.json({ error: "Member invite service is not configured" }, 503);
  }
  await next();
});
membersRouter.post("/invite", requireManagerAuth, async (c) => {
  const body = await c.req.json();
  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const inviteRedirect = body.redirectTo?.trim() || process.env.MEMBER_INVITE_REDIRECT_URL?.trim() || "http://localhost:8081/accept-invite";
  if (!firstName || !lastName) {
    return c.json({ error: "First name and last name are required" }, 400);
  }
  if (!email || !isValidEmail(email)) {
    return c.json({ error: "A valid email is required" }, 400);
  }
  try {
    const { userId } = await inviteUserByEmail({
      email,
      firstName,
      lastName,
      redirectTo: inviteRedirect
    });
    await updateProfileAfterInvite({
      userId,
      firstName,
      lastName,
      email,
      handicapIndex: body.handicapIndex
    });
    return c.json({ userId, status: "invited" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invite failed";
    return c.json({ error: message }, 400);
  }
});
membersRouter.post("/resend-invite", requireManagerAuth, async (c) => {
  const body = await c.req.json();
  const email = body.email?.trim() ?? "";
  const inviteRedirect = body.redirectTo?.trim() || process.env.MEMBER_INVITE_REDIRECT_URL?.trim() || "http://localhost:8081/accept-invite";
  if (!email || !isValidEmail(email)) {
    return c.json({ error: "A valid email is required" }, 400);
  }
  try {
    const profileResult = await adminFetch(`/rest/v1/user_profiles?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,first_name,last_name`);
    if (!profileResult.ok || !profileResult.data?.[0]) {
      return c.json({ error: "Member not found" }, 404);
    }
    const profile = profileResult.data[0];
    await generateInviteLink({
      email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      redirectTo: inviteRedirect
    });
    await updateProfileAfterInvite({
      userId: profile.id,
      firstName: profile.first_name ?? "",
      lastName: profile.last_name ?? "",
      email
    });
    return c.json({ success: true, status: "invited" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resend failed";
    return c.json({ error: message }, 400);
  }
});

// src/routes/display.ts
import { Hono as Hono4 } from "hono";

// src/lib/tournament-display.ts
function buildNameMap(teams, players) {
  const map = new Map;
  for (const team of teams)
    map.set(team.id, team.team_name);
  for (const player of players)
    map.set(player.id, player.display_name);
  return map;
}
function buildLeaderboard(scores, nameByKey, mode) {
  const totals = new Map;
  for (const score of scores) {
    const key = score.team_id ?? score.tournament_player_id ?? score.user_id ?? score.id;
    const current = totals.get(key) ?? { total_gross: 0, total_net: 0, rounds: 0 };
    totals.set(key, {
      total_gross: current.total_gross + score.total_gross,
      total_net: current.total_net + score.total_net,
      rounds: current.rounds + 1
    });
  }
  const sorted = Array.from(totals.entries()).sort((a, b) => mode === "gross" ? a[1].total_gross - b[1].total_gross : a[1].total_net - b[1].total_net);
  return sorted.map(([key, stats], index) => ({
    rank: index + 1,
    name: nameByKey.get(key) ?? "Player",
    score: mode === "gross" ? stats.total_gross : stats.total_net,
    detail: `${stats.rounds} round${stats.rounds !== 1 ? "s" : ""}`
  }));
}
function buildMatchPoints(teams, matchGroups) {
  const byTeamId = new Map;
  for (const team of teams) {
    if (!team.side)
      continue;
    byTeamId.set(team.id, {
      teamName: team.team_name,
      matchPoints: 0,
      matchesWon: 0,
      matchesPlayed: 0
    });
  }
  for (const group of matchGroups) {
    const teamA = byTeamId.get(group.side_a_team_id);
    const teamB = byTeamId.get(group.side_b_team_id);
    const pointsA = Number(group.match_points_a ?? 0);
    const pointsB = Number(group.match_points_b ?? 0);
    if (teamA) {
      teamA.matchPoints += pointsA;
      teamA.matchesPlayed += 1;
      if (group.match_winner === "side_a")
        teamA.matchesWon += 1;
    }
    if (teamB) {
      teamB.matchPoints += pointsB;
      teamB.matchesPlayed += 1;
      if (group.match_winner === "side_b")
        teamB.matchesWon += 1;
    }
  }
  return Array.from(byTeamId.values()).sort((a, b) => {
    if (b.matchPoints !== a.matchPoints)
      return b.matchPoints - a.matchPoints;
    return b.matchesWon - a.matchesWon;
  }).map((row, index) => ({
    rank: index + 1,
    teamName: row.teamName,
    matchPoints: row.matchPoints,
    matchesWon: row.matchesWon,
    matchesPlayed: row.matchesPlayed
  }));
}
function aggregateHoleWins(results) {
  let side_a = 0;
  let side_b = 0;
  let ties = 0;
  for (const row of results) {
    if (row.hole_winner === "side_a")
      side_a += 1;
    else if (row.hole_winner === "side_b")
      side_b += 1;
    else
      ties += 1;
  }
  return { side_a, side_b, ties };
}
function sanitizeSponsors(ads) {
  const active = ads.filter((ad) => ad.is_active && ad.placement_type === "leaderboard");
  const bucket = (position) => active.filter((ad) => (ad.display_position ?? "sidebar") === position).map((ad) => ({
    id: ad.id,
    sponsor_name: ad.sponsor_name,
    image_url: ad.image_url,
    banner_text: ad.banner_text,
    action_url: ad.action_url,
    display_position: ad.display_position ?? position
  }));
  return {
    header_left: bucket("header_left"),
    sidebar: bucket("sidebar"),
    footer: bucket("footer")
  };
}
function buildTournamentDisplayPayload(params) {
  const { tournament, teams, players, scores, matchGroups, holeResults, ads, fullMatchGroups, fullScores, fullHoleResults } = params;
  const nameByKey = buildNameMap(teams, players);
  const sideATeam = teams.find((t) => t.side === "side_a");
  const sideBTeam = teams.find((t) => t.side === "side_b");
  const holeWins = aggregateHoleWins(holeResults);
  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      start_date: tournament.start_date,
      end_date: tournament.end_date,
      round_schedule: tournament.round_schedule,
      rounds_count: tournament.rounds_count,
      match_use_net_scoring: tournament.match_use_net_scoring
    },
    teams: teams.map((team) => ({
      id: team.id,
      tournament_id: team.tournament_id,
      team_name: team.team_name,
      side: team.side,
      logo_url: team.logo_url ?? null
    })),
    players: players.map((player) => ({
      id: player.id,
      tournament_id: player.tournament_id,
      display_name: player.display_name
    })),
    matchGroups: fullMatchGroups ?? [],
    scores: fullScores ?? [],
    holeResults: params.fullHoleResults ?? [],
    grossStandings: buildLeaderboard(scores, nameByKey, "gross"),
    netStandings: buildLeaderboard(scores, nameByKey, "net"),
    matchPoints: buildMatchPoints(teams, matchGroups),
    matchPlay: sideATeam && sideBTeam && holeResults.length > 0 ? {
      sideAName: sideATeam.team_name,
      sideBName: sideBTeam.team_name,
      sideAHoles: holeWins.side_a,
      sideBHoles: holeWins.side_b,
      ties: holeWins.ties
    } : null,
    sponsors: sanitizeSponsors(ads),
    mobileTournamentPath: `/tournaments/${tournament.id}`,
    updated_at: new Date().toISOString()
  };
}

// src/routes/display.ts
var displayRouter = new Hono4;
async function fetchRows(path) {
  const { ok, data } = await adminFetch(path);
  if (!ok)
    return [];
  return Array.isArray(data) ? data : data ? [data] : [];
}
displayRouter.get("/tournament/:id", async (c) => {
  if (!isSupabaseAdminConfigured()) {
    return c.json({ error: "Display service is not configured" }, 503);
  }
  const tournamentId = c.req.param("id");
  const token = c.req.query("token")?.trim();
  if (!token) {
    return c.json({ error: "Missing display token" }, 401);
  }
  const tournaments = await fetchRows(`/rest/v1/tournaments?id=eq.${tournamentId}&display_token=eq.${token}&select=id,name,start_date,end_date,display_token,round_schedule,rounds_count,match_use_net_scoring`);
  const tournament = tournaments[0];
  if (!tournament) {
    return c.json({ error: "Tournament not found or invalid token" }, 404);
  }
  const matchGroupSelect = "id,tournament_id,round_number,format,side_a_team_id,side_b_team_id,side_a_player_ids,side_b_player_ids,tee_time,starting_hole,group_number,notes,match_winner,match_points_a,match_points_b,created_at";
  const [teams, players, scores, matchGroups, fullMatchGroups, ads] = await Promise.all([
    fetchRows(`/rest/v1/tournament_teams?tournament_id=eq.${tournamentId}&select=id,tournament_id,team_name,side,logo_url`),
    fetchRows(`/rest/v1/tournament_players?tournament_id=eq.${tournamentId}&select=id,tournament_id,display_name`),
    fetchRows(`/rest/v1/tournament_scores?tournament_id=eq.${tournamentId}&select=id,tournament_id,team_id,tournament_player_id,user_id,match_group_id,round_number,hole_scores,total_gross,total_net,created_at&order=round_number.asc`),
    fetchRows(`/rest/v1/tournament_match_groups?tournament_id=eq.${tournamentId}&select=tournament_id,side_a_team_id,side_b_team_id,match_points_a,match_points_b,match_winner`),
    fetchRows(`/rest/v1/tournament_match_groups?tournament_id=eq.${tournamentId}&select=${matchGroupSelect}&order=round_number.asc,tee_time.asc,group_number.asc`),
    fetchRows(`/rest/v1/ad_placements?placement_type=eq.leaderboard&is_active=eq.true&order=created_at.desc&select=id,sponsor_name,placement_type,image_url,banner_text,action_url,display_position,is_active`)
  ]);
  const matchGroupIds = await fetchRows(`/rest/v1/tournament_match_groups?tournament_id=eq.${tournamentId}&select=id`);
  let holeResults = [];
  let fullHoleResults = [];
  if (matchGroupIds.length > 0) {
    const ids = matchGroupIds.map((row) => row.id).join(",");
    holeResults = await fetchRows(`/rest/v1/tournament_match_hole_results?match_group_id=in.(${ids})&select=hole_winner`);
    fullHoleResults = await fetchRows(`/rest/v1/tournament_match_hole_results?match_group_id=in.(${ids})&select=id,match_group_id,round_number,hole,hole_winner,pairing_index,side_a_net,side_b_net&order=round_number.asc,hole.asc`);
  }
  const payload = buildTournamentDisplayPayload({
    tournament,
    teams,
    players,
    scores,
    matchGroups,
    holeResults,
    ads,
    fullMatchGroups,
    fullScores: scores,
    fullHoleResults
  });
  return c.json(payload);
});

// src/routes/tournament-teams.ts
import { Hono as Hono5 } from "hono";

// src/lib/tournament-email.ts
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function buildTournamentOnboardEmailHtml(params) {
  const rosterList = (params.rosterNames ?? []).map((name) => `<li style="margin:4px 0;">${escapeHtml(name)}</li>`).join("");
  const ctaLabel = params.isPendingMember ? "Set up your account" : "View tournament";
  const hasTeam = Boolean(params.teamName?.trim());
  const teamBlock = hasTeam ? `<div style="background:#0c0c0c; border:1px solid #262626; border-radius:12px; padding:16px; margin:20px 0;">
        <p style="margin:0 0 4px; color:#a3a3a3; font-size:12px; text-transform:uppercase; letter-spacing:0.08em;">Team</p>
        <p style="margin:0 0 8px; font-size:18px; font-weight:700;">${escapeHtml(params.teamName ?? "")}</p>
        ${params.teamSideLabel ? `<p style="margin:0 0 12px; color:#a3a3a3;">${escapeHtml(params.teamSideLabel)}</p>` : ""}
        ${rosterList ? `<ul style="margin:0; padding-left:18px; color:#e5e5e5;">${rosterList}</ul>` : ""}
      </div>` : `<p style="color:#d4d4d4; line-height:1.5;">
        You're on the participant list. Team assignments and pairings may still be finalized — check back in the app for updates.
      </p>`;
  const introLine = hasTeam ? `Your team roster is set for <strong>${escapeHtml(params.tournamentName)}</strong> (${escapeHtml(params.tournamentDates)}).` : `You're registered for <strong>${escapeHtml(params.tournamentName)}</strong> (${escapeHtml(params.tournamentDates)}).`;
  return `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#0c0c0c; color:#f5f5f5; padding:24px;">
    <div style="max-width:560px; margin:0 auto; background:#141414; border:1px solid #262626; border-radius:16px; padding:24px;">
      <p style="color:#a3e635; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; margin:0 0 8px;">Fox Creek Golf</p>
      <h1 style="margin:0 0 12px; font-size:24px;">You're on the roster</h1>
      <p style="color:#d4d4d4; line-height:1.5;">
        Hi ${escapeHtml(params.recipientName)},
      </p>
      <p style="color:#d4d4d4; line-height:1.5;">
        ${introLine}
      </p>
      ${teamBlock}
      <a href="${escapeHtml(params.tournamentUrl)}" style="display:inline-block; background:#65a30d; color:#ffffff; text-decoration:none; font-weight:700; padding:12px 18px; border-radius:12px;">
        ${ctaLabel}
      </a>
      <p style="color:#737373; font-size:12px; margin-top:20px; line-height:1.5;">
        ${params.isPendingMember ? "Use the link above to finish setting up your Fox Creek account, then open the tournament." : "Open the app or website to review pairings, tee times, and scoring."}
      </p>
    </div>
  </body>
</html>`;
}
function buildTournamentOnboardEmailText(params) {
  const rosterLines = (params.rosterNames ?? []).map((name) => `- ${name}`).join(`
`);
  const hasTeam = Boolean(params.teamName?.trim());
  const lines = [
    `Hi ${params.recipientName},`,
    "",
    hasTeam ? `Your team roster is set for ${params.tournamentName} (${params.tournamentDates}).` : `You're registered for ${params.tournamentName} (${params.tournamentDates}).`
  ];
  if (hasTeam) {
    lines.push("", `Team: ${params.teamName}${params.teamSideLabel ? ` (${params.teamSideLabel})` : ""}`);
    if (rosterLines)
      lines.push(rosterLines);
  } else {
    lines.push("", "Team assignments and pairings may still be finalized.");
  }
  lines.push("", params.isPendingMember ? "Set up your account: " + params.tournamentUrl : "View tournament: " + params.tournamentUrl);
  return lines.join(`
`);
}
async function sendTournamentOnboardEmail(params) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.TOURNAMENT_EMAIL_FROM?.trim() ?? "Fox Creek Golf <onboarding@foxcreek.golf>";
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY is not configured" };
  }
  const controller = new AbortController;
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: `You're on the roster — ${params.tournamentName}`,
        html: buildTournamentOnboardEmailHtml(params),
        text: buildTournamentOnboardEmailText(params)
      }),
      signal: controller.signal,
      cache: "no-store"
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Email service timed out" : "Email service unreachable";
    return { sent: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { sent: false, error: body.message ?? `Resend request failed (${response.status})` };
  }
  return { sent: true };
}
function buildTournamentDeepLink(tournamentId) {
  const base = process.env.TOURNAMENT_EMAIL_APP_URL?.trim() ?? process.env.MEMBER_INVITE_REDIRECT_URL?.replace(/\/accept-invite$/, "") ?? "https://www.foxcreek.golf";
  return `${base.replace(/\/$/, "")}/tournaments/${tournamentId}`;
}

// src/routes/tournament-teams.ts
var tournamentTeamsRouter = new Hono5;
function buildFullName2(firstName, lastName) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}
function parseTournamentCalendarDate(iso) {
  const dateOnly = iso.trim().slice(0, 10);
  return new Date(`${dateOnly}T12:00:00`);
}
function formatTournamentDates(startDate, endDate) {
  const start = parseTournamentCalendarDate(startDate);
  const end = parseTournamentCalendarDate(endDate);
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const startKey = startDate.trim().slice(0, 10);
  const endKey = endDate.trim().slice(0, 10);
  if (startKey === endKey)
    return formatter.format(start);
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}
async function generateInviteLink2(params) {
  const fullName = params.firstName && params.lastName ? buildFullName2(params.firstName, params.lastName) : undefined;
  const { ok, data } = await adminFetch("/auth/v1/admin/generate_link", {
    method: "POST",
    body: {
      type: "invite",
      email: params.email.trim().toLowerCase(),
      options: {
        redirect_to: params.redirectTo,
        data: fullName ? {
          first_name: params.firstName,
          last_name: params.lastName,
          full_name: fullName
        } : undefined
      }
    }
  });
  if (!ok) {
    throw new Error(getErrorMessage(data));
  }
  const properties = data.properties;
  return typeof data.action_link === "string" && data.action_link || typeof properties?.action_link === "string" && properties.action_link || null;
}
tournamentTeamsRouter.use("*", async (c, next) => {
  if (!isSupabaseAdminConfigured()) {
    return c.json({ error: "Tournament team service is not configured" }, 503);
  }
  await next();
});
tournamentTeamsRouter.patch("/:tournamentId/teams/:teamId", requireManagerAuth, async (c) => {
  const tournamentId = c.req.param("tournamentId");
  const teamId = c.req.param("teamId");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
  const updates = {};
  if (typeof body.team_name === "string") {
    const teamName = body.team_name.trim();
    if (!teamName) {
      return c.json({ error: "Team name is required" }, 400);
    }
    updates.team_name = teamName;
  }
  if ("captain_user_id" in body) {
    updates.captain_user_id = typeof body.captain_user_id === "string" ? body.captain_user_id : null;
  }
  if ("captain_player_id" in body) {
    updates.captain_player_id = typeof body.captain_player_id === "string" ? body.captain_player_id : null;
  }
  if ("player_ids" in body) {
    if (!Array.isArray(body.player_ids)) {
      return c.json({ error: "player_ids must be an array" }, 400);
    }
    updates.player_ids = body.player_ids.filter((id) => typeof id === "string");
  }
  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No valid updates provided" }, 400);
  }
  const patchResult = await adminFetch(`/rest/v1/tournament_teams?id=eq.${teamId}&tournament_id=eq.${tournamentId}&select=*`, {
    method: "PATCH",
    body: updates,
    prefer: "return=representation"
  });
  if (!patchResult.ok) {
    const details = getErrorMessage(patchResult.data);
    console.error("[TournamentTeams] PATCH failed:", details);
    return c.json({
      error: details.includes("captain_player_id") && details.includes("column") ? "Database missing captain_player_id column. Run migration 20260716000000_tournament_team_captain_player.sql" : `Team was not updated: ${details}`
    }, 500);
  }
  const updated = Array.isArray(patchResult.data) ? patchResult.data[0] : null;
  if (!updated) {
    return c.json({ error: "Team not found" }, 404);
  }
  return c.json(updated);
});
function splitDisplayName(displayName) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0)
    return { firstName: "Member", lastName: "" };
  if (parts.length === 1)
    return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
async function inviteUserByEmail2(params) {
  const fullName = buildFullName2(params.firstName, params.lastName);
  const { ok, data } = await adminFetch("/auth/v1/invite", {
    method: "POST",
    body: {
      email: params.email.trim().toLowerCase(),
      data: {
        first_name: params.firstName.trim(),
        last_name: params.lastName.trim(),
        full_name: fullName
      },
      redirect_to: params.redirectTo
    }
  });
  if (!ok) {
    throw new Error(getErrorMessage(data));
  }
  const user = data.user;
  const userId = user?.id ?? (typeof data.id === "string" ? data.id : null);
  if (!userId) {
    throw new Error("Invite succeeded but no user id returned");
  }
  return { userId };
}
async function findAuthUserIdByEmail(email) {
  const normalized = email.trim().toLowerCase();
  const quotedEmail = `"${normalized.replace(/"/g, "")}"`;
  const profileResult = await adminFetch(`/rest/v1/user_profiles?email=eq.${quotedEmail}&select=id&limit=1`);
  if (profileResult.ok && profileResult.data?.[0]?.id) {
    return profileResult.data[0].id;
  }
  const authResult = await adminFetch(`/auth/v1/admin/users?filter=email:eq.${encodeURIComponent(normalized)}&page=1&per_page=1`);
  if (authResult.ok && authResult.data?.users?.[0]?.id) {
    return authResult.data.users[0].id;
  }
  return null;
}
async function ensureAuthUserIdForInvite(params) {
  try {
    const invited = await inviteUserByEmail2(params);
    return { userId: invited.userId, authInviteSent: true };
  } catch (error) {
    const existingId = await findAuthUserIdByEmail(params.email);
    if (existingId) {
      return { userId: existingId, authInviteSent: false };
    }
    throw error;
  }
}
async function loadParticipantInviteContext(tournamentId) {
  const inviteRedirect = process.env.MEMBER_INVITE_REDIRECT_URL?.trim() ?? "http://localhost:8081/accept-invite";
  const tournamentUrl = buildTournamentDeepLink(tournamentId);
  const tournamentResult = await adminFetch(`/rest/v1/tournaments?id=eq.${tournamentId}&select=id,name,start_date,end_date,participant_invites_sent_at`);
  if (!tournamentResult.ok || !tournamentResult.data?.[0]) {
    return { error: "Tournament not found", status: 404 };
  }
  const tournament = tournamentResult.data[0];
  const tournamentDates = formatTournamentDates(tournament.start_date, tournament.end_date);
  const playersResult = await adminFetch(`/rest/v1/tournament_players?tournament_id=eq.${tournamentId}&select=id,display_name,user_id,email,invite_email_sent_at`);
  if (!playersResult.ok || !playersResult.data) {
    return { error: "Could not load participants", status: 500 };
  }
  const teamsResult = await adminFetch(`/rest/v1/tournament_teams?tournament_id=eq.${tournamentId}&select=id,team_name,side,player_ids`);
  if (!teamsResult.ok || !teamsResult.data) {
    return { error: "Could not load teams", status: 500 };
  }
  const teamByPlayerId = new Map;
  for (const team of teamsResult.data) {
    for (const playerId of team.player_ids ?? []) {
      teamByPlayerId.set(playerId, team);
    }
  }
  const userIds = playersResult.data.map((player) => player.user_id).filter((id) => Boolean(id));
  let profiles = [];
  if (userIds.length > 0) {
    const profilesResult = await adminFetch(`/rest/v1/user_profiles?id=in.(${userIds.join(",")})&select=id,email,full_name,first_name,last_name,invite_status`);
    if (profilesResult.ok && profilesResult.data) {
      profiles = profilesResult.data;
    }
  }
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const emailsToLookup = playersResult.data.filter((player) => !player.user_id && player.email?.trim()).map((player) => player.email.trim().toLowerCase());
  let profilesByEmail = new Map;
  if (emailsToLookup.length > 0) {
    const inList = emailsToLookup.map((email) => `"${email.replace(/"/g, "")}"`).join(",");
    const byEmailResult = await adminFetch(`/rest/v1/user_profiles?email=in.(${inList})&select=id,email,full_name,first_name,last_name,invite_status`);
    if (byEmailResult.ok && byEmailResult.data) {
      profilesByEmail = new Map(byEmailResult.data.map((profile) => [profile.email?.toLowerCase() ?? "", profile]));
    }
  }
  return {
    context: {
      inviteRedirect,
      tournamentUrl,
      tournament,
      tournamentDates,
      teamByPlayerId,
      allPlayers: playersResult.data,
      profileById,
      profilesByEmail
    }
  };
}
async function loadSingleParticipantInviteContext(tournamentId, playerId) {
  const inviteRedirect = process.env.MEMBER_INVITE_REDIRECT_URL?.trim() ?? "http://localhost:8081/accept-invite";
  const tournamentUrl = buildTournamentDeepLink(tournamentId);
  const [tournamentResult, playerResult, teamsResult] = await Promise.all([
    adminFetch(`/rest/v1/tournaments?id=eq.${tournamentId}&select=id,name,start_date,end_date,participant_invites_sent_at`),
    adminFetch(`/rest/v1/tournament_players?id=eq.${playerId}&tournament_id=eq.${tournamentId}&select=id,display_name,user_id,email,invite_email_sent_at`),
    adminFetch(`/rest/v1/tournament_teams?tournament_id=eq.${tournamentId}&select=id,team_name,side,player_ids`)
  ]);
  if (!tournamentResult.ok || !tournamentResult.data?.[0]) {
    return { error: "Tournament not found", status: 404 };
  }
  if (!playerResult.ok || !playerResult.data?.[0]) {
    return { error: "Participant not found", status: 404 };
  }
  const tournament = tournamentResult.data[0];
  const player = playerResult.data[0];
  const teams = teamsResult.ok && teamsResult.data ? teamsResult.data : [];
  const team = teams.find((entry) => entry.player_ids?.includes(playerId));
  const profileById = new Map;
  const profilesByEmail = new Map;
  const rosterPromise = team?.player_ids?.length && team.player_ids.length > 0 ? adminFetch(`/rest/v1/tournament_players?id=in.(${team.player_ids.join(",")})&select=id,display_name,user_id,email,invite_email_sent_at`) : Promise.resolve({ ok: true, status: 200, data: [player] });
  const profilePromise = player.user_id ? adminFetch(`/rest/v1/user_profiles?id=eq.${player.user_id}&select=id,email,full_name,first_name,last_name,invite_status`) : player.email?.trim() ? adminFetch(`/rest/v1/user_profiles?email=eq."${player.email.trim().toLowerCase().replace(/"/g, "")}"&select=id,email,full_name,first_name,last_name,invite_status`) : Promise.resolve({ ok: true, status: 200, data: [] });
  const [rosterResult, profileResult] = await Promise.all([rosterPromise, profilePromise]);
  const rosterPlayers = rosterResult.ok && rosterResult.data?.length ? rosterResult.data : [player];
  if (profileResult.ok && profileResult.data?.[0]) {
    const profile = profileResult.data[0];
    if (player.user_id) {
      profileById.set(player.user_id, profile);
    } else if (profile.email) {
      profilesByEmail.set(profile.email.toLowerCase(), profile);
    }
  }
  const teamByPlayerId = new Map;
  if (team) {
    teamByPlayerId.set(player.id, team);
  }
  return {
    player,
    context: {
      inviteRedirect,
      tournamentUrl,
      tournament,
      tournamentDates: formatTournamentDates(tournament.start_date, tournament.end_date),
      teamByPlayerId,
      allPlayers: rosterPlayers,
      profileById,
      profilesByEmail
    }
  };
}
async function sendParticipantInviteForPlayer(player, context, options = {}) {
  const now = options.now ?? new Date().toISOString();
  if (player.invite_email_sent_at && !options.allowResend) {
    return { emailed: false, invitesSent: 0, skippedAlreadySent: true };
  }
  let profile = player.user_id ? context.profileById.get(player.user_id) : null;
  let email = profile?.email?.trim() ?? player.email?.trim() ?? null;
  if (!email && player.email?.trim()) {
    const byEmail = context.profilesByEmail.get(player.email.trim().toLowerCase());
    if (byEmail) {
      profile = byEmail;
      email = byEmail.email?.trim() ?? player.email.trim();
    }
  }
  if (!email) {
    return { emailed: false, invitesSent: 0, skippedNoEmail: true };
  }
  const team = context.teamByPlayerId.get(player.id);
  const rosterNames = team ? context.allPlayers.filter((entry) => team.player_ids.includes(entry.id)).map((entry) => entry.display_name) : [];
  const recipientName = profile?.full_name?.trim() || buildFullName2(profile?.first_name ?? "", profile?.last_name ?? "") || player.display_name;
  let isPendingMember = profile?.invite_status === "pending";
  let linkedUserId = player.user_id ?? profile?.id ?? null;
  let invitesSent = 0;
  try {
    if (!linkedUserId) {
      const { firstName, lastName } = splitDisplayName(player.display_name);
      const ensured = await ensureAuthUserIdForInvite({
        email,
        firstName,
        lastName,
        redirectTo: context.inviteRedirect
      });
      linkedUserId = ensured.userId;
      if (ensured.authInviteSent) {
        invitesSent += 1;
      }
      isPendingMember = true;
    }
    let accountSetupUrl = context.tournamentUrl;
    if (isPendingMember) {
      const { firstName, lastName } = splitDisplayName(recipientName);
      const actionLink = await generateInviteLink2({
        email,
        firstName,
        lastName,
        redirectTo: context.inviteRedirect
      });
      if (actionLink) {
        accountSetupUrl = actionLink;
        invitesSent += 1;
      } else {
        accountSetupUrl = context.inviteRedirect;
      }
    }
    if (!player.user_id && linkedUserId) {
      await adminFetch(`/rest/v1/tournament_players?id=eq.${player.id}`, {
        method: "PATCH",
        body: { user_id: linkedUserId }
      });
    }
    const emailResult = await sendTournamentOnboardEmail({
      to: email,
      recipientName,
      tournamentName: context.tournament.name,
      tournamentDates: context.tournamentDates,
      teamName: team?.team_name ?? null,
      teamSideLabel: null,
      rosterNames,
      tournamentUrl: isPendingMember ? accountSetupUrl : context.tournamentUrl,
      isPendingMember
    });
    if (emailResult.sent) {
      await adminFetch(`/rest/v1/tournament_players?id=eq.${player.id}`, {
        method: "PATCH",
        body: { invite_email_sent_at: now }
      });
      return { emailed: true, invitesSent, email };
    }
    return {
      emailed: false,
      invitesSent,
      email,
      error: emailResult.error ?? "Email was not sent"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email failed";
    return { emailed: false, invitesSent, email, error: message };
  }
}
tournamentTeamsRouter.patch("/:tournamentId/participants/:playerId", requireManagerAuth, async (c) => {
  const tournamentId = c.req.param("tournamentId");
  const playerId = c.req.param("playerId");
  const body = await c.req.json();
  const playerResult = await adminFetch(`/rest/v1/tournament_players?id=eq.${playerId}&tournament_id=eq.${tournamentId}&select=id,user_id,email`);
  if (!playerResult.ok || !playerResult.data?.[0]) {
    return c.json({ error: "Participant not found" }, 404);
  }
  const updates = {};
  if (typeof body.display_name === "string") {
    const trimmed = body.display_name.trim();
    if (!trimmed) {
      return c.json({ error: "Name is required" }, 400);
    }
    updates.display_name = trimmed;
  }
  if (body.email !== undefined) {
    if (body.email === null || body.email === "") {
      updates.email = null;
    } else if (typeof body.email === "string") {
      updates.email = body.email.trim().toLowerCase();
    }
  }
  if (body.handicap_index !== undefined) {
    updates.handicap_index = body.handicap_index;
  }
  if (body.user_id !== undefined) {
    updates.user_id = typeof body.user_id === "string" ? body.user_id : null;
  }
  const existingPlayer = playerResult.data[0];
  const resolvedEmail = typeof updates.email === "string" ? updates.email : existingPlayer.email?.trim().toLowerCase() ?? null;
  if (!updates.user_id && resolvedEmail) {
    const profileResult = await adminFetch(`/rest/v1/user_profiles?email=eq.${encodeURIComponent(resolvedEmail)}&select=id&limit=1`);
    if (profileResult.ok && profileResult.data?.[0]?.id) {
      updates.user_id = profileResult.data[0].id;
    }
  }
  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No updates provided" }, 400);
  }
  const patchResult = await adminFetch(`/rest/v1/tournament_players?id=eq.${playerId}&tournament_id=eq.${tournamentId}`, {
    method: "PATCH",
    body: updates,
    prefer: "return=representation"
  });
  if (!patchResult.ok) {
    return c.json({ error: "Could not update participant" }, 500);
  }
  const updated = Array.isArray(patchResult.data) ? patchResult.data[0] : null;
  if (!updated) {
    return c.json({ error: "Participant was not updated" }, 500);
  }
  return c.json(updated);
});
tournamentTeamsRouter.delete("/:tournamentId/participants/:playerId", requireManagerAuth, async (c) => {
  const tournamentId = c.req.param("tournamentId");
  const playerId = c.req.param("playerId");
  const playerResult = await adminFetch(`/rest/v1/tournament_players?id=eq.${playerId}&tournament_id=eq.${tournamentId}&select=id`);
  if (!playerResult.ok || !playerResult.data?.[0]) {
    return c.json({ error: "Participant not found" }, 404);
  }
  const teamsResult = await adminFetch(`/rest/v1/tournament_teams?tournament_id=eq.${tournamentId}&select=id,player_ids`);
  if (teamsResult.ok && teamsResult.data) {
    for (const team of teamsResult.data) {
      if (!team.player_ids?.includes(playerId))
        continue;
      const nextIds = team.player_ids.filter((id) => id !== playerId);
      await adminFetch(`/rest/v1/tournament_teams?id=eq.${team.id}`, {
        method: "PATCH",
        body: { player_ids: nextIds }
      });
    }
  }
  const matchGroupsResult = await adminFetch(`/rest/v1/tournament_match_groups?tournament_id=eq.${tournamentId}&select=id,side_a_player_ids,side_b_player_ids`);
  if (matchGroupsResult.ok && matchGroupsResult.data) {
    for (const group of matchGroupsResult.data) {
      const nextA = group.side_a_player_ids.filter((id) => id !== playerId);
      const nextB = group.side_b_player_ids.filter((id) => id !== playerId);
      if (nextA.length !== group.side_a_player_ids.length || nextB.length !== group.side_b_player_ids.length) {
        await adminFetch(`/rest/v1/tournament_match_groups?id=eq.${group.id}`, {
          method: "PATCH",
          body: {
            side_a_player_ids: nextA,
            side_b_player_ids: nextB
          }
        });
      }
    }
  }
  const deleteResult = await adminFetch(`/rest/v1/tournament_players?id=eq.${playerId}&tournament_id=eq.${tournamentId}`, { method: "DELETE" });
  if (!deleteResult.ok) {
    return c.json({ error: "Could not delete participant" }, 500);
  }
  return c.json({ success: true });
});
tournamentTeamsRouter.post("/:tournamentId/participants/:playerId/send-invite", requireManagerAuth, async (c) => {
  try {
    const tournamentId = c.req.param("tournamentId");
    const playerId = c.req.param("playerId");
    let resend = false;
    try {
      const body = await c.req.json();
      resend = body.resend === true;
    } catch {}
    const loaded = await loadSingleParticipantInviteContext(tournamentId, playerId);
    if ("error" in loaded) {
      return c.json({ error: loaded.error }, loaded.status);
    }
    const { player, context } = loaded;
    if (player.invite_email_sent_at && !resend) {
      return c.json({
        error: "Invite was already sent to this participant. Send again with resend enabled.",
        skippedAlreadySent: true
      }, 409);
    }
    const result = await sendParticipantInviteForPlayer(player, context, {
      allowResend: resend
    });
    if (result.skippedNoEmail) {
      return c.json({ error: "Participant has no email address" }, 400);
    }
    if (!result.emailed) {
      return c.json({
        error: result.error ?? "Could not send invite",
        invitesSent: result.invitesSent,
        email: result.email
      }, 500);
    }
    return c.json({
      success: true,
      emailed: 1,
      invitesSent: result.invitesSent,
      email: result.email
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send invite";
    console.error("[Tournament] send-invite failed:", message);
    return c.json({ error: message }, 500);
  }
});
tournamentTeamsRouter.post("/:tournamentId/send-participant-invites", requireManagerAuth, async (c) => {
  const tournamentId = c.req.param("tournamentId");
  const loaded = await loadParticipantInviteContext(tournamentId);
  if ("error" in loaded) {
    return c.json({ error: loaded.error }, loaded.status);
  }
  const { context } = loaded;
  let emailed = 0;
  let invitesSent = 0;
  let skippedNoEmail = 0;
  let skippedAlreadySent = 0;
  const errors = [];
  const now = new Date().toISOString();
  for (const player of context.allPlayers) {
    const result = await sendParticipantInviteForPlayer(player, context, { now });
    if (result.skippedAlreadySent) {
      skippedAlreadySent += 1;
      continue;
    }
    if (result.skippedNoEmail) {
      skippedNoEmail += 1;
      continue;
    }
    invitesSent += result.invitesSent;
    if (result.emailed) {
      emailed += 1;
    } else if (result.error && result.email) {
      errors.push(`${result.email}: ${result.error}`);
    }
  }
  const teamsResult = await adminFetch(`/rest/v1/tournament_teams?tournament_id=eq.${tournamentId}&select=id,player_ids`);
  const teams = teamsResult.ok && teamsResult.data ? teamsResult.data : [];
  await adminFetch(`/rest/v1/tournaments?id=eq.${tournamentId}`, {
    method: "PATCH",
    body: { participant_invites_sent_at: now }
  });
  for (const team of teams) {
    if ((team.player_ids?.length ?? 0) > 0) {
      await adminFetch(`/rest/v1/tournament_teams?id=eq.${team.id}`, {
        method: "PATCH",
        body: {
          roster_status: "ready",
          onboard_email_sent_at: now
        }
      });
    }
  }
  return c.json({
    emailed,
    invitesSent,
    skippedNoEmail,
    skippedAlreadySent,
    errors
  });
});
tournamentTeamsRouter.post("/:tournamentId/teams/:teamId/mark-ready-and-notify", requireManagerAuth, async (c) => {
  const tournamentId = c.req.param("tournamentId");
  const teamId = c.req.param("teamId");
  const authUser = c.get("authUser");
  const inviteRedirect = process.env.MEMBER_INVITE_REDIRECT_URL?.trim() ?? "http://localhost:8081/accept-invite";
  const tournamentUrl = buildTournamentDeepLink(tournamentId);
  const teamResult = await adminFetch(`/rest/v1/tournament_teams?id=eq.${teamId}&tournament_id=eq.${tournamentId}&select=*`);
  if (!teamResult.ok || !teamResult.data?.[0]) {
    return c.json({ error: "Team not found" }, 404);
  }
  const team = teamResult.data[0];
  if (!team.captain_user_id && !team.captain_player_id) {
    return c.json({ error: "Assign a captain before marking the roster ready" }, 400);
  }
  if (!team.player_ids?.length) {
    return c.json({ error: "Add at least one player to the roster" }, 400);
  }
  if (team.roster_status !== "draft") {
    return c.json({ error: "Roster is already marked ready" }, 400);
  }
  if (team.onboard_email_sent_at) {
    return c.json({ error: "Onboard email was already sent for this team" }, 400);
  }
  const tournamentResult = await adminFetch(`/rest/v1/tournaments?id=eq.${tournamentId}&select=id,name,start_date,end_date`);
  if (!tournamentResult.ok || !tournamentResult.data?.[0]) {
    return c.json({ error: "Tournament not found" }, 404);
  }
  const tournament = tournamentResult.data[0];
  const playersResult = await adminFetch(`/rest/v1/tournament_players?id=in.(${team.player_ids.join(",")})&select=id,display_name,user_id`);
  if (!playersResult.ok || !playersResult.data) {
    return c.json({ error: "Could not load roster players" }, 500);
  }
  const rosterPlayers = playersResult.data;
  const memberUserIds = rosterPlayers.map((player) => player.user_id).filter((userId) => Boolean(userId));
  let profiles = [];
  if (memberUserIds.length > 0) {
    const profilesResult = await adminFetch(`/rest/v1/user_profiles?id=in.(${memberUserIds.join(",")})&select=id,email,full_name,first_name,last_name,invite_status`);
    if (!profilesResult.ok || !profilesResult.data) {
      return c.json({ error: "Could not load member profiles" }, 500);
    }
    profiles = profilesResult.data;
  }
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const rosterNames = rosterPlayers.map((player) => player.display_name);
  const teamSideLabel = null;
  const tournamentDates = formatTournamentDates(tournament.start_date, tournament.end_date);
  let emailed = 0;
  let invitesSent = 0;
  let skippedGuests = 0;
  const errors = [];
  for (const player of rosterPlayers) {
    if (!player.user_id) {
      skippedGuests += 1;
      continue;
    }
    const profile = profileById.get(player.user_id);
    if (!profile?.email) {
      skippedGuests += 1;
      continue;
    }
    const recipientName = profile.full_name?.trim() || buildFullName2(profile.first_name ?? "", profile.last_name ?? "") || player.display_name;
    try {
      if (profile.invite_status === "pending") {
        await generateInviteLink2({
          email: profile.email,
          firstName: profile.first_name ?? recipientName.split(" ")[0] ?? "Member",
          lastName: profile.last_name ?? recipientName.split(" ").slice(1).join(" ") ?? "",
          redirectTo: inviteRedirect
        });
        invitesSent += 1;
      }
      const emailResult = await sendTournamentOnboardEmail({
        to: profile.email,
        recipientName,
        tournamentName: tournament.name,
        tournamentDates,
        teamName: team.team_name,
        teamSideLabel,
        rosterNames,
        tournamentUrl: profile.invite_status === "pending" ? inviteRedirect : tournamentUrl,
        isPendingMember: profile.invite_status === "pending"
      });
      if (emailResult.sent) {
        emailed += 1;
      } else if (emailResult.error) {
        errors.push(`${profile.email}: ${emailResult.error}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email failed";
      errors.push(`${profile.email}: ${message}`);
    }
  }
  const now = new Date().toISOString();
  const patchResult = await adminFetch(`/rest/v1/tournament_teams?id=eq.${teamId}`, {
    method: "PATCH",
    body: {
      roster_status: "ready",
      roster_ready_at: now,
      roster_ready_by: authUser.id,
      onboard_email_sent_at: now
    },
    prefer: "return=representation"
  });
  if (!patchResult.ok) {
    return c.json({ error: "Roster was updated in email step but status save failed" }, 500);
  }
  return c.json({
    emailed,
    invitesSent,
    skippedGuests,
    errors
  });
});

// src/routes/tournament-scores.ts
import { Hono as Hono6 } from "hono";

// src/lib/tournament-match-points.ts
function pointsFromWinTally(aWins, bWins) {
  if (aWins > bWins) {
    return { match_winner: "side_a", match_points_a: 1, match_points_b: 0 };
  }
  if (bWins > aWins) {
    return { match_winner: "side_b", match_points_a: 0, match_points_b: 1 };
  }
  return { match_winner: "tie", match_points_a: 0.5, match_points_b: 0.5 };
}
function countWins(rows) {
  let side_a = 0;
  let side_b = 0;
  for (const row of rows) {
    if (row.hole_winner === "side_a")
      side_a += 1;
    else if (row.hole_winner === "side_b")
      side_b += 1;
  }
  return { side_a, side_b };
}
function computeMatchPointsFromHoleResults(params) {
  const { format, matchGroup, holeResults } = params;
  if (format === "singles" || format === "match_play") {
    const pairCount = Math.min(matchGroup.side_a_player_ids.length, matchGroup.side_b_player_ids.length);
    let totalA = 0;
    let totalB = 0;
    for (let i = 0;i < pairCount; i++) {
      const pairingRows = holeResults.filter((r) => (r.pairing_index ?? 0) === i);
      const wins2 = countWins(pairingRows);
      const pairPoints = pointsFromWinTally(wins2.side_a, wins2.side_b);
      totalA += pairPoints.match_points_a;
      totalB += pairPoints.match_points_b;
    }
    if (totalA > totalB) {
      return { match_winner: "side_a", match_points_a: totalA, match_points_b: totalB };
    }
    if (totalB > totalA) {
      return { match_winner: "side_b", match_points_a: totalA, match_points_b: totalB };
    }
    return { match_winner: "tie", match_points_a: totalA, match_points_b: totalB };
  }
  const teamRows = holeResults.filter((r) => (r.pairing_index ?? 0) === 0);
  const wins = countWins(teamRows);
  return pointsFromWinTally(wins.side_a, wins.side_b);
}

// src/lib/tournament-score-sync.ts
async function assertUserCanWriteMatchGroup(userId, role, matchGroupId) {
  if (role === "manager" || role === "super_admin") {
    const groupRes2 = await adminFetch(`/rest/v1/tournament_match_groups?id=eq.${matchGroupId}&select=id,tournament_id,format,side_a_player_ids,side_b_player_ids`);
    if (!groupRes2.ok || !groupRes2.data[0]) {
      return { ok: false, error: "Match pairing not found" };
    }
    return { ok: true, matchGroup: groupRes2.data[0] };
  }
  const groupRes = await adminFetch(`/rest/v1/tournament_match_groups?id=eq.${matchGroupId}&select=id,tournament_id,format,side_a_player_ids,side_b_player_ids`);
  if (!groupRes.ok || !groupRes.data[0]) {
    return { ok: false, error: "Match pairing not found" };
  }
  const matchGroup = groupRes.data[0];
  const playerRes = await adminFetch(`/rest/v1/tournament_players?tournament_id=eq.${matchGroup.tournament_id}&user_id=eq.${userId}&select=id`);
  const playerId = playerRes.data?.[0]?.id;
  if (!playerId) {
    return { ok: false, error: "You are not on this tournament roster" };
  }
  const inGroup = matchGroup.side_a_player_ids.includes(playerId) || matchGroup.side_b_player_ids.includes(playerId);
  if (!inGroup) {
    return { ok: false, error: "You are not in this match pairing" };
  }
  return { ok: true, matchGroup };
}
async function findExistingScore(score) {
  if (score.team_id) {
    const res = await adminFetch(`/rest/v1/tournament_scores?tournament_id=eq.${score.tournament_id}&team_id=eq.${score.team_id}&round_number=eq.${score.round_number}&select=id`);
    return res.data?.[0] ?? null;
  }
  if (score.tournament_player_id) {
    const res = await adminFetch(`/rest/v1/tournament_scores?tournament_id=eq.${score.tournament_id}&tournament_player_id=eq.${score.tournament_player_id}&round_number=eq.${score.round_number}&select=id`);
    return res.data?.[0] ?? null;
  }
  if (score.user_id) {
    const res = await adminFetch(`/rest/v1/tournament_scores?tournament_id=eq.${score.tournament_id}&user_id=eq.${score.user_id}&round_number=eq.${score.round_number}&select=id`);
    return res.data?.[0] ?? null;
  }
  return null;
}
async function upsertTournamentScore(score) {
  const existing = await findExistingScore(score);
  if (existing) {
    const res2 = await adminFetch(`/rest/v1/tournament_scores?id=eq.${existing.id}`, {
      method: "PATCH",
      body: {
        hole_scores: score.hole_scores,
        total_gross: score.total_gross,
        total_net: score.total_net,
        match_group_id: score.match_group_id ?? null
      },
      prefer: "return=representation"
    });
    if (!res2.ok) {
      throw new Error(getErrorMessage(res2.data));
    }
    return res2.data?.[0]?.id ?? existing.id;
  }
  const res = await adminFetch(`/rest/v1/tournament_scores`, {
    method: "POST",
    body: score,
    prefer: "return=representation"
  });
  if (!res.ok) {
    throw new Error(getErrorMessage(res.data));
  }
  return res.data?.[0]?.id ?? null;
}
async function syncTournamentMatchScores(params) {
  const access = await assertUserCanWriteMatchGroup(params.userId, params.role, params.matchGroupId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }
  const matchGroup = access.matchGroup;
  const recomputedPoints = computeMatchPointsFromHoleResults({
    format: matchGroup.format,
    matchGroup,
    holeResults: params.holeResults
  });
  const matchPoints = params.matchPoints ?? recomputedPoints;
  try {
    if (params.scores.length > 0) {
      for (const score of params.scores) {
        await upsertTournamentScore({
          ...score,
          match_group_id: score.match_group_id ?? params.matchGroupId
        });
      }
    }
    const clearRes = await adminFetch(`/rest/v1/tournament_match_hole_results?match_group_id=eq.${params.matchGroupId}&round_number=eq.${params.roundNumber}`, { method: "DELETE" });
    if (!clearRes.ok) {
      throw new Error(getErrorMessage(clearRes.data));
    }
    if (params.holeResults.length > 0) {
      const insertRes = await adminFetch(`/rest/v1/tournament_match_hole_results`, {
        method: "POST",
        body: params.holeResults,
        prefer: "return=representation"
      });
      if (!insertRes.ok) {
        throw new Error(getErrorMessage(insertRes.data));
      }
    }
    const patchRes = await adminFetch(`/rest/v1/tournament_match_groups?id=eq.${params.matchGroupId}`, {
      method: "PATCH",
      body: matchPoints,
      prefer: "return=minimal"
    });
    if (!patchRes.ok) {
      throw new Error(getErrorMessage(patchRes.data));
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save scores";
    return { success: false, error: message };
  }
}
async function clearTournamentMatchScores(params) {
  const access = await assertUserCanWriteMatchGroup(params.userId, params.role, params.matchGroupId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }
  try {
    const scoresRes = await adminFetch(`/rest/v1/tournament_scores?match_group_id=eq.${params.matchGroupId}&round_number=eq.${params.roundNumber}`, { method: "DELETE" });
    if (!scoresRes.ok) {
      throw new Error(getErrorMessage(scoresRes.data));
    }
    const holesRes = await adminFetch(`/rest/v1/tournament_match_hole_results?match_group_id=eq.${params.matchGroupId}&round_number=eq.${params.roundNumber}`, { method: "DELETE" });
    if (!holesRes.ok) {
      throw new Error(getErrorMessage(holesRes.data));
    }
    const patchRes = await adminFetch(`/rest/v1/tournament_match_groups?id=eq.${params.matchGroupId}`, {
      method: "PATCH",
      body: {
        match_winner: null,
        match_points_a: 0,
        match_points_b: 0
      },
      prefer: "return=minimal"
    });
    if (!patchRes.ok) {
      throw new Error(getErrorMessage(patchRes.data));
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to clear scores";
    return { success: false, error: message };
  }
}

// src/routes/tournament-scores.ts
var tournamentScoresRouter = new Hono6;
tournamentScoresRouter.post("/:tournamentId/match-groups/:matchGroupId/sync", requireMemberAuth, async (c) => {
  if (!isSupabaseAdminConfigured()) {
    return c.json({ error: "Tournament sync is not configured" }, 503);
  }
  const authUser = c.get("authUser");
  const matchGroupId = c.req.param("matchGroupId");
  const body = await c.req.json();
  if (!body.roundNumber || !Array.isArray(body.scores)) {
    return c.json({ error: "roundNumber and scores array are required" }, 400);
  }
  const result = await syncTournamentMatchScores({
    userId: authUser.id,
    role: authUser.role,
    matchGroupId,
    roundNumber: body.roundNumber,
    scores: body.scores,
    holeResults: body.holeResults ?? [],
    matchPoints: body.matchPoints
  });
  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }
  return c.json({ success: true });
});
tournamentScoresRouter.post("/:tournamentId/match-groups/:matchGroupId/clear", requireMemberAuth, async (c) => {
  if (!isSupabaseAdminConfigured()) {
    return c.json({ error: "Tournament sync is not configured" }, 503);
  }
  const authUser = c.get("authUser");
  const matchGroupId = c.req.param("matchGroupId");
  const body = await c.req.json();
  if (!body.roundNumber) {
    return c.json({ error: "roundNumber is required" }, 400);
  }
  const result = await clearTournamentMatchScores({
    userId: authUser.id,
    role: authUser.role,
    matchGroupId,
    roundNumber: body.roundNumber
  });
  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }
  return c.json({ success: true });
});

// src/app.ts
var allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/(www\.)?foxcreek\.golf$/,
  /^https:\/\/[a-z0-9-]+\.foxcreek\.golf$/,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
  /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/
];
function createApp() {
  const app = new Hono7;
  app.use("*", cors({
    origin: (origin) => origin && allowed.some((re) => re.test(origin)) ? origin : null,
    credentials: true
  }));
  app.use("*", logger());
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/health/supabase-admin", async (c) => {
    if (!isSupabaseAdminConfigured()) {
      return c.json({ ok: false, error: "Supabase admin is not configured" }, 503);
    }
    const started = Date.now();
    const result = await adminFetch("/rest/v1/user_profiles?select=id&limit=1");
    return c.json({
      ok: result.ok,
      status: result.status,
      latencyMs: Date.now() - started
    });
  });
  app.route("/api/sample", sampleRouter);
  app.route("/api/dev", devAuthRouter);
  app.route("/api/members", membersRouter);
  app.route("/api/display", displayRouter);
  app.route("/api/tournaments", tournamentTeamsRouter);
  app.route("/api/tournaments", tournamentScoresRouter);
  return app;
}
var app = createApp();

// src/vercel.ts
var vercel_default = handle(app);
export {
  vercel_default as default
};
