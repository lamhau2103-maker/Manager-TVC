import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const DEFAULT_SUPABASE_URL = 'https://mqvfpuqhlgbhoiwciwpr.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_i9AtKDyTEULSJ7s0UQ6kww_lOxxOKd0';

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || '').trim() || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (process.env.VITE_SUPABASE_ANON_KEY || '').trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE_PATH = path.resolve(DATA_DIR, 'fleet-db.json');

const DEFAULT_MONTHLY_BUDGET = 320_000_000;
const REFERENCE_TODAY = '2026-11-24';
const DEFAULT_DASHBOARD_BLOCK_ORDER = [
  'summary',
  'budget_heatmap',
  'monthly_status',
  'alerts',
  'charts',
  'orders_table',
];
const VALID_APP_PAGES = new Set(['dashboard', 'orders', 'vehicles', 'po', 'settings']);
const VALID_DASHBOARD_BLOCKS = new Set(DEFAULT_DASHBOARD_BLOCK_ORDER);
const MAX_AUDIT_LOGS = 500;
const SSE_TICKET_TTL_MS = 30_000;
const MAX_SSE_TICKETS = 500;

interface VehicleRecord {
  id: string;
  plate: string;
  plate_key: string;
  type: string;
  brand_model: string;
  year?: number;
  driver_name: string;
  department: string;
  status: string;
  registration_due_date: string;
  current_km: number;
  service_interval_km: number;
  service_interval_days: number;
  next_service_km: number;
  next_service_date: string;
}

interface OrderRecord {
  id: string;
  vehicle_id: string;
  service_date: string;
  odometer_km: number;
  service_interval_km?: number;
  garage: string;
  driver_name: string;
  service_type: string;
  note: string;
  created_at: string;
  updated_at: string;
}

interface ItemRecord {
  id: string;
  order_id: string;
  category: string;
  item_name: string;
  action: string;
  part_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  po_number: string;
}

interface AuditLogRecord {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  summary: string;
  details?: string;
}

interface SharedFleetState {
  version: number;
  vehicles: VehicleRecord[];
  orders: OrderRecord[];
  items: ItemRecord[];
  auditLogs: AuditLogRecord[];
  monthlyBudget: number;
  hiddenReportTabs: string[];
  hiddenDashboardBlocks: string[];
  dashboardBlockOrder: string[];
  lastUpdated: string;
}

interface AuthedCaller {
  userId: string;
  role: 'admin' | 'user';
  actorName: string;
}

interface AuthedRequest extends Request {
  caller?: AuthedCaller;
}

// ==================== PURE HELPERS (SELF-CONTAINED FOR NODE 22) ====================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

function normalizePlateKey(raw: string): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function formatVietnamesePlate(raw: string): string {
  const clean = normalizePlateKey(raw);
  if (!clean) return '';
  const m5 = clean.match(/^(\d{2}[A-Z]{1,2}\d?)(\d{3})(\d{2})$/);
  if (m5) return `${m5[1]}-${m5[2]}.${m5[3]}`;
  const m4 = clean.match(/^(\d{2}[A-Z]{1,2})(\d{4})$/);
  if (m4) return `${m4[1]}-${m4[2]}`;
  const mFallback = clean.match(/^(\d{2}[A-Z]{1,2})([0-9]+)$/);
  if (mFallback) return `${mFallback[1]}-${mFallback[2]}`;
  return clean;
}

