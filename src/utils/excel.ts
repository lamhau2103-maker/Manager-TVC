import * as XLSX from 'xlsx';
import {
  EnrichedOrder,
  MAINTENANCE_CATEGORIES,
  MaintenanceAction,
  MaintenanceCategory,
  MaintenanceItem,
  MaintenanceOrder,
  SERVICE_TYPES,
  ServiceType,
  Vehicle,
} from '../types';
import { formatDateVN, formatVND } from './format';
import { formatVietnamesePlate, isValidVietnamesePlate, normalizePlateKey } from './plate';

/**
 * Export full multi-sheet Excel report (.xlsx) reflecting current filtered data.
 */
export function exportReportToExcel(
  periodLabel: string,
  enrichedOrders: EnrichedOrder[],
  vehicles: Vehicle[]
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Chi tiết hạng mục & PO (most important for accounting & UPSERT re-import)
  const itemRows = enrichedOrders.flatMap((ord) =>
    ord.items.map((it) => ({
      'Biển số': ord.vehicle?.plate ?? '',
      'Loại xe': ord.vehicle?.type ?? '',
      'Bộ phận': ord.vehicle?.department ?? '',
      'Ngày bảo dưỡng': ord.service_date,
      'Số km': ord.odometer_km,
      'Gara / Xưởng': ord.garage,
      'Tài xế': ord.driver_name,
      'Loại bảo dưỡng': ord.service_type,
      'Nhóm hạng mục': it.category,
      'Tên hạng mục': it.item_name,
      'Hành động': it.action,
      'Phụ tùng thay': it.part_name,
      'Số lượng': it.quantity,
      'Đơn giá (VNĐ)': it.unit_price,
      'Thành tiền (VNĐ)': it.amount,
      'Số PO': it.po_number || '',
      'Ghi chú phiếu': ord.note,
    }))
  );
  const wsItems = XLSX.utils.json_to_sheet(
    itemRows.length > 0
      ? itemRows
      : [{ 'Thông báo': 'Không có dữ liệu phù hợp bộ lọc hiện tại' }]
  );
  XLSX.utils.book_append_sheet(wb, wsItems, 'ChiTiet_HangMuc_PO');

  // Sheet 2: Danh sách phiếu bảo dưỡng
  const orderRows = enrichedOrders.map((ord) => ({
    'Mã phiếu': ord.id,
    'Ngày bảo dưỡng': formatDateVN(ord.service_date),
    'Biển số': ord.vehicle?.plate ?? '',
    'Loại xe': ord.vehicle?.type ?? '',
    'Tài xế': ord.driver_name,
    'Số km': ord.odometer_km,
    'Gara / Xưởng': ord.garage,
    'Loại bảo dưỡng': ord.service_type,
    'Số hạng mục': ord.items.length,
    'Danh sách PO': ord.poNumbers.join(', ') || 'Chưa có PO',
    'Tổng chi phí (VNĐ)': ord.totalAmount,
    'Tổng tiền hiển thị': formatVND(ord.totalAmount),
    'Ghi chú': ord.note,
  }));
  const wsOrders = XLSX.utils.json_to_sheet(
    orderRows.length > 0 ? orderRows : [{ 'Thông báo': 'Không có phiếu bảo dưỡng' }]
  );
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Phieu_Bao_Duong');

  // Sheet 3: Danh sách đội xe
  const vehicleRows = vehicles.map((v) => ({
    'Biển số': v.plate,
    'Plate Key': v.plate_key,
    'Loại xe': v.type,
    'Hãng / Model': v.brand_model,
    'Tài xế': v.driver_name,
    'Bộ phận': v.department,
    'Trạng thái': v.status,
    'Hạn cuối đăng kiểm': v.registration_due_date ? formatDateVN(v.registration_due_date) : '—',
    'Km hiện tại': v.current_km,
    'Chu kỳ km/lần': v.service_interval_km,
    'Hạn km tiếp theo': v.next_service_km,
    'Hạn ngày tiếp theo': v.next_service_date ? formatDateVN(v.next_service_date) : '—',
  }));
  const wsVehicles = XLSX.utils.json_to_sheet(vehicleRows);
  XLSX.utils.book_append_sheet(wb, wsVehicles, 'Danh_Sach_Xe');

  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `BaoCao_BaoDuong_DoiXe_${safePeriod}.xlsx`);
}

/**
 * Download an Excel import template with realistic example rows (including multi-PO order).
 */
