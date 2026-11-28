import {
  MaintenanceAction,
  MaintenanceCategory,
  MaintenanceItem,
  MaintenanceOrder,
  ServiceType,
  Vehicle,
} from '../types';
import { getCurrentYearMonth, getPreviousMonth } from './format';
import { normalizePlateKey } from './plate';

export interface DemoDataset {
  vehicles: Vehicle[];
  orders: MaintenanceOrder[];
  items: MaintenanceItem[];
}

const DEMO_BASE_VEHICLES: Vehicle[] = [
  {
    id: '93LD-006.68',
    plate: '93LD-006.68',
    plate_key: normalizePlateKey('93LD-006.68'),
    type: 'Xe 16 chỗ',
    brand_model: 'Ford Transit Luxury',
    driver_id: null,
    driver_name: 'Nguyễn Văn Thảo',
    department: 'Văn Phòng Bình Phước',
    status: 'Đang hoạt động',
    registration_due_date: '2027-05-24',
    current_km: 142500,
    service_interval_km: 10000,
    service_interval_days: 90,
    next_service_km: 150000,
    next_service_date: '',
  },
  {
    id: '93LD-004.23',
    plate: '93LD-004.23',
    plate_key: normalizePlateKey('93LD-004.23'),
    type: 'Xe 7 chỗ',
    brand_model: 'Toyota Innova Cross',
    driver_id: null,
    driver_name: 'Lâm Phúc Hậu',
    department: 'Văn Phòng Bình Phước',
    status: 'Đang hoạt động',
    registration_due_date: '2027-05-24',
    current_km: 88200,
    service_interval_km: 10000,
    service_interval_days: 90,
    next_service_km: 95000,
    next_service_date: '',
  },
  {
    id: '93LD-004.46',
    plate: '93LD-004.46',
    plate_key: normalizePlateKey('93LD-004.46'),
    type: 'Xe 7 chỗ',
    brand_model: 'Mitsubishi Xpander',
    driver_id: null,
    driver_name: 'Lê Quang Bé',
    department: 'Văn Phòng Bình Phước',
    status: 'Đang hoạt động',
    registration_due_date: '2027-05-24',
    current_km: 69400,
    service_interval_km: 10000,
    service_interval_days: 90,
    next_service_km: 70150,
    next_service_date: '',
  },
];

