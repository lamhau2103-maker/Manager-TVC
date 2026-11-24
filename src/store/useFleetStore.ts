import { useCallback, useEffect, useState } from 'react';
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
        // Safely migrate older cached vehicles without registration_due_date
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

export function useFleetStore() {
  const [db, setDb] = useState<FleetDatabaseState>(() => loadInitialState());
  const [recentPlates, setRecentPlates] = useState<string[]>(() => loadRecentPlates());
  const [monthlyBudget, setMonthlyBudgetState] = useState<number>(() => loadMonthlyBudget());
  const [adminVisibility, setAdminVisibility] = useState<AdminVisibilityConfig>(() =>
    loadAdminVisibility()
  );
  const [isSyncing, setIsSyncing] = useState(false);

  // Persist to localStorage on every DB mutation
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
      localStorage.setItem(ADMIN_VISIBILITY_KEY, JSON.stringify(adminVisibility));
    } catch {
      // ignore
    }
  }, [adminVisibility]);

  const toggleAdminMode = useCallback(() => {
    setAdminVisibility((prev) => ({ ...prev, isAdminMode: !prev.isAdminMode }));
  }, []);

  const toggleReportTabVisibility = useCallback((tab: AppPage) => {
    if (tab === 'dashboard') return; // Tổng quan luôn hiển thị
    setAdminVisibility((prev) => {
      const exists = prev.hiddenReportTabs.includes(tab);
      return {
        ...prev,
        hiddenReportTabs: exists
          ? prev.hiddenReportTabs.filter((t) => t !== tab)
          : [...prev.hiddenReportTabs, tab],
      };
    });
  }, []);

  const toggleDashboardBlockVisibility = useCallback((block: DashboardBlockId) => {
    setAdminVisibility((prev) => {
      const exists = prev.hiddenDashboardBlocks.includes(block);
      return {
        ...prev,
        hiddenDashboardBlocks: exists
          ? prev.hiddenDashboardBlocks.filter((b) => b !== block)
          : [...prev.hiddenDashboardBlocks, block],
      };
    });
  }, []);

  const moveDashboardBlock = useCallback(
    (block: DashboardBlockId, direction: 'up' | 'down') => {
      setAdminVisibility((prev) => {
        const next = [...prev.dashboardBlockOrder];
        const idx = next.indexOf(block);
        if (idx === -1) return prev;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= next.length) return prev;
        const [moved] = next.splice(idx, 1);
        next.splice(targetIdx, 0, moved);
        return { ...prev, dashboardBlockOrder: next };
      });
    },
    []
  );

  const reorderDashboardBlocks = useCallback(
    (sourceBlock: DashboardBlockId, targetBlock: DashboardBlockId) => {
      if (sourceBlock === targetBlock) return;
      setAdminVisibility((prev) => {
        const next = [...prev.dashboardBlockOrder];
        const fromIdx = next.indexOf(sourceBlock);
        const toIdx = next.indexOf(targetBlock);
        if (fromIdx === -1 || toIdx === -1) return prev;
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        return { ...prev, dashboardBlockOrder: next };
      });
    },
    []
  );

  const resetReportVisibility = useCallback(() => {
    setAdminVisibility((prev) => ({
      ...prev,
      hiddenReportTabs: [],
      hiddenDashboardBlocks: [],
      dashboardBlockOrder: [...DEFAULT_DASHBOARD_BLOCK_ORDER],
    }));
  }, []);

  // Listen to storage events across browser tabs for instant multi-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
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

  const refreshData = useCallback(() => {
    setIsSyncing(true);
    setDb((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
    }));
    window.setTimeout(() => setIsSyncing(false), 380);
  }, []);

  // Auto-refresh every 60 seconds when not connected to Supabase realtime
  useEffect(() => {
    const id = window.setInterval(() => {
      setDb((prev) => ({
        ...prev,
        lastUpdated: new Date().toISOString(),
      }));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const setMonthlyBudget = useCallback((nextBudget: number, actor = 'Quản lý đội xe') => {
    const clean = Math.max(1_000_000, Math.round(nextBudget));
    setMonthlyBudgetState(clean);
    try {
      localStorage.setItem(BUDGET_STORAGE_KEY, String(clean));
    } catch {
      // ignore
    }
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
  }, []);

  const pushRecentPlate = useCallback((plate: string) => {
    const formatted = formatVietnamesePlate(plate);
    if (!formatted) return;
    setRecentPlates((prev) => {
      const next = [formatted, ...prev.filter((p) => normalizePlateKey(p) !== normalizePlateKey(formatted))];
      return next.slice(0, 5);
    });
  }, []);

  const addVehicle = useCallback(
    (
      payload: Omit<Vehicle, 'id' | 'plate_key'>,
      actor = 'Quản lý đội xe'
    ): { ok: true; vehicle: Vehicle } | { ok: false; error: string } => {
      const formattedPlate = formatVietnamesePlate(payload.plate);
      const plateKey = normalizePlateKey(formattedPlate);
      if (!plateKey) {
        return { ok: false, error: 'Biển số không được để trống.' };
      }
      const dup = db.vehicles.find((v) => v.plate_key === plateKey);
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

      return { ok: true, vehicle: newVehicle };
    },
    [db.vehicles]
  );

  const bulkAddPlates = useCallback(
    (
      rawEntries: string[],
      defaultType: VehicleType = 'Xe tải',
      defaultDepartment: string = DEPARTMENTS[0],
      actor = 'Admin đội xe'
    ): { added: Vehicle[]; skipped: string[] } => {
      const existingKeys = new Set(db.vehicles.map((v) => v.plate_key));
      const added: Vehicle[] = [];
      const skipped: string[] = [];

      for (const raw of rawEntries) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        // Support optional "BIỂN SỐ | LOẠI XE | TÀI XẾ" or plain plate per line
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
          details: added.map((v) => v.plate).slice(0, 8).join(', ') + (added.length > 8 ? '...' : ''),
        };

        setDb((prev) => ({
          ...prev,
          vehicles: [...added, ...prev.vehicles],
          auditLogs: [log, ...prev.auditLogs],
          lastUpdated: now,
        }));
      }

      return { added, skipped };
    },
    [db.vehicles]
  );

  const updateVehicle = useCallback(
    (
      vehicleId: string,
      updates: Partial<Omit<Vehicle, 'id' | 'plate_key'>>,
      actor = 'Quản lý đội xe'
    ): { ok: boolean; error?: string } => {
      const target = db.vehicles.find((v) => v.id === vehicleId);
      if (!target) return { ok: false, error: 'Không tìm thấy xe.' };

      const nextPlate = updates.plate ? formatVietnamesePlate(updates.plate) : target.plate;
      const nextPlateKey = normalizePlateKey(nextPlate);

      if (
        nextPlateKey !== target.plate_key &&
        db.vehicles.some((v) => v.id !== vehicleId && v.plate_key === nextPlateKey)
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

      return { ok: true };
    },
    [db.vehicles]
  );

  const saveOrder = useCallback(
    (
      orderPayload: Omit<MaintenanceOrder, 'id' | 'created_at' | 'updated_at'> & { id?: string },
      itemPayloads: Array<Omit<MaintenanceItem, 'id' | 'order_id'> & { id?: string }>,
      actor = 'Quản lý đội xe'
    ) => {
      const now = new Date().toISOString();
      const isEdit = Boolean(orderPayload.id);
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
          ? db.orders.find((o) => o.id === orderId)?.created_at || now
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
      const vehicle = db.vehicles.find((v) => v.id === nextOrder.vehicle_id);
      const poList = Array.from(new Set(nextItems.map((i) => i.po_number).filter(Boolean))).join(', ');

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

        // Scientifically sync vehicle odometer, km cycle, and next service km/date
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

      return orderId;
    },
    [db.orders, db.vehicles]
  );

  const appendItemsToExistingOrder = useCallback(
    (
      orderId: string,
      newItems: Array<Omit<MaintenanceItem, 'id' | 'order_id'>>,
      actor = 'Quản lý đội xe'
    ) => {
      const now = new Date().toISOString();
      const targetOrder = db.orders.find((o) => o.id === orderId);
      if (!targetOrder) return;
      const veh = db.vehicles.find((v) => v.id === targetOrder.vehicle_id);

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
    },
    [db.orders, db.vehicles]
  );

  const deleteOrder = useCallback(
    (orderId: string, actor = 'Quản lý đội xe') => {
      const target = db.orders.find((o) => o.id === orderId);
      if (!target) return;
      const veh = db.vehicles.find((v) => v.id === target.vehicle_id);
      const removedItems = db.items.filter((i) => i.order_id === orderId);
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
    },
    [db.items, db.orders, db.vehicles]
  );

  const assignPoToItem = useCallback(
    (itemId: string, poNumber: string, actor = 'Quản lý đội xe') => {
      const cleanPo = poNumber.trim().toUpperCase();
      const target = db.items.find((i) => i.id === itemId);
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
    },
    [db.items]
  );

  const upsertImportRows = useCallback(
    (rows: ParsedImportRow[], actor = 'Quản lý đội xe') => {
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
          // 1. Ensure vehicle exists
          let veh = vehByPlateKey.get(row.plate_key);
          if (!veh) {
            veh = {
              id: generateId('veh'),
              plate: row.plate,
              plate_key: row.plate_key,
              type: 'Xe bán tải',
              brand_model: 'Chưa cập nhật',
              driver_name: row.driver_name || 'Chưa phân công',
              department: 'Vận tải Miền Nam',
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

          // 2. Find or create order (same vehicle_id + service_date)
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

          // 3. UPSERT item by (order_id + item_name + po_number)
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

      return { inserted, updated, createdVehicles };
    },
    []
  );

  const resetDemoData = useCallback(() => {
    const seed = buildSeedDataset();
    const now = new Date().toISOString();
    setDb({
      ...seed,
      auditLogs: [
        {
          id: generateId('log'),
          timestamp: now,
          actor: 'Quản lý đội xe',
          action: 'UPDATE',
          entity: 'system',
          summary: 'Khôi phục dữ liệu mẫu ban đầu (15 xe, 55 phiếu)',
        },
        ...seed.auditLogs,
      ],
      lastUpdated: now,
    });
  }, []);

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
