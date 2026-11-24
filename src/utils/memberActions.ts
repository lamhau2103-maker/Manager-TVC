import { supabase } from '../lib/supabaseClient';
import { normalizePlateKey } from './plate';

export interface MemberProfileRow {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  vehicle_plate: string | null;
  created_at?: string | null;
}

/**
 * Extracts the server error message from a failed supabase.functions.invoke call
 * using `await error.context.json()` and reading its `error` field.
 */
export async function extractFunctionError(error: unknown, data?: unknown): Promise<string> {
  const errObj = error as {
    message?: string;
    context?: { json?: () => Promise<{ error?: unknown; message?: unknown }> };
  } | null;

  if (errObj?.context && typeof errObj.context.json === 'function') {
    try {
      const parsed = await errObj.context.json();
      if (parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
        return parsed.error.trim();
      }
      if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message.trim();
      }
    } catch {
      // Response body is not valid JSON; fall back below
    }
  }

  if (data && typeof data === 'object' && 'error' in data) {
    const dErr = (data as { error?: unknown }).error;
    if (typeof dErr === 'string' && dErr.trim()) return dErr.trim();
  }

  if (errObj?.message && errObj.message.trim()) {
    return errObj.message.trim();
  }

  return 'Không thể thực hiện yêu cầu trên máy chủ, vui lòng thử lại.';
}

/**
 * Fetches all member accounts (role = 'user') from Supabase `profiles`.
 */
export async function fetchAllMemberProfiles(): Promise<{
  members: MemberProfileRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, role, vehicle_plate, created_at')
    .eq('role', 'user')
    .order('created_at', { ascending: false });

  if (!error && Array.isArray(data)) {
    return { members: data as MemberProfileRow[], error: null };
  }

  // Graceful fallback if `created_at` column is absent or unindexed for ordering
  const fallback = await supabase
    .from('profiles')
    .select('id, username, full_name, role, vehicle_plate')
    .eq('role', 'user');

  if (fallback.error) {
    return {
      members: [],
      error: fallback.error.message || 'Không tải được danh sách tài khoản thành viên.',
    };
  }

  return {
    members: (fallback.data ?? []) as MemberProfileRow[],
    error: null,
  };
}

/**
 * Filters a list of member profiles matching a given license plate (normalized comparison).
 */
export function filterMembersByPlate(
  members: MemberProfileRow[],
  plate: string
): MemberProfileRow[] {
  const targetKey = normalizePlateKey(plate);
  if (!targetKey) return [];
  return members.filter(
    (m) => m.vehicle_plate && normalizePlateKey(m.vehicle_plate) === targetKey
  );
}