function buildDayDate(yearMonth: string, dayNum: number): string {
  const [yStr, mStr] = yearMonth.split('-');
  const y = Number(yStr) || 2026;
  const m = Number(mStr) || 11;
  const maxDay = new Date(y, m, 0).getDate();
  const safeDay = Math.min(Math.max(1, dayNum), maxDay);
  return `${yStr}-${mStr.padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

/**
 * Generates an in-memory demo dataset anchored to the active month + 5 prior months
 * for presentation / dashboard preview without touching Supabase.
 */
export function buildDemoDataset(
  realVehicles: Vehicle[],
  anchorMonth: string = getCurrentYearMonth()
): DemoDataset {
  const byPlateKey = new Map<string, Vehicle>();
  for (const v of realVehicles) {
    byPlateKey.set(v.plate_key, { ...v });
  }
  for (const base of DEMO_BASE_VEHICLES) {
    if (!byPlateKey.has(base.plate_key)) {
      byPlateKey.set(base.plate_key, { ...base });
    }
  }

  const demoVehicles = Array.from(byPlateKey.values()).map((v, idx) => ({
    ...v,
    current_km: v.current_km > 0 ? v.current_km : 72000 + idx * 18500,
    service_interval_km: v.service_interval_km > 0 ? v.service_interval_km : 10000,
    next_service_km: v.next_service_km > 0 ? v.next_service_km : 80000 + idx * 18500,
  }));

  const primary =
    demoVehicles.find((v) => v.plate === '93LD-006.68') ?? demoVehicles[0];
  const secondary =
    demoVehicles.find((v) => v.plate === '93LD-004.23') ??
    demoVehicles[1] ??
    primary;
  const tertiary =
    demoVehicles.find((v) => v.plate === '93LD-004.46') ??
    demoVehicles[2] ??
    secondary;

  const orders: MaintenanceOrder[] = [];
  const items: MaintenanceItem[] = [];

  const pushDemoOrder = (spec: {
    id: string;
    vehicle: Vehicle;
    service_date: string;
    odometer_km: number;
    garage: string;
    service_type: ServiceType;
    note: string;
    lineItems: Array<{
      category: MaintenanceCategory;
      item_name: string;
      action: MaintenanceAction;
      part_name: string;
      quantity: number;
      unit_price: number;
      po_number: string;
    }>;
  }) => {
    const iso = `${spec.service_date}T09:00:00.000Z`;
    orders.push({
      id: spec.id,
      vehicle_id: spec.vehicle.id,
      service_date: spec.service_date,
      odometer_km: spec.odometer_km,
      service_interval_km: spec.vehicle.service_interval_km || 10000,
      garage: spec.garage,
      driver_name: spec.vehicle.driver_name || 'Tài xế đội xe',
      service_type: spec.service_type,
      note: spec.note,
      created_at: iso,
      updated_at: iso,
    });

    spec.lineItems.forEach((it, idx) => {
      items.push({
        id: `${spec.id}_it_${idx + 1}`,
        order_id: spec.id,
        category: it.category,
        item_name: it.item_name,
        action: it.action,
        part_name: it.part_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        amount: Math.round(it.quantity * it.unit_price),
        po_number: it.po_number,
      });
    });
  };

  // Current anchor month: rich daily cadence & category diversity
  pushDemoOrder({
    id: 'demo_ord_cur_1',
    vehicle: primary,
    service_date: buildDayDate(anchorMonth, 3),
    odometer_km: 139200,
    garage: 'Gara Thành Công Auto',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng định kỳ 140.000 km · Thay dầu tổng hợp & lọc nhớt',
    lineItems: [
      {
        category: 'Dầu nhớt-lọc',
        item_name: 'Thay nhớt động cơ tổng hợp 10W-40',
        action: 'THAY THẾ',
        part_name: 'Shell Rimula R5 10W-40 (8L)',
        quantity: 1,
        unit_price: 2450000,
        po_number: 'PO-2026-8801',
      },
      {
        category: 'Dầu nhớt-lọc',
        item_name: 'Thay lọc nhớt & lọc gió động cơ',
        action: 'THAY THẾ',
        part_name: 'Bộ lọc chính hãng Ford',
        quantity: 2,
        unit_price: 680000,
        po_number: 'PO-2026-8801',
      },
    ],
  });

  pushDemoOrder({
    id: 'demo_ord_cur_2',
    vehicle: secondary,
    service_date: buildDayDate(anchorMonth, 8),
    odometer_km: 86800,
    garage: 'Xưởng Lốp & Gầm Đồng Nai',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay cặp lốp trước Michelin & cân chỉnh thước lái',
    lineItems: [
      {
        category: 'Lốp',
        item_name: 'Thay lốp Michelin Primacy 215/60R17',
        action: 'THAY THẾ',
        part_name: 'Michelin Primacy 4',
        quantity: 2,
        unit_price: 3450000,
        po_number: 'PO-2026-8802',
      },
      {
        category: 'Gầm-treo',
        item_name: 'Cân chỉnh độ chụm & rô-tuyn lái',
        action: 'SỬA CHỮA',
        part_name: 'Công cân bằng động laser',
        quantity: 1,
        unit_price: 950000,
        po_number: 'PO-2026-8802',
      },
    ],
  });

  pushDemoOrder({
    id: 'demo_ord_cur_3',
    vehicle: primary,
    service_date: buildDayDate(anchorMonth, 14),
    odometer_km: 140900,
    garage: 'Gara Thành Công Auto',
    service_type: 'Sửa chữa đột xuất',
    note: 'Bảo trì hệ thống phanh trước và máy phát điện',
    lineItems: [
      {
        category: 'Phanh',
        item_name: 'Thay má phanh trước & láng đĩa phanh',
        action: 'THAY THẾ',
        part_name: 'Bộ bố thắng Bosch Ceramic',
        quantity: 1,
        unit_price: 2850000,
        po_number: 'PO-2026-8803',
      },
      {
        category: 'Hệ thống điện',
        item_name: 'Kiểm tra và thay chổi than củ đề',
        action: 'SỬA CHỮA',
        part_name: 'Bộ chổi than Denso',
        quantity: 1,
        unit_price: 1650000,
        po_number: 'PO-2026-8803',
      },
    ],
  });

  pushDemoOrder({
    id: 'demo_ord_cur_4',
    vehicle: secondary,
    service_date: buildDayDate(anchorMonth, 20),
    odometer_km: 88200,
    garage: 'Trung tâm Bảo dưỡng Isuzu Bình Dương',
    service_type: 'Định kỳ',
    note: 'Vệ sinh dàn lạnh điều hòa và bảo dưỡng kim phun',
    lineItems: [
      {
        category: 'Điều hòa',
        item_name: 'Nạp gas R134a & vệ sinh dàn lạnh kép',
        action: 'SỬA CHỮA',
        part_name: 'Gas lạnh Dupont R134a',
        quantity: 1,
        unit_price: 1450000,
        po_number: 'PO-2026-8804',
      },
      {
        category: 'Động cơ',
        item_name: 'Vệ sinh kim phun & thay dây curoa tổng',
        action: 'THAY THẾ',
        part_name: 'Dây curoa Bando 6PK',
        quantity: 1,
        unit_price: 3200000,
        po_number: '',
      },
    ],
  });

  pushDemoOrder({
    id: 'demo_ord_cur_5',
    vehicle: primary,
    service_date: buildDayDate(anchorMonth, 25),
    odometer_km: 142500,
    garage: 'Xưởng Lốp & Gầm Đồng Nai',
    service_type: 'Định kỳ',
    note: 'Thay ắc quy khô 90Ah & đảo lốp định kỳ',
    lineItems: [
      {
        category: 'Hệ thống điện',
        item_name: 'Thay bình ắc quy GS 90Ah',
        action: 'THAY THẾ',
        part_name: 'GS MF 105D31R',
        quantity: 1,
        unit_price: 2750000,
        po_number: 'PO-2026-8804',
      },
      {
        category: 'Lốp',
        item_name: 'Đảo lốp & vá nấm lốp sau',
        action: 'SỬA CHỮA',
        part_name: 'Vật tư vá nấm chuyên dụng',
        quantity: 2,
        unit_price: 350000,
        po_number: 'PO-2026-8804',
      },
    ],
  });

  // Prior 5 months so M-1..M-5 comparison, 6-month trend & Top Vehicles are populated
  const priorSpecs: Array<{
    offset: number;
    day: number;
    vehicle: Vehicle;
    km: number;
    garage: string;
    serviceType: ServiceType;
    cat: MaintenanceCategory;
    item: string;
    action: MaintenanceAction;
    amount: number;
    po: string;
  }> = [
    {
      offset: 1,
      day: 6,
      vehicle: primary,
      km: 135100,
      garage: 'Gara Thành Công Auto',
      serviceType: 'Định kỳ',
      cat: 'Dầu nhớt-lọc',
      item: 'Thay nhớt động cơ & lọc nhiên liệu',
      action: 'THAY THẾ',
      amount: 4200000,
      po: 'PO-2026-8710',
    },
    {
      offset: 1,
      day: 16,
      vehicle: tertiary,
      km: 68100,
      garage: 'Xưởng Lốp & Gầm Đồng Nai',
      serviceType: 'Sửa chữa đột xuất',
      cat: 'Lốp',
      item: 'Thay 2 lốp sau Bridgestone & cân mâm',
      action: 'THAY THẾ',
      amount: 6400000,
      po: 'PO-2026-8715',
    },
    {
      offset: 1,
      day: 24,
      vehicle: secondary,
      km: 84300,
      garage: 'Trung tâm Bảo dưỡng Isuzu Bình Dương',
      serviceType: 'Sửa chữa đột xuất',
      cat: 'Động cơ',
      item: 'Thay bơm nước làm mát & súc két nước',
      action: 'THAY THẾ',
      amount: 5150000,
      po: 'PO-2026-8719',
    },
    {
      offset: 2,
      day: 12,
      vehicle: primary,
      km: 131400,
      garage: 'Gara Thành Công Auto',
      serviceType: 'Định kỳ',
      cat: 'Phanh',
      item: 'Thay bố thắng sau & dầu phanh DOT4',
      action: 'THAY THẾ',
      amount: 7850000,
      po: 'PO-2026-8622',
    },
    {
      offset: 2,
      day: 21,
      vehicle: tertiary,
      km: 65900,
      garage: 'Gara Thành Công Auto',
      serviceType: 'Định kỳ',
      cat: 'Dầu nhớt-lọc',
      item: 'Bảo dưỡng định kỳ 65.000 km',
      action: 'THAY THẾ',
      amount: 3650000,
      po: 'PO-2026-8628',
    },
    {
      offset: 3,
      day: 10,
      vehicle: secondary,
      km: 81000,
      garage: 'Xưởng Lốp & Gầm Đồng Nai',
      serviceType: 'Sửa chữa đột xuất',
      cat: 'Gầm-treo',
      item: 'Thay cặp phuộc giảm xóc trước',
      action: 'THAY THẾ',
      amount: 9200000,
      po: 'PO-2026-8511',
    },
    {
      offset: 4,
      day: 18,
      vehicle: primary,
      km: 126800,
      garage: 'Trung tâm Bảo dưỡng Isuzu Bình Dương',
      serviceType: 'Định kỳ',
      cat: 'Động cơ',
      item: 'Đại tu cụm ly hợp & thay lá côn bàn ép',
      action: 'THAY THẾ',
      amount: 14600000,
      po: 'PO-2026-8405',
    },
    {
      offset: 5,
      day: 14,
      vehicle: tertiary,
      km: 61500,
      garage: 'Gara Thành Công Auto',
      serviceType: 'Kiểm định',
      cat: 'Điều hòa',
      item: 'Bảo dưỡng lốc lạnh & vệ sinh hệ thống gió',
      action: 'SỬA CHỮA',
      amount: 5400000,
      po: 'PO-2026-8309',
    },
  ];

  priorSpecs.forEach((p, idx) => {
    const ym = getPreviousMonth(anchorMonth, p.offset);
    pushDemoOrder({
      id: `demo_ord_prev_${idx + 1}`,
      vehicle: p.vehicle,
      service_date: buildDayDate(ym, p.day),
      odometer_km: p.km,
      garage: p.garage,
      service_type: p.serviceType,
      note: `Dữ liệu minh họa kỳ ${ym}`,
      lineItems: [
        {
          category: p.cat,
          item_name: p.item,
          action: p.action,
          part_name: 'Phụ tùng tiêu chuẩn OEM',
          quantity: 1,
          unit_price: p.amount,
          po_number: p.po,
        },
      ],
    });
  });

  return {
    vehicles: demoVehicles,
    orders,
    items,
  };
}
