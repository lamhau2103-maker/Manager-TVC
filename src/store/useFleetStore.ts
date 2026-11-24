import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppPage,
  AuditLogEntry,
  DEPARTMENTS,
  DashboardBlockId,
  MaintenanceItem,
  MaintenanceOrder,
  Vehicle,
  VehicleType,
} from '../types';
import { buildSeedDataset, REFERENCE_TODAY, SEED_VEHICLES } from '../data/seedData';
import { addDaysISO, formatVND, generateId } from '../utils/format';
import { formatVietnamesePlate, normalizePlateKey } from '../utils/plate';
import { ParsedImportRow } from '../utils/excel';
import { supabase } from '../lib/supabaseClient';

export const FLEET_STORAGE_KEY = 'fleet_maintenance_v1_db';
const STORAGE_KEY = FLEET_STORAGE_KEY;
const RECENT_PLATES_KEY = 'fleet_maintenance_v1_recent_plates';
const BUDGET_STORAGE_KEY = 'fleet_maintenance_v1_monthly_budget';
const ADMIN_VISIBILITY_KEY = 'fleet_maintenance_v1_admin_visibility';
const DEFAULT_MONTHLY_BUDGET = 320_000_000;

export function readStoredVehicles(): Vehicle[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FleetDatabaseState>;
      if (Array.isArray(parsed.vehicles)) {
        return parsed.vehicles;
      }
    }
  } catch {
    // Fallback to seed vehicles
  }
  return SEED_VEHICLES;
}

const DEFAULT_DASHBOARD_BLOCK_ORDER: DashboardBlockId[] = [
  'summary',
  'budget_heatmap',
  'monthly_status',
  'alerts',
  'charts',
  'orders_table',
];

interface AdminVisibilityConfig {
  isAdminMode: boolean;
  hiddenReportTabs: AppPage[];
  hiddenDashboardBlocks: DashboardBlockId[];
  dashboardBlockOrder: DashboardBlockId[];
}

interface FleetDatabaseState {
  vehicles: Vehicle[];
  orders: MaintenanceOrder[];
  items: MaintenanceItem[];
  auditLogs: AuditLogEntry[];
  lastUpdated: string;
}

interface SharedServerFleetState extends FleetDatabaseState {
  version: number;
  monthlyBudget: number;
  hiddenReportTabs: AppPage[];
  hiddenDashboardBlocks: DashboardBlockId[];
  dashboardBlockOrder: DashboardBlockId[];
}

interface UseFleetStoreOptions {
  actorName?: string;
  isAdmin?: boolean;
  onSyncError?: (message: string) => void;
}

function loadInitialState(): FleetDatabaseState {
  const seedRegMap = new Map(SEED_VEHICLES.map((v) => [v.plate_key, v.registration_due_date]));
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FleetDatabaseState;
      if (
        Array.isArray(parsed.vehicles) &&
        Array.isArray(parsed.orders) &&
        Array.isArray(parsed.items)
      ) {
        const migratedVehicles = parsed.vehicles.map((v) => ({
          ...v,
          registration_due_date:
            v.registration_due_date ||
            seedRegMap.get(v.plate_key) ||
            addDaysISO(REFERENCE_TODAY, 180),
        }));
        return {
          ...parsed,
          vehicles: migratedVehicles,
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        };
      }
    }
  } catch {
    // Fallback to seed data
  }
  const seed = buildSeedDataset();
  return {
    ...seed,
    lastUpdated: new Date().toISOString(),
  };
}

function loadRecentPlates(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_PLATES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, 5);
    }
  } catch {
    // ignore
  }
  return ['61C-123.45', '51D-678.90', '60H-012.34'];
}

function loadMonthlyBudget(): number {
  try {
    const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (raw) {
      const num = Number(raw);
      if (Number.isFinite(num) && num > 0) return num;
    }
  } catch {
    // ignore
  }
  return DEFAULT_MONTHLY_BUDGET;
}

function normalizeBlockOrder(order?: unknown): DashboardBlockId[] {
  const validSet = new Set<DashboardBlockId>(DEFAULT_DASHBOARD_BLOCK_ORDER);
  const result: DashboardBlockId[] = [];
  if (Array.isArray(order)) {
    for (const item of order) {
      if (validSet.has(item as DashboardBlockId) && !result.includes(item as DashboardBlockId)) {
        result.push(item as DashboardBlockId);
      }
    }
  }
  for (const id of DEFAULT_DASHBOARD_BLOCK_ORDER) {
    if (!result.includes(id)) result.push(id);
  }
  return result;
}

function loadAdminVisibility(): AdminVisibilityConfig {
  try {
    const raw = localStorage.getItem(ADMIN_VISIBILITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AdminVisibilityConfig>;
      return {
        isAdminMode: typeof parsed.isAdminMode === 'boolean' ? parsed.isAdminMode : true,
        hiddenReportTabs: Array.isArray(parsed.hiddenReportTabs) ? parsed.hiddenReportTabs : [],
        hiddenDashboardBlocks: Array.isArray(parsed.hiddenDashboardBlocks)
          ? parsed.hiddenDashboardBlocks
          : [],
        dashboardBlockOrder: normalizeBlockOrder(parsed.dashboardBlockOrder),
      };
    }
  } catch {
    // ignore
  }
  return {
    isAdminMode: true,
    hiddenReportTabs: [],
    hiddenDashboardBlocks: [],
    dashboardBlockOrder: [...DEFAULT_DASHBOARD_BLOCK_ORDER],
  };
}