function addDaysISO(isoDate: string, days: number): string {
  const parts = String(isoDate || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return isoDate || REFERENCE_TODAY;
  }
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatVND(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `${safe.toLocaleString('vi-VN')} ₫`;
}

function safeString(val: unknown, maxLen = 200, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  return val.trim().slice(0, maxLen);
}

function safeNonNegativeNumber(val: unknown, fallback = 0): number {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

function normalizeBlockOrder(order: unknown): string[] {
  const result: string[] = [];
  if (Array.isArray(order)) {
    for (const item of order) {
      if (
        typeof item === 'string' &&
        VALID_DASHBOARD_BLOCKS.has(item) &&
        !result.includes(item)
      ) {
        result.push(item);
      }
    }
  }
  for (const id of DEFAULT_DASHBOARD_BLOCK_ORDER) {
    if (!result.includes(id)) result.push(id);
  }
  return result;
}

function sanitizeClientId(raw: unknown, prefix: string): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const pattern = new RegExp(`^${prefix}_[a-zA-Z0-9_-]{3,48}$`);
  return pattern.test(trimmed) ? trimmed : null;
}

function sanitizeVehicle(raw: Record<string, unknown>, fallbackId?: string): VehicleRecord | null {
  const formattedPlate = formatVietnamesePlate(String(raw.plate || ''));
  const plateKey = normalizePlateKey(formattedPlate);
  if (!plateKey) return null;

  const id = sanitizeClientId(raw.id, 'veh') || fallbackId || generateId('veh');
  return {
    id,
    plate: formattedPlate,
    plate_key: plateKey,
    type: safeString(raw.type, 80, 'Xe bán tải') || 'Xe bán tải',
    brand_model: safeString(raw.brand_model, 120, 'Chưa cập nhật') || 'Chưa cập nhật',
    year: typeof raw.year === 'number' && Number.isFinite(raw.year) ? raw.year : undefined,
    driver_name: safeString(raw.driver_name, 100, 'Chưa phân công') || 'Chưa phân công',
    department: safeString(raw.department, 80, 'Văn Phòng HCM') || 'Văn Phòng HCM',
    status: safeString(raw.status, 40, 'Đang hoạt động') || 'Đang hoạt động',
    registration_due_date:
      safeString(raw.registration_due_date, 20) || addDaysISO(REFERENCE_TODAY, 180),
    current_km: safeNonNegativeNumber(raw.current_km, 0),
    service_interval_km: Math.max(1000, safeNonNegativeNumber(raw.service_interval_km, 10000)),
    service_interval_days: Math.max(1, safeNonNegativeNumber(raw.service_interval_days, 90)),
    next_service_km: safeNonNegativeNumber(raw.next_service_km, 0),
    next_service_date: safeString(raw.next_service_date, 20, ''),
  };
}

function sanitizeItem(
  raw: Record<string, unknown>,
  orderId: string,
  allowExistingId = false
): ItemRecord | null {
  const itemName = safeString(raw.item_name, 200);
  if (!itemName) return null;
  const qty = Math.max(1, safeNonNegativeNumber(raw.quantity, 1));
  const amount = safeNonNegativeNumber(raw.amount, 0);
  const unitPrice = safeNonNegativeNumber(
    raw.unit_price,
    qty > 0 ? Math.round(amount / qty) : amount
  );
  const id =
    (allowExistingId ? sanitizeClientId(raw.id, 'it') : null) || generateId('it');

  return {
    id,
    order_id: orderId,
    category: safeString(raw.category, 60, 'Khác') || 'Khác',
    item_name: itemName,
    action: raw.action === 'SỬA CHỮA' ? 'SỬA CHỮA' : 'THAY THẾ',
    part_name: safeString(raw.part_name, 200, ''),
    quantity: qty,
    unit_price: unitPrice,
    amount,
    po_number: safeString(raw.po_number, 60, '').toUpperCase(),
  };
}

// ==================== ATOMIC FILE PERSISTENCE ====================

let dbState: SharedFleetState | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStateFromDisk(): SharedFleetState | null {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) return null;
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SharedFleetState>;
    if (
      !Array.isArray(parsed.vehicles) ||
      !Array.isArray(parsed.orders) ||
      !Array.isArray(parsed.items)
    ) {
      return null;
    }
    return {
      version:
        typeof parsed.version === 'number' && parsed.version >= 1
          ? Math.floor(parsed.version)
          : 1,
      vehicles: parsed.vehicles as VehicleRecord[],
      orders: parsed.orders as OrderRecord[],
      items: parsed.items as ItemRecord[],
      auditLogs: Array.isArray(parsed.auditLogs)
        ? (parsed.auditLogs as AuditLogRecord[]).slice(0, MAX_AUDIT_LOGS)
        : [],
      monthlyBudget:
        typeof parsed.monthlyBudget === 'number' &&
        Number.isFinite(parsed.monthlyBudget) &&
        parsed.monthlyBudget > 0
          ? Math.round(parsed.monthlyBudget)
          : DEFAULT_MONTHLY_BUDGET,
      hiddenReportTabs: Array.isArray(parsed.hiddenReportTabs)
        ? parsed.hiddenReportTabs.filter(
            (t): t is string => typeof t === 'string' && VALID_APP_PAGES.has(t) && t !== 'dashboard'
          )
        : [],
      hiddenDashboardBlocks: Array.isArray(parsed.hiddenDashboardBlocks)
        ? parsed.hiddenDashboardBlocks.filter(
            (b): b is string => typeof b === 'string' && VALID_DASHBOARD_BLOCKS.has(b)
          )
        : [],
      dashboardBlockOrder: normalizeBlockOrder(parsed.dashboardBlockOrder),
      lastUpdated:
        typeof parsed.lastUpdated === 'string' && parsed.lastUpdated
          ? parsed.lastUpdated
          : new Date().toISOString(),
    };
  } catch (err) {
    console.error('[fleet-db] Failed to load state from disk:', err);
    return null;
  }
}

