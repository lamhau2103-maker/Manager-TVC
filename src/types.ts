export type VehicleType = string;

export type VehicleStatus = 'Đang hoạt động' | 'Đang bảo dưỡng' | 'Ngưng';

export type ServiceType =
  | 'Định kỳ'
  | 'Sửa chữa đột xuất'
  | 'Tai nạn'
  | 'Kiểm định';

export type MaintenanceCategory =
  | 'Động cơ'
  | 'Phanh'
  | 'Lốp'
  | 'Hệ thống điện'
  | 'Gầm-treo'
  | 'Dầu nhớt-lọc'
  | 'Thân vỏ'
  | 'Điều hòa'
  | 'Khác';

export type MaintenanceAction = 'SỬA CHỮA' | 'THAY THẾ';

export interface Vehicle {
  id: string;
  plate: string;
  plate_key: string;
  type: VehicleType;
  brand_model: string;
  year?: number;
  driver_name: string;
  department: string;
  status: VehicleStatus;
  registration_due_date: string; // YYYY-MM-DD (Ngày hạn cuối đăng kiểm)
  // Operational tracking fields updated automatically via maintenance orders
  current_km: number;
  service_interval_km: number;
  service_interval_days: number;
  next_service_km: number;
  next_service_date: string; // YYYY-MM-DD
}

export interface MaintenanceOrder {
  id: string;
  vehicle_id: string;
  service_date: string; // YYYY-MM-DD
  odometer_km: number;
  service_interval_km?: number; // Chu kỳ km/lần ghi nhận theo phiếu
  garage: string;
  driver_name: string;
  service_type: ServiceType;
  note: string;
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface MaintenanceItem {
  id: string;
  order_id: string;
  category: MaintenanceCategory;
  item_name: string;
  action: MaintenanceAction;
  part_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  po_number: string; // Empty string if missing PO
}

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO
  actor: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT';
  entity: 'vehicle' | 'order' | 'item' | 'system';
  summary: string;
  details?: string;
}

export type PeriodPreset = 'month' | 'quarter' | 'year' | 'custom';

export interface GlobalFilters {
  periodPreset: PeriodPreset;
  selectedMonth: string; // YYYY-MM, e.g. '2026-11'
  customStartDate: string; // YYYY-MM-DD
  customEndDate: string; // YYYY-MM-DD
  plateKey: string; // '' = all
  vehicleType: string; // '' = all
  department: string; // '' = all
  garage: string; // '' = all
  category: string; // '' = all
  serviceType: string; // '' = all
  action: '' | MaintenanceAction;
  poNumber: string; // '' = all, '__MISSING__' = missing PO
  searchQuery: string;
}

export type AppPage = 'dashboard' | 'orders' | 'vehicles' | 'po' | 'settings';

export type DashboardBlockId =
  | 'monthly_status'
  | 'alerts'
  | 'charts'
  | 'orders_table';

export interface EnrichedOrder extends MaintenanceOrder {
  vehicle?: Vehicle;
  items: MaintenanceItem[];
  totalAmount: number;
  poNumbers: string[];
  hasMissingPo: boolean;
  repairCount: number;
  replaceCount: number;
}

export const VEHICLE_TYPE_PRESETS: string[] = [
  'Xe 4 chỗ',
  'Xe 7 chỗ',
  'Xe 16 chỗ',
  'Xe bán tải',
];

export const VEHICLE_TYPES: string[] = [
  'Xe 4 chỗ',
  'Xe 7 chỗ',
  'Xe 16 chỗ',
  'Xe bán tải',
];

export const VEHICLE_STATUSES: VehicleStatus[] = [
  'Đang hoạt động',
  'Đang bảo dưỡng',
  'Ngưng',
];

export const SERVICE_TYPES: ServiceType[] = [
  'Định kỳ',
  'Sửa chữa đột xuất',
  'Tai nạn',
  'Kiểm định',
];

export const MAINTENANCE_CATEGORIES: MaintenanceCategory[] = [
  'Động cơ',
  'Phanh',
  'Lốp',
  'Hệ thống điện',
  'Gầm-treo',
  'Dầu nhớt-lọc',
  'Thân vỏ',
  'Điều hòa',
  'Khác',
];

export const DEPARTMENTS = [
  'Vận tải Miền Nam',
  'Kho vận Bình Dương',
  'Cảng Đồng Nai',
  'Vận tải Miền Bắc',
  'Vận tải Miền Trung',
  'Hành chính - Điều phối',
];

export const DEFAULT_GARAGES = [
  'Gara Thành Công Auto',
  'Xưởng Dịch Vụ Hino Sài Gòn',
  'Trung tâm Bảo dưỡng Isuzu Bình Dương',
  'Gara Đầu Kéo Mỹ Phước',
  'Xưởng Lốp & Gầm Đồng Nai',
  'Gara Đại Phát Miền Bắc',
  'Trạm Dịch vụ Hyundai Đà Nẵng',
];
