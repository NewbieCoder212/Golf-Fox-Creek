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
function getErrorMessage(data) {
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
    return c.json({ error: getErrorMessage(data) }, 400);
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
    return c.json({ error: getErrorMessage(data) }, 400);
  }
  return c.json({ success: true, email });
});

// src/routes/members.ts
import { Hono as Hono3 } from "hono";

// src/lib/supabase-admin.ts
var supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
var serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
function isSupabaseAdminConfigured() {
  return Boolean(supabaseUrl && serviceRoleKey);
}
function getSupabaseAdminConfig() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Supabase admin is not configured");
  }
  return { supabaseUrl, serviceRoleKey };
}
function getErrorMessage2(data) {
  return typeof data.error_description === "string" && data.error_description || typeof data.msg === "string" && data.msg || typeof data.message === "string" && data.message || "Request failed";
}
async function adminFetch(path, options = {}) {
  const { supabaseUrl: url, serviceRoleKey: key } = getSupabaseAdminConfig();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
  if (options.prefer) {
    headers.Prefer = options.prefer;
  }
  const response = await fetch(`${url}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: response.ok, status: response.status, data };
}

// src/middleware/auth.ts
async function fetchUserRole(userId) {
  const { supabaseUrl: supabaseUrl2, serviceRoleKey: serviceRoleKey2 } = getSupabaseAdminConfig();
  const url = new URL(`${supabaseUrl2}/rest/v1/user_profiles`);
  url.searchParams.set("id", `eq.${userId}`);
  url.searchParams.set("select", "role");
  const response = await fetch(url.toString(), {
    headers: {
      apikey: serviceRoleKey2,
      Authorization: `Bearer ${serviceRoleKey2}`,
      Accept: "application/vnd.pgrst.object+json"
    }
  });
  if (!response.ok)
    return null;
  const profile = await response.json();
  return profile.role ?? null;
}
async function requireMemberAuth(c, next) {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const { supabaseUrl: supabaseUrl2, serviceRoleKey: serviceRoleKey2 } = getSupabaseAdminConfig();
    const response = await fetch(`${supabaseUrl2}/auth/v1/user`, {
      headers: {
        apikey: serviceRoleKey2,
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }
    const user = await response.json();
    const role = await fetchUserRole(user.id);
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
    const { supabaseUrl: supabaseUrl2, serviceRoleKey: serviceRoleKey2 } = getSupabaseAdminConfig();
    const response = await fetch(`${supabaseUrl2}/auth/v1/user`, {
      headers: {
        apikey: serviceRoleKey2,
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }
    const user = await response.json();
    const role = await fetchUserRole(user.id);
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
    throw new Error(getErrorMessage2(data));
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
    throw new Error(getErrorMessage2(data));
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
    throw new Error(getErrorMessage2(data));
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
  const { tournament, teams, players, scores, matchGroups, holeResults, ads, fullMatchGroups, fullScores } = params;
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
      side: team.side
    })),
    players: players.map((player) => ({
      id: player.id,
      tournament_id: player.tournament_id,
      display_name: player.display_name
    })),
    matchGroups: fullMatchGroups ?? [],
    scores: fullScores ?? [],
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
    fetchRows(`/rest/v1/tournament_teams?tournament_id=eq.${tournamentId}&select=id,tournament_id,team_name,side`),
    fetchRows(`/rest/v1/tournament_players?tournament_id=eq.${tournamentId}&select=id,tournament_id,display_name`),
    fetchRows(`/rest/v1/tournament_scores?tournament_id=eq.${tournamentId}&select=id,tournament_id,team_id,tournament_player_id,user_id,match_group_id,round_number,hole_scores,total_gross,total_net,created_at&order=round_number.asc`),
    fetchRows(`/rest/v1/tournament_match_groups?tournament_id=eq.${tournamentId}&select=tournament_id,side_a_team_id,side_b_team_id,match_points_a,match_points_b,match_winner`),
    fetchRows(`/rest/v1/tournament_match_groups?tournament_id=eq.${tournamentId}&select=${matchGroupSelect}&order=round_number.asc,tee_time.asc,group_number.asc`),
    fetchRows(`/rest/v1/ad_placements?placement_type=eq.leaderboard&is_active=eq.true&order=created_at.desc&select=id,sponsor_name,placement_type,image_url,banner_text,action_url,display_position,is_active`)
  ]);
  const matchGroupIds = await fetchRows(`/rest/v1/tournament_match_groups?tournament_id=eq.${tournamentId}&select=id`);
  let holeResults = [];
  if (matchGroupIds.length > 0) {
    const ids = matchGroupIds.map((row) => row.id).join(",");
    holeResults = await fetchRows(`/rest/v1/tournament_match_hole_results?match_group_id=in.(${ids})&select=hole_winner`);
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
    fullScores: scores
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
  const response = await fetch("https://api.resend.com/emails", {
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
    })
  });
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
function formatTournamentDates(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  if (startDate === endDate)
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
    throw new Error(getErrorMessage2(data));
  }
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
    const details = getErrorMessage2(patchResult.data);
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
    throw new Error(getErrorMessage2(data));
  }
  const user = data.user;
  const userId = user?.id ?? (typeof data.id === "string" ? data.id : null);
  if (!userId) {
    throw new Error("Invite succeeded but no user id returned");
  }
  return { userId };
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
tournamentTeamsRouter.post("/:tournamentId/send-participant-invites", requireManagerAuth, async (c) => {
  const tournamentId = c.req.param("tournamentId");
  const inviteRedirect = process.env.MEMBER_INVITE_REDIRECT_URL?.trim() ?? "http://localhost:8081/accept-invite";
  const tournamentUrl = buildTournamentDeepLink(tournamentId);
  const tournamentResult = await adminFetch(`/rest/v1/tournaments?id=eq.${tournamentId}&select=id,name,start_date,end_date,participant_invites_sent_at`);
  if (!tournamentResult.ok || !tournamentResult.data?.[0]) {
    return c.json({ error: "Tournament not found" }, 404);
  }
  const tournament = tournamentResult.data[0];
  const tournamentDates = formatTournamentDates(tournament.start_date, tournament.end_date);
  const playersResult = await adminFetch(`/rest/v1/tournament_players?tournament_id=eq.${tournamentId}&select=id,display_name,user_id,email,invite_email_sent_at`);
  if (!playersResult.ok || !playersResult.data) {
    return c.json({ error: "Could not load participants" }, 500);
  }
  const teamsResult = await adminFetch(`/rest/v1/tournament_teams?tournament_id=eq.${tournamentId}&select=id,team_name,side,player_ids`);
  if (!teamsResult.ok || !teamsResult.data) {
    return c.json({ error: "Could not load teams" }, 500);
  }
  const teams = teamsResult.data;
  const teamByPlayerId = new Map;
  for (const team of teams) {
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
  let emailed = 0;
  let invitesSent = 0;
  let skippedNoEmail = 0;
  let skippedAlreadySent = 0;
  const errors = [];
  const now = new Date().toISOString();
  for (const player of playersResult.data) {
    if (player.invite_email_sent_at) {
      skippedAlreadySent += 1;
      continue;
    }
    let profile = player.user_id ? profileById.get(player.user_id) : null;
    let email = profile?.email?.trim() ?? player.email?.trim() ?? null;
    if (!email && player.email?.trim()) {
      const byEmail = profilesByEmail.get(player.email.trim().toLowerCase());
      if (byEmail) {
        profile = byEmail;
        email = byEmail.email?.trim() ?? player.email.trim();
      }
    }
    if (!email) {
      skippedNoEmail += 1;
      continue;
    }
    const team = teamByPlayerId.get(player.id);
    const rosterNames = team ? playersResult.data.filter((entry) => team.player_ids.includes(entry.id)).map((entry) => entry.display_name) : [];
    const recipientName = profile?.full_name?.trim() || buildFullName2(profile?.first_name ?? "", profile?.last_name ?? "") || player.display_name;
    let isPendingMember = profile?.invite_status === "pending";
    let linkedUserId = player.user_id ?? profile?.id ?? null;
    try {
      if (!linkedUserId) {
        const { firstName, lastName } = splitDisplayName(player.display_name);
        const invited = await inviteUserByEmail2({
          email,
          firstName,
          lastName,
          redirectTo: inviteRedirect
        });
        linkedUserId = invited.userId;
        invitesSent += 1;
        isPendingMember = true;
      } else if (profile?.invite_status === "pending") {
        const { firstName, lastName } = splitDisplayName(recipientName);
        await generateInviteLink2({
          email,
          firstName,
          lastName,
          redirectTo: inviteRedirect
        });
        invitesSent += 1;
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
        tournamentName: tournament.name,
        tournamentDates,
        teamName: team?.team_name ?? null,
        teamSideLabel: null,
        rosterNames,
        tournamentUrl: isPendingMember ? inviteRedirect : tournamentUrl,
        isPendingMember
      });
      if (emailResult.sent) {
        emailed += 1;
        await adminFetch(`/rest/v1/tournament_players?id=eq.${player.id}`, {
          method: "PATCH",
          body: { invite_email_sent_at: now }
        });
      } else if (emailResult.error) {
        errors.push(`${email}: ${emailResult.error}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email failed";
      errors.push(`${email}: ${message}`);
    }
  }
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