export function downloadImportTemplate() {
  const sampleRows = [
    {
      'Biển số': '61C-123.45',
      'Ngày bảo dưỡng': '2026-11-23',
      'Số km': 249200,
      'Gara / Xưởng': 'Gara Đầu Kéo Mỹ Phước',
      'Tài xế': 'Nguyễn Văn Hùng',
      'Loại bảo dưỡng': 'Định kỳ',
      'Nhóm hạng mục': 'Dầu nhớt-lọc',
      'Tên hạng mục': 'Thay nhớt động cơ 15W-40',
      'Hành động': 'THAY THẾ',
      'Phụ tùng thay': 'Nhớt Shell Rimula R4 X (40L)',
      'Số lượng': 1,
      'Đơn giá': 5400000,
      'Thành tiền': 5400000,
      'Số PO': 'PO-2026-1125',
      'Ghi chú': 'Phiếu mẫu nhập hàng loạt',
    },
    {
      'Biển số': '61C-123.45',
      'Ngày bảo dưỡng': '2026-11-23',
      'Số km': 249200,
      'Gara / Xưởng': 'Gara Đầu Kéo Mỹ Phước',
      'Tài xế': 'Nguyễn Văn Hùng',
      'Loại bảo dưỡng': 'Định kỳ',
      'Nhóm hạng mục': 'Phanh',
      'Tên hạng mục': 'Căn chỉnh bầu phanh hơi',
      'Hành động': 'SỬA CHỮA',
      'Phụ tùng thay': 'Công kỹ thuật',
      'Số lượng': 1,
      'Đơn giá': 1200000,
      'Thành tiền': 1200000,
      'Số PO': 'PO-2026-1126',
      'Ghi chú': 'Phiếu mẫu nhập hàng loạt',
    },
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_BaoDuong');
  XLSX.writeFile(wb, 'Mau_Nhap_BaoDuong_DoiXe.xlsx');
}

export interface ParsedImportRow {
  rowIndex: number;
  plate: string;
  plate_key: string;
  service_date: string;
  odometer_km: number;
  garage: string;
  driver_name: string;
  service_type: ServiceType;
  category: MaintenanceCategory;
  item_name: string;
  action: MaintenanceAction;
  part_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  po_number: string;
  note: string;
  status: 'valid' | 'warning' | 'error';
  upsertMode: 'insert' | 'update';
  messages: string[];
}

function normalizeDateInput(raw: unknown): string {
  if (typeof raw === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  const str = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const vnMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (vnMatch) {
    return `${vnMatch[3]}-${vnMatch[2].padStart(2, '0')}-${vnMatch[1].padStart(2, '0')}`;
  }
  return '';
}

function pickField(row: Record<string, unknown>, keys: string[]): unknown {
  const lowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    lowerMap.set(k.trim().toLowerCase(), v);
  }
  for (const k of keys) {
    const val = lowerMap.get(k.toLowerCase());
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return val;
    }
  }
  return '';
}

