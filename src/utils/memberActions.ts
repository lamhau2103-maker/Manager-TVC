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
 * or fetch JSON response.
 */
export async function extractFunctionError(error: unknown, data?: unknown): Promise<string> {
  const errObj = error as {
    message?: string;
    context?: Response | { json?: () => Promise<{ error?: unknown; message?: unknown }>; text?: () => Promise<string> };
  } | null;

  if (errObj?.context && typeof errObj.context.json === 'function') {
    try {
      const ctxClone =
        typeof (errObj.context as Response).clone === 'function'
          ? (errObj.context as Response).clone()
          : errObj.context;
      const parsed = (await ctxClone.json?.()) as { error?: unknown; message?: unknown };
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
 * Fetches all member accounts (role = 'user') from Supabase `profiles`,
 * computing each member's assigned plate strictly from `vehicles.driver_id = profiles.id`.
 */
export async function fetchAllMemberProfiles(): Promise<{
  members: MemberProfileRow[];
  error: string | null;
}> {
  const [profileRes, vehicleRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, full_name, role, created_at')
      .eq('role', 'user')
      .order('created_at', { ascending: false }),
    supabase.from('vehicles').select('plate, driver_id'),
  ]);

  let profileRows: Array<{
    id: string;
    username: string;
    full_name: string | null;
    role: string;
    created_at?: string | null;
  }> | null = profileRes.data;
  if (profileRes.error) {
    const fallbackProfile = await supabase
      .from('profiles')
      .select('id, username, full_name, role')
      .eq('role', 'user');
    if (fallbackProfile.error) {
      return {
        members: [],
        error: fallbackProfile.error.message || 'Không tải được danh sách tài khoản thành viên.',
      };
    }
    profileRows = fallbackProfile.data;
  }

  const vehiclesList = vehicleRes.error ? [] : vehicleRes.data || [];
  const driverToPlateMap = new Map<string, string>();
  for (const v of vehiclesList) {
    if (v.driver_id && v.plate) {
      driverToPlateMap.set(v.driver_id, v.plate);
    }
  }

  const members: MemberProfileRow[] = (profileRows || []).map((p: {
    id: string;
    username: string;
    full_name: string | null;
    role: string;
    created_at?: string | null;
  }) => ({
    id: p.id,
    username: p.username,
    full_name: p.full_name,
    role: p.role,
    vehicle_plate: driverToPlateMap.get(p.id) || null,
    created_at: p.created_at ?? null,
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

function isEdgeFunctionUnavailableError(err: unknown): boolean {
  const msg = String((err as { message?: string } | null)?.message || '').toLowerCase();
  const status = (err as { context?: { status?: number } } | null)?.context?.status;
  return (
    status === 404 ||
    msg.includes('failed to send a request to the edge function') ||
    msg.includes('not_found')
  );
}

export async function invokeAdminUsers(payload: {
  action: 'create' | 'reset_password' | 'delete';
  username?: string;
  password?: string;
  full_name?: string;
  vehicle_plate?: string | null;
  member_id?: string;
}): Promise<{ data: unknown; error: unknown }> {
  // For deletion, unassign any vehicles linked via driver_id first so FK constraints never block deletion
  if (payload.action === 'delete' && payload.member_id) {
    await supabase
      .from('vehicles')
      .update({ driver_id: null })
      .eq('driver_id', payload.member_id);
  }

  // 1. Primary path: Supabase Edge Functions (`create-member` / `manage-member`)
  // Works identically in AI Studio Preview AND static Vercel deployments.
  if (payload.action === 'create') {
    const createRes = await supabase.functions.invoke('create-member', {
      body: {
        username: payload.username,
        password: payload.password,
        full_name: payload.full_name,
        vehicle_plate: payload.vehicle_plate ?? null,
      },
    });
    if (!createRes.error) {
      return createRes;
    }
    if (!isEdgeFunctionUnavailableError(createRes.error)) {
      return createRes;
    }
  } else {
    const manageBody =
      payload.action === 'reset_password'
        ? {
            action: 'reset_password',
            user_id: payload.member_id,
            member_id: payload.member_id,
            password: payload.password,
            new_password: payload.password,
          }
        : {
            action: 'delete',
            user_id: payload.member_id,
            member_id: payload.member_id,
          };

    const manageRes = await supabase.functions.invoke('manage-member', {
      body: manageBody,
    });
    if (!manageRes.error) {
      return manageRes;
    }
    if (!isEdgeFunctionUnavailableError(manageRes.error)) {
      return manageRes;
    }
  }

  // 2. Fallback to local Express endpoint `/api/admin/users` (if SUPABASE_SERVICE_ROLE_KEY is configured)
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
    const text = await res.text();
    const json = text ? (JSON.parse(text) as { error?: string }) : {};
    if (!res.ok || json.error) {
      return { data: null, error: { message: json.error || 'Không thể xử lý yêu cầu quản lý tài khoản.' } };
    }
    return { data: json, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : { message: 'Không thể kết nối máy chủ.' },
    };
  }
}
