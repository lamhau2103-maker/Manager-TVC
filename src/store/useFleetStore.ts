import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppPage,
  AuditLogEntry,
  DEPARTMENTS,
  DashboardBlockId,
  MaintenanceAction,
  MaintenanceCategory,
  MaintenanceItem,
  MaintenanceOrder,
  ServiceType,
  Vehicle,
  VehicleStatus,
  VehicleType,
} from '../types';
import { addDaysISO, formatVND, REFERENCE_TODAY } from '../utils/format';
import { formatVietnamesePlate, isVehicleAssignedToUser, normalizePlateKey } from '../utils/plate';
import { ParsedImportRow } from '../utils/excel';
import { supabase } from '../lib/supabaseClient';

const LEGACY_LOCAL_DB_KEY = 'fleet_maintenance_v1_db';
const RECENT_PLATES_KEY = 'fleet_maintenance_v1_recent_plates';
const BUDGET_STORAGE_KEY = 'fleet_maintenance_v1_monthly_budget';
const ADMIN_VISIBILITY_KEY = 'fleet_maintenance_v1_admin_visibility';
const DEFAULT_MONTHLY_BUDGET = 320_000_000;
const META_MARKER = '\n[META:';

const DEFAULT_DASHBOARD_BLOCK_ORDER: DashboardBlockId[] = [
  'kpi_summary',
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

interface UseFleetStoreOptions {
  actorName?: string;
  isAdmin?: boolean;
  userId?: string | null;
  assignedVehiclePlate?: string | null;
  onSyncError?: (message: string) => void;
}

interface TicketItemMeta {
  category?: MaintenanceCategory;
  part_name?: string;
  quantity?: number;
  unit_price?: number;
  amount?: number;
}

interface TicketEncodedMeta {
  garage?: string;
  service_type?: ServiceType;
  driver_name?: string;
  service_interval_km?: number;
  items?: Record<string, TicketItemMeta>;
}

interface VehicleRow {
  plate: string;
  vehicle_type: string | null;
  brand_model: string | null;
  driver_id: string | null;
  department: string | null;
  status: string | null;
  registration_expiry: string | null;
  service_interval_km: number | null;
  note: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface TicketRow {
  id: string;
  plate: string;
  service_date: string;
  odometer_km: number | null;
  note: string | null;
  created_by: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface ItemRow {
  id: string;
  ticket_id: string;
  item_name: string;
  action: string | null;
  po_number: string | null;
  created_at?: string | null;
}

interface ActivityLogRow {
  id: string;
  user_id: string | null;
  action: string | null;
  detail: string | null;
  created_at?: string | null;
}

interface ProfileRow {
  id: string;
  username: string | null;
  full_name: string | null;
  role: string | null;
}

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isUuid(val: string | undefined): val is string {
  return Boolean(
    val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

function inferCategoryFromItemName(itemName: string): MaintenanceCategory {
  const s = itemName.toLowerCase();
  if (/lốp|vỏ xe|vá|mâm|van hơi|đảo lốp/.test(s)) return 'Lốp';
  if (/phanh|thắng|bố thắng|tăng bua|heo thắng/.test(s)) return 'Phanh';
  if (/nhớt|dầu cầu|dầu hộp số|lọc gió|lọc dầu|lọc nhiên liệu|lọc nhớt|nước làm mát/.test(s))
    return 'Dầu nhớt-lọc';
  if (/động cơ|turbo|kim phun|ly hợp|lá côn|bàn ép|két nước|curoa|bơm cao áp|egr|máy/.test(s))
    return 'Động cơ';
  if (/điện|ắc quy|bình|đèn|cảm biến|abs|củ đề|máy phát|ecu|rơ-le|gạt mưa/.test(s))
    return 'Hệ thống điện';
  if (/gầm|nhíp|phuộc|giảm xóc|thước lái|rô-tuyn|bạc đạn|moay-ơ|các-đăng|bầu hơi|tắc kê|mâm kéo/.test(s))
    return 'Gầm-treo';
  if (/điều hòa|máy lạnh|dàn lạnh|dàn nóng|lốc lạnh|gas|quạt gió/.test(s)) return 'Điều hòa';
  if (/thân vỏ|gò|sơn|kính|gương|cửa|cản|gioăng/.test(s)) return 'Thân vỏ';
  return 'Khác';
}

function encodeTicketNote(userNote: string, meta: TicketEncodedMeta): string {
  const cleanNote = (userNote || '').trim();
  const payload = JSON.stringify(meta);
  if (!cleanNote) return `[META:${payload}]`;
  return `${cleanNote}${META_MARKER}${payload}]`;
}

function decodeTicketNote(rawNote: string | null | undefined): {
  note: string;
  meta: TicketEncodedMeta;
} {
  const raw = rawNote ?? '';
  if (!raw) return { note: '', meta: {} };

  if (raw.startsWith('[META:') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw.slice(6, -1)) as TicketEncodedMeta;
      return { note: '', meta: parsed && typeof parsed === 'object' ? parsed : {} };
    } catch {
      return { note: raw, meta: {} };
    }
  }

  const idx = raw.lastIndexOf(META_MARKER);
  if (idx >= 0 && raw.endsWith(']')) {
    const jsonPart = raw.slice(idx + META_MARKER.length, -1);
    try {
      const parsed = JSON.parse(jsonPart) as TicketEncodedMeta;
      return {
        note: raw.slice(0, idx).trim(),
        meta: parsed && typeof parsed === 'object' ? parsed : {},
      };
    } catch {
      return { note: raw, meta: {} };
    }
  }

  return { note: raw, meta: {} };
}

function mapAuditAction(raw: string | null | undefined): AuditLogEntry['action'] {
  const upper = String(raw || '').toUpperCase();
  if (upper === 'CREATE' || upper === 'INSERT' || upper.includes('THÊM')) return 'CREATE';
  if (upper === 'DELETE' || upper.includes('XÓA')) return 'DELETE';
  if (upper === 'IMPORT' || upper.includes('EXCEL') || upper.includes('NHẬP')) return 'IMPORT';
  return 'UPDATE';
}

function loadRecentPlates(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_PLATES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((p): p is string => typeof p === 'string' && Boolean(p.trim()))
          .slice(0, 5);
      }
    }
  } catch {
    // ignore
  }
  return [];
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
  if (!result.includes('kpi_summary')) {
    result.unshift('kpi_summary');
  }
  for (const id of DEFAULT_DASHBOARD_BLOCK_ORDER) {
    if (!result.includes(id)) result.push(id);
  }
  return result;
}

