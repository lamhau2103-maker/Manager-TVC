import {
  AuditLogEntry,
  MaintenanceItem,
  MaintenanceOrder,
  Vehicle,
} from '../types';

// Reference "today" date aligned with current workspace time: 2026-11-23
export const REFERENCE_TODAY = '2026-11-23';

// Legacy mock IDs & plate keys stripped automatically from any old cached storage
export const LEGACY_MOCK_VEHICLE_IDS = new Set([
  'veh_01',
  'veh_02',
  'veh_03',
  'veh_04',
  'veh_05',
  'veh_06',
  'veh_07',
  'veh_08',
  'veh_09',
  'veh_10',
  'veh_11',
  'veh_12',
  'veh_13',
  'veh_14',
  'veh_15',
]);

export const LEGACY_MOCK_PLATE_KEYS = new Set([
  '61C12345',
  '51D67890',
  '60H01234',
  '29C45678',
  '51C88912',
  '61H04567',
  '50H23456',
  '43C11289',
  '60C55678',
  '51G30219',
  '61LD00845',
  '29H77421',
  '51C90433',
  '60D11865',
  '79C09240',
]);

export const LEGACY_MOCK_LOG_IDS = new Set(['log_01', 'log_02', 'log_03', 'log_04']);

export function isLegacyMockOrderId(id: string): boolean {
  return /^ord_26(06|07|08|09|10|11)_\d{2}$/.test(id);
}

// Empty dataset — all simulated vehicles, orders, items and logs have been removed
export const SEED_VEHICLES: Vehicle[] = [];

export function buildSeedDataset(): {
  vehicles: Vehicle[];
  orders: MaintenanceOrder[];
  items: MaintenanceItem[];
  auditLogs: AuditLogEntry[];
} {
  return {
    vehicles: [],
    orders: [],
    items: [],
    auditLogs: [],
  };
}
