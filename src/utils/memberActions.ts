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
  const [profileRes, vehicleRes] = await Promise.all([
    supabase.from('profiles').select('id, username, full_name, role, created_at').eq('role', 'user'),
    supabase.from('vehicles').select('id, plate, driver_id')
  ]);

  if (profileRes.error) {
    const fallbackProfile = await supabase.from('profiles').select('id, username, full_name, role').eq('role', 'user');
    if (fallbackProfile.error) {
      return {
        members: [],
        error: fallbackProfile.error.message || 'Không tải được danh sách tài khoản thành viên.',
      };
    }
    const vehiclesList = vehicleRes.data || [];
    const driverToPlateMap = new Map<string, string>();
    for (const v of vehiclesList) {
      if (v.driver_id && v.plate) {
        driverToPlateMap.set(v.driver_id, v.plate);
      }
    }
    const members: MemberProfileRow[] = (fallbackProfile.data || []).map((p: any) => ({
      id: p.id,
      username: p.username,
      full_name: p.full_name,
      role: p.role,
      vehicle_plate: driverToPlateMap.get(p.id) || null,
      created_at: p.created_at,
    }));
    return { members, error: null };
  }

  const vehiclesList = vehicleRes.data || [];
  const driverToPlateMap = new Map<string, string>();
  for (const v of vehiclesList) {
    if (v.driver_id && v.plate) {
      driverToPlateMap.set(v.driver_id, v.plate);
    }
  }

  const members: MemberProfileRow[] = (profileRes.data || []).map((p: any) => ({
    id: p.id,
    username: p.username,
    full_name: p.full_name,
    role: p.role,
    vehicle_plate: driverToPlateMap.get(p.id) || null,
    created_at: p.created_at,
  }));

  return { members, error: null };
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

export async function invokeAdminUsers(payload: {
  action: 'create' | 'reset_password' | 'delete';
  username?: string;
  password?: string;
  full_name?: string;
  vehicle_id?: string;
  member_id?: string;
}): Promise<{ data: any; error: any }> {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      return { data: null, error: { message: json.error || 'Lỗi xử lý yêu cầu' } };
    }
    return { data: json, error: null };
  } catch (err) {
    return await supabase.functions.invoke('admin-users', { body: payload });
  }
}