// src/lib/tournament-score-sync.ts
async function assertUserCanWriteMatchGroup(userId, role, matchGroupId) {
  if (role === "manager" || role === "super_admin") {
    const groupRes2 = await adminFetch(`/rest/v1/tournament_match_groups?id=eq.${matchGroupId}&select=id,tournament_id,side_a_player_ids,side_b_player_ids`);
    if (!groupRes2.ok || !groupRes2.data[0]) {
      return { ok: false, error: "Match pairing not found" };
    }
    return { ok: true, matchGroup: groupRes2.data[0] };
  }
  const groupRes = await adminFetch(`/rest/v1/tournament_match_groups?id=eq.${matchGroupId}&select=id,tournament_id,side_a_player_ids,side_b_player_ids`);
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
      throw new Error(getErrorMessage2(res2.data));
    }
    return res2.data?.[0]?.id ?? existing.id;
  }
  const res = await adminFetch(`/rest/v1/tournament_scores`, {
    method: "POST",
    body: score,
    prefer: "return=representation"
  });
  if (!res.ok) {
    throw new Error(getErrorMessage2(res.data));
  }
  return res.data?.[0]?.id ?? null;
}
async function syncTournamentMatchScores(params) {
  const access = await assertUserCanWriteMatchGroup(params.userId, params.role, params.matchGroupId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }
  try {
    for (const score of params.scores) {
      await upsertTournamentScore({
        ...score,
        match_group_id: score.match_group_id ?? params.matchGroupId
      });
    }
    const clearRes = await adminFetch(`/rest/v1/tournament_match_hole_results?match_group_id=eq.${params.matchGroupId}&round_number=eq.${params.roundNumber}`, { method: "DELETE" });
    if (!clearRes.ok) {
      throw new Error(getErrorMessage2(clearRes.data));
    }
    if (params.holeResults.length > 0) {
      const insertRes = await adminFetch(`/rest/v1/tournament_match_hole_results`, {
        method: "POST",
        body: params.holeResults,
        prefer: "return=representation"
      });
      if (!insertRes.ok) {
        throw new Error(getErrorMessage2(insertRes.data));
      }
    }
    const patchRes = await adminFetch(`/rest/v1/tournament_match_groups?id=eq.${params.matchGroupId}`, {
      method: "PATCH",
      body: params.matchPoints,
      prefer: "return=minimal"
    });
    if (!patchRes.ok) {
      throw new Error(getErrorMessage2(patchRes.data));
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
      throw new Error(getErrorMessage2(scoresRes.data));
    }
    const holesRes = await adminFetch(`/rest/v1/tournament_match_hole_results?match_group_id=eq.${params.matchGroupId}&round_number=eq.${params.roundNumber}`, { method: "DELETE" });
    if (!holesRes.ok) {
      throw new Error(getErrorMessage2(holesRes.data));
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
      throw new Error(getErrorMessage2(patchRes.data));
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
  if (!body.roundNumber || !Array.isArray(body.scores) || !body.matchPoints) {
    return c.json({ error: "roundNumber, scores, and matchPoints are required" }, 400);
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
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/
];
function createApp() {
  const app = new Hono7;
  app.use("*", cors({
    origin: (origin) => origin && allowed.some((re) => re.test(origin)) ? origin : null,
    credentials: true
  }));
  app.use("*", logger());
  app.get("/health", (c) => c.json({ status: "ok" }));
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