function normalizeHiddenBlocks(blocks?: unknown): DashboardBlockId[] {
  const validSet = new Set<DashboardBlockId>(DEFAULT_DASHBOARD_BLOCK_ORDER);
  if (!Array.isArray(blocks)) return [];
  return blocks.filter((b): b is DashboardBlockId => validSet.has(b as DashboardBlockId));
}

function loadAdminVisibility(): AdminVisibilityConfig {
  try {
    const raw = localStorage.getItem(ADMIN_VISIBILITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AdminVisibilityConfig>;
      return {
        isAdminMode: typeof parsed.isAdminMode === 'boolean' ? parsed.isAdminMode : true,
        hiddenReportTabs: Array.isArray(parsed.hiddenReportTabs) ? parsed.hiddenReportTabs : [],
        hiddenDashboardBlocks: normalizeHiddenBlocks(parsed.hiddenDashboardBlocks),
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

export function useFleetStore(options: UseFleetStoreOptions = {}) {
  const {
    actorName = 'Admin',
    isAdmin = false,
    userId = null,
    assignedVehiclePlate = null,
    onSyncError,
  } = options;

  const [db, setDb] = useState<FleetDatabaseState>({
    vehicles: [],
    orders: [],
    items: [],
    auditLogs: [],
    lastUpdated: new Date().toISOString(),
  });
  const [recentPlates, setRecentPlates] = useState<string[]>(() => loadRecentPlates());
  const [monthlyBudget, setMonthlyBudgetState] = useState<number>(() => loadMonthlyBudget());
  const [adminVisibility, setAdminVisibility] = useState<AdminVisibilityConfig>(() =>
    loadAdminVisibility()
  );
  const [isSyncing, setIsSyncing] = useState(false);

  const dbRef = useRef(db);
  dbRef.current = db;
  const onSyncErrorRef = useRef(onSyncError);
  onSyncErrorRef.current = onSyncError;
  const pendingWritesRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    // Purge legacy localStorage fleet cache so Supabase is strictly the single source of truth
    try {
      localStorage.removeItem(LEGACY_LOCAL_DB_KEY);
    } catch {
      // ignore
    }
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  const recordActivityLog = useCallback(
    async (
      action: AuditLogEntry['action'],
      entity: AuditLogEntry['entity'],
      summary: string,
      details?: string
    ) => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id ?? null;
        const payload = JSON.stringify({ entity, summary, details });
        await supabase.from('activity_logs').insert({
          user_id: userId,
          action,
          detail: payload,
        });
      } catch {
        // Ignore if activity_logs insert fails silently
      }
    },
    []
  );

  const syncFromServer = useCallback(async (opts?: { force?: boolean; showSpinner?: boolean }) => {
    if (!opts?.force && pendingWritesRef.current > 0) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    if (opts?.showSpinner && isMountedRef.current) setIsSyncing(true);
    try {
      const [vehiclesRes, ticketsRes, itemsRes, logsRes, profilesRes] = await Promise.all([
        supabase
          .from('vehicles')
          .select(
            'plate, vehicle_type, brand_model, driver_id, department, status, registration_expiry, service_interval_km, note, created_at, updated_at'
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('maintenance_tickets')
          .select('id, plate, service_date, odometer_km, note, created_by, created_at, updated_at')
          .order('service_date', { ascending: false }),
        supabase
          .from('maintenance_items')
          .select('id, ticket_id, item_name, action, po_number, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('activity_logs')
          .select('id, user_id, action, detail, created_at')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('profiles').select('id, username, full_name, role'),
      ]);

      if (!isMountedRef.current) return;

      const profilesMap = new Map<string, ProfileRow>();
      for (const p of (profilesRes.data || []) as ProfileRow[]) {
        profilesMap.set(p.id, p);
      }

      const rawVehicles = (vehiclesRes.data || []) as VehicleRow[];
      const rawTickets = (ticketsRes.data || []) as TicketRow[];
      const rawItems = (itemsRes.data || []) as ItemRow[];
      const rawLogs = (logsRes.data || []) as ActivityLogRow[];

      const ticketMetaMap = new Map<string, TicketEncodedMeta>();
      const vehicleByPlateKey = new Map<string, VehicleRow>();
      for (const v of rawVehicles) {
        vehicleByPlateKey.set(normalizePlateKey(v.plate), v);
      }

      const orders: MaintenanceOrder[] = rawTickets.map((t) => {
        const { note, meta } = decodeTicketNote(t.note);
        ticketMetaMap.set(t.id, meta);

        const matchedVeh = vehicleByPlateKey.get(normalizePlateKey(t.plate));
        const driverProfile = matchedVeh?.driver_id
          ? profilesMap.get(matchedVeh.driver_id)
          : undefined;
        const resolvedDriver =
          meta.driver_name?.trim() ||
          driverProfile?.full_name?.trim() ||
          driverProfile?.username?.trim() ||
          'Chưa phân công';

        return {
          id: t.id,
          vehicle_id: matchedVeh?.plate || formatVietnamesePlate(t.plate) || t.plate,
          service_date: t.service_date,
          odometer_km: Number(t.odometer_km) || 0,
          service_interval_km: meta.service_interval_km,
          garage: meta.garage?.trim() || 'Chưa xác định',
          driver_name: resolvedDriver,
          service_type: meta.service_type || 'Định kỳ',
          note,
          created_at: t.created_at || new Date().toISOString(),
          updated_at: t.updated_at || t.created_at || new Date().toISOString(),
        };
      });

      const items: MaintenanceItem[] = rawItems.map((it) => {
        const ticketMeta = ticketMetaMap.get(it.ticket_id);
        const itemMeta = ticketMeta?.items?.[it.id];
        const qty = itemMeta?.quantity && itemMeta.quantity > 0 ? itemMeta.quantity : 1;
        const amount = Number(itemMeta?.amount) || 0;
        const unitPrice =
          Number(itemMeta?.unit_price) || (qty > 0 ? Math.round(amount / qty) : amount);
        const actionNormalized: MaintenanceAction =
          String(it.action || '').toUpperCase().includes('SỬA') ? 'SỬA CHỮA' : 'THAY THẾ';

        return {
          id: it.id,
          order_id: it.ticket_id,
          category: itemMeta?.category || inferCategoryFromItemName(it.item_name),
          item_name: it.item_name,
          action: actionNormalized,
          part_name: itemMeta?.part_name || '',
          quantity: qty,
          unit_price: unitPrice,
          amount,
          po_number: (it.po_number || '').trim().toUpperCase(),
        };
      });

      // Compute operational km/cycle stats per vehicle from real maintenance_tickets
      const ordersByPlateKey = new Map<string, MaintenanceOrder[]>();
      for (const o of orders) {
        const key = normalizePlateKey(o.vehicle_id);
        const list = ordersByPlateKey.get(key);
        if (list) list.push(o);
        else ordersByPlateKey.set(key, [o]);
      }

      const vehicles: Vehicle[] = rawVehicles.map((v) => {
        const formattedPlate = formatVietnamesePlate(v.plate) || v.plate;
        const plateKey = normalizePlateKey(formattedPlate);
        const vOrders = (ordersByPlateKey.get(plateKey) || []).sort((a, b) =>
          b.service_date.localeCompare(a.service_date)
        );
        const maxKm = vOrders.reduce((max, o) => Math.max(max, o.odometer_km || 0), 0);
        const latestPeriodic =
          vOrders.find((o) => o.service_type === 'Định kỳ' && o.odometer_km > 0) ||
          vOrders.find((o) => o.odometer_km > 0) ||
          vOrders[0];
        const intervalKm =
          Number(v.service_interval_km) ||
          latestPeriodic?.service_interval_km ||
          10000;
        const intervalDays = 90;

        const driverProfile = v.driver_id ? profilesMap.get(v.driver_id) : undefined;
        const driverName =
          driverProfile?.full_name?.trim() ||
          driverProfile?.username?.trim() ||
          'Chưa phân công';

        return {
          id: v.plate,
          plate: formattedPlate,
          plate_key: plateKey,
          type: v.vehicle_type || 'Xe 4 chỗ',
          brand_model: v.brand_model || 'Chưa cập nhật',
          driver_id: v.driver_id || null,
          driver_name: driverName,
          department: v.department || '',
          status: (v.status as VehicleStatus) || 'Đang hoạt động',
          registration_due_date: v.registration_expiry || '',
          current_km: maxKm,
          service_interval_km: intervalKm,
          service_interval_days: intervalDays,
          next_service_km:
            latestPeriodic && latestPeriodic.odometer_km > 0
              ? latestPeriodic.odometer_km + intervalKm
              : 0,
          next_service_date: latestPeriodic?.service_date
            ? addDaysISO(latestPeriodic.service_date, intervalDays)
            : '',
        };
      });

      const auditLogs: AuditLogEntry[] = rawLogs.map((l) => {
        const profile = l.user_id ? profilesMap.get(l.user_id) : undefined;
        const isProfileAdmin = String(profile?.role || '').toLowerCase() === 'admin';
        const resolvedActor = isProfileAdmin
          ? profile?.full_name?.trim() || 'Admin'
          : profile?.full_name?.trim() || profile?.username?.trim() || 'Thành viên';

        let entity: AuditLogEntry['entity'] = 'system';
        let summary = l.detail || l.action || '';
        let details: string | undefined;

        if (l.detail && l.detail.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(l.detail) as {
              entity?: AuditLogEntry['entity'];
              summary?: string;
              details?: string;
            };
            if (parsed.entity) entity = parsed.entity;
            if (parsed.summary) summary = parsed.summary;
            if (parsed.details) details = parsed.details;
          } catch {
            // keep raw detail string
          }
        }

        return {
          id: l.id,
          timestamp: l.created_at || new Date().toISOString(),
          actor: resolvedActor,
          action: mapAuditAction(l.action),
          entity,
          summary,
          details,
        };
      });

      if (isMountedRef.current) {
        setDb({
          vehicles,
          orders,
          items,
          auditLogs,
          lastUpdated: new Date().toISOString(),
        });
      }
    } catch {
      onSyncErrorRef.current?.('Không thể tải dữ liệu từ Supabase.');
    } finally {
      if (opts?.showSpinner && isMountedRef.current) {
        window.setTimeout(() => {
          if (isMountedRef.current) setIsSyncing(false);
        }, 220);
      }
    }
  }, []);

  // Initial fetch + Supabase Realtime postgres_changes subscription across all relational tables
  useEffect(() => {
    let active = true;
    let refreshTimer: number | null = null;

    const scheduleSync = () => {
      if (!active) return;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        if (active) void syncFromServer({ force: false });
      }, 150);
    };

    void syncFromServer({ force: true });

    const channel = supabase
      .channel('fleet-relational-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, scheduleSync)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_tickets' },
        scheduleSync
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_items' },
        scheduleSync
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_logs' },
        scheduleSync
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleSync)
      .subscribe();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void syncFromServer({ force: false });
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const pollId = window.setInterval(() => {
      if (document.visibilityState === 'visible' && pendingWritesRef.current === 0) {
        void syncFromServer({ force: false });
      }
    }, 20_000);

    return () => {
      active = false;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.clearInterval(pollId);
      void supabase.removeChannel(channel);
    };
  }, [syncFromServer]);

  const toggleAdminMode = useCallback(() => {
    setAdminVisibility((prev) => ({ ...prev, isAdminMode: !prev.isAdminMode }));
  }, []);

  const toggleReportTabVisibility = useCallback(
    (tab: AppPage) => {
      if (!isAdmin || tab === 'dashboard') return;
      setAdminVisibility((prev) => {
        const exists = prev.hiddenReportTabs.includes(tab);
        return {
          ...prev,
          hiddenReportTabs: exists
            ? prev.hiddenReportTabs.filter((t) => t !== tab)
            : [...prev.hiddenReportTabs, tab],
        };
      });
    },
    [isAdmin]
  );

  const toggleDashboardBlockVisibility = useCallback(
    (block: DashboardBlockId) => {
      if (!isAdmin) return;
      setAdminVisibility((prev) => {
        const exists = prev.hiddenDashboardBlocks.includes(block);
        return {
          ...prev,
          hiddenDashboardBlocks: exists
            ? prev.hiddenDashboardBlocks.filter((b) => b !== block)
            : [...prev.hiddenDashboardBlocks, block],
        };
      });
    },
    [isAdmin]
  );

  const moveDashboardBlock = useCallback(
    (block: DashboardBlockId, direction: 'up' | 'down') => {
      if (!isAdmin) return;
      setAdminVisibility((prev) => {
        const nextOrder = [...prev.dashboardBlockOrder];
        const idx = nextOrder.indexOf(block);
        if (idx === -1) return prev;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= nextOrder.length) return prev;
        const [moved] = nextOrder.splice(idx, 1);
        nextOrder.splice(targetIdx, 0, moved);
        return { ...prev, dashboardBlockOrder: nextOrder };
      });
    },
    [isAdmin]
  );

  const reorderDashboardBlocks = useCallback(
    (sourceBlock: DashboardBlockId, targetBlock: DashboardBlockId) => {
      if (!isAdmin || sourceBlock === targetBlock) return;
      setAdminVisibility((prev) => {
        const nextOrder = [...prev.dashboardBlockOrder];
        const fromIdx = nextOrder.indexOf(sourceBlock);
        const toIdx = nextOrder.indexOf(targetBlock);
        if (fromIdx === -1 || toIdx === -1) return prev;
        const [moved] = nextOrder.splice(fromIdx, 1);
        nextOrder.splice(toIdx, 0, moved);
        return { ...prev, dashboardBlockOrder: nextOrder };
      });
    },
    [isAdmin]
  );

  const resetReportVisibility = useCallback(() => {
    if (!isAdmin) return;
    setAdminVisibility((prev) => ({
      ...prev,
      hiddenReportTabs: [],
      hiddenDashboardBlocks: [],
      dashboardBlockOrder: [...DEFAULT_DASHBOARD_BLOCK_ORDER],
    }));
  }, [isAdmin]);

  const refreshData = useCallback(() => {
    void syncFromServer({ force: true, showSpinner: true });
  }, [syncFromServer]);

  const setMonthlyBudget = useCallback(
    (nextBudget: number) => {
      if (!isAdmin) return;
      const clean = Math.max(1_000_000, Math.round(nextBudget));
      setMonthlyBudgetState(clean);
      void recordActivityLog(
        'UPDATE',
        'system',
        `Cập nhật ngân sách bảo dưỡng tháng thành ${formatVND(clean)}`
      );
    },
    [isAdmin, recordActivityLog]
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
      _actor = actorName
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
        id: formattedPlate,
        plate: formattedPlate,
        plate_key: plateKey,
        driver_id: payload.driver_id || null,
        driver_name: payload.driver_name || 'Chưa phân công',
      };

      setDb((prev) => ({
        ...prev,
        vehicles: [
          newVehicle,
          ...prev.vehicles.map((v) =>
            newVehicle.driver_id && v.driver_id === newVehicle.driver_id
              ? { ...v, driver_id: null, driver_name: 'Chưa phân công' }
              : v
          ),
        ],
        lastUpdated: new Date().toISOString(),
      }));

      void (async () => {
        pendingWritesRef.current += 1;
        try {
          if (newVehicle.driver_id) {
            await supabase
              .from('vehicles')
              .update({ driver_id: null })
              .eq('driver_id', newVehicle.driver_id);
          }

          const { error } = await supabase.from('vehicles').insert({
            plate: newVehicle.plate,
            vehicle_type: newVehicle.type,
            brand_model: newVehicle.brand_model || 'Chưa cập nhật',
            driver_id: newVehicle.driver_id || null,
            department: newVehicle.department,
            status: newVehicle.status || 'Đang hoạt động',
            registration_expiry: newVehicle.registration_due_date || null,
            service_interval_km: newVehicle.service_interval_km || 10000,
          });

          if (error) {
            onSyncErrorRef.current?.(error.message || 'Không thể lưu xe mới lên Supabase.');
          } else {
            await recordActivityLog(
              'CREATE',
              'vehicle',
              `Thêm xe mới ${newVehicle.plate} (${newVehicle.type})`,
              `${newVehicle.brand_model || 'Chưa rõ model'} · Tài xế: ${newVehicle.driver_name || 'Chưa phân công'} · ${newVehicle.department}`
            );
          }
        } finally {
          pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
          await syncFromServer({ force: true });
        }
      })();

      return { ok: true, vehicle: newVehicle };
    },
    [actorName, isAdmin, recordActivityLog, syncFromServer]
  );

  const bulkAddPlates = useCallback(
    (
      rawEntries: string[],
      defaultType: VehicleType = 'Xe 4 chỗ',
      defaultDepartment: string = DEPARTMENTS[0] || 'Văn Phòng HCM',
      _actor = actorName
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
        const intervalKm = 10000;

        added.push({
          id: formattedPlate,
          plate: formattedPlate,
          plate_key: plateKey,
          type: typeCandidate,
          brand_model: 'Chưa cập nhật',
          driver_id: null,
          driver_name: 'Chưa phân công',
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
        setDb((prev) => ({
          ...prev,
          vehicles: [...added, ...prev.vehicles],
          lastUpdated: new Date().toISOString(),
        }));

        void (async () => {
          pendingWritesRef.current += 1;
          try {
            const { error } = await supabase.from('vehicles').insert(
              added.map((v) => ({
                plate: v.plate,
                vehicle_type: v.type,
                brand_model: v.brand_model,
                driver_id: null,
                department: v.department,
                status: v.status,
                registration_expiry: v.registration_due_date || null,
                service_interval_km: v.service_interval_km,
              }))
            );
            if (error) {
              onSyncErrorRef.current?.(error.message || 'Không thể nạp danh sách xe lên Supabase.');
            } else {
              await recordActivityLog(
                'CREATE',
                'vehicle',
                `Admin nạp danh sách ${added.length} biển số xe mới`,
                added
                  .map((v) => v.plate)
                  .slice(0, 8)
                  .join(', ') + (added.length > 8 ? '...' : '')
              );
            }
          } finally {
            pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
            await syncFromServer({ force: true });
          }
        })();
      }

      return { added, skipped };
    },
    [actorName, isAdmin, recordActivityLog, syncFromServer]
  );

  const updateVehicle = useCallback(
    (
      vehicleId: string,
      updates: Partial<Omit<Vehicle, 'id' | 'plate_key'>>,
      _actor = actorName
    ): { ok: boolean; error?: string } => {
      if (!isAdmin) {
        return { ok: false, error: 'Chỉ Admin mới có quyền cập nhật thông tin xe.' };
      }
      const target = dbRef.current.vehicles.find(
        (v) => v.id === vehicleId || v.plate === vehicleId
      );
      if (!target) return { ok: false, error: 'Không tìm thấy xe.' };

      const nextPlate = updates.plate ? formatVietnamesePlate(updates.plate) : target.plate;
      const nextPlateKey = normalizePlateKey(nextPlate);

      if (
        nextPlateKey !== target.plate_key &&
        dbRef.current.vehicles.some((v) => v.id !== target.id && v.plate_key === nextPlateKey)
      ) {
        return { ok: false, error: `Biển số ${nextPlate} đã tồn tại.` };
      }

      const updated: Vehicle = {
        ...target,
        ...updates,
        id: nextPlate,
        plate: nextPlate,
        plate_key: nextPlateKey,
      };

      setDb((prev) => ({
        ...prev,
        vehicles: prev.vehicles.map((v) => {
          if (v.id === target.id) return updated;
          if (updated.driver_id && v.driver_id === updated.driver_id) {
            return { ...v, driver_id: null, driver_name: 'Chưa phân công' };
          }
          return v;
        }),
        lastUpdated: new Date().toISOString(),
      }));

      void (async () => {
        pendingWritesRef.current += 1;
        try {
          if (updates.driver_id) {
            await supabase
              .from('vehicles')
              .update({ driver_id: null })
              .eq('driver_id', updates.driver_id)
              .neq('plate', target.plate);
          }

          const patch: Record<string, unknown> = {};
          if (updates.plate !== undefined) patch.plate = nextPlate;
          if (updates.type !== undefined) patch.vehicle_type = updates.type;
          if (updates.brand_model !== undefined) patch.brand_model = updates.brand_model;
          if (updates.driver_id !== undefined) patch.driver_id = updates.driver_id;
          if (updates.department !== undefined) patch.department = updates.department;
          if (updates.status !== undefined) patch.status = updates.status;
          if (updates.registration_due_date !== undefined) {
            patch.registration_expiry = updates.registration_due_date || null;
          }
          if (updates.service_interval_km !== undefined) {
            patch.service_interval_km = updates.service_interval_km;
          }

          if (Object.keys(patch).length > 0) {
            const { error } = await supabase
              .from('vehicles')
              .update(patch)
              .eq('plate', target.plate);

            if (error) {
              onSyncErrorRef.current?.(error.message || 'Không thể cập nhật thông tin xe.');
            } else {
              await recordActivityLog(
                'UPDATE',
                'vehicle',
                `Cập nhật thông tin xe ${updated.plate}`,
                `Trạng thái: ${updated.status} · Tài xế: ${updated.driver_name}`
              );
            }
          }
        } finally {
          pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
          await syncFromServer({ force: true });
        }
      })();

      return { ok: true };
    },
    [actorName, isAdmin, recordActivityLog, syncFromServer]
  );

  const deleteVehicle = useCallback(
    async (vehicleId: string): Promise<{ ok: boolean; error?: string }> => {
      if (!isAdmin) {
        return { ok: false, error: 'Chỉ Admin mới có quyền xóa xe.' };
      }
      const target = dbRef.current.vehicles.find(
        (v) => v.id === vehicleId || v.plate === vehicleId
      );
      if (!target) {
        return { ok: false, error: 'Không tìm thấy xe cần xóa.' };
      }

      pendingWritesRef.current += 1;
      try {
        // Delete child items and tickets first so FK constraints never reject vehicle deletion
        const { data: relatedTickets } = await supabase
          .from('maintenance_tickets')
          .select('id')
          .eq('plate', target.plate);

        const ticketIds = (relatedTickets || []).map((t: { id: string }) => t.id);
        if (ticketIds.length > 0) {
          await supabase.from('maintenance_items').delete().in('ticket_id', ticketIds);
          await supabase.from('maintenance_tickets').delete().in('id', ticketIds);
        }

        const { error } = await supabase.from('vehicles').delete().eq('plate', target.plate);
        if (error) {
          onSyncErrorRef.current?.(error.message || 'Không thể xóa xe khỏi Supabase.');
          return { ok: false, error: error.message };
        }

        await recordActivityLog(
          'DELETE',
          'vehicle',
          `Xóa xe ${target.plate} khỏi đội xe`,
          `${target.type} · ${target.department}`
        );

        await syncFromServer({ force: true });
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Lỗi xóa xe.';
        return { ok: false, error: msg };
      } finally {
        pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
      }
    },
    [isAdmin, recordActivityLog, syncFromServer]
  );

  const saveOrder = useCallback(
    (
      orderPayload: Omit<MaintenanceOrder, 'id' | 'created_at' | 'updated_at'> & { id?: string },
      itemPayloads: Array<Omit<MaintenanceItem, 'id' | 'order_id'> & { id?: string }>,
      _actor = actorName
    ) => {
      const isEdit = Boolean(orderPayload.id);
      if (isEdit && !isAdmin) {
        onSyncErrorRef.current?.('Bạn không có quyền chỉnh sửa phiếu bảo dưỡng.');
        return '';
      }
      if (!isEdit && isAdmin) {
        onSyncErrorRef.current?.('Admin không có quyền thêm/lập phiếu bảo dưỡng mới.');
        return '';
      }

      const now = new Date().toISOString();
      const orderId = isEdit && isUuid(orderPayload.id) ? orderPayload.id! : createUuid();
      const vehicle = dbRef.current.vehicles.find(
        (v) => v.id === orderPayload.vehicle_id || v.plate === orderPayload.vehicle_id
      );
      if (!isEdit && !isAdmin) {
        if (!vehicle || !isVehicleAssignedToUser(vehicle, userId, assignedVehiclePlate)) {
          onSyncErrorRef.current?.(
            'Bạn chỉ được phép thêm/lập phiếu cho biển số xe đang phụ trách.'
          );
          return '';
        }
      }
      const targetPlate = vehicle?.plate || orderPayload.vehicle_id;

      const nextItems: MaintenanceItem[] = itemPayloads.map((it) => ({
        id: isUuid(it.id) ? it.id! : createUuid(),
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

      const nextOrder: MaintenanceOrder = {
        id: orderId,
        vehicle_id: targetPlate,
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

      const totalAmount = nextItems.reduce((s, it) => s + it.amount, 0);
      const poList = Array.from(new Set(nextItems.map((i) => i.po_number).filter(Boolean))).join(
        ', '
      );

      const itemsMeta: Record<string, TicketItemMeta> = {};
      for (const it of nextItems) {
        itemsMeta[it.id] = {
          category: it.category,
          part_name: it.part_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          amount: it.amount,
        };
      }

      const encodedNote = encodeTicketNote(nextOrder.note, {
        garage: nextOrder.garage,
        service_type: nextOrder.service_type,
        driver_name: nextOrder.driver_name,
        service_interval_km: nextOrder.service_interval_km,
        items: itemsMeta,
      });

      setDb((prev) => {
        const orders = isEdit
          ? prev.orders.map((o) => (o.id === orderId ? nextOrder : o))
          : [nextOrder, ...prev.orders];
        const otherItems = prev.items.filter((it) => it.order_id !== orderId);
        return {
          ...prev,
          orders,
          items: [...nextItems, ...otherItems],
          lastUpdated: now,
        };
      });

      void (async () => {
        pendingWritesRef.current += 1;
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const sessionUserId = session?.user?.id ?? null;

          if (!isEdit && !isAdmin) {
            if (
              !sessionUserId ||
              !vehicle ||
              !isVehicleAssignedToUser(vehicle, sessionUserId, assignedVehiclePlate)
            ) {
              onSyncErrorRef.current?.(
                'Bạn chỉ được phép thêm/lập phiếu cho biển số xe đang phụ trách.'
              );
              return;
            }
          }

          if (isEdit) {
            const { error: ticketErr } = await supabase
              .from('maintenance_tickets')
              .update({
                plate: targetPlate,
                service_date: nextOrder.service_date,
                odometer_km: nextOrder.odometer_km,
                note: encodedNote,
                updated_at: now,
              })
              .eq('id', orderId);

            if (ticketErr) {
              onSyncErrorRef.current?.(
                ticketErr.message || 'Không thể cập nhật phiếu bảo dưỡng.'
              );
              return;
            }
            await supabase.from('maintenance_items').delete().eq('ticket_id', orderId);
          } else {
            const { error: ticketErr } = await supabase.from('maintenance_tickets').insert({
              id: orderId,
              plate: targetPlate,
              service_date: nextOrder.service_date,
              odometer_km: nextOrder.odometer_km,
              note: encodedNote,
              created_by: sessionUserId,
            });

            if (ticketErr) {
              onSyncErrorRef.current?.(ticketErr.message || 'Không thể lưu phiếu bảo dưỡng mới.');
              return;
            }
          }

          if (nextItems.length > 0) {
            const { error: itemsErr } = await supabase.from('maintenance_items').insert(
              nextItems.map((it) => ({
                id: it.id,
                ticket_id: orderId,
                item_name: it.item_name,
                action: it.action,
                po_number: it.po_number,
              }))
            );
            if (itemsErr) {
              onSyncErrorRef.current?.(itemsErr.message || 'Không thể lưu hạng mục bảo dưỡng.');
            }
          }

          if (
            nextOrder.service_interval_km &&
            nextOrder.service_interval_km >= 1000 &&
            vehicle &&
            nextOrder.service_interval_km !== vehicle.service_interval_km
          ) {
            await supabase
              .from('vehicles')
              .update({ service_interval_km: nextOrder.service_interval_km })
              .eq('plate', targetPlate);
          }

          await recordActivityLog(
            isEdit ? 'UPDATE' : 'CREATE',
            'order',
            `${isEdit ? 'Cập nhật' : 'Thêm mới'} phiếu bảo dưỡng xe ${targetPlate} ngày ${nextOrder.service_date}`,
            `${nextItems.length} hạng mục · ${formatVND(totalAmount)}${poList ? ` · ${poList}` : ' · Chưa có PO'}`
          );
        } finally {
          pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
          await syncFromServer({ force: true });
        }
      })();

      return orderId;
    },
    [actorName, assignedVehiclePlate, isAdmin, recordActivityLog, syncFromServer, userId]
  );

  const appendItemsToExistingOrder = useCallback(
    (
      orderId: string,
      newItems: Array<Omit<MaintenanceItem, 'id' | 'order_id'>>,
      _actor = actorName
    ) => {
      if (!isAdmin) return;
      const now = new Date().toISOString();
      const targetOrder = dbRef.current.orders.find((o) => o.id === orderId);
      if (!targetOrder) return;
      const veh = dbRef.current.vehicles.find((v) => v.id === targetOrder.vehicle_id);

      const created: MaintenanceItem[] = newItems.map((it) => ({
        ...it,
        id: createUuid(),
        order_id: orderId,
        po_number: it.po_number.trim().toUpperCase(),
      }));

      setDb((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? { ...o, updated_at: now } : o)),
        items: [...created, ...prev.items],
        lastUpdated: now,
      }));

      void (async () => {
        pendingWritesRef.current += 1;
        try {
          const allOrderItems = [
            ...created,
            ...dbRef.current.items.filter((i) => i.order_id === orderId),
          ];
          const itemsMeta: Record<string, TicketItemMeta> = {};
          for (const it of allOrderItems) {
            itemsMeta[it.id] = {
              category: it.category,
              part_name: it.part_name,
              quantity: it.quantity,
              unit_price: it.unit_price,
              amount: it.amount,
            };
          }
          const encodedNote = encodeTicketNote(targetOrder.note, {
            garage: targetOrder.garage,
            service_type: targetOrder.service_type,
            driver_name: targetOrder.driver_name,
            service_interval_km: targetOrder.service_interval_km,
            items: itemsMeta,
          });

          await supabase.from('maintenance_items').insert(
            created.map((it) => ({
              id: it.id,
              ticket_id: orderId,
              item_name: it.item_name,
              action: it.action,
              po_number: it.po_number,
            }))
          );
          await supabase
            .from('maintenance_tickets')
            .update({ note: encodedNote, updated_at: now })
            .eq('id', orderId);

          await recordActivityLog(
            'UPDATE',
            'order',
            `Gộp thêm ${created.length} hạng mục vào phiếu xe ${veh?.plate ?? targetOrder.vehicle_id} (${targetOrder.service_date})`,
            `Giá trị thêm: ${formatVND(created.reduce((s, x) => s + x.amount, 0))}`
          );
        } finally {
          pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
          await syncFromServer({ force: true });
        }
      })();
    },
    [actorName, isAdmin, recordActivityLog, syncFromServer]
  );

  const deleteOrder = useCallback(
    (orderId: string, _actor = actorName) => {
      if (!isAdmin) return;
      const target = dbRef.current.orders.find((o) => o.id === orderId);
      if (!target) return;
      const veh = dbRef.current.vehicles.find((v) => v.id === target.vehicle_id);
      const removedItems = dbRef.current.items.filter((i) => i.order_id === orderId);
      const total = removedItems.reduce((s, i) => s + i.amount, 0);

      setDb((prev) => ({
        ...prev,
        orders: prev.orders.filter((o) => o.id !== orderId),
        items: prev.items.filter((i) => i.order_id !== orderId),
        lastUpdated: new Date().toISOString(),
      }));

      void (async () => {
        pendingWritesRef.current += 1;
        try {
          await supabase.from('maintenance_items').delete().eq('ticket_id', orderId);
          const { error } = await supabase.from('maintenance_tickets').delete().eq('id', orderId);
          if (error) {
            onSyncErrorRef.current?.(error.message || 'Không thể xóa phiếu bảo dưỡng.');
          } else {
            await recordActivityLog(
              'DELETE',
              'order',
              `Xóa phiếu bảo dưỡng xe ${veh?.plate ?? target.vehicle_id} ngày ${target.service_date}`,
              `${removedItems.length} hạng mục · ${formatVND(total)}`
            );
          }
        } finally {
          pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
          await syncFromServer({ force: true });
        }
      })();
    },
    [actorName, isAdmin, recordActivityLog, syncFromServer]
  );

  const assignPoToItem = useCallback(
    (itemId: string, poNumber: string, _actor = actorName) => {
      if (!isAdmin) return;
      const cleanPo = poNumber.trim().toUpperCase();
      const target = dbRef.current.items.find((i) => i.id === itemId);
      if (!target) return;

      setDb((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === itemId ? { ...i, po_number: cleanPo } : i)),
        lastUpdated: new Date().toISOString(),
      }));

      void (async () => {
        pendingWritesRef.current += 1;
        try {
          const { error } = await supabase
            .from('maintenance_items')
            .update({ po_number: cleanPo })
            .eq('id', itemId);
          if (error) {
            onSyncErrorRef.current?.(error.message || 'Không thể cập nhật số PO.');
          } else {
            await recordActivityLog(
              'UPDATE',
              'item',
              `Gán số PO "${cleanPo || 'Trống'}" cho hạng mục "${target.item_name}"`,
              `Thành tiền: ${formatVND(target.amount)}`
            );
          }
        } finally {
          pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
          await syncFromServer({ force: true });
        }
      })();
    },
    [actorName, isAdmin, recordActivityLog, syncFromServer]
  );

  const upsertImportRows = useCallback(
    (rows: ParsedImportRow[], _actor = actorName) => {
      if (!isAdmin) return { inserted: 0, updated: 0, createdVehicles: 0 };
      const validRows = rows.filter((r) => r.status !== 'error');
      if (validRows.length === 0) return { inserted: 0, updated: 0, createdVehicles: 0 };

      let inserted = 0;
      let updated = 0;
      let createdVehicles = 0;

      const vehiclesSnapshot = [...dbRef.current.vehicles];
      const ordersSnapshot = [...dbRef.current.orders];
      const itemsSnapshot = [...dbRef.current.items];
      const vehByPlateKey = new Map(vehiclesSnapshot.map((v) => [v.plate_key, v]));

      const vehiclesToCreate: Vehicle[] = [];
      const touchedOrderIds = new Set<string>();
      const newOrders: MaintenanceOrder[] = [];
      const itemsToInsert: MaintenanceItem[] = [];
      const itemsToUpdate: MaintenanceItem[] = [];

      for (const row of validRows) {
        let veh = vehByPlateKey.get(row.plate_key);
        if (!veh) {
          veh = {
            id: row.plate,
            plate: row.plate,
            plate_key: row.plate_key,
            type: 'Xe bán tải',
            brand_model: 'Chưa cập nhật',
            driver_id: null,
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
          vehiclesSnapshot.push(veh);
          vehiclesToCreate.push(veh);
          vehByPlateKey.set(veh.plate_key, veh);
          createdVehicles += 1;
        }

        let order = ordersSnapshot.find(
          (o) =>
            normalizePlateKey(o.vehicle_id) === veh!.plate_key &&
            o.service_date === row.service_date
        );
        if (!order) {
          order = {
            id: createUuid(),
            vehicle_id: veh.plate,
            service_date: row.service_date,
            odometer_km: row.odometer_km,
            garage: row.garage,
            driver_name: row.driver_name || veh.driver_name,
            service_type: row.service_type,
            note: row.note,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          ordersSnapshot.push(order);
          newOrders.push(order);
        } else {
          order.odometer_km = row.odometer_km || order.odometer_km;
          order.garage = row.garage || order.garage;
          order.note = row.note || order.note;
        }
        touchedOrderIds.add(order.id);

        const existingIdx = itemsSnapshot.findIndex(
          (it) =>
            it.order_id === order!.id &&
            it.item_name.trim().toLowerCase() === row.item_name.trim().toLowerCase() &&
            it.po_number.trim().toUpperCase() === row.po_number.trim().toUpperCase()
        );

        if (existingIdx >= 0) {
          const updatedItem: MaintenanceItem = {
            ...itemsSnapshot[existingIdx],
            category: row.category,
            action: row.action,
            part_name: row.part_name,
            quantity: row.quantity,
            unit_price: row.unit_price,
            amount: row.amount,
          };
          itemsSnapshot[existingIdx] = updatedItem;
          itemsToUpdate.push(updatedItem);
          updated += 1;
        } else {
          const createdItem: MaintenanceItem = {
            id: createUuid(),
            order_id: order.id,
            category: row.category,
            item_name: row.item_name,
            action: row.action,
            part_name: row.part_name,
            quantity: row.quantity,
            unit_price: row.unit_price,
            amount: row.amount,
            po_number: row.po_number,
          };
          itemsSnapshot.push(createdItem);
          itemsToInsert.push(createdItem);
          inserted += 1;
        }
      }

      void (async () => {
        pendingWritesRef.current += 1;
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const userId = session?.user?.id ?? null;

          if (vehiclesToCreate.length > 0) {
            await supabase.from('vehicles').insert(
              vehiclesToCreate.map((v) => ({
                plate: v.plate,
                vehicle_type: v.type,
                brand_model: v.brand_model,
                driver_id: null,
                department: v.department,
                status: v.status,
                registration_expiry: v.registration_due_date || null,
                service_interval_km: v.service_interval_km,
              }))
            );
          }

          for (const order of ordersSnapshot.filter((o) => touchedOrderIds.has(o.id))) {
            const ordItems = itemsSnapshot.filter((i) => i.order_id === order.id);
            const itemsMeta: Record<string, TicketItemMeta> = {};
            for (const it of ordItems) {
              itemsMeta[it.id] = {
                category: it.category,
                part_name: it.part_name,
                quantity: it.quantity,
                unit_price: it.unit_price,
                amount: it.amount,
              };
            }
            const encodedNote = encodeTicketNote(order.note, {
              garage: order.garage,
              service_type: order.service_type,
              driver_name: order.driver_name,
              items: itemsMeta,
            });
            const isNew = newOrders.some((n) => n.id === order.id);
            if (isNew) {
              await supabase.from('maintenance_tickets').insert({
                id: order.id,
                plate: order.vehicle_id,
                service_date: order.service_date,
                odometer_km: order.odometer_km,
                note: encodedNote,
                created_by: userId,
              });
            } else {
              await supabase
                .from('maintenance_tickets')
                .update({
                  odometer_km: order.odometer_km,
                  note: encodedNote,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', order.id);
            }
          }

          if (itemsToInsert.length > 0) {
            await supabase.from('maintenance_items').insert(
              itemsToInsert.map((it) => ({
                id: it.id,
                ticket_id: it.order_id,
                item_name: it.item_name,
                action: it.action,
                po_number: it.po_number,
              }))
            );
          }

          for (const it of itemsToUpdate) {
            await supabase
              .from('maintenance_items')
              .update({ action: it.action, po_number: it.po_number })
              .eq('id', it.id);
          }

          await recordActivityLog(
            'IMPORT',
            'system',
            `Nhập Excel/CSV (UPSERT): thêm mới ${inserted}, cập nhật ${updated} hạng mục`,
            createdVehicles > 0
              ? `Tự động tạo thêm ${createdVehicles} xe mới chưa có trong danh mục`
              : 'Khớp hoàn toàn với danh sách xe hiện có'
          );
        } finally {
          pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
          await syncFromServer({ force: true });
        }
      })();

      return { inserted, updated, createdVehicles };
    },
    [actorName, isAdmin, recordActivityLog, syncFromServer]
  );

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
    deleteVehicle,
    saveOrder,
    appendItemsToExistingOrder,
    deleteOrder,
    assignPoToItem,
    upsertImportRows,
  };
}
