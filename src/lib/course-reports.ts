/**
 * Course Reports Service - Member-submitted course condition reports
 */

import type {
  CourseReport,
  CourseReportInsert,
  ReportStatus,
} from '@/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const isConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Generic Supabase request helper
 */
async function supabaseRequest<T>(
  table: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    query?: Record<string, string>;
    body?: Record<string, unknown>;
    single?: boolean;
  } = {}
): Promise<T | null> {
  if (!isConfigured()) return null;

  const { method = 'GET', query = {}, body, single = false } = options;

  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const headers: Record<string, string> = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  if (single) {
    headers['Accept'] = 'application/vnd.pgrst.object+json';
  }

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

// ============================================
// COURSE REPORTS
// ============================================

/**
 * Get all course reports (for admin dashboard)
 */
export async function getCourseReports(
  status?: ReportStatus,
  limit = 50
): Promise<CourseReport[]> {
  if (!isConfigured()) {
    return getMockReports();
  }

  const query: Record<string, string> = {
    order: 'created_at.desc',
    limit: String(limit),
  };

  if (status) {
    query.status = `eq.${status}`;
  }

  const data = await supabaseRequest<CourseReport[]>('course_reports', { query });

  if (!data || data.length === 0) {
    return getMockReports();
  }

  return data;
}

/**
 * Get pending reports count (for badge)
 */
export async function getPendingReportsCount(): Promise<number> {
  if (!isConfigured()) return 3;

  const data = await supabaseRequest<CourseReport[]>('course_reports', {
    query: {
      status: 'eq.pending',
      select: 'id',
    },
  });

  return data?.length ?? 0;
}

/**
 * Submit a new course report
 */
export async function submitCourseReport(
  report: CourseReportInsert
): Promise<CourseReport | null> {
  if (!isConfigured()) return null;

  const result = await supabaseRequest<CourseReport[]>('course_reports', {
    method: 'POST',
    body: {
      ...report,
      status: 'pending',
    },
  });

  return result?.[0] ?? null;
}

/**
 * Update report status (admin only)
 */
export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  adminNotes?: string
): Promise<boolean> {
  if (!isConfigured()) return false;

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (adminNotes !== undefined) {
    updates.admin_notes = adminNotes;
  }

  if (status === 'resolved') {
    updates.resolved_at = new Date().toISOString();
  }

  const result = await supabaseRequest('course_reports', {
    method: 'PATCH',
    query: { id: `eq.${reportId}` },
    body: updates,
  });

  return result !== null;
}

/**
 * Get user's submitted reports
 */
export async function getUserReports(userId: string): Promise<CourseReport[]> {
  if (!isConfigured()) return [];

  const data = await supabaseRequest<CourseReport[]>('course_reports', {
    query: {
      user_id: `eq.${userId}`,
      order: 'created_at.desc',
      limit: '20',
    },
  });

  return data ?? [];
}

/**
 * Mock reports for demo/offline
 */
function getMockReports(): CourseReport[] {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  return [
    {
      id: '1',
      user_id: '1',
      reporter_name: 'Mike Johnson',
      hole_number: 7,
      area: 'bunker',
      report_type: 'wet_bunker',
      description: 'Bunker on left side of fairway is holding water after rain',
      photo_url: null,
      latitude: 46.0654,
      longitude: -64.7241,
      status: 'pending',
      admin_notes: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      resolved_at: null,
    },
    {
      id: '2',
      user_id: '2',
      reporter_name: 'Sarah Williams',
      hole_number: 12,
      area: 'fairway',
      report_type: 'damaged_turf',
      description: 'Large divot damage near the 150 marker, needs repair',
      photo_url: null,
      latitude: 46.0731,
      longitude: -64.7361,
      status: 'in_progress',
      admin_notes: 'Grounds crew notified',
      created_at: yesterday.toISOString(),
      updated_at: yesterday.toISOString(),
      resolved_at: null,
    },
    {
      id: '3',
      user_id: '3',
      reporter_name: 'Tom Richards',
      hole_number: 4,
      area: 'cart_path',
      report_type: 'drainage_issue',
      description: 'Water pooling on cart path near tee box',
      photo_url: null,
      latitude: 46.0608,
      longitude: -64.7281,
      status: 'pending',
      admin_notes: null,
      created_at: twoDaysAgo.toISOString(),
      updated_at: twoDaysAgo.toISOString(),
      resolved_at: null,
    },
  ];
}

/**
 * Get report type label
 */
export function getReportTypeLabel(type: CourseReport['report_type']): string {
  switch (type) {
    case 'wet_bunker':
      return 'Wet Bunker';
    case 'damaged_turf':
      return 'Damaged Turf';
    case 'fallen_tree':
      return 'Fallen Tree';
    case 'drainage_issue':
      return 'Drainage Issue';
    case 'other':
    default:
      return 'Other';
  }
}

/**
 * Get area label
 */
export function getAreaLabel(area: CourseReport['area']): string {
  switch (area) {
    case 'fairway':
      return 'Fairway';
    case 'green':
      return 'Green';
    case 'bunker':
      return 'Bunker';
    case 'tee_box':
      return 'Tee Box';
    case 'rough':
      return 'Rough';
    case 'cart_path':
      return 'Cart Path';
    case 'other':
    default:
      return 'Other';
  }
}