function persistStateToDisk(nextState: SharedFleetState): void {
  ensureDataDir();
  const tmpPath = path.resolve(
    DATA_DIR,
    `fleet-db.${process.pid}.${Date.now()}.${crypto.randomBytes(3).toString('hex')}.tmp`
  );
  fs.writeFileSync(tmpPath, JSON.stringify(nextState, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_FILE_PATH);
}

// ==================== SSE REAL-TIME BROADCAST ====================

const sseClients = new Set<Response>();
const sseTickets = new Map<string, { userId: string; expiresAt: number }>();

function cleanupExpiredTickets(): void {
  const now = Date.now();
  for (const [token, info] of sseTickets.entries()) {
    if (info.expiresAt <= now) {
      sseTickets.delete(token);
    }
  }
}

function broadcastState(state: SharedFleetState): void {
  if (sseClients.size === 0) return;
  const payload = `event: fleet-update\ndata: ${JSON.stringify(state)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function commitMutation(updater: (prev: SharedFleetState) => SharedFleetState): SharedFleetState {
  if (!dbState) {
    throw new Error('DATABASE_NOT_INITIALIZED');
  }
  const now = new Date().toISOString();
  const updated = updater(dbState);
  const nextState: SharedFleetState = {
    ...updated,
    version: dbState.version + 1,
    auditLogs: updated.auditLogs.slice(0, MAX_AUDIT_LOGS),
    lastUpdated: now,
  };
  persistStateToDisk(nextState);
  dbState = nextState;
  broadcastState(nextState);
  return nextState;
}

// ==================== SUPABASE JWT AUTH + RBAC MIDDLEWARE ====================

const baseSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function resolveCallerFromToken(token: string): Promise<AuthedCaller | null> {
  const { data: userData, error: authError } = await baseSupabase.auth.getUser(token);
  if (authError || !userData?.user) {
    return null;
  }

  const user = userData.user;
  const scopedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  let role: 'admin' | 'user' = 'user';
  let actorName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    (user.email || '').split('@')[0] ||
    'Thành viên';

  try {
    const { data: profileData } = await scopedClient
      .from('profiles')
      .select('username, full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileData) {
      if (String(profileData.role || '').toLowerCase() === 'admin') {
        role = 'admin';
      }
      const fullName =
        typeof profileData.full_name === 'string' ? profileData.full_name.trim() : '';
      const username =
        typeof profileData.username === 'string' ? profileData.username.trim() : '';
      if (role === 'admin') {
        actorName = 'Quản Trị Viên / Điều Phối';
      } else if (fullName) {
        actorName = fullName;
      } else if (username) {
        actorName = username;
      }
    }
  } catch {
    // Fail-closed to role='user' if profiles lookup fails
  }

  return {
    userId: user.id,
    role,
    actorName,
  };
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    const token = match ? match[1].trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Vui lòng đăng nhập để truy cập dữ liệu.' });
      return;
    }

    const caller = await resolveCallerFromToken(token);
    if (!caller) {
      res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
      return;
    }

    req.caller = caller;
    next();
  } catch {
    res.status(401).json({ error: 'Không thể xác thực phiên đăng nhập.' });
  }
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.caller || req.caller.role !== 'admin') {
    res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác này.' });
    return;
  }
  next();
}

function syncVehicleOnOrder(
  vehicles: VehicleRecord[],
  order: OrderRecord
): VehicleRecord[] {
  return vehicles.map((v) => {
    if (v.id !== order.vehicle_id) return v;
    const updatedKm =
      order.odometer_km > v.current_km || v.current_km === 0
        ? order.odometer_km
        : v.current_km;
    const nextIntervalKm =
      order.service_interval_km && order.service_interval_km >= 1000
        ? order.service_interval_km
        : v.service_interval_km || 10000;
    const isPeriodic = order.service_type === 'Định kỳ';
    const shouldRecomputeDue =
      (isPeriodic || v.next_service_km <= 0) && order.odometer_km > 0;
    return {
      ...v,
      current_km: updatedKm,
      service_interval_km: nextIntervalKm,
      next_service_km: shouldRecomputeDue
        ? order.odometer_km + nextIntervalKm
        : v.next_service_km,
      next_service_date:
        isPeriodic || !v.next_service_date
          ? addDaysISO(order.service_date, v.service_interval_days || 90)
          : v.next_service_date,
    };
  });
}

// ==================== EXPRESS APP SETUP ====================

dbState = loadStateFromDisk();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));

// Security headers for API responses
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// 1. Issue single-use 30s SSE ticket (authenticated via Bearer header — JWT never in URL)
app.post('/api/fleet/sse-ticket', requireAuth, (req: AuthedRequest, res: Response) => {
  cleanupExpiredTickets();
  if (sseTickets.size >= MAX_SSE_TICKETS) {
    const oldestKey = sseTickets.keys().next().value;
    if (oldestKey) sseTickets.delete(oldestKey);
  }
  const ticket = crypto.randomBytes(24).toString('hex');
  sseTickets.set(ticket, {
    userId: req.caller!.userId,
    expiresAt: Date.now() + SSE_TICKET_TTL_MS,
  });
  res.json({ ticket });
});

// 2. Real-time SSE stream (redeems and deletes single-use ticket immediately)
app.get('/api/fleet/stream', (req: Request, res: Response) => {
  cleanupExpiredTickets();
  const ticket = typeof req.query.ticket === 'string' ? req.query.ticket.trim() : '';
  const record = ticket ? sseTickets.get(ticket) : undefined;
  if (!record || record.expiresAt <= Date.now()) {
    res.status(401).json({ error: 'Vé kết nối đồng bộ không hợp lệ hoặc đã hết hạn.' });
    return;
  }
  sseTickets.delete(ticket);

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  sseClients.add(res);
  res.write(
    `event: connected\ndata: ${JSON.stringify({ version: dbState?.version ?? 0 })}\n\n`
  );

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// 3. Read canonical shared fleet state (all authenticated roles)
app.get('/api/fleet/state', requireAuth, (_req: AuthedRequest, res: Response) => {
  if (!dbState) {
    res.json({ initialized: false, state: null });
    return;
  }
  res.json({ initialized: true, state: dbState });
});

// 4. First-boot bootstrap (only initializes once when disk DB does not exist yet)
app.post('/api/fleet/bootstrap', requireAuth, (req: AuthedRequest, res: Response) => {
  if (dbState) {
    res.json({ initialized: true, state: dbState });
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  if (!Array.isArray(body.vehicles) || !Array.isArray(body.orders) || !Array.isArray(body.items)) {
    res.status(400).json({ error: 'Dữ liệu khởi tạo không hợp lệ.' });
    return;
  }

  const vehicles: VehicleRecord[] = [];
  const seenPlateKeys = new Set<string>();
  for (const rawVeh of body.vehicles) {
    if (!rawVeh || typeof rawVeh !== 'object') continue;
    const v = sanitizeVehicle(rawVeh as Record<string, unknown>);
    if (!v || seenPlateKeys.has(v.plate_key)) continue;
    seenPlateKeys.add(v.plate_key);
    vehicles.push(v);
  }

  const orders: OrderRecord[] = [];
  const seenOrderIds = new Set<string>();
  for (const rawOrd of body.orders) {
    if (!rawOrd || typeof rawOrd !== 'object') continue;
    const o = rawOrd as Record<string, unknown>;
    const id = sanitizeClientId(o.id, 'ord') || generateId('ord');
    const vehicleId = safeString(o.vehicle_id, 64);
    const serviceDate = safeString(o.service_date, 20);
    if (!vehicleId || !serviceDate || seenOrderIds.has(id)) continue;
    seenOrderIds.add(id);
    orders.push({
      id,
      vehicle_id: vehicleId,
      service_date: serviceDate,
      odometer_km: safeNonNegativeNumber(o.odometer_km, 0),
      service_interval_km:
        typeof o.service_interval_km === 'number' && o.service_interval_km >= 1000
          ? Math.round(o.service_interval_km)
          : undefined,
      garage: safeString(o.garage, 120, 'Chưa xác định') || 'Chưa xác định',
      driver_name: safeString(o.driver_name, 100, ''),
      service_type: safeString(o.service_type, 60, 'Định kỳ') || 'Định kỳ',
      note: safeString(o.note, 500, ''),
      created_at: safeString(o.created_at, 40) || new Date().toISOString(),
      updated_at: safeString(o.updated_at, 40) || new Date().toISOString(),
    });
  }

  const items: ItemRecord[] = [];
  for (const rawIt of body.items) {
    if (!rawIt || typeof rawIt !== 'object') continue;
    const it = rawIt as Record<string, unknown>;
    const orderId = safeString(it.order_id, 64);
    if (!orderId) continue;
    const clean = sanitizeItem(it, orderId, true);
    if (clean) items.push(clean);
  }

  const auditLogs: AuditLogRecord[] = Array.isArray(body.auditLogs)
    ? body.auditLogs
        .filter((l): l is Record<string, unknown> => Boolean(l && typeof l === 'object'))
        .slice(0, MAX_AUDIT_LOGS)
        .map((l) => ({
          id: sanitizeClientId(l.id, 'log') || generateId('log'),
          timestamp: safeString(l.timestamp, 40) || new Date().toISOString(),
          actor: safeString(l.actor, 100, 'Hệ thống'),
          action: safeString(l.action, 20, 'UPDATE'),
          entity: safeString(l.entity, 20, 'system'),
          summary: safeString(l.summary, 300, ''),
          details: typeof l.details === 'string' ? l.details.slice(0, 400) : undefined,
        }))
    : [];

  const initial: SharedFleetState = {
    version: 1,
    vehicles,
    orders,
    items,
    auditLogs,
    monthlyBudget: Math.max(
      1_000_000,
      safeNonNegativeNumber(body.monthlyBudget, DEFAULT_MONTHLY_BUDGET)
    ),
    hiddenReportTabs: Array.isArray(body.hiddenReportTabs)
      ? body.hiddenReportTabs.filter(
          (t): t is string => typeof t === 'string' && VALID_APP_PAGES.has(t) && t !== 'dashboard'
        )
      : [],
    hiddenDashboardBlocks: Array.isArray(body.hiddenDashboardBlocks)
      ? body.hiddenDashboardBlocks.filter(
          (b): b is string => typeof b === 'string' && VALID_DASHBOARD_BLOCKS.has(b)
        )
      : [],
    dashboardBlockOrder: normalizeBlockOrder(body.dashboardBlockOrder),
    lastUpdated: new Date().toISOString(),
  };

  persistStateToDisk(initial);
  dbState = initial;
  broadcastState(initial);
  res.json({ initialized: true, state: initial });
});

// 5. CREATE NEW MAINTENANCE ORDER (Allowed for BOTH admin and user — NEVER overwrites existing order)
app.post('/api/fleet/orders', requireAuth, (req: AuthedRequest, res: Response) => {
  if (!dbState) {
    res.status(503).json({ error: 'Cơ sở dữ liệu chưa được khởi tạo.' });
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const orderInput = (body.order || {}) as Record<string, unknown>;
  const rawItems = Array.isArray(body.items) ? body.items : [];

  const vehicleId = safeString(orderInput.vehicle_id, 64);
  const serviceDate = safeString(orderInput.service_date, 20);
  if (!vehicleId || !serviceDate) {
    res.status(400).json({ error: 'Thiếu biển số xe hoặc ngày bảo dưỡng.' });
    return;
  }

  const vehicle = dbState.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) {
    res.status(404).json({ error: 'Không tìm thấy phương tiện đã chọn.' });
    return;
  }

  // Always create a brand-new order; never allow POST to overwrite an existing order ID
  const requestedId = sanitizeClientId(orderInput.id, 'ord');
  const orderId =
    requestedId && !dbState.orders.some((o) => o.id === requestedId)
      ? requestedId
      : generateId('ord');

  const nextItems: ItemRecord[] = [];
  for (const rawIt of rawItems) {
    if (!rawIt || typeof rawIt !== 'object') continue;
    const clean = sanitizeItem(rawIt as Record<string, unknown>, orderId, false);
    if (clean) nextItems.push(clean);
  }
  if (nextItems.length === 0) {
    res.status(400).json({ error: 'Phiếu bảo dưỡng cần có ít nhất 1 hạng mục.' });
    return;
  }

  const now = new Date().toISOString();
  const nextOrder: OrderRecord = {
    id: orderId,
    vehicle_id: vehicleId,
    service_date: serviceDate,
    odometer_km: safeNonNegativeNumber(orderInput.odometer_km, 0),
    service_interval_km:
      typeof orderInput.service_interval_km === 'number' && orderInput.service_interval_km >= 1000
        ? Math.round(orderInput.service_interval_km)
        : undefined,
    garage: safeString(orderInput.garage, 120, 'Chưa xác định') || 'Chưa xác định',
    driver_name: safeString(orderInput.driver_name, 100, ''),
    service_type: safeString(orderInput.service_type, 60, 'Định kỳ') || 'Định kỳ',
    note: safeString(orderInput.note, 500, ''),
    created_at: now,
    updated_at: now,
  };

  const totalAmount = nextItems.reduce((s, it) => s + it.amount, 0);
  const poList = Array.from(new Set(nextItems.map((i) => i.po_number).filter(Boolean))).join(', ');
  const actor = req.caller!.actorName;

  const log: AuditLogRecord = {
    id: generateId('log'),
    timestamp: now,
    actor,
    action: 'CREATE',
    entity: 'order',
    summary: `Thêm mới phiếu bảo dưỡng xe ${vehicle.plate} ngày ${nextOrder.service_date}`,
    details: `${nextItems.length} hạng mục · ${formatVND(totalAmount)}${poList ? ` · ${poList}` : ' · Chưa có PO'}`,
  };

  const state = commitMutation((prev) => ({
    ...prev,
    vehicles: syncVehicleOnOrder(prev.vehicles, nextOrder),
    orders: [nextOrder, ...prev.orders],
    items: [...nextItems, ...prev.items],
    auditLogs: [log, ...prev.auditLogs],
  }));

  res.status(201).json({ ok: true, orderId, state });
});

// 6. UPDATE EXISTING MAINTENANCE ORDER (Admin ONLY)
app.put('/api/fleet/orders/:id', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
  if (!dbState) {
    res.status(503).json({ error: 'Cơ sở dữ liệu chưa được khởi tạo.' });
    return;
  }

  const orderId = safeString(req.params.id, 64);
  const existing = dbState.orders.find((o) => o.id === orderId);
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy phiếu bảo dưỡng cần cập nhật.' });
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const orderInput = (body.order || {}) as Record<string, unknown>;
  const rawItems = Array.isArray(body.items) ? body.items : [];

  const vehicleId = safeString(orderInput.vehicle_id, 64) || existing.vehicle_id;
  const serviceDate = safeString(orderInput.service_date, 20) || existing.service_date;
  const vehicle = dbState.vehicles.find((v) => v.id === vehicleId);

  const nextItems: ItemRecord[] = [];
  for (const rawIt of rawItems) {
    if (!rawIt || typeof rawIt !== 'object') continue;
    const clean = sanitizeItem(rawIt as Record<string, unknown>, orderId, true);
    if (clean) nextItems.push(clean);
  }
  if (nextItems.length === 0) {
    res.status(400).json({ error: 'Phiếu bảo dưỡng cần có ít nhất 1 hạng mục.' });
    return;
  }

  const now = new Date().toISOString();
  const nextOrder: OrderRecord = {
    id: orderId,
    vehicle_id: vehicleId,
    service_date: serviceDate,
    odometer_km: safeNonNegativeNumber(orderInput.odometer_km, existing.odometer_km),
    service_interval_km:
      typeof orderInput.service_interval_km === 'number' && orderInput.service_interval_km >= 1000
        ? Math.round(orderInput.service_interval_km)
        : existing.service_interval_km,
    garage: safeString(orderInput.garage, 120, existing.garage) || 'Chưa xác định',
    driver_name: safeString(orderInput.driver_name, 100, existing.driver_name),
    service_type: safeString(orderInput.service_type, 60, existing.service_type) || 'Định kỳ',
    note: safeString(orderInput.note, 500, ''),
    created_at: existing.created_at,
    updated_at: now,
  };

  const totalAmount = nextItems.reduce((s, it) => s + it.amount, 0);
  const poList = Array.from(new Set(nextItems.map((i) => i.po_number).filter(Boolean))).join(', ');

  const log: AuditLogRecord = {
    id: generateId('log'),
    timestamp: now,
    actor: req.caller!.actorName,
    action: 'UPDATE',
    entity: 'order',
    summary: `Cập nhật phiếu bảo dưỡng xe ${vehicle?.plate ?? ''} ngày ${nextOrder.service_date}`,
    details: `${nextItems.length} hạng mục · ${formatVND(totalAmount)}${poList ? ` · ${poList}` : ' · Chưa có PO'}`,
  };

  const state = commitMutation((prev) => ({
    ...prev,
    vehicles: syncVehicleOnOrder(prev.vehicles, nextOrder),
    orders: prev.orders.map((o) => (o.id === orderId ? nextOrder : o)),
    items: [...nextItems, ...prev.items.filter((it) => it.order_id !== orderId)],
    auditLogs: [log, ...prev.auditLogs],
  }));

  res.json({ ok: true, orderId, state });
});

// 7. APPEND ITEMS TO EXISTING ORDER (Admin ONLY)
app.post(
  '/api/fleet/orders/:id/items',
  requireAuth,
  requireAdmin,
  (req: AuthedRequest, res: Response) => {
    if (!dbState) {
      res.status(503).json({ error: 'Cơ sở dữ liệu chưa được khởi tạo.' });
      return;
    }

    const orderId = safeString(req.params.id, 64);
    const targetOrder = dbState.orders.find((o) => o.id === orderId);
    if (!targetOrder) {
      res.status(404).json({ error: 'Không tìm thấy phiếu bảo dưỡng.' });
      return;
    }

    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const created: ItemRecord[] = [];
    for (const rawIt of rawItems) {
      if (!rawIt || typeof rawIt !== 'object') continue;
      const clean = sanitizeItem(rawIt as Record<string, unknown>, orderId, false);
      if (clean) created.push(clean);
    }
    if (created.length === 0) {
      res.status(400).json({ error: 'Không có hạng mục hợp lệ để gộp.' });
      return;
    }

    const now = new Date().toISOString();
    const veh = dbState.vehicles.find((v) => v.id === targetOrder.vehicle_id);
    const log: AuditLogRecord = {
      id: generateId('log'),
      timestamp: now,
      actor: req.caller!.actorName,
      action: 'UPDATE',
      entity: 'order',
      summary: `Gộp thêm ${created.length} hạng mục vào phiếu xe ${veh?.plate ?? ''} (${targetOrder.service_date})`,
      details: `Giá trị thêm: ${formatVND(created.reduce((s, x) => s + x.amount, 0))}`,
    };

    const state = commitMutation((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === orderId ? { ...o, updated_at: now } : o)),
      items: [...created, ...prev.items],
      auditLogs: [log, ...prev.auditLogs],
    }));

    res.json({ ok: true, state });
  }
);

// 8. DELETE MAINTENANCE ORDER (Admin ONLY)
app.delete(
  '/api/fleet/orders/:id',
  requireAuth,
  requireAdmin,
  (req: AuthedRequest, res: Response) => {
    if (!dbState) {
      res.status(503).json({ error: 'Cơ sở dữ liệu chưa được khởi tạo.' });
      return;
    }

    const orderId = safeString(req.params.id, 64);
    const target = dbState.orders.find((o) => o.id === orderId);
    if (!target) {
      res.status(404).json({ error: 'Không tìm thấy phiếu bảo dưỡng.' });
      return;
    }

    const veh = dbState.vehicles.find((v) => v.id === target.vehicle_id);
    const removedItems = dbState.items.filter((i) => i.order_id === orderId);
    const total = removedItems.reduce((s, i) => s + i.amount, 0);

    const log: AuditLogRecord = {
      id: generateId('log'),
      timestamp: new Date().toISOString(),
      actor: req.caller!.actorName,
      action: 'DELETE',
      entity: 'order',
      summary: `Xóa phiếu bảo dưỡng xe ${veh?.plate ?? ''} ngày ${target.service_date}`,
      details: `${removedItems.length} hạng mục · ${formatVND(total)}`,
    };

    const state = commitMutation((prev) => ({
      ...prev,
      orders: prev.orders.filter((o) => o.id !== orderId),
      items: prev.items.filter((i) => i.order_id !== orderId),
      auditLogs: [log, ...prev.auditLogs],
    }));

    res.json({ ok: true, state });
  }
);

// 9. ADD SINGLE VEHICLE (Admin ONLY)
app.post('/api/fleet/vehicles', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
  if (!dbState) {
    res.status(503).json({ error: 'Cơ sở dữ liệu chưa được khởi tạo.' });
    return;
  }

  const rawVeh = (req.body?.vehicle || req.body || {}) as Record<string, unknown>;
  const newVehicle = sanitizeVehicle(rawVeh);
  if (!newVehicle) {
    res.status(400).json({ ok: false, error: 'Biển số không được để trống.' });
    return;
  }

  const dup = dbState.vehicles.find((v) => v.plate_key === newVehicle.plate_key);
  if (dup) {
    res
      .status(409)
      .json({ ok: false, error: `Biển số ${dup.plate} đã tồn tại trong hệ thống.` });
    return;
  }

  if (dbState.vehicles.some((v) => v.id === newVehicle.id)) {
    newVehicle.id = generateId('veh');
  }

  const log: AuditLogRecord = {
    id: generateId('log'),
    timestamp: new Date().toISOString(),
    actor: req.caller!.actorName,
    action: 'CREATE',
    entity: 'vehicle',
    summary: `Thêm xe mới ${newVehicle.plate} (${newVehicle.type})`,
    details: `${newVehicle.brand_model || 'Chưa rõ model'} · Tài xế: ${newVehicle.driver_name || '—'} · ${newVehicle.department}`,
  };

  const state = commitMutation((prev) => ({
    ...prev,
    vehicles: [newVehicle, ...prev.vehicles],
    auditLogs: [log, ...prev.auditLogs],
  }));

  res.status(201).json({ ok: true, vehicle: newVehicle, state });
});

// 10. BULK ADD VEHICLES (Admin ONLY)
app.post(
  '/api/fleet/vehicles/bulk',
  requireAuth,
  requireAdmin,
  (req: AuthedRequest, res: Response) => {
    if (!dbState) {
      res.status(503).json({ error: 'Cơ sở dữ liệu chưa được khởi tạo.' });
      return;
    }

    const rawVehicles = Array.isArray(req.body?.vehicles) ? req.body.vehicles : [];
    const existingKeys = new Set(dbState.vehicles.map((v) => v.plate_key));
    const existingIds = new Set(dbState.vehicles.map((v) => v.id));
    const added: VehicleRecord[] = [];
    const skipped: string[] = [];

    for (const item of rawVehicles) {
      if (!item || typeof item !== 'object') continue;
      const clean = sanitizeVehicle(item as Record<string, unknown>);
      if (!clean || clean.plate_key.length < 4) {
        skipped.push(String((item as Record<string, unknown>).plate || ''));
        continue;
      }
      if (existingKeys.has(clean.plate_key)) {
        skipped.push(clean.plate);
        continue;
      }
      if (existingIds.has(clean.id)) {
        clean.id = generateId('veh');
      }
      existingKeys.add(clean.plate_key);
      existingIds.add(clean.id);
      added.push(clean);
    }

    if (added.length === 0) {
      res.json({ ok: true, added: [], skipped, state: dbState });
      return;
    }

    const log: AuditLogRecord = {
      id: generateId('log'),
      timestamp: new Date().toISOString(),
      actor: req.caller!.actorName,
      action: 'CREATE',
      entity: 'vehicle',
      summary: `Admin nạp danh sách ${added.length} biển số xe mới`,
      details:
        added
          .map((v) => v.plate)
          .slice(0, 8)
          .join(', ') + (added.length > 8 ? '...' : ''),
    };

    const state = commitMutation((prev) => ({
      ...prev,
      vehicles: [...added, ...prev.vehicles],
      auditLogs: [log, ...prev.auditLogs],
    }));

    res.status(201).json({ ok: true, added, skipped, state });
  }
);

// 11. UPDATE VEHICLE (Admin ONLY)
app.patch(
  '/api/fleet/vehicles/:id',
  requireAuth,
  requireAdmin,
  (req: AuthedRequest, res: Response) => {
    if (!dbState) {
      res.status(503).json({ error: 'Cơ sở dữ liệu chưa được khởi tạo.' });
      return;
    }

    const vehicleId = safeString(req.params.id, 64);
    const target = dbState.vehicles.find((v) => v.id === vehicleId);
    if (!target) {
      res.status(404).json({ ok: false, error: 'Không tìm thấy xe.' });
      return;
    }

    const updates = (req.body?.updates || req.body || {}) as Record<string, unknown>;
    const nextPlate =
      typeof updates.plate === 'string' && updates.plate.trim()
        ? formatVietnamesePlate(updates.plate)
        : target.plate;
    const nextPlateKey = normalizePlateKey(nextPlate);

    if (
      nextPlateKey !== target.plate_key &&
      dbState.vehicles.some((v) => v.id !== vehicleId && v.plate_key === nextPlateKey)
    ) {
      res.status(409).json({ ok: false, error: `Biển số ${nextPlate} đã tồn tại.` });
      return;
    }

    const updated: VehicleRecord = {
      ...target,
      plate: nextPlate,
      plate_key: nextPlateKey,
      type:
        typeof updates.type === 'string' && updates.type.trim()
          ? safeString(updates.type, 80)
          : target.type,
      brand_model:
        typeof updates.brand_model === 'string'
          ? safeString(updates.brand_model, 120, target.brand_model)
          : target.brand_model,
      driver_name:
        typeof updates.driver_name === 'string'
          ? safeString(updates.driver_name, 100, target.driver_name)
          : target.driver_name,
      department:
        typeof updates.department === 'string' && updates.department.trim()
          ? safeString(updates.department, 80)
          : target.department,
      status:
        typeof updates.status === 'string' && updates.status.trim()
          ? safeString(updates.status, 40)
          : target.status,
      registration_due_date:
        typeof updates.registration_due_date === 'string' && updates.registration_due_date.trim()
          ? safeString(updates.registration_due_date, 20)
          : target.registration_due_date,
    };

    const log: AuditLogRecord = {
      id: generateId('log'),
      timestamp: new Date().toISOString(),
      actor: req.caller!.actorName,
      action: 'UPDATE',
      entity: 'vehicle',
      summary: `Cập nhật thông tin xe ${updated.plate}`,
      details: `Trạng thái: ${updated.status} · Km hiện tại: ${updated.current_km.toLocaleString('vi-VN')} km`,
    };

    const state = commitMutation((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v) => (v.id === vehicleId ? updated : v)),
      auditLogs: [log, ...prev.auditLogs],
    }));

    res.json({ ok: true, vehicle: updated, state });
  }
);

// 12. ASSIGN PO NUMBER TO ITEM (Admin ONLY)
app.patch(
  '/api/fleet/items/:id/po',
  requireAuth,
  requireAdmin,
  (req: AuthedRequest, res: Response) => {
    if (!dbState) {
      res.status(503).json({ error: 'Cơ sở dữ liệu chưa được khởi tạo.' });
      return;
    }

    const itemId = safeString(req.params.id, 64);
    const target = dbState.items.find((i) => i.id === itemId);
    if (!target) {
      res.status(404).json({ error: 'Không tìm thấy hạng mục.' });
      return;
    }

    const cleanPo = safeString(req.body?.poNumber, 60, '').toUpperCase();
    const log: AuditLogRecord = {
      id: generateId('log'),
      timestamp: new Date().toISOString(),
      actor: req.caller!.actorName,
      action: 'UPDATE',
      entity: 'item',
      summary: `Gán số PO "${cleanPo || 'Trống'}" cho hạng mục "${target.item_name}"`,
      details: `Thành tiền: ${formatVND(target.amount)}`,
    };

    const state = commitMutation((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === itemId ? { ...i, po_number: cleanPo } : i)),
      auditLogs: [log, ...prev.auditLogs],
    }));

    res.json({ ok: true, state });
  }
);

// 13. UPDATE MONTHLY BUDGET (Admin ONLY)
app.put('/api/fleet/budget', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
  if (!dbState) {
    res.status(503).json({ error: 'Cơ sở dữ liệu chưa được khởi tạo.' });
    return;
  }

  const nextBudget = Math.max(
    1_000_000,
    safeNonNegativeNumber(req.body?.monthlyBudget, dbState.monthlyBudget)
  );
  const log: AuditLogRecord = {
    id: generateId('log'),
    timestamp: new Date().toISOString(),
    actor: req.caller!.actorName,
    action: 'UPDATE',
    entity: 'system',
    summary: `Cập nhật ngân sách bảo dưỡng tháng thành ${formatVND(nextBudget)}`,
  };

  const state = commitMutation((prev) => ({
    ...prev,
    monthlyBudget: nextBudget,
    auditLogs: [log, ...prev.auditLogs],
  }));

  res.json({ ok: true, state });
});

// 14. UPDATE VISIBILITY & DASHBOARD BLOCK ORDER (Admin ONLY)
app.put(
  '/api/fleet/visibility',
  requireAuth,
  requireAdmin,
  (req: AuthedRequest, res: Response) => {
    if (!dbState) {
      res.status(503).json({ error: 'Cơ sở dữ liệu chưa được khởi tạo.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const hiddenReportTabs = Array.isArray(body.hiddenReportTabs)
      ? body.hiddenReportTabs.filter(
          (t): t is string =>
            typeof t === 'string' && VALID_APP_PAGES.has(t) && t !== 'dashboard'
        )
      : dbState.hiddenReportTabs;

    const hiddenDashboardBlocks = Array.isArray(body.hiddenDashboardBlocks)
      ? body.hiddenDashboardBlocks.filter(
          (b): b is string => typeof b === 'string' && VALID_DASHBOARD_BLOCKS.has(b)
        )
      : dbState.hiddenDashboardBlocks;

    const dashboardBlockOrder = body.dashboardBlockOrder
      ? normalizeBlockOrder(body.dashboardBlockOrder)
      : dbState.dashboardBlockOrder;

    const state = commitMutation((prev) => ({
      ...prev,
      hiddenReportTabs,
      hiddenDashboardBlocks,
      dashboardBlockOrder,
    }));

    res.json({ ok: true, state });
  }
);

// 15. EXCEL / CSV UPSERT IMPORT (Admin ONLY)
app.post('/api/fleet/import', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
  if (!dbState) {
    res.status(503).json({ error: 'Cơ sở dữ liệu chưa được khởi tạo.' });
    return;
  }

  const rawRows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const validRows = rawRows.filter(
    (r: unknown): r is Record<string, unknown> =>
      Boolean(r && typeof r === 'object' && (r as Record<string, unknown>).status !== 'error')
  );

  if (validRows.length === 0) {
    res.json({ ok: true, inserted: 0, updated: 0, createdVehicles: 0, state: dbState });
    return;
  }

  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;
  let createdVehicles = 0;

  const state = commitMutation((prev) => {
    const vehicles = [...prev.vehicles];
    const orders = [...prev.orders];
    const items = [...prev.items];
    const vehByPlateKey = new Map(vehicles.map((v) => [v.plate_key, v]));

    for (const row of validRows) {
      const formattedPlate = formatVietnamesePlate(String(row.plate || ''));
      const plateKey = normalizePlateKey(String(row.plate_key || formattedPlate));
      if (!plateKey) continue;

      const odometerKm = safeNonNegativeNumber(row.odometer_km, 0);
      const serviceDate = safeString(row.service_date, 20, REFERENCE_TODAY);
      const driverName = safeString(row.driver_name, 100, '');
      const garage = safeString(row.garage, 120, 'Chưa xác định');
      const serviceType = safeString(row.service_type, 60, 'Định kỳ');
      const note = safeString(row.note, 500, '');
      const itemName = safeString(row.item_name, 200);
      if (!itemName) continue;
      const poNumber = safeString(row.po_number, 60, '').toUpperCase();
      const category = safeString(row.category, 60, 'Khác') || 'Khác';
      const action = row.action === 'SỬA CHỮA' ? 'SỬA CHỮA' : 'THAY THẾ';
      const partName = safeString(row.part_name, 200, '');
      const quantity = Math.max(1, safeNonNegativeNumber(row.quantity, 1));
      const unitPrice = safeNonNegativeNumber(row.unit_price, 0);
      const amount = safeNonNegativeNumber(row.amount, unitPrice * quantity);

      let veh = vehByPlateKey.get(plateKey);
      if (!veh) {
        veh = {
          id: generateId('veh'),
          plate: formattedPlate,
          plate_key: plateKey,
          type: 'Xe bán tải',
          brand_model: 'Chưa cập nhật',
          driver_name: driverName || 'Chưa phân công',
          department: 'Văn Phòng HCM',
          status: 'Đang hoạt động',
          registration_due_date: addDaysISO(REFERENCE_TODAY, 180),
          current_km: odometerKm,
          service_interval_km: 10000,
          service_interval_days: 90,
          next_service_km: odometerKm ? odometerKm + 10000 : 0,
          next_service_date: addDaysISO(serviceDate, 90),
        };
        vehicles.push(veh);
        vehByPlateKey.set(plateKey, veh);
        createdVehicles += 1;
      } else if (odometerKm > veh.current_km) {
        const idx = vehicles.findIndex((v) => v.id === veh!.id);
        if (idx >= 0) {
          vehicles[idx] = { ...vehicles[idx], current_km: odometerKm };
          veh = vehicles[idx];
          vehByPlateKey.set(plateKey, veh);
        }
      }

      let order = orders.find(
        (o) => o.vehicle_id === veh!.id && o.service_date === serviceDate
      );
      if (!order) {
        order = {
          id: generateId('ord'),
          vehicle_id: veh.id,
          service_date: serviceDate,
          odometer_km: odometerKm,
          garage,
          driver_name: driverName || veh.driver_name,
          service_type: serviceType,
          note,
          created_at: now,
          updated_at: now,
        };
        orders.push(order);
      } else {
        const oIdx = orders.findIndex((o) => o.id === order!.id);
        orders[oIdx] = {
          ...order,
          odometer_km: odometerKm || order.odometer_km,
          garage: garage || order.garage,
          note: note || order.note,
          updated_at: now,
        };
        order = orders[oIdx];
      }

      const existingIdx = items.findIndex(
        (it) =>
          it.order_id === order!.id &&
          it.item_name.trim().toLowerCase() === itemName.toLowerCase() &&
          it.po_number.trim().toUpperCase() === poNumber
      );

      if (existingIdx >= 0) {
        items[existingIdx] = {
          ...items[existingIdx],
          category,
          action,
          part_name: partName,
          quantity,
          unit_price: unitPrice,
          amount,
        };
        updated += 1;
      } else {
        items.push({
          id: generateId('it'),
          order_id: order.id,
          category,
          item_name: itemName,
          action,
          part_name: partName,
          quantity,
          unit_price: unitPrice,
          amount,
          po_number: poNumber,
        });
        inserted += 1;
      }
    }

    const log: AuditLogRecord = {
      id: generateId('log'),
      timestamp: now,
      actor: req.caller!.actorName,
      action: 'IMPORT',
      entity: 'system',
      summary: `Nhập Excel/CSV (UPSERT): thêm mới ${inserted}, cập nhật ${updated} hạng mục`,
      details:
        createdVehicles > 0
          ? `Tự động tạo thêm ${createdVehicles} xe mới chưa có trong danh mục`
          : 'Khớp hoàn toàn với danh sách xe hiện có',
    };

    return {
      ...prev,
      vehicles,
      orders,
      items,
      auditLogs: [log, ...prev.auditLogs],
    };
  });

  res.json({ ok: true, inserted, updated, createdVehicles, state });
});

// 16. RESET DEMO DATA (Admin ONLY)
app.post('/api/fleet/reset', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
  if (!dbState) {
    res.status(503).json({ error: 'Cơ sở dữ liệu chưa được khởi tạo.' });
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  if (!Array.isArray(body.vehicles) || !Array.isArray(body.orders) || !Array.isArray(body.items)) {
    res.status(400).json({ error: 'Dữ liệu mẫu không hợp lệ.' });
    return;
  }

  const vehicles: VehicleRecord[] = [];
  for (const rawVeh of body.vehicles) {
    if (!rawVeh || typeof rawVeh !== 'object') continue;
    const clean = sanitizeVehicle(rawVeh as Record<string, unknown>);
    if (clean) vehicles.push(clean);
  }

  const orders: OrderRecord[] = [];
  for (const rawOrd of body.orders) {
    if (!rawOrd || typeof rawOrd !== 'object') continue;
    const o = rawOrd as Record<string, unknown>;
    const id = sanitizeClientId(o.id, 'ord') || generateId('ord');
    const vehicleId = safeString(o.vehicle_id, 64);
    const serviceDate = safeString(o.service_date, 20);
    if (!vehicleId || !serviceDate) continue;
    orders.push({
      id,
      vehicle_id: vehicleId,
      service_date: serviceDate,
      odometer_km: safeNonNegativeNumber(o.odometer_km, 0),
      service_interval_km:
        typeof o.service_interval_km === 'number' && o.service_interval_km >= 1000
          ? Math.round(o.service_interval_km)
          : undefined,
      garage: safeString(o.garage, 120, 'Chưa xác định'),
      driver_name: safeString(o.driver_name, 100, ''),
      service_type: safeString(o.service_type, 60, 'Định kỳ'),
      note: safeString(o.note, 500, ''),
      created_at: safeString(o.created_at, 40) || new Date().toISOString(),
      updated_at: safeString(o.updated_at, 40) || new Date().toISOString(),
    });
  }

  const items: ItemRecord[] = [];
  for (const rawIt of body.items) {
    if (!rawIt || typeof rawIt !== 'object') continue;
    const it = rawIt as Record<string, unknown>;
    const orderId = safeString(it.order_id, 64);
    if (!orderId) continue;
    const clean = sanitizeItem(it, orderId, true);
    if (clean) items.push(clean);
  }

  const now = new Date().toISOString();
  const seedLogs: AuditLogRecord[] = Array.isArray(body.auditLogs)
    ? body.auditLogs
        .filter((l): l is Record<string, unknown> => Boolean(l && typeof l === 'object'))
        .map((l) => ({
          id: sanitizeClientId(l.id, 'log') || generateId('log'),
          timestamp: safeString(l.timestamp, 40) || now,
          actor: safeString(l.actor, 100, 'Hệ thống'),
          action: safeString(l.action, 20, 'UPDATE'),
          entity: safeString(l.entity, 20, 'system'),
          summary: safeString(l.summary, 300, ''),
          details: typeof l.details === 'string' ? l.details.slice(0, 400) : undefined,
        }))
    : [];

  const resetLog: AuditLogRecord = {
    id: generateId('log'),
    timestamp: now,
    actor: req.caller!.actorName,
    action: 'UPDATE',
    entity: 'system',
    summary: `Khôi phục dữ liệu mẫu ban đầu (${vehicles.length} xe, ${orders.length} phiếu)`,
  };

  const state = commitMutation((prev) => ({
    ...prev,
    vehicles,
    orders,
    items,
    auditLogs: [resetLog, ...seedLogs],
  }));

  res.json({ ok: true, state });
});

// ==================== VITE DEV MIDDLEWARE / PROD STATIC ====================

async function startServer(): Promise<void> {
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[fleet-server] Running on http://0.0.0.0:${PORT} (${IS_PROD ? 'prod' : 'dev'})`);
  });
}

startServer().catch((err) => {
  console.error('[fleet-server] Fatal startup error:', err);
  process.exit(1);
});
