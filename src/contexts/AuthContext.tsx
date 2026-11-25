import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { Vehicle } from '../types';
import { FLEET_STORAGE_KEY, readStoredVehicles } from '../store/useFleetStore';
import { normalizePlateKey } from '../utils/plate';

export type UserRole = 'admin' | 'user';

export const ADMIN_DISPLAY_NAME = 'Quản Trị Viên / Điều Phối';

export interface UserProfile {
  username: string;
  full_name: string;
  role: UserRole;
  vehicle_plate: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  role: UserRole;
  isAdmin: boolean;
  /** Resolved driver full name for role = 'user' (empty string if admin or undetermined). */
  driverName: string;
  /** Shared sidebar display name ('Quản Trị Viên / Điều Phối' for admin, resolved driverName for user). */
  displayName: string;
  loading: boolean;
  fetchUserProfile: (user: User) => Promise<UserProfile>;
  applyAuthenticatedSession: (session: Session, profile: UserProfile) => void;
  syncVehiclesForAuth: (vehicles: Vehicle[]) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function cleanDriverText(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase() === 'chưa phân công') return '';
  return trimmed;
}

/**
 * Resolve driver full name for role = 'user' by priority:
 *  a) Vehicle in fleet dataset matching profile.vehicle_plate -> vehicle.driver_name
 *  b) profile.full_name
 *  c) profile.username
 */
export function resolveMemberDriverName(
  profile: UserProfile | null,
  vehicles: Vehicle[]
): string {
  if (!profile || profile.role === 'admin') return '';

  const plateKey = normalizePlateKey(profile.vehicle_plate ?? '');
  if (plateKey) {
    const matchedVehicle = vehicles.find(
      (v) => (v.plate_key || normalizePlateKey(v.plate)) === plateKey
    );
    const vehicleDriver = cleanDriverText(matchedVehicle?.driver_name);
    if (vehicleDriver) return vehicleDriver;
  }

  const profileFullName = cleanDriverText(profile.full_name);
  if (profileFullName) return profileFullName;

  const username = (profile.username ?? '').trim();
  if (username) return username;

  return '';
}

function buildFallbackProfile(user: User): UserProfile {
  const emailName = (user.email ?? '').split('@')[0]?.trim() || '';
  const metaName =
    typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : '';
  return {
    username: emailName,
    full_name: metaName,
    role: 'user',
    vehicle_plate: null,
  };
}

export async function loadProfileForUser(user: User): Promise<UserProfile> {
  try {
    const [profileRes, vehicleRes] = await Promise.all([
      supabase.from('profiles').select('username, full_name, role').eq('id', user.id).maybeSingle(),
      supabase.from('vehicles').select('plate').eq('driver_id', user.id).maybeSingle()
    ]);

    const data = profileRes.data;
    if (profileRes.error || !data) {
      return buildFallbackProfile(user);
    }

    const normalizedRole: UserRole =
      String(data.role ?? '').toLowerCase() === 'admin' ? 'admin' : 'user';
    const fallback = buildFallbackProfile(user);
    const assignedPlate = vehicleRes.data?.plate ? String(vehicleRes.data.plate).trim() : null;

    return {
      username:
        typeof data.username === 'string' && data.username.trim()
          ? data.username.trim()
          : fallback.username,
      full_name: typeof data.full_name === 'string' ? data.full_name.trim() : '',
      role: normalizedRole,
      vehicle_plate: assignedPlate,
    };
  } catch {
    return buildFallbackProfile(user);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [vehiclesSnapshot, setVehiclesSnapshot] = useState<Vehicle[]>(() => readStoredVehicles());

  // Track which user.id already has its profile fetched to avoid duplicate API calls
  const loadedUserIdRef = useRef<string | null>(null);

  const syncVehiclesForAuth = useCallback((nextVehicles: Vehicle[]) => {
    setVehiclesSnapshot(nextVehicles);
  }, []);

  // Keep vehicles snapshot synchronized across browser tabs (e.g. admin edits driver_name in another tab)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === FLEET_STORAGE_KEY) {
        setVehiclesSnapshot(readStoredVehicles());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const fetchUserProfile = useCallback(async (u: User): Promise<UserProfile> => {
    const loaded = await loadProfileForUser(u);
    loadedUserIdRef.current = u.id;
    setProfile(loaded);
    return loaded;
  }, []);

  const applyAuthenticatedSession = useCallback(
    (nextSession: Session, nextProfile: UserProfile) => {
      loadedUserIdRef.current = nextSession.user.id;
      setSession(nextSession);
      setProfile(nextProfile);
      setVehiclesSnapshot(readStoredVehicles());
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!active) return;

        if (initialSession?.user) {
          setSession(initialSession);
          const loaded = await loadProfileForUser(initialSession.user);
          if (active) {
            loadedUserIdRef.current = initialSession.user.id;
            setProfile(loaded);
            setVehiclesSnapshot(readStoredVehicles());
          }
        } else {
          loadedUserIdRef.current = null;
          setSession(null);
          setProfile(null);
        }
      } catch {
        if (active) {
          loadedUserIdRef.current = null;
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      if (event === 'SIGNED_OUT' || !nextSession?.user) {
        loadedUserIdRef.current = null;
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setSession(nextSession);

      // Fetch profile once per user session instead of duplicating on INITIAL_SESSION / SIGNED_IN
      if (loadedUserIdRef.current !== nextSession.user.id) {
        loadedUserIdRef.current = nextSession.user.id;
        loadProfileForUser(nextSession.user).then((loaded) => {
          if (active) {
            setProfile(loaded);
            setVehiclesSnapshot(readStoredVehicles());
          }
        });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      loadedUserIdRef.current = null;
      setSession(null);
      setProfile(null);
    }
  }, []);

  const role: UserRole = profile?.role === 'admin' ? 'admin' : 'user';
  const isAdmin = role === 'admin';

  const driverName = useMemo(
    () => resolveMemberDriverName(profile, vehiclesSnapshot),
    [profile, vehiclesSnapshot]
  );

  const displayName = useMemo(() => {
    if (isAdmin) return ADMIN_DISPLAY_NAME;
    return driverName || 'Thành viên';
  }, [isAdmin, driverName]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        role,
        isAdmin,
        driverName,
        displayName,
        loading,
        fetchUserProfile,
        applyAuthenticatedSession,
        syncVehiclesForAuth,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