async function getAccessToken(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

export function useFleetStore(options: UseFleetStoreOptions = {}) {
  const { actorName = 'Quản lý đội xe', isAdmin = false, onSyncError } = options;

  const [db, setDb] = useState<FleetDatabaseState>(() => loadInitialState());
  const [recentPlates, setRecentPlates] = useState<string[]>(() => loadRecentPlates());
  const [monthlyBudget, setMonthlyBudgetState] = useState<number>(() => loadMonthlyBudget());
  const [adminVisibility, setAdminVisibility] = useState<AdminVisibilityConfig>(() =>
    loadAdminVisibility()
  );
  const [isSyncing, setIsSyncing] = useState(false);

  const dbRef = useRef(db);
  dbRef.current = db;
  const monthlyBudgetRef = useRef(monthlyBudget);
  monthlyBudgetRef.current = monthlyBudget;
  const adminVisibilityRef = useRef(adminVisibility);
  adminVisibilityRef.current = adminVisibility;
  const onSyncErrorRef = useRef(onSyncError);
  onSyncErrorRef.current = onSyncError;

  const serverVersionRef = useRef(0);
  const pendingWritesRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cache to localStorage for fast startup & offline resilience
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // ignore quota errors
    }
  }, [db]);

  useEffect(() => {
    try {
      localStorage.setItem(RECENT_PLATES_KEY, JSON.stringify(recentPlates));
    } catch {
      // ignore
    }
  }, [recentPlates]);

  useEffect(() => {
    try {
      localStorage.setItem(BUDGET_STORAGE_KEY, String(monthlyBudget));
    } catch {
      // ignore
    }
  }, [monthlyBudget]);

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_VISIBILITY_KEY, JSON.stringify(adminVisibility));
    } catch {
      // ignore
    }
  }, [adminVisibility]);

  const applyServerState = useCallback(
    (incoming: SharedServerFleetState, force = false) => {
      if (!incoming || !Array.isArray(incoming.vehicles)) return;
      const incomingVersion = typeof incoming.version === 'number' ? incoming.version : 0;
      if (!force && incomingVersion > 0 && incomingVersion < serverVersionRef.current) {
        return;
      }
      if (!force && pendingWritesRef.current > 0 && incomingVersion <= serverVersionRef.current) {
        return;
      }

      if (incomingVersion > 0) {
        serverVersionRef.current = incomingVersion;
      }

      setDb({
        vehicles: incoming.vehicles,
        orders: Array.isArray(incoming.orders) ? incoming.orders : [],
        items: Array.isArray(incoming.items) ? incoming.items : [],
        auditLogs: Array.isArray(incoming.auditLogs) ? incoming.auditLogs : [],
        lastUpdated: incoming.lastUpdated || new Date().toISOString(),
      });

      if (typeof incoming.monthlyBudget === 'number' && incoming.monthlyBudget > 0) {
        setMonthlyBudgetState(incoming.monthlyBudget);
      }

      setAdminVisibility((prev) => ({
        isAdminMode: prev.isAdminMode,
        hiddenReportTabs: Array.isArray(incoming.hiddenReportTabs)
          ? incoming.hiddenReportTabs
          : prev.hiddenReportTabs,
        hiddenDashboardBlocks: Array.isArray(incoming.hiddenDashboardBlocks)
          ? incoming.hiddenDashboardBlocks
          : prev.hiddenDashboardBlocks,
        dashboardBlockOrder: normalizeBlockOrder(incoming.dashboardBlockOrder),
      }));
    },
    []
  );

  const syncFromServer = useCallback(
    async (opts?: { allowBootstrap?: boolean; force?: boolean; showSpinner?: boolean }) => {
      const token = await getAccessToken();
      if (!token) return;

      if (opts?.showSpinner) setIsSyncing(true);
      try {
        const res = await fetch('/api/fleet/state', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        });

        if (!res.ok) return;
        const data = (await res.json()) as {
          initialized?: boolean;
          state?: SharedServerFleetState | null;
        };

        if (!isMountedRef.current) return;

        if (!data.initialized && opts?.allowBootstrap) {
          const currentDb = dbRef.current;
          const currentVis = adminVisibilityRef.current;
          const bootRes = await fetch('/api/fleet/bootstrap', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              vehicles: currentDb.vehicles,
              orders: currentDb.orders,
              items: currentDb.items,
              auditLogs: currentDb.auditLogs,
              monthlyBudget: monthlyBudgetRef.current,
              hiddenReportTabs: currentVis.hiddenReportTabs,
              hiddenDashboardBlocks: currentVis.hiddenDashboardBlocks,
              dashboardBlockOrder: currentVis.dashboardBlockOrder,
            }),
          });
          if (bootRes.ok) {
            const bootData = (await bootRes.json()) as { state?: SharedServerFleetState | null };
            if (bootData.state && isMountedRef.current) {
              applyServerState(bootData.state, true);
            }
          }
          return;
        }

        if (data.state) {
          applyServerState(data.state, Boolean(opts?.force));
        }
      } catch {
        // Network issue; retain cached view until reconnect
      } finally {
        if (opts?.showSpinner && isMountedRef.current) {
          window.setTimeout(() => {
            if (isMountedRef.current) setIsSyncing(false);
          }, 260);
        }
      }
    },
    [applyServerState]
  );

  const sendMutation = useCallback(
    async (
      url: string,
      method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      body?: unknown
    ): Promise<void> => {
      const token = await getAccessToken();
      if (!token) {
        onSyncErrorRef.current?.('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        return;
      }

      pendingWritesRef.current += 1;
      try {
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          state?: SharedServerFleetState;
        };

        if (!res.ok) {
          if (payload.error) {
            onSyncErrorRef.current?.(payload.error);
          } else {
            onSyncErrorRef.current?.('Không thể đồng bộ thay đổi lên máy chủ.');
          }
          await syncFromServer({ force: true });
          return;
        }

        if (payload.state && isMountedRef.current) {
          applyServerState(payload.state, true);
        }
      } catch {
        onSyncErrorRef.current?.('Mất kết nối máy chủ — đang đồng bộ lại dữ liệu.');
        await syncFromServer({ force: true });
      } finally {
        pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
      }
    },
    [applyServerState, syncFromServer]
  );

  // Initial hydration + Real-time SSE cross-device stream + focus/visibility/periodic fallback sync
  useEffect(() => {
    let active = true;
    let eventSource: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let retryDelay = 1500;

    const closeStream = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connectStream = async () => {
      if (!active) return;
      closeStream();

      const token = await getAccessToken();
      if (!token || !active) return;

      try {
        const ticketRes = await fetch('/api/fleet/sse-ticket', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!ticketRes.ok || !active) {
          scheduleReconnect();
          return;
        }

        const { ticket } = (await ticketRes.json()) as { ticket?: string };
        if (!ticket || !active) {
          scheduleReconnect();
          return;
        }

        const es = new EventSource(`/api/fleet/stream?ticket=${encodeURIComponent(ticket)}`);
        eventSource = es;

        es.addEventListener('connected', (event) => {
          retryDelay = 1500;
          try {
            const meta = JSON.parse((event as MessageEvent).data) as { version?: number };
            if (typeof meta.version === 'number' && meta.version > serverVersionRef.current) {
              void syncFromServer({ force: false });
            }
          } catch {
            // ignore
          }
        });

        es.addEventListener('fleet-update', (event) => {
          try {
            const incoming = JSON.parse((event as MessageEvent).data) as SharedServerFleetState;
            applyServerState(incoming, false);
          } catch {
            // ignore malformed event
          }
        });

        es.onerror = () => {
          if (!active) return;
          closeStream();
          scheduleReconnect();
        };
      } catch {
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (!active) return;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(() => {
        retryDelay = Math.min(15_000, Math.round(retryDelay * 1.8));
        void connectStream();
      }, retryDelay);
    };

    void syncFromServer({ allowBootstrap: true, force: true }).then(() => {
      if (active) void connectStream();
    });

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void syncFromServer({ force: false });
        if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
          void connectStream();
        }
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const pollId = window.setInterval(() => {
      if (document.visibilityState === 'visible' && pendingWritesRef.current === 0) {
        void syncFromServer({ force: false });
      }
    }, 15_000);

    return () => {
      active = false;
      closeStream();
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.clearInterval(pollId);
    };
  }, [applyServerState, syncFromServer]);

  // Same-browser multi-tab fallback listener
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && pendingWritesRef.current === 0) {
        try {
          const next = JSON.parse(e.newValue) as FleetDatabaseState;
          setDb(next);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const persistVisibilityToServer = useCallback(
    (nextVis: AdminVisibilityConfig) => {
      if (!isAdmin) return;
      void sendMutation('/api/fleet/visibility', 'PUT', {
        hiddenReportTabs: nextVis.hiddenReportTabs,
        hiddenDashboardBlocks: nextVis.hiddenDashboardBlocks,
        dashboardBlockOrder: nextVis.dashboardBlockOrder,
      });
    },
    [isAdmin, sendMutation]
  );

  const toggleAdminMode = useCallback(() => {
    setAdminVisibility((prev) => ({ ...prev, isAdminMode: !prev.isAdminMode }));
  }, []);

  const toggleReportTabVisibility = useCallback(
    (tab: AppPage) => {
      if (!isAdmin || tab === 'dashboard') return;
      const prev = adminVisibilityRef.current;
      const exists = prev.hiddenReportTabs.includes(tab);
      const next: AdminVisibilityConfig = {
        ...prev,
        hiddenReportTabs: exists
          ? prev.hiddenReportTabs.filter((t) => t !== tab)
          : [...prev.hiddenReportTabs, tab],
      };
      setAdminVisibility(next);
      persistVisibilityToServer(next);
    },
    [isAdmin, persistVisibilityToServer]
  );

  const toggleDashboardBlockVisibility = useCallback(
    (block: DashboardBlockId) => {
      if (!isAdmin) return;
      const prev = adminVisibilityRef.current;
      const exists = prev.hiddenDashboardBlocks.includes(block);
      const next: AdminVisibilityConfig = {
        ...prev,
        hiddenDashboardBlocks: exists
          ? prev.hiddenDashboardBlocks.filter((b) => b !== block)
          : [...prev.hiddenDashboardBlocks, block],
      };
      setAdminVisibility(next);
      persistVisibilityToServer(next);
    },
    [isAdmin, persistVisibilityToServer]
  );

  const moveDashboardBlock = useCallback(
    (block: DashboardBlockId, direction: 'up' | 'down') => {
      if (!isAdmin) return;
      const prev = adminVisibilityRef.current;
      const nextOrder = [...prev.dashboardBlockOrder];
      const idx = nextOrder.indexOf(block);
      if (idx === -1) return;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= nextOrder.length) return;
      const [moved] = nextOrder.splice(idx, 1);
      nextOrder.splice(targetIdx, 0, moved);
      const next: AdminVisibilityConfig = { ...prev, dashboardBlockOrder: nextOrder };
      setAdminVisibility(next);
      persistVisibilityToServer(next);
    },
    [isAdmin, persistVisibilityToServer]
  );

  const reorderDashboardBlocks = useCallback(
    (sourceBlock: DashboardBlockId, targetBlock: DashboardBlockId) => {
      if (!isAdmin || sourceBlock === targetBlock) return;
      const prev = adminVisibilityRef.current;
      const nextOrder = [...prev.dashboardBlockOrder];
      const fromIdx = nextOrder.indexOf(sourceBlock);
      const toIdx = nextOrder.indexOf(targetBlock);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = nextOrder.splice(fromIdx, 1);
      nextOrder.splice(toIdx, 0, moved);
      const next: AdminVisibilityConfig = { ...prev, dashboardBlockOrder: nextOrder };
      setAdminVisibility(next);
      persistVisibilityToServer(next);
    },
    [isAdmin, persistVisibilityToServer]
  );

  const resetReportVisibility = useCallback(() => {
    if (!isAdmin) return;
    const prev = adminVisibilityRef.current;
    const next: AdminVisibilityConfig = {
      ...prev,
      hiddenReportTabs: [],
      hiddenDashboardBlocks: [],
      dashboardBlockOrder: [...DEFAULT_DASHBOARD_BLOCK_ORDER],
    };
    setAdminVisibility(next);
    persistVisibilityToServer(next);
  }, [isAdmin, persistVisibilityToServer]);

  const refreshData = useCallback(() => {
    void syncFromServer({ force: true, showSpinner: true });
  }, [syncFromServer]);

  const setMonthlyBudget = useCallback(
    (nextBudget: number, actor = actorName) => {
      if (!isAdmin) return;
      const clean = Math.max(1_000_000, Math.round(nextBudget));
      setMonthlyBudgetState(clean);
      const now = new Date().toISOString();
      setDb((prev) => ({
        ...prev,
        auditLogs: [
          {
            id: generateId('log'),
            timestamp: now,
            actor,
            action: 'UPDATE',
            entity: 'system',
            summary: `Cập nhật ngân sách bảo dưỡng tháng thành ${formatVND(clean)}`,
          },
          ...prev.auditLogs,
        ],
        lastUpdated: now,
      }));
      void sendMutation('/api/fleet/budget', 'PUT', { monthlyBudget: clean });
    },
    [actorName, isAdmin, sendMutation]
  );

  const pushRecentPlate = useCallback((plate: string) => {
    const formatted = formatVietnamesePlate(plate);
    if (!formatted) return;
    setRecentPlates((prev) => {
      const next = [
        formatted,
        ...prev.filter((p) => normalizePlateKey(p) !== normalizePlateKey(formatted)),
      ];
      return next.slice(0, 5);
    });
  }, []);

  const addVehicle = useCallback(
    (
      payload: Omit<Vehicle, 'id' | 'plate_key'>,
      actor = actorName
    ): { ok: true; vehicle: Vehicle } | { ok: false; error: string } => {
      if (!isAdmin) {
        return { ok: false, error: 'Chỉ Admin mới có quyền thêm xe mới.' };
      }
      const formattedPlate = formatVietnamesePlate(payload.plate);
      const plateKey = normalizePlateKey(formattedPlate);
      if (!plateKey) {
        return { ok: false, error: 'Biển số không được để trống.' };
      }
      const dup = dbRef.current.vehicles.find((v) => v.plate_key === plateKey);
      if (dup) {
        return { ok: false, error: `Biển số ${dup.plate} đã tồn tại trong hệ thống.` };
      }

      const newVehicle: Vehicle = {
        ...payload,
        id: generateId('veh'),
        plate: formattedPlate,
        plate_key: plateKey,
      };

      const log: AuditLogEntry = {
        id: generateId('log'),
        timestamp: new Date().toISOString(),
        actor,
        action: 'CREATE',
        entity: 'vehicle',
        summary: `Thêm xe mới ${newVehicle.plate} (${newVehicle.type})`,
        details: `${newVehicle.brand_model || 'Chưa rõ model'} · Tài xế: ${newVehicle.driver_name || '—'} · ${newVehicle.department}`,
      };

      setDb((prev) => ({
        ...prev,
        vehicles: [newVehicle, ...prev.vehicles],
        auditLogs: [log, ...prev.auditLogs],
        lastUpdated: new Date().toISOString(),
      }));

      void sendMutation('/api/fleet/vehicles', 'POST', { vehicle: newVehicle });
      return { ok: true, vehicle: newVehicle };
    },
    [actorName, isAdmin, sendMutation]
  );

  const bulkAddPlates = useCallback(
    (
      rawEntries: string[],
      defaultType: VehicleType = 'Xe tải',
      defaultDepartment: string = DEPARTMENTS[0],
      actor = actorName
    ): { added: Vehicle[]; skipped: string[] } => {
      if (!isAdmin) {
        return { added: [], skipped: rawEntries };
      }
      const existingKeys = new Set(dbRef.current.vehicles.map((v) => v.plate_key));
      const added: Vehicle[] = [];
      const skipped: string[] = [];

      for (const raw of rawEntries) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/[|\t]/).map((p) => p.trim());
        const formattedPlate = formatVietnamesePlate(parts[0] || '');
        const plateKey = normalizePlateKey(formattedPlate);
        if (!plateKey || plateKey.length < 4) {
          skipped.push(trimmed);
          continue;
        }
        if (existingKeys.has(plateKey)) {
          skipped.push(formattedPlate);
          continue;
        }
        existingKeys.add(plateKey);
        const typeCandidate = (parts[1] as VehicleType) || defaultType;
        const driverCandidate = parts[2] || 'Chưa phân công';
        const intervalKm = typeCandidate === 'Đầu kéo' ? 15000 : 10000;

        added.push({
          id: generateId('veh'),
          plate: formattedPlate,
          plate_key: plateKey,
          type: typeCandidate,
          brand_model: 'Đã nạp từ danh sách Admin',
          driver_name: driverCandidate,
          department: defaultDepartment,
          status: 'Đang hoạt động',
          registration_due_date: addDaysISO(REFERENCE_TODAY, 180),
          current_km: 0,
          service_interval_km: intervalKm,
          service_interval_days: 90,
          next_service_km: 0,
          next_service_date: '',
        });
      }

      if (added.length > 0) {
        const now = new Date().toISOString();
        const log: AuditLogEntry = {
          id: generateId('log'),
          timestamp: now,
          actor,
          action: 'CREATE',
          entity: 'vehicle',
          summary: `Admin nạp danh sách ${added.length} biển số xe mới`,
          details:
            added
              .map((v) => v.plate)
              .slice(0, 8)
              .join(', ') + (added.length > 8 ? '...' : ''),
        };

        setDb((prev) => ({
          ...prev,
          vehicles: [...added, ...prev.vehicles],
          auditLogs: [log, ...prev.auditLogs],
          lastUpdated: now,
        }));

        void sendMutation('/api/fleet/vehicles/bulk', 'POST', { vehicles: added });
      }

      return { added, skipped };
    },
    [actorName, isAdmin, sendMutation]
  );

  const updateVehicle = useCallback(
    (
      vehicleId: string,
      updates: Partial<Omit<Vehicle, 'id' | 'plate_key'>>,
      actor = actorName
    ): { ok: boolean; error?: string } => {
      if (!isAdmin) {
        return { ok: false, error: 'Chỉ Admin mới có quyền cập nhật thông tin xe.' };
      }
      const target = dbRef.current.vehicles.find((v) => v.id === vehicleId);
      if (!target) return { ok: false, error: 'Không tìm thấy xe.' };

      const nextPlate = updates.plate ? formatVietnamesePlate(updates.plate) : target.plate;
      const nextPlateKey = normalizePlateKey(nextPlate);

      if (
        nextPlateKey !== target.plate_key &&
        dbRef.current.vehicles.some((v) => v.id !== vehicleId && v.plate_key === nextPlateKey)
      ) {
        return { ok: false, error: `Biển số ${nextPlate} đã tồn tại.` };
      }

      const updated: Vehicle = {
        ...target,
        ...updates,
        plate: nextPlate,
        plate_key: nextPlateKey,
      };

      const log: AuditLogEntry = {
        id: generateId('log'),
        timestamp: new Date().toISOString(),
        actor,
        action: 'UPDATE',
        entity: 'vehicle',
        summary: `Cập nhật thông tin xe ${updated.plate}`,
        details: `Trạng thái: ${updated.status} · Km hiện tại: ${updated.current_km.toLocaleString('vi-VN')} km`,
      };

      setDb((prev) => ({
        ...prev,
        vehicles: prev.vehicles.map((v) => (v.id === vehicleId ? updated : v)),
        auditLogs: [log, ...prev.auditLogs],
        lastUpdated: new Date().toISOString(),
      }));

      void sendMutation(`/api/fleet/vehicles/${encodeURIComponent(vehicleId)}`, 'PATCH', {
        updates,
      });
      return { ok: true };
    },
    [actorName, isAdmin, sendMutation]
  );

  const saveOrder = useCallback(
    (
      orderPayload: Omit<MaintenanceOrder, 'id' | 'created_at' | 'updated_at'> & { id?: string },
      itemPayloads: Array<Omit<MaintenanceItem, 'id' | 'order_id'> & { id?: string }>,
      actor = actorName
    ) => {
      const isEdit = Boolean(orderPayload.id);
      if (isEdit && !isAdmin) {
        onSyncErrorRef.current?.('Bạn không có quyền chỉnh sửa phiếu bảo dưỡng.');
        return '';
      }

      const now = new Date().toISOString();
      const orderId = orderPayload.id || generateId('ord');

      const nextOrder: MaintenanceOrder = {
        id: orderId,
        vehicle_id: orderPayload.vehicle_id,
        service_date: orderPayload.service_date,
        odometer_km: orderPayload.odometer_km,
        service_interval_km: orderPayload.service_interval_km,
        garage: orderPayload.garage,
        driver_name: orderPayload.driver_name,
        service_type: orderPayload.service_type,
        note: orderPayload.note,
        created_at: isEdit
          ? dbRef.current.orders.find((o) => o.id === orderId)?.created_at || now
          : now,
        updated_at: now,
      };

      const nextItems: MaintenanceItem[] = itemPayloads.map((it) => ({
        id: it.id || generateId('it'),
        order_id: orderId,
        category: it.category,
        item_name: it.item_name.trim(),
        action: it.action,
        part_name: it.part_name.trim(),
        quantity: it.quantity,
        unit_price: it.unit_price,
        amount: it.amount,
        po_number: it.po_number.trim().toUpperCase(),
      }));

      const totalAmount = nextItems.reduce((s, it) => s + it.amount, 0);
      const vehicle = dbRef.current.vehicles.find((v) => v.id === nextOrder.vehicle_id);
      const poList = Array.from(new Set(nextItems.map((i) => i.po_number).filter(Boolean))).join(
        ', '
      );

      const log: AuditLogEntry = {
        id: generateId('log'),
        timestamp: now,
        actor,
        action: isEdit ? 'UPDATE' : 'CREATE',
        entity: 'order',
        summary: `${isEdit ? 'Cập nhật' : 'Thêm mới'} phiếu bảo dưỡng xe ${vehicle?.plate ?? ''} ngày ${nextOrder.service_date}`,
        details: `${nextItems.length} hạng mục · ${formatVND(totalAmount)}${poList ? ` · ${poList}` : ' · Chưa có PO'}`,
      };

      setDb((prev) => {
        const orders = isEdit
          ? prev.orders.map((o) => (o.id === orderId ? nextOrder : o))
          : [nextOrder, ...prev.orders];

        const otherItems = prev.items.filter((it) => it.order_id !== orderId);
        const items = [...nextItems, ...otherItems];

        const vehicles = prev.vehicles.map((v) => {
          if (v.id !== nextOrder.vehicle_id) return v;
          const updatedKm =
            nextOrder.odometer_km > v.current_km || v.current_km === 0
              ? nextOrder.odometer_km
              : v.current_km;
          const nextIntervalKm =
            nextOrder.service_interval_km && nextOrder.service_interval_km >= 1000
              ? nextOrder.service_interval_km
              : v.service_interval_km || 10000;
          const isPeriodic = nextOrder.service_type === 'Định kỳ';
          const shouldRecomputeDue =
            (isPeriodic || v.next_service_km <= 0) && nextOrder.odometer_km > 0;
          return {
            ...v,
            current_km: updatedKm,
            service_interval_km: nextIntervalKm,
            next_service_km: shouldRecomputeDue
              ? nextOrder.odometer_km + nextIntervalKm
              : v.next_service_km,
            next_service_date:
              isPeriodic || !v.next_service_date
                ? addDaysISO(nextOrder.service_date, v.service_interval_days || 90)
                : v.next_service_date,
          };
        });

        return {
          vehicles,
          orders,
          items,
          auditLogs: [log, ...prev.auditLogs],
          lastUpdated: now,
        };
      });

      if (isEdit) {
        void sendMutation(`/api/fleet/orders/${encodeURIComponent(orderId)}`, 'PUT', {
          order: nextOrder,
          items: nextItems,
        });
      } else {
        void sendMutation('/api/fleet/orders', 'POST', {
          order: nextOrder,
          items: nextItems,
        });
      }

      return orderId;
    },
    [actorName, isAdmin, sendMutation]
  );

  const appendItemsToExistingOrder = useCallback(
    (
      orderId: string,
      newItems: Array<Omit<MaintenanceItem, 'id' | 'order_id'>>,
      actor = actorName
    ) => {
      if (!isAdmin) return;
      const now = new Date().toISOString();
      const targetOrder = dbRef.current.orders.find((o) => o.id === orderId);
      if (!targetOrder) return;
      const veh = dbRef.current.vehicles.find((v) => v.id === targetOrder.vehicle_id);

      const created: MaintenanceItem[] = newItems.map((it) => ({
        ...it,
        id: generateId('it'),
        order_id: orderId,
        po_number: it.po_number.trim().toUpperCase(),
      }));

      const log: AuditLogEntry = {
        id: generateId('log'),
        timestamp: now,
        actor,
        action: 'UPDATE',
        entity: 'order',
        summary: `Gộp thêm ${created.length} hạng mục vào phiếu xe ${veh?.plate ?? ''} (${targetOrder.service_date})`,
        details: `Giá trị thêm: ${formatVND(created.reduce((s, x) => s + x.amount, 0))}`,
      };

      setDb((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? { ...o, updated_at: now } : o)),
        items: [...created, ...prev.items],
        auditLogs: [log, ...prev.auditLogs],
        lastUpdated: now,
      }));

      void sendMutation(`/api/fleet/orders/${encodeURIComponent(orderId)}/items`, 'POST', {
        items: created,
      });
    },
    [actorName, isAdmin, sendMutation]
  );

  const deleteOrder = useCallback(
    (orderId: string, actor = actorName) => {
      if (!isAdmin) return;
      const target = dbRef.current.orders.find((o) => o.id === orderId);
      if (!target) return;
      const veh = dbRef.current.vehicles.find((v) => v.id === target.vehicle_id);
      const removedItems = dbRef.current.items.filter((i) => i.order_id === orderId);
      const total = removedItems.reduce((s, i) => s + i.amount, 0);

      const log: AuditLogEntry = {
        id: generateId('log'),
        timestamp: new Date().toISOString(),
        actor,
        action: 'DELETE',
        entity: 'order',
        summary: `Xóa phiếu bảo dưỡng xe ${veh?.plate ?? ''} ngày ${target.service_date}`,
        details: `${removedItems.length} hạng mục · ${formatVND(total)}`,
      };

      setDb((prev) => ({
        ...prev,
        orders: prev.orders.filter((o) => o.id !== orderId),
        items: prev.items.filter((i) => i.order_id !== orderId),
        auditLogs: [log, ...prev.auditLogs],
        lastUpdated: new Date().toISOString(),
      }));

      void sendMutation(`/api/fleet/orders/${encodeURIComponent(orderId)}`, 'DELETE');
    },
    [actorName, isAdmin, sendMutation]
  );

  const assignPoToItem = useCallback(
    (itemId: string, poNumber: string, actor = actorName) => {
      if (!isAdmin) return;
      const cleanPo = poNumber.trim().toUpperCase();
      const target = dbRef.current.items.find((i) => i.id === itemId);
      if (!target) return;

      const log: AuditLogEntry = {
        id: generateId('log'),
        timestamp: new Date().toISOString(),
        actor,
        action: 'UPDATE',
        entity: 'item',
        summary: `Gán số PO "${cleanPo || 'Trống'}" cho hạng mục "${target.item_name}"`,
        details: `Thành tiền: ${formatVND(target.amount)}`,
      };

      setDb((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === itemId ? { ...i, po_number: cleanPo } : i)),
        auditLogs: [log, ...prev.auditLogs],
        lastUpdated: new Date().toISOString(),
      }));

      void sendMutation(`/api/fleet/items/${encodeURIComponent(itemId)}/po`, 'PATCH', {
        poNumber: cleanPo,
      });
    },
    [actorName, isAdmin, sendMutation]
  );

  const upsertImportRows = useCallback(
    (rows: ParsedImportRow[], actor = actorName) => {
      if (!isAdmin) return { inserted: 0, updated: 0, createdVehicles: 0 };
      const validRows = rows.filter((r) => r.status !== 'error');
      if (validRows.length === 0) return { inserted: 0, updated: 0, createdVehicles: 0 };

      const now = new Date().toISOString();
      let inserted = 0;
      let updated = 0;
      let createdVehicles = 0;

      setDb((prev) => {
        const vehicles = [...prev.vehicles];
        const orders = [...prev.orders];
        const items = [...prev.items];

        const vehByPlateKey = new Map(vehicles.map((v) => [v.plate_key, v]));

        for (const row of validRows) {
          let veh = vehByPlateKey.get(row.plate_key);
          if (!veh) {
            veh = {
              id: generateId('veh'),
              plate: row.plate,
              plate_key: row.plate_key,
              type: 'Xe bán tải',
              brand_model: 'Chưa cập nhật',
              driver_name: row.driver_name || 'Chưa phân công',
              department: 'Văn Phòng HCM',
              status: 'Đang hoạt động',
              registration_due_date: addDaysISO(REFERENCE_TODAY, 180),
              current_km: row.odometer_km || 0,
              service_interval_km: 10000,
              service_interval_days: 90,
              next_service_km: row.odometer_km ? row.odometer_km + 10000 : 0,
              next_service_date: addDaysISO(row.service_date || REFERENCE_TODAY, 90),
            };
            vehicles.push(veh);
            vehByPlateKey.set(veh.plate_key, veh);
            createdVehicles += 1;
          } else if (row.odometer_km > veh.current_km) {
            const idx = vehicles.findIndex((v) => v.id === veh!.id);
            if (idx >= 0) {
              vehicles[idx] = { ...vehicles[idx], current_km: row.odometer_km };
              veh = vehicles[idx];
              vehByPlateKey.set(veh.plate_key, veh);
            }
          }

          let order = orders.find(
            (o) => o.vehicle_id === veh!.id && o.service_date === row.service_date
          );
          if (!order) {
            order = {
              id: generateId('ord'),
              vehicle_id: veh.id,
              service_date: row.service_date,
              odometer_km: row.odometer_km,
              garage: row.garage,
              driver_name: row.driver_name || veh.driver_name,
              service_type: row.service_type,
              note: row.note,
              created_at: now,
              updated_at: now,
            };
            orders.push(order);
          } else {
            const oIdx = orders.findIndex((o) => o.id === order!.id);
            orders[oIdx] = {
              ...order,
              odometer_km: row.odometer_km || order.odometer_km,
              garage: row.garage || order.garage,
              note: row.note || order.note,
              updated_at: now,
            };
            order = orders[oIdx];
          }

          const existingIdx = items.findIndex(
            (it) =>
              it.order_id === order!.id &&
              it.item_name.trim().toLowerCase() === row.item_name.trim().toLowerCase() &&
              it.po_number.trim().toUpperCase() === row.po_number.trim().toUpperCase()
          );

          if (existingIdx >= 0) {
            items[existingIdx] = {
              ...items[existingIdx],
              category: row.category,
              action: row.action,
              part_name: row.part_name,
              quantity: row.quantity,
              unit_price: row.unit_price,
              amount: row.amount,
            };
            updated += 1;
          } else {
            items.push({
              id: generateId('it'),
              order_id: order.id,
              category: row.category,
              item_name: row.item_name,
              action: row.action,
              part_name: row.part_name,
              quantity: row.quantity,
              unit_price: row.unit_price,
              amount: row.amount,
              po_number: row.po_number,
            });
            inserted += 1;
          }
        }

        const log: AuditLogEntry = {
          id: generateId('log'),
          timestamp: now,
          actor,
          action: 'IMPORT',
          entity: 'system',
          summary: `Nhập Excel/CSV (UPSERT): thêm mới ${inserted}, cập nhật ${updated} hạng mục`,
          details:
            createdVehicles > 0
              ? `Tự động tạo thêm ${createdVehicles} xe mới chưa có trong danh mục`
              : 'Khớp hoàn toàn với danh sách xe hiện có',
        };

        return {
          vehicles,
          orders,
          items,
          auditLogs: [log, ...prev.auditLogs],
          lastUpdated: now,
        };
      });

      void sendMutation('/api/fleet/import', 'POST', { rows: validRows });
      return { inserted, updated, createdVehicles };
    },
    [actorName, isAdmin, sendMutation]
  );

  const resetDemoData = useCallback(() => {
    if (!isAdmin) return;
    const seed = buildSeedDataset();
    const now = new Date().toISOString();
    setDb({
      ...seed,
      auditLogs: [
        {
          id: generateId('log'),
          timestamp: now,
          actor: actorName,
          action: 'UPDATE',
          entity: 'system',
          summary: 'Khôi phục dữ liệu mẫu ban đầu (15 xe, 55 phiếu)',
        },
        ...seed.auditLogs,
      ],
      lastUpdated: now,
    });
    void sendMutation('/api/fleet/reset', 'POST', seed);
  }, [actorName, isAdmin, sendMutation]);

  return {
    vehicles: db.vehicles,
    orders: db.orders,
    items: db.items,
    auditLogs: db.auditLogs,
    lastUpdated: db.lastUpdated,
    isSyncing,
    recentPlates,
    monthlyBudget,
    setMonthlyBudget,
    isAdminMode: adminVisibility.isAdminMode,
    hiddenReportTabs: adminVisibility.hiddenReportTabs,
    hiddenDashboardBlocks: adminVisibility.hiddenDashboardBlocks,
    dashboardBlockOrder: adminVisibility.dashboardBlockOrder,
    toggleAdminMode,
    toggleReportTabVisibility,
    toggleDashboardBlockVisibility,
    moveDashboardBlock,
    reorderDashboardBlocks,
    resetReportVisibility,
    pushRecentPlate,
    refreshData,
    addVehicle,
    bulkAddPlates,
    updateVehicle,
    saveOrder,
    appendItemsToExistingOrder,
    deleteOrder,
    assignPoToItem,
    upsertImportRows,
    resetDemoData,
  };
}