export async function parseImportFile(
  file: File,
  vehicles: Vehicle[],
  existingOrders: MaintenanceOrder[],
  existingItems: MaintenanceItem[]
): Promise<ParsedImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  const vehByPlateKey = new Map(vehicles.map((v) => [v.plate_key, v]));
  const orderById = new Map(existingOrders.map((o) => [o.id, o]));

  // Build UPSERT lookup set: plate_key + service_date + item_name + po_number
  const existingKeys = new Set<string>();
  for (const it of existingItems) {
    const ord = orderById.get(it.order_id);
    if (!ord) continue;
    const veh = vehicles.find((v) => v.id === ord.vehicle_id);
    if (!veh) continue;
    const key = [
      veh.plate_key,
      ord.service_date,
      it.item_name.trim().toLowerCase(),
      it.po_number.trim().toUpperCase(),
    ].join('|');
    existingKeys.add(key);
  }

  return rawRows.map((row, idx) => {
    const rawPlate = String(pickField(row, ['Biển số', 'plate', 'bien_so', 'Biển số xe']) || '');
    const plate = formatVietnamesePlate(rawPlate);
    const plate_key = normalizePlateKey(plate);
    const service_date = normalizeDateInput(
      pickField(row, ['Ngày bảo dưỡng', 'service_date', 'ngay', 'Ngày'])
    );
    const odometer_km = Number(
      String(pickField(row, ['Số km', 'odometer_km', 'km']) || '0').replace(/[^0-9.-]/g, '')
    );
    const garage = String(
      pickField(row, ['Gara / Xưởng', 'Gara', 'garage', 'Xưởng']) || 'Chưa xác định'
    ).trim();
    const existingVeh = vehByPlateKey.get(plate_key);
    const driver_name = String(
      pickField(row, ['Tài xế', 'driver_name', 'tai_xe']) || existingVeh?.driver_name || ''
    ).trim();

    const rawServiceType = String(
      pickField(row, ['Loại bảo dưỡng', 'service_type']) || 'Định kỳ'
    ).trim();
    const service_type: ServiceType = (SERVICE_TYPES.find(
      (s) => s.toLowerCase() === rawServiceType.toLowerCase()
    ) ?? 'Định kỳ') as ServiceType;

    const rawCat = String(
      pickField(row, ['Nhóm hạng mục', 'category', 'Nhóm']) || 'Khác'
    ).trim();
    const category: MaintenanceCategory = (MAINTENANCE_CATEGORIES.find(
      (c) => c.toLowerCase() === rawCat.toLowerCase()
    ) ?? 'Khác') as MaintenanceCategory;

    const item_name = String(
      pickField(row, ['Tên hạng mục', 'item_name', 'Hạng mục']) || ''
    ).trim();

    const rawAction = String(
      pickField(row, ['Hành động', 'action']) || 'THAY THẾ'
    )
      .trim()
      .toUpperCase();
    const action: MaintenanceAction =
      rawAction.includes('SỬA') || rawAction.includes('SUA') ? 'SỬA CHỮA' : 'THAY THẾ';

    const part_name = String(
      pickField(row, ['Phụ tùng thay', 'part_name', 'Phụ tùng']) || ''
    ).trim();

    const quantity = Number(
      String(pickField(row, ['Số lượng', 'quantity', 'SL']) || '1').replace(/[^0-9.]/g, '')
    );
    const unit_price = Number(
      String(pickField(row, ['Đơn giá', 'Đơn giá (VNĐ)', 'unit_price']) || '0').replace(
        /[^0-9.-]/g,
        ''
      )
    );
    const rawAmount = pickField(row, ['Thành tiền', 'Thành tiền (VNĐ)', 'amount']);
    const amount =
      rawAmount !== ''
        ? Number(String(rawAmount).replace(/[^0-9.-]/g, ''))
        : Math.round(quantity * unit_price);

    const po_number = String(pickField(row, ['Số PO', 'po_number', 'PO']) || '')
      .trim()
      .toUpperCase();
    const note = String(pickField(row, ['Ghi chú', 'Ghi chú phiếu', 'note']) || '').trim();

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!plate_key) errors.push('Thiếu biển số xe');
    if (!service_date) errors.push('Ngày bảo dưỡng không hợp lệ (dùng YYYY-MM-DD hoặc dd/MM/yyyy)');
    if (!item_name) errors.push('Thiếu tên hạng mục');
    if (!Number.isFinite(quantity) || quantity <= 0) errors.push('Số lượng phải > 0');
    if (!Number.isFinite(unit_price) || unit_price < 0) errors.push('Đơn giá không hợp lệ');

    if (plate && !isValidVietnamesePlate(plate)) {
      warnings.push('Biển số chưa đúng định dạng chuẩn (vẫn có thể nhập)');
    }
    if (plate_key && !existingVeh) {
      warnings.push('Biển số mới — hệ thống sẽ tự tạo hồ sơ xe');
    }
    if (existingVeh && odometer_km > 0 && odometer_km < existingVeh.current_km) {
      warnings.push(
        `Số km (${odometer_km.toLocaleString('vi-VN')}) nhỏ hơn km hiện tại của xe (${existingVeh.current_km.toLocaleString('vi-VN')})`
      );
    }
    if (odometer_km <= 0) {
      warnings.push('Thiếu số km công-tơ-mét');
    }
    if (!po_number) {
      warnings.push('Thiếu số PO');
    }
    if (Math.abs(amount - quantity * unit_price) > 1) {
      warnings.push('Thành tiền lệch với Số lượng × Đơn giá');
    }

    const upsertKey = [plate_key, service_date, item_name.toLowerCase(), po_number].join('|');
    const upsertMode: 'insert' | 'update' = existingKeys.has(upsertKey) ? 'update' : 'insert';
    if (upsertMode === 'update') {
      warnings.push('Trùng khóa (Biển số + Ngày + Hạng mục + PO) → Sẽ CẬP NHẬT bản ghi cũ');
    }

    const status: ParsedImportRow['status'] =
      errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';

    return {
      rowIndex: idx + 2,
      plate,
      plate_key,
      service_date,
      odometer_km: Number.isFinite(odometer_km) ? odometer_km : 0,
      garage,
      driver_name,
      service_type,
      category,
      item_name,
      action,
      part_name,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      unit_price: Number.isFinite(unit_price) ? unit_price : 0,
      amount: Number.isFinite(amount) ? amount : 0,
      po_number,
      note,
      status,
      upsertMode,
      messages: [...errors, ...warnings],
    };
  });
}
