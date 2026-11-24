import {
  AuditLogEntry,
  MaintenanceCategory,
  MaintenanceItem,
  MaintenanceOrder,
  Vehicle,
} from '../types';
import { normalizePlateKey } from '../utils/plate';

// Reference "today" date aligned with current workspace time: 2026-11-23
export const REFERENCE_TODAY = '2026-11-23';

export const SEED_VEHICLES: Vehicle[] = [
  {
    id: 'veh_01',
    plate: '61C-123.45',
    plate_key: normalizePlateKey('61C-123.45'),
    type: 'Đầu kéo',
    brand_model: 'Freightliner Cascadia 2021',
    driver_name: 'Nguyễn Văn Hùng',
    department: 'Kho vận Bình Dương',
    status: 'Đang hoạt động',
    registration_due_date: '2027-04-18',
    current_km: 248600,
    service_interval_km: 15000,
    service_interval_days: 90,
    next_service_km: 260000,
    next_service_date: '2027-01-15',
  },
  {
    id: 'veh_02',
    plate: '51D-678.90',
    plate_key: normalizePlateKey('51D-678.90'),
    type: 'Xe 16 chỗ',
    brand_model: 'Ford Transit 16 chỗ',
    driver_name: 'Trần Minh Tuấn',
    department: 'Vận tải Miền Nam',
    status: 'Đang hoạt động',
    registration_due_date: '2026-11-19', // QUÁ HẠN ĐĂNG KIỂM (4 ngày)
    current_km: 141250,
    service_interval_km: 10000,
    service_interval_days: 90,
    next_service_km: 140000, // QUÁ KM (+1.250 km)
    next_service_date: '2026-11-12',
  },
  {
    id: 'veh_03',
    plate: '60H-012.34',
    plate_key: normalizePlateKey('60H-012.34'),
    type: 'Đầu kéo',
    brand_model: 'Howo A7 420HP',
    driver_name: 'Lê Hoàng Nam',
    department: 'Cảng Đồng Nai',
    status: 'Đang bảo dưỡng',
    registration_due_date: '2027-03-10',
    current_km: 312400,
    service_interval_km: 15000,
    service_interval_days: 75,
    next_service_km: 325000,
    next_service_date: '2027-01-20',
  },
  {
    id: 'veh_04',
    plate: '29C-456.78',
    plate_key: normalizePlateKey('29C-456.78'),
    type: 'Xe tải',
    brand_model: 'Isuzu FVR34QE4 8T',
    driver_name: 'Phạm Đức Anh',
    department: 'Vận tải Miền Bắc',
    status: 'Đang hoạt động',
    registration_due_date: '2026-11-29', // SẮP ĐẾN HẠN ĐĂNG KIỂM KHẨN CẤP (còn 6 ngày)
    current_km: 169450,
    service_interval_km: 10000,
    service_interval_days: 90,
    next_service_km: 170000, // SẮP CHẠM MỐC KM (còn 550 km)
    next_service_date: '2026-12-03',
  },
  {
    id: 'veh_05',
    plate: '51C-889.12',
    plate_key: normalizePlateKey('51C-889.12'),
    type: 'Xe 16 chỗ',
    brand_model: 'Hyundai Solati 16 chỗ',
    driver_name: 'Võ Thanh Phong',
    department: 'Vận tải Miền Nam',
    status: 'Đang hoạt động',
    registration_due_date: '2027-05-22',
    current_km: 98300,
    service_interval_km: 10000,
    service_interval_days: 90,
    next_service_km: 105000,
    next_service_date: '2027-02-05',
  },
  {
    id: 'veh_06',
    plate: '61H-045.67',
    plate_key: normalizePlateKey('61H-045.67'),
    type: 'Đầu kéo',
    brand_model: 'Dongfeng Hoàng Huy DFL4251A',
    driver_name: 'Đặng Quốc Bảo',
    department: 'Kho vận Bình Dương',
    status: 'Đang hoạt động',
    registration_due_date: '2026-12-05', // SẮP ĐẾN HẠN ĐĂNG KIỂM KHẨN CẤP (còn 12 ngày)
    current_km: 386900,
    service_interval_km: 15000,
    service_interval_days: 75,
    next_service_km: 385000, // QUÁ KM (+1.900 km)
    next_service_date: '2026-11-18',
  },
  {
    id: 'veh_07',
    plate: '50H-234.56',
    plate_key: normalizePlateKey('50H-234.56'),
    type: 'Xe tải',
    brand_model: 'Hino FL8JT7A 15T',
    driver_name: 'Bùi Quang Khải',
    department: 'Vận tải Miền Nam',
    status: 'Đang hoạt động',
    registration_due_date: '2027-06-14',
    current_km: 179320,
    service_interval_km: 12000,
    service_interval_days: 90,
    next_service_km: 180000, // SẮP CHẠM MỐC KM (còn 680 km)
    next_service_date: '2026-12-06',
  },
  {
    id: 'veh_08',
    plate: '43C-112.89',
    plate_key: normalizePlateKey('43C-112.89'),
    type: 'Xe tải',
    brand_model: 'Thaco Ollin S720',
    driver_name: 'Huỳnh Tấn Phát',
    department: 'Vận tải Miền Trung',
    status: 'Đang hoạt động',
    registration_due_date: '2027-07-30',
    current_km: 124500,
    service_interval_km: 10000,
    service_interval_days: 90,
    next_service_km: 132000,
    next_service_date: '2027-01-28',
  },
  {
    id: 'veh_09',
    plate: '60C-556.78',
    plate_key: normalizePlateKey('60C-556.78'),
    type: 'Xe 4 chỗ',
    brand_model: 'Toyota Camry 2.0Q',
    driver_name: 'Ngô Văn Lợi',
    department: 'Cảng Đồng Nai',
    status: 'Đang hoạt động',
    registration_due_date: '2027-08-15',
    current_km: 112800,
    service_interval_km: 10000,
    service_interval_days: 90,
    next_service_km: 120000,
    next_service_date: '2027-02-01',
  },
  {
    id: 'veh_10',
    plate: '51G-302.19',
    plate_key: normalizePlateKey('51G-302.19'),
    type: 'Xe 7 chỗ',
    brand_model: 'Toyota Fortuner 2.4 AT',
    driver_name: 'Trương Gia Huy',
    department: 'Hành chính - Điều phối',
    status: 'Đang hoạt động',
    registration_due_date: '2027-09-20',
    current_km: 64200,
    service_interval_km: 10000,
    service_interval_days: 120,
    next_service_km: 70000,
    next_service_date: '2027-02-18',
  },
  {
    id: 'veh_11',
    plate: '61LD-008.45',
    plate_key: normalizePlateKey('61LD-008.45'),
    type: 'Xe bán tải',
    brand_model: 'Ford Ranger Wildtrak 2.0',
    driver_name: 'Phan Công Minh',
    department: 'Kho vận Bình Dương',
    status: 'Đang hoạt động',
    registration_due_date: '2026-12-14', // SẮP ĐẾN HẠN ĐĂNG KIỂM KHẨN CẤP (còn 21 ngày)
    current_km: 79400,
    service_interval_km: 10000,
    service_interval_days: 120,
    next_service_km: 80000, // SẮP CHẠM MỐC KM (còn 600 km)
    next_service_date: '2026-12-05',
  },
  {
    id: 'veh_12',
    plate: '29H-774.21',
    plate_key: normalizePlateKey('29H-774.21'),
    type: 'Đầu kéo',
    brand_model: 'Hyundai Xcient GT 440PS',
    driver_name: 'Lương Văn Hải',
    department: 'Vận tải Miền Bắc',
    status: 'Đang hoạt động',
    registration_due_date: '2027-03-28',
    current_km: 221500,
    service_interval_km: 15000,
    service_interval_days: 90,
    next_service_km: 233000,
    next_service_date: '2027-01-25',
  },
  {
    id: 'veh_13',
    plate: '51C-904.33',
    plate_key: normalizePlateKey('51C-904.33'),
    type: 'Xe 4 chỗ',
    brand_model: 'Honda Civic RS',
    driver_name: 'Đỗ Hoàng Phúc',
    department: 'Vận tải Miền Nam',
    status: 'Đang hoạt động',
    registration_due_date: '2027-05-11',
    current_km: 156400,
    service_interval_km: 8000,
    service_interval_days: 90,
    next_service_km: 162000,
    next_service_date: '2027-01-12',
  },
  {
    id: 'veh_14',
    plate: '60D-118.65',
    plate_key: normalizePlateKey('60D-118.65'),
    type: 'Xe bán tải',
    brand_model: 'Mitsubishi Triton Athlete',
    driver_name: 'Mai Xuân Trường',
    department: 'Cảng Đồng Nai',
    status: 'Đang hoạt động',
    registration_due_date: '2027-02-16',
    current_km: 109600,
    service_interval_km: 10000,
    service_interval_days: 120,
    next_service_km: 110000, // SẮP CHẠM MỐC KM (còn 400 km)
    next_service_date: '2026-12-01',
  },
  {
    id: 'veh_15',
    plate: '79C-092.40',
    plate_key: normalizePlateKey('79C-092.40'),
    type: 'Xe 7 chỗ',
    brand_model: 'Mitsubishi Xpander Cross',
    driver_name: 'Nguyễn Tấn Đạt',
    department: 'Vận tải Miền Trung',
    status: 'Ngưng',
    registration_due_date: '2027-01-25',
    current_km: 215800,
    service_interval_km: 10000,
    service_interval_days: 90,
    next_service_km: 215000, // QUÁ KM (+800 km)
    next_service_date: '2026-11-05',
  },
];

interface RawOrderSpec {
  id: string;
  vehicle_id: string;
  service_date: string;
  odometer_km: number;
  garage: string;
  service_type: MaintenanceOrder['service_type'];
  note: string;
  items: Array<{
    category: MaintenanceCategory;
    item_name: string;
    action: MaintenanceItem['action'];
    part_name: string;
    quantity: number;
    unit_price: number;
    po_number: string;
  }>;
}

const RAW_ORDERS: RawOrderSpec[] = [
  // ================= THÁNG 11/2026 (Current Month - 20 orders) =================
  {
    id: 'ord_2611_01',
    vehicle_id: 'veh_01', // 61C-123.45 — highest spender in Nov (~86M) & split across 2 POs
    service_date: '2026-11-02',
    odometer_km: 245200,
    garage: 'Gara Đầu Kéo Mỹ Phước',
    service_type: 'Sửa chữa đột xuất',
    note: 'Đại tu cụm turbo tăng áp, thay 4 lốp trục sau và bảo dưỡng cấp lớn',
    items: [
      { category: 'Động cơ', item_name: 'Thay bộ tăng áp Turbocharger', action: 'THAY THẾ', part_name: 'Turbo Holset HE451V chính hãng', quantity: 1, unit_price: 28500000, po_number: 'PO-2026-1101' },
      { category: 'Động cơ', item_name: 'Thay kim phun nhiên liệu', action: 'THAY THẾ', part_name: 'Kim phun Detroit DD15', quantity: 2, unit_price: 7800000, po_number: 'PO-2026-1101' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ 15W-40 & bộ lọc', action: 'THAY THẾ', part_name: 'Nhớt Shell Rimula R4 X (40L) + lọc', quantity: 1, unit_price: 5400000, po_number: 'PO-2026-1101' },
      { category: 'Lốp', item_name: 'Thay lốp trục truyền động 11R22.5', action: 'THAY THẾ', part_name: 'Lốp Michelin XZE2+ 11R22.5', quantity: 4, unit_price: 7600000, po_number: 'PO-2026-1102' },
      { category: 'Lốp', item_name: 'Cân mâm và đảo lốp trục trước', action: 'SỬA CHỮA', part_name: 'Chì dán cân mâm', quantity: 2, unit_price: 450000, po_number: 'PO-2026-1102' },
      { category: 'Phanh', item_name: 'Vệ sinh và căn chỉnh bầu phanh hơi', action: 'SỬA CHỮA', part_name: 'Bộ phớt bầu phanh', quantity: 2, unit_price: 1150000, po_number: 'PO-2026-1102' },
    ],
  },
  {
    id: 'ord_2611_02',
    vehicle_id: 'veh_01', // Second visit in Nov -> repeated brake pad replacement in 90 days
    service_date: '2026-11-18',
    odometer_km: 248100,
    garage: 'Gara Đầu Kéo Mỹ Phước',
    service_type: 'Sửa chữa đột xuất',
    note: 'Kiểm tra tiếng kêu phanh trục 2 và thay cảm biến ABS',
    items: [
      { category: 'Phanh', item_name: 'Thay má phanh trước/sau', action: 'THAY THẾ', part_name: 'Bộ bố thắng Meritor Q-Plus', quantity: 2, unit_price: 2950000, po_number: 'PO-2026-1114' },
      { category: 'Hệ thống điện', item_name: 'Thay cảm biến tốc độ ABS', action: 'THAY THẾ', part_name: 'Cảm biến ABS Wabco', quantity: 2, unit_price: 1850000, po_number: 'PO-2026-1114' },
    ],
  },
  {
    id: 'ord_2611_03',
    vehicle_id: 'veh_03', // 60H-012.34 — split across 2 POs + 1 missing PO
    service_date: '2026-11-04',
    odometer_km: 310200,
    garage: 'Xưởng Lốp & Gầm Đồng Nai',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng cấp 300.000 km và thay nhíp gầm',
    items: [
      { category: 'Gầm-treo', item_name: 'Thay bộ lá nhíp sau chịu tải', action: 'THAY THẾ', part_name: 'Bộ nhíp Howo 12 lá dày', quantity: 2, unit_price: 8900000, po_number: 'PO-2026-1103' },
      { category: 'Gầm-treo', item_name: 'Thay rô-tuyn thanh giằng cầu', action: 'THAY THẾ', part_name: 'Thanh giằng chữ V Howo', quantity: 1, unit_price: 4200000, po_number: 'PO-2026-1103' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay dầu cầu và dầu hộp số', action: 'THAY THẾ', part_name: 'Dầu cầu Castrol 85W-140 (24L)', quantity: 1, unit_price: 3650000, po_number: 'PO-2026-1104' },
      { category: 'Phanh', item_name: 'Tiện láng tăng bua phanh sau', action: 'SỬA CHỮA', part_name: 'Công gia công tiện', quantity: 2, unit_price: 1200000, po_number: '' }, // Missing PO
    ],
  },
  {
    id: 'ord_2611_04',
    vehicle_id: 'veh_03',
    service_date: '2026-11-21',
    odometer_km: 312400,
    garage: 'Gara Đầu Kéo Mỹ Phước',
    service_type: 'Sửa chữa đột xuất',
    note: 'Xử lý rò rỉ két nước làm mát và thay dây curoa tổng',
    items: [
      { category: 'Động cơ', item_name: 'Thay két nước làm mát động cơ', action: 'THAY THẾ', part_name: 'Két nước nhôm Howo A7', quantity: 1, unit_price: 11800000, po_number: 'PO-2026-1116' },
      { category: 'Động cơ', item_name: 'Thay dây curoa tổng và puly tăng', action: 'THAY THẾ', part_name: 'Bộ dây curoa Gates + puly', quantity: 1, unit_price: 2650000, po_number: 'PO-2026-1116' },
      { category: 'Dầu nhớt-lọc', item_name: 'Súc rửa và châm nước làm mát mới', action: 'SỬA CHỮA', part_name: 'Nước làm mát đỏ Prestone (20L)', quantity: 1, unit_price: 1450000, po_number: 'PO-2026-1116' },
    ],
  },
  {
    id: 'ord_2611_05',
    vehicle_id: 'veh_05', // 51C-889.12 — xe đông lạnh
    service_date: '2026-11-05',
    odometer_km: 96800,
    garage: 'Gara Thành Công Auto',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng máy lạnh thùng đông lạnh và định kỳ động cơ',
    items: [
      { category: 'Điều hòa', item_name: 'Thay lốc nén máy lạnh thùng', action: 'THAY THẾ', part_name: 'Lốc lạnh Thermo King TM16', quantity: 1, unit_price: 14500000, po_number: 'PO-2026-1105' },
      { category: 'Điều hòa', item_name: 'Vệ sinh dàn nóng & nạp gas R404A', action: 'SỬA CHỮA', part_name: 'Gas lạnh R404A + dầu lạnh', quantity: 1, unit_price: 2800000, po_number: 'PO-2026-1105' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt máy & lọc nhớt', action: 'THAY THẾ', part_name: 'Nhớt Hyundai XTeer 10W-40 + lọc', quantity: 1, unit_price: 2150000, po_number: 'PO-2026-1105' },
    ],
  },
  {
    id: 'ord_2611_06',
    vehicle_id: 'veh_12', // 29H-774.21 — split 2 POs
    service_date: '2026-11-07',
    odometer_km: 219400,
    garage: 'Gara Đại Phát Miền Bắc',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng định kỳ 220.000 km và thay 2 lốp dẫn hướng',
    items: [
      { category: 'Lốp', item_name: 'Thay lốp dẫn hướng 12R22.5', action: 'THAY THẾ', part_name: 'Lốp Bridgestone R150 12R22.5', quantity: 2, unit_price: 8900000, po_number: 'PO-2026-1106' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ, lọc dầu & lọc nhiên liệu', action: 'THAY THẾ', part_name: 'Bộ lọc Hyundai Xcient chính hãng', quantity: 1, unit_price: 6200000, po_number: 'PO-2026-1107' },
      { category: 'Hệ thống điện', item_name: 'Thay cặp bình ắc quy khởi động', action: 'THAY THẾ', part_name: 'Ắc quy GS N150 12V-150Ah', quantity: 2, unit_price: 3450000, po_number: 'PO-2026-1107' },
      { category: 'Phanh', item_name: 'Thay má phanh trước/sau', action: 'THAY THẾ', part_name: 'Bố thắng Hyundai Xcient', quantity: 1, unit_price: 4100000, po_number: 'PO-2026-1107' },
    ],
  },
  {
    id: 'ord_2611_07',
    vehicle_id: 'veh_08', // 43C-112.89
    service_date: '2026-11-08',
    odometer_km: 122900,
    garage: 'Trạm Dịch vụ Hyundai Đà Nẵng',
    service_type: 'Sửa chữa đột xuất',
    note: 'Sửa hộp số khó vào số 3 và thay lá côn',
    items: [
      { category: 'Động cơ', item_name: 'Thay bộ lá côn và mâm ép', action: 'THAY THẾ', part_name: 'Bộ ly hợp Valeo 350mm', quantity: 1, unit_price: 9400000, po_number: 'PO-2026-1108' },
      { category: 'Động cơ', item_name: 'Thay bi T ly hợp & phớt đuôi trục cơ', action: 'THAY THẾ', part_name: 'Bi T NSK + phớt trục cơ', quantity: 1, unit_price: 2350000, po_number: 'PO-2026-1108' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay dầu hộp số 80W-90', action: 'THAY THẾ', part_name: 'Dầu hộp số Total 80W-90 (8L)', quantity: 1, unit_price: 1150000, po_number: 'PO-2026-1108' },
    ],
  },
  {
    id: 'ord_2611_08',
    vehicle_id: 'veh_09', // 60C-556.78
    service_date: '2026-11-10',
    odometer_km: 111200,
    garage: 'Trung tâm Bảo dưỡng Isuzu Bình Dương',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng định kỳ 110.000 km & kiểm tra hệ thống phanh',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ & lọc nhớt', action: 'THAY THẾ', part_name: 'Nhớt Isuzu Genuine 15W-40 + lọc', quantity: 1, unit_price: 2450000, po_number: 'PO-2026-1109' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay lọc gió động cơ & lọc nhiên liệu', action: 'THAY THẾ', part_name: 'Lọc gió + lọc dầu tinh Isuzu', quantity: 1, unit_price: 1650000, po_number: 'PO-2026-1109' },
      { category: 'Phanh', item_name: 'Thay má phanh trước/sau', action: 'THAY THẾ', part_name: 'Bộ má phanh Isuzu NQR', quantity: 1, unit_price: 2650000, po_number: 'PO-2026-1109' },
      { category: 'Điều hòa', item_name: 'Bảo dưỡng dàn lạnh cabin & thay lọc gió', action: 'SỬA CHỮA', part_name: 'Lọc gió cabin + hóa chất vệ sinh', quantity: 1, unit_price: 950000, po_number: '' }, // Missing PO
    ],
  },
  {
    id: 'ord_2611_09',
    vehicle_id: 'veh_13', // 51C-904.33 — tai nạn nhẹ thân vỏ
    service_date: '2026-11-11',
    odometer_km: 155100,
    garage: 'Gara Thành Công Auto',
    service_type: 'Tai nạn',
    note: 'Gò sơn cửa phụ và thay gương chiếu hậu bị va quẹt tại kho',
    items: [
      { category: 'Thân vỏ', item_name: 'Gò nắn và sơn lại cửa phụ + cản trước', action: 'SỬA CHỮA', part_name: 'Sơn Dupont 2K + vật tư đồng sơn', quantity: 1, unit_price: 6800000, po_number: 'PO-2026-1110' },
      { category: 'Thân vỏ', item_name: 'Thay cụm đèn pha và gương chiếu hậu phải', action: 'THAY THẾ', part_name: 'Đèn pha + gương Isuzu QKR', quantity: 1, unit_price: 3950000, po_number: 'PO-2026-1110' },
      { category: 'Hệ thống điện', item_name: 'Kiểm tra và đấu lại dây đèn xi-nhan', action: 'SỬA CHỮA', part_name: 'Giắc nối chống nước + công điện', quantity: 1, unit_price: 650000, po_number: 'PO-2026-1110' },
    ],
  },
  {
    id: 'ord_2611_10',
    vehicle_id: 'veh_10', // 51G-302.19 — shifted to late Oct so veh_10 shows as active unserviced in Nov
    service_date: '2026-10-27',
    odometer_km: 63400,
    garage: 'Gara Thành Công Auto',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng định kỳ 60.000 km xe điều phối',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt tổng hợp 5W-30 & lọc nhớt', action: 'THAY THẾ', part_name: 'Nhớt Toyota 5W-30 + lọc chính hãng', quantity: 1, unit_price: 1850000, po_number: 'PO-2026-1018' },
      { category: 'Lốp', item_name: 'Đảo lốp & cân chỉnh độ chụm thước lái', action: 'SỬA CHỮA', part_name: 'Công cân chỉnh Hunter 3D', quantity: 1, unit_price: 850000, po_number: 'PO-2026-1018' },
      { category: 'Phanh', item_name: 'Bảo dưỡng 4 cụm phanh đĩa & thay dầu phanh', action: 'SỬA CHỮA', part_name: 'Dầu phanh DOT4 + mỡ chịu nhiệt', quantity: 1, unit_price: 1100000, po_number: 'PO-2026-1018' },
    ],
  },
  {
    id: 'ord_2611_11',
    vehicle_id: 'veh_07', // 50H-234.56
    service_date: '2026-11-14',
    odometer_km: 177600,
    garage: 'Xưởng Dịch Vụ Hino Sài Gòn',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay 2 lốp sau mòn không đều và chỉnh thước lái',
    items: [
      { category: 'Lốp', item_name: 'Thay lốp tải 11.00R20', action: 'THAY THẾ', part_name: 'Lốp Bridgestone R156 11.00R20', quantity: 2, unit_price: 8200000, po_number: 'PO-2026-1112' },
      { category: 'Gầm-treo', item_name: 'Thay bạc đạn bánh trước và phớt moay-ơ', action: 'THAY THẾ', part_name: 'Bạc đạn Koyo + phớt moay-ơ Hino', quantity: 2, unit_price: 1950000, po_number: 'PO-2026-1112' },
      { category: 'Gầm-treo', item_name: 'Cân chỉnh thước lái & kiểm tra rô-tuyn', action: 'SỬA CHỮA', part_name: 'Công cân chỉnh xe tải nặng', quantity: 1, unit_price: 1200000, po_number: 'PO-2026-1112' },
    ],
  },
  {
    id: 'ord_2611_12',
    vehicle_id: 'veh_04', // 29C-456.78
    service_date: '2026-11-15',
    odometer_km: 168200,
    garage: 'Gara Đại Phát Miền Bắc',
    service_type: 'Kiểm định',
    note: 'Kiểm tra hệ thống khí thải, đèn chiếu sáng và phanh trước đăng kiểm',
    items: [
      { category: 'Hệ thống điện', item_name: 'Căn chỉnh đèn pha và thay bóng cốt LED', action: 'THAY THẾ', part_name: 'Cặp bóng đèn Philips 24V', quantity: 1, unit_price: 1450000, po_number: 'PO-2026-1113' },
      { category: 'Phanh', item_name: 'Cân lực phanh 2 bên và xả gió', action: 'SỬA CHỮA', part_name: 'Dầu phanh + công căn chỉnh', quantity: 1, unit_price: 1350000, po_number: 'PO-2026-1113' },
      { category: 'Khác', item_name: 'Lệ phí và công hỗ trợ kiểm định định kỳ', action: 'SỬA CHỮA', part_name: 'Dịch vụ đăng kiểm', quantity: 1, unit_price: 1800000, po_number: '' }, // Missing PO
    ],
  },
  {
    id: 'ord_2611_13',
    vehicle_id: 'veh_06', // 61H-045.67 — intentional anomalous lower km alert (or missing km = 0 on one order)
    service_date: '2026-11-16',
    odometer_km: 0, // Thiếu km để demo cảnh báo dữ liệu chưa đầy đủ
    garage: 'Gara Đầu Kéo Mỹ Phước',
    service_type: 'Sửa chữa đột xuất',
    note: 'Sửa máy phát điện không sạc bình giữa tuyến',
    items: [
      { category: 'Hệ thống điện', item_name: 'Thay máy phát điện 24V', action: 'THAY THẾ', part_name: 'Máy phát điện Bosch 24V-80A', quantity: 1, unit_price: 6900000, po_number: 'PO-2026-1115' },
      { category: 'Hệ thống điện', item_name: 'Kiểm tra dây mass và cọc bình', action: 'SỬA CHỮA', part_name: 'Cọc bình đồng + dây cáp 50mm', quantity: 1, unit_price: 950000, po_number: 'PO-2026-1115' },
    ],
  },
  {
    id: 'ord_2611_14',
    vehicle_id: 'veh_11', // 61LD-008.45
    service_date: '2026-11-17',
    odometer_km: 78500,
    garage: 'Gara Thành Công Auto',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay ắc quy yếu và vệ sinh họng nạp',
    items: [
      { category: 'Hệ thống điện', item_name: 'Thay bình ắc quy DIN75', action: 'THAY THẾ', part_name: 'Ắc quy Varta DIN75 12V-75Ah', quantity: 1, unit_price: 2650000, po_number: 'PO-2026-1115' },
      { category: 'Động cơ', item_name: 'Vệ sinh cổ hút & van EGR', action: 'SỬA CHỮA', part_name: 'Dung dịch vệ sinh EGR Liqui Moly', quantity: 1, unit_price: 1650000, po_number: '' }, // Missing PO
    ],
  },
  {
    id: 'ord_2611_15',
    vehicle_id: 'veh_14', // 60D-118.65 — shifted to late Oct so veh_14 shows as active unserviced in Nov
    service_date: '2026-10-30',
    odometer_km: 108900,
    garage: 'Xưởng Lốp & Gầm Đồng Nai',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay giảm xóc trước bên phải bị chảy dầu',
    items: [
      { category: 'Gầm-treo', item_name: 'Thay cặp phuộc giảm xóc trước', action: 'THAY THẾ', part_name: 'Phuộc KYB Excel-G Triton', quantity: 2, unit_price: 2450000, po_number: 'PO-2026-1019' },
      { category: 'Gầm-treo', item_name: 'Thay cao su cân bằng trước', action: 'THAY THẾ', part_name: 'Cao su thanh cân bằng chính hãng', quantity: 2, unit_price: 420000, po_number: 'PO-2026-1019' },
    ],
  },
  {
    id: 'ord_2611_16',
    vehicle_id: 'veh_02', // 51D-678.90 — quick brake fix, still overdue for full periodic service
    service_date: '2026-11-20',
    odometer_km: 140800,
    garage: 'Xưởng Dịch Vụ Hino Sài Gòn',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay ống dầu phanh bị nứt và thay má phanh',
    items: [
      { category: 'Phanh', item_name: 'Thay má phanh trước/sau', action: 'THAY THẾ', part_name: 'Bộ má phanh Hino FC', quantity: 1, unit_price: 3150000, po_number: 'PO-2026-1118' },
      { category: 'Phanh', item_name: 'Thay ống dẫn dầu phanh cao áp', action: 'THAY THẾ', part_name: 'Ống mềm dầu phanh Hino', quantity: 2, unit_price: 680000, po_number: 'PO-2026-1118' },
    ],
  },
  {
    id: 'ord_2611_17',
    vehicle_id: 'veh_05', // 51C-889.12 — 2nd order in Nov
    service_date: '2026-11-22',
    odometer_km: 98100,
    garage: 'Xưởng Lốp & Gầm Đồng Nai',
    service_type: 'Sửa chữa đột xuất',
    note: 'Vá ép lốp sau và thay van hơi',
    items: [
      { category: 'Lốp', item_name: 'Thay lốp dự phòng & vá nấm lốp sau', action: 'THAY THẾ', part_name: 'Lốp Casumina 8.25R16', quantity: 1, unit_price: 4150000, po_number: 'PO-2026-1119' },
      { category: 'Lốp', item_name: 'Thay van hơi & cân bằng động', action: 'SỬA CHỮA', part_name: 'Van hơi đồng + công', quantity: 2, unit_price: 250000, po_number: 'PO-2026-1119' },
    ],
  },

  // ================= THÁNG 10/2026 (Previous Month - 14 orders) =================
  {
    id: 'ord_2610_01',
    vehicle_id: 'veh_01',
    service_date: '2026-10-03',
    odometer_km: 237400,
    garage: 'Gara Đầu Kéo Mỹ Phước',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng định kỳ tháng 10 & thay má phanh trục 1',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ 15W-40 & bộ lọc', action: 'THAY THẾ', part_name: 'Nhớt Shell Rimula R4 X + lọc', quantity: 1, unit_price: 5300000, po_number: 'PO-2026-1001' },
      { category: 'Phanh', item_name: 'Thay má phanh trước/sau', action: 'THAY THẾ', part_name: 'Bộ bố thắng Meritor Q-Plus', quantity: 2, unit_price: 2900000, po_number: 'PO-2026-1001' },
      { category: 'Hệ thống điện', item_name: 'Thay cảm biến tốc độ ABS', action: 'THAY THẾ', part_name: 'Cảm biến ABS Wabco', quantity: 1, unit_price: 1850000, po_number: 'PO-2026-1002' },
    ],
  },
  {
    id: 'ord_2610_02',
    vehicle_id: 'veh_02',
    service_date: '2026-10-06',
    odometer_km: 135900,
    garage: 'Xưởng Dịch Vụ Hino Sài Gòn',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay lốp trước bên tài và cân thước lái',
    items: [
      { category: 'Lốp', item_name: 'Thay lốp trước 8.25R16', action: 'THAY THẾ', part_name: 'Lốp Michelin Agilis 8.25R16', quantity: 2, unit_price: 5600000, po_number: 'PO-2026-1003' },
      { category: 'Gầm-treo', item_name: 'Cân chỉnh thước lái & thay rô-tuyn lái', action: 'THAY THẾ', part_name: 'Rô-tuyn lái Hino FC', quantity: 2, unit_price: 1450000, po_number: 'PO-2026-1003' },
    ],
  },
  {
    id: 'ord_2610_03',
    vehicle_id: 'veh_03',
    service_date: '2026-10-08',
    odometer_km: 303500,
    garage: 'Gara Đầu Kéo Mỹ Phước',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay bơm cao áp và vệ sinh bình dầu',
    items: [
      { category: 'Động cơ', item_name: 'Đại tu bơm cao áp nhiên liệu', action: 'SỬA CHỮA', part_name: 'Bộ ruột bơm Bosch + cân chỉnh', quantity: 1, unit_price: 12800000, po_number: 'PO-2026-1004' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay bộ lọc nhiên liệu tách nước', action: 'THAY THẾ', part_name: 'Lọc tách nước Racor', quantity: 2, unit_price: 1350000, po_number: 'PO-2026-1004' },
      { category: 'Hệ thống điện', item_name: 'Kiểm tra hệ thống dây ECU động cơ', action: 'SỬA CHỮA', part_name: 'Công chẩn đoán điện tử', quantity: 1, unit_price: 1500000, po_number: 'PO-2026-1005' },
    ],
  },
  {
    id: 'ord_2610_04',
    vehicle_id: 'veh_04',
    service_date: '2026-10-10',
    odometer_km: 161500,
    garage: 'Gara Đại Phát Miền Bắc',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng định kỳ 160.000 km',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ & bộ lọc định kỳ', action: 'THAY THẾ', part_name: 'Nhớt Isuzu 15W-40 + 3 lọc', quantity: 1, unit_price: 3850000, po_number: 'PO-2026-1006' },
      { category: 'Phanh', item_name: 'Thay má phanh trước/sau', action: 'THAY THẾ', part_name: 'Bộ má phanh Isuzu FVR', quantity: 1, unit_price: 3400000, po_number: 'PO-2026-1006' },
      { category: 'Điều hòa', item_name: 'Vệ sinh dàn lạnh & bổ sung gas R134a', action: 'SỬA CHỮA', part_name: 'Gas R134a + công vệ sinh', quantity: 1, unit_price: 1250000, po_number: 'PO-2026-1006' },
    ],
  },
  {
    id: 'ord_2610_05',
    vehicle_id: 'veh_06',
    service_date: '2026-10-12',
    odometer_km: 378400,
    garage: 'Gara Đầu Kéo Mỹ Phước',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay 4 lốp sau & sửa bầu hơi cabin',
    items: [
      { category: 'Lốp', item_name: 'Thay lốp trục truyền động 11R22.5', action: 'THAY THẾ', part_name: 'Lốp Double Coin 11R22.5', quantity: 4, unit_price: 5900000, po_number: 'PO-2026-1007' },
      { category: 'Gầm-treo', item_name: 'Thay bầu hơi giảm chấn cabin', action: 'THAY THẾ', part_name: 'Bầu hơi cabin Dongfeng', quantity: 2, unit_price: 2150000, po_number: 'PO-2026-1008' },
    ],
  },
  {
    id: 'ord_2610_06',
    vehicle_id: 'veh_07',
    service_date: '2026-10-14',
    odometer_km: 171200,
    garage: 'Xưởng Dịch Vụ Hino Sài Gòn',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng định kỳ cấp trung bình',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ, lọc nhớt & lọc dầu', action: 'THAY THẾ', part_name: 'Nhớt Hino Genuine 15W-40 + bộ lọc', quantity: 1, unit_price: 4600000, po_number: 'PO-2026-1009' },
      { category: 'Phanh', item_name: 'Vệ sinh tăng bua & bơm mỡ trục cam phanh', action: 'SỬA CHỮA', part_name: 'Mỡ chịu nhiệt + công bảo dưỡng', quantity: 1, unit_price: 1450000, po_number: 'PO-2026-1009' },
    ],
  },
  {
    id: 'ord_2610_07',
    vehicle_id: 'veh_08',
    service_date: '2026-10-16',
    odometer_km: 118200,
    garage: 'Trạm Dịch vụ Hyundai Đà Nẵng',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng 120.000 km & kiểm tra hệ thống điện',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ & lọc nhớt', action: 'THAY THẾ', part_name: 'Nhớt Castrol CRB 15W-40 + lọc', quantity: 1, unit_price: 2350000, po_number: 'PO-2026-1010' },
      { category: 'Hệ thống điện', item_name: 'Thay bình ắc quy khởi động', action: 'THAY THẾ', part_name: 'Ắc quy Đồng Nai 12V-100Ah', quantity: 2, unit_price: 2350000, po_number: 'PO-2026-1010' },
    ],
  },
  {
    id: 'ord_2610_08',
    vehicle_id: 'veh_12',
    service_date: '2026-10-18',
    odometer_km: 211600,
    garage: 'Gara Đại Phát Miền Bắc',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay van chia hơi phanh & kiểm tra máy nén khí',
    items: [
      { category: 'Phanh', item_name: 'Thay van chia hơi tổng 4 ngả', action: 'THAY THẾ', part_name: 'Van chia hơi Wabco 4 mạch', quantity: 1, unit_price: 5400000, po_number: 'PO-2026-1011' },
      { category: 'Phanh', item_name: 'Thay lọc tách ẩm khí nén', action: 'THAY THẾ', part_name: 'Lọc sấy khí Wabco', quantity: 1, unit_price: 1650000, po_number: 'PO-2026-1011' },
    ],
  },
  {
    id: 'ord_2610_09',
    vehicle_id: 'veh_05',
    service_date: '2026-10-20',
    odometer_km: 92400,
    garage: 'Gara Thành Công Auto',
    service_type: 'Sửa chữa đột xuất',
    note: 'Sửa cảm biến nhiệt độ thùng đông lạnh & thay gioăng cửa thùng',
    items: [
      { category: 'Điều hòa', item_name: 'Thay cảm biến nhiệt độ thùng lạnh', action: 'THAY THẾ', part_name: 'Cảm biến nhiệt Thermo King', quantity: 2, unit_price: 1450000, po_number: 'PO-2026-1012' },
      { category: 'Thân vỏ', item_name: 'Thay gioăng cao su cửa thùng đông lạnh', action: 'THAY THẾ', part_name: 'Bộ gioăng EPDM 2 cánh sau', quantity: 1, unit_price: 3800000, po_number: 'PO-2026-1012' },
    ],
  },
  {
    id: 'ord_2610_10',
    vehicle_id: 'veh_09',
    service_date: '2026-10-22',
    odometer_km: 106800,
    garage: 'Trung tâm Bảo dưỡng Isuzu Bình Dương',
    service_type: 'Sửa chữa đột xuất',
    note: 'Sửa rò rỉ phớt láp sau và bổ sung dầu cầu',
    items: [
      { category: 'Gầm-treo', item_name: 'Thay phớt láp cầu sau & vòng bi', action: 'THAY THẾ', part_name: 'Phớt láp + bi cầu Isuzu', quantity: 2, unit_price: 1650000, po_number: 'PO-2026-1013' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay dầu cầu sau 85W-140', action: 'THAY THẾ', part_name: 'Dầu cầu Mobil 85W-140 (6L)', quantity: 1, unit_price: 950000, po_number: 'PO-2026-1013' },
    ],
  },
  {
    id: 'ord_2610_11',
    vehicle_id: 'veh_11',
    service_date: '2026-10-24',
    odometer_km: 74100,
    garage: 'Gara Thành Công Auto',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng định kỳ 70.000 km xe bán tải kỹ thuật',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ 5W-30 & lọc nhớt', action: 'THAY THẾ', part_name: 'Nhớt Castrol Magnatec + lọc Ford', quantity: 1, unit_price: 2250000, po_number: 'PO-2026-1014' },
      { category: 'Phanh', item_name: 'Thay má phanh trước/sau', action: 'THAY THẾ', part_name: 'Bộ má phanh trước Ford Ranger', quantity: 1, unit_price: 2450000, po_number: 'PO-2026-1014' },
    ],
  },
  {
    id: 'ord_2610_12',
    vehicle_id: 'veh_13',
    service_date: '2026-10-26',
    odometer_km: 151800,
    garage: 'Xưởng Lốp & Gầm Đồng Nai',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng định kỳ 150.000 km và thay 2 lốp sau',
    items: [
      { category: 'Lốp', item_name: 'Thay cặp lốp sau 7.00R15', action: 'THAY THẾ', part_name: 'Lốp Yokohama 7.00R15', quantity: 2, unit_price: 3450000, po_number: 'PO-2026-1015' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ & lọc nhớt', action: 'THAY THẾ', part_name: 'Nhớt Isuzu 15W-40 + lọc', quantity: 1, unit_price: 1850000, po_number: 'PO-2026-1015' },
    ],
  },
  {
    id: 'ord_2610_13',
    vehicle_id: 'veh_14',
    service_date: '2026-10-28',
    odometer_km: 105200,
    garage: 'Xưởng Lốp & Gầm Đồng Nai',
    service_type: 'Kiểm định',
    note: 'Kiểm tra tổng quát và đăng kiểm định kỳ',
    items: [
      { category: 'Hệ thống điện', item_name: 'Thay chổi gạt mưa & kiểm tra đèn tín hiệu', action: 'THAY THẾ', part_name: 'Bộ gạt mưa Bosch Aerotwin', quantity: 1, unit_price: 780000, po_number: 'PO-2026-1016' },
      { category: 'Khác', item_name: 'Chi phí kiểm định định kỳ & cân đèn', action: 'SỬA CHỮA', part_name: 'Dịch vụ đăng kiểm', quantity: 1, unit_price: 1450000, po_number: 'PO-2026-1016' },
    ],
  },
  {
    id: 'ord_2610_14',
    vehicle_id: 'veh_01',
    service_date: '2026-10-29',
    odometer_km: 243800,
    garage: 'Xưởng Lốp & Gầm Đồng Nai',
    service_type: 'Sửa chữa đột xuất',
    note: 'Vá lốp rơ-moóc và thay bu-lông tắc kê gãy',
    items: [
      { category: 'Gầm-treo', item_name: 'Thay bộ bu-lông tắc kê trục sau', action: 'THAY THẾ', part_name: 'Bu-lông tắc kê cường độ 10.9', quantity: 6, unit_price: 220000, po_number: 'PO-2026-1017' },
      { category: 'Lốp', item_name: 'Vá ép nhiệt lốp tải nặng', action: 'SỬA CHỮA', part_name: 'Miếng vá ép nhiệt Tech', quantity: 2, unit_price: 450000, po_number: '' }, // Missing PO
    ],
  },

  // ================= THÁNG 09/2026 (10 orders) =================
  {
    id: 'ord_2609_01',
    vehicle_id: 'veh_03',
    service_date: '2026-09-04',
    odometer_km: 295200,
    garage: 'Gara Đầu Kéo Mỹ Phước',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng cấp 295.000 km & thay 2 lốp dẫn hướng',
    items: [
      { category: 'Lốp', item_name: 'Thay lốp dẫn hướng 12R22.5', action: 'THAY THẾ', part_name: 'Lốp Bridgestone R150 12R22.5', quantity: 2, unit_price: 8800000, po_number: 'PO-2026-0901' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ 15W-40 & bộ lọc', action: 'THAY THẾ', part_name: 'Nhớt Shell Rimula + 3 lọc', quantity: 1, unit_price: 5100000, po_number: 'PO-2026-0901' },
      { category: 'Phanh', item_name: 'Thay má phanh trước/sau', action: 'THAY THẾ', part_name: 'Bộ má phanh Howo', quantity: 2, unit_price: 2750000, po_number: 'PO-2026-0902' },
    ],
  },
  {
    id: 'ord_2609_02',
    vehicle_id: 'veh_01',
    service_date: '2026-09-09',
    odometer_km: 229800,
    garage: 'Gara Đầu Kéo Mỹ Phước',
    service_type: 'Sửa chữa đột xuất',
    note: 'Sửa điều hòa cabin kém lạnh & thay mô-tơ quạt dàn lạnh',
    items: [
      { category: 'Điều hòa', item_name: 'Thay mô-tơ quạt gió dàn lạnh cabin', action: 'THAY THẾ', part_name: 'Mô-tơ quạt Freightliner 12V', quantity: 1, unit_price: 4600000, po_number: 'PO-2026-0903' },
      { category: 'Điều hòa', item_name: 'Thay phin lọc gas & nạp gas R134a', action: 'SỬA CHỮA', part_name: 'Phin lọc + gas R134a', quantity: 1, unit_price: 2150000, po_number: 'PO-2026-0903' },
    ],
  },
  {
    id: 'ord_2609_03',
    vehicle_id: 'veh_06',
    service_date: '2026-09-12',
    odometer_km: 370100,
    garage: 'Gara Đầu Kéo Mỹ Phước',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng 370.000 km & kiểm tra hộp số',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ, dầu hộp số & bộ lọc', action: 'THAY THẾ', part_name: 'Nhớt động cơ + dầu số Fast 12 cấp', quantity: 1, unit_price: 7800000, po_number: 'PO-2026-0904' },
      { category: 'Động cơ', item_name: 'Thay dây curoa tổng và bi tăng', action: 'THAY THẾ', part_name: 'Bộ dây curoa Dongfeng', quantity: 1, unit_price: 2400000, po_number: 'PO-2026-0904' },
      { category: 'Phanh', item_name: 'Thay bầu phanh lốc-kê trục sau', action: 'THAY THẾ', part_name: 'Bầu phanh T30/30', quantity: 2, unit_price: 2250000, po_number: 'PO-2026-0905' },
    ],
  },
  {
    id: 'ord_2609_04',
    vehicle_id: 'veh_02',
    service_date: '2026-09-15',
    odometer_km: 130100,
    garage: 'Xưởng Dịch Vụ Hino Sài Gòn',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng định kỳ 130.000 km',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ & lọc nhớt', action: 'THAY THẾ', part_name: 'Nhớt Hino 15W-40 + lọc', quantity: 1, unit_price: 3100000, po_number: 'PO-2026-0906' },
      { category: 'Hệ thống điện', item_name: 'Kiểm tra hệ thống nạp và vệ sinh cọc bình', action: 'SỬA CHỮA', part_name: 'Công kiểm tra điện', quantity: 1, unit_price: 750000, po_number: 'PO-2026-0906' },
    ],
  },
  {
    id: 'ord_2609_05',
    vehicle_id: 'veh_12',
    service_date: '2026-09-18',
    odometer_km: 204200,
    garage: 'Gara Đại Phát Miền Bắc',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay kính chắn gió bị đá văng nứt khi chạy cao tốc',
    items: [
      { category: 'Thân vỏ', item_name: 'Thay kính chắn gió cabin', action: 'THAY THẾ', part_name: 'Kính chắn gió Hyundai Xcient chính hãng', quantity: 1, unit_price: 11200000, po_number: 'PO-2026-0907' },
      { category: 'Thân vỏ', item_name: 'Keo dán kính 3M & gioăng viền kính', action: 'THAY THẾ', part_name: 'Bộ keo 3M + gioăng', quantity: 1, unit_price: 1850000, po_number: 'PO-2026-0907' },
    ],
  },
  {
    id: 'ord_2609_06',
    vehicle_id: 'veh_07',
    service_date: '2026-09-21',
    odometer_km: 165800,
    garage: 'Xưởng Dịch Vụ Hino Sài Gòn',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay củ đề khởi động bị trượt bendix',
    items: [
      { category: 'Hệ thống điện', item_name: 'Thay củ đề khởi động 24V', action: 'THAY THẾ', part_name: 'Củ đề Denso Hino FL', quantity: 1, unit_price: 7400000, po_number: 'PO-2026-0908' },
      { category: 'Hệ thống điện', item_name: 'Thay rơ-le đề chính', action: 'THAY THẾ', part_name: 'Rơ-le đề 24V chính hãng', quantity: 1, unit_price: 1150000, po_number: 'PO-2026-0908' },
    ],
  },
  {
    id: 'ord_2609_07',
    vehicle_id: 'veh_05',
    service_date: '2026-09-24',
    odometer_km: 88100,
    garage: 'Gara Thành Công Auto',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng 90.000 km & kiểm tra hệ thống phanh',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ & lọc nhớt', action: 'THAY THẾ', part_name: 'Nhớt Hyundai 10W-40 + bộ lọc', quantity: 1, unit_price: 2650000, po_number: 'PO-2026-0909' },
      { category: 'Phanh', item_name: 'Thay má phanh trước/sau', action: 'THAY THẾ', part_name: 'Bộ má phanh Hyundai EX8', quantity: 1, unit_price: 2550000, po_number: 'PO-2026-0909' },
    ],
  },
  {
    id: 'ord_2609_08',
    vehicle_id: 'veh_10',
    service_date: '2026-09-26',
    odometer_km: 58900,
    garage: 'Gara Thành Công Auto',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay 4 lốp xe con đã mòn tới vạch chỉ thị',
    items: [
      { category: 'Lốp', item_name: 'Thay bộ 4 lốp 265/60R18', action: 'THAY THẾ', part_name: 'Lốp Bridgestone Dueler H/T', quantity: 4, unit_price: 3850000, po_number: 'PO-2026-0910' },
      { category: 'Lốp', item_name: 'Cân mâm bấm chì 4 bánh', action: 'SỬA CHỮA', part_name: 'Công cân bằng động', quantity: 4, unit_price: 150000, po_number: 'PO-2026-0910' },
    ],
  },
  {
    id: 'ord_2609_09',
    vehicle_id: 'veh_15',
    service_date: '2026-09-28',
    odometer_km: 214500,
    garage: 'Trạm Dịch vụ Hyundai Đà Nẵng',
    service_type: 'Sửa chữa đột xuất',
    note: 'Kiểm tra động cơ yếu, xả khói trắng (tạm ngưng vận hành chờ kế hoạch thanh lý/đại tu)',
    items: [
      { category: 'Động cơ', item_name: 'Kiểm tra áp suất buồng đốt & tháo kiểm đầu máy', action: 'SỬA CHỮA', part_name: 'Công tháo lắp kiểm tra kỹ thuật', quantity: 1, unit_price: 4200000, po_number: 'PO-2026-0911' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay lọc dầu nhiên liệu thử tải', action: 'THAY THẾ', part_name: 'Lọc nhiên liệu Hino XZU', quantity: 2, unit_price: 650000, po_number: 'PO-2026-0911' },
    ],
  },
  {
    id: 'ord_2609_10',
    vehicle_id: 'veh_04',
    service_date: '2026-09-29',
    odometer_km: 156400,
    garage: 'Gara Đại Phát Miền Bắc',
    service_type: 'Sửa chữa đột xuất',
    note: 'Sửa rò rỉ đường ống hơi phanh & thay lọc gió',
    items: [
      { category: 'Phanh', item_name: 'Thay đoạn ống hơi phanh trục sau', action: 'THAY THẾ', part_name: 'Ống hơi chịu áp 12mm + cút nối', quantity: 1, unit_price: 1450000, po_number: 'PO-2026-0912' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay lọc gió động cơ', action: 'THAY THẾ', part_name: 'Lọc gió Isuzu FVR', quantity: 1, unit_price: 1150000, po_number: 'PO-2026-0912' },
    ],
  },

  // ================= THÁNG 08/2026 (9 orders) =================
  {
    id: 'ord_2608_01',
    vehicle_id: 'veh_01',
    service_date: '2026-08-05',
    odometer_km: 221900,
    garage: 'Gara Đầu Kéo Mỹ Phước',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng 220.000 km & thay bộ giảm xóc trục trước',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ 15W-40 & bộ lọc', action: 'THAY THẾ', part_name: 'Nhớt Shell Rimula R4 X + 4 lọc', quantity: 1, unit_price: 5400000, po_number: 'PO-2026-0801' },
      { category: 'Gầm-treo', item_name: 'Thay cặp phuộc giảm xóc trục trước', action: 'THAY THẾ', part_name: 'Phuộc Monroe Magnum Freightliner', quantity: 2, unit_price: 3850000, po_number: 'PO-2026-0801' },
      { category: 'Lốp', item_name: 'Thay lốp dẫn hướng 11R22.5', action: 'THAY THẾ', part_name: 'Lốp Michelin XZE2+ 11R22.5', quantity: 2, unit_price: 7500000, po_number: 'PO-2026-0802' },
    ],
  },
  {
    id: 'ord_2608_02',
    vehicle_id: 'veh_06',
    service_date: '2026-08-10',
    odometer_km: 361800,
    garage: 'Gara Đầu Kéo Mỹ Phước',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay trục các-đăng và chữ thập bị rơ',
    items: [
      { category: 'Gầm-treo', item_name: 'Thay bi chữ thập & cân bằng trục các-đăng', action: 'THAY THẾ', part_name: 'Bộ chữ thập Spicer + công cân', quantity: 2, unit_price: 2950000, po_number: 'PO-2026-0803' },
      { category: 'Gầm-treo', item_name: 'Thay gối đỡ trục các-đăng giữa', action: 'THAY THẾ', part_name: 'Bi quang treo trục các-đăng', quantity: 1, unit_price: 2650000, po_number: 'PO-2026-0803' },
    ],
  },
  {
    id: 'ord_2608_03',
    vehicle_id: 'veh_08',
    service_date: '2026-08-14',
    odometer_km: 112600,
    garage: 'Trạm Dịch vụ Hyundai Đà Nẵng',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay 4 lốp sau mòn đều',
    items: [
      { category: 'Lốp', item_name: 'Thay 4 lốp sau 8.25R16', action: 'THAY THẾ', part_name: 'Lốp DRC 8.25R16', quantity: 4, unit_price: 3950000, po_number: 'PO-2026-0804' },
      { category: 'Phanh', item_name: 'Vệ sinh và căn chỉnh phanh 4 bánh', action: 'SỬA CHỮA', part_name: 'Công bảo dưỡng phanh', quantity: 1, unit_price: 1200000, po_number: 'PO-2026-0804' },
    ],
  },
  {
    id: 'ord_2608_04',
    vehicle_id: 'veh_09',
    service_date: '2026-08-18',
    odometer_km: 100900,
    garage: 'Trung tâm Bảo dưỡng Isuzu Bình Dương',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng cấp lớn 100.000 km',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay toàn bộ dầu nhớt & lọc (máy/hộp số/cầu)', action: 'THAY THẾ', part_name: 'Combo dầu nhớt & bộ lọc Isuzu', quantity: 1, unit_price: 5200000, po_number: 'PO-2026-0805' },
      { category: 'Động cơ', item_name: 'Thay dây curoa quạt & kiểm tra bơm nước', action: 'THAY THẾ', part_name: 'Dây curoa Bando chính hãng', quantity: 2, unit_price: 680000, po_number: 'PO-2026-0805' },
      { category: 'Điều hòa', item_name: 'Bảo dưỡng hệ thống lạnh thùng đông lạnh', action: 'SỬA CHỮA', part_name: 'Vệ sinh dàn nóng + kiểm tra gas', quantity: 1, unit_price: 2450000, po_number: 'PO-2026-0806' },
    ],
  },
  {
    id: 'ord_2608_05',
    vehicle_id: 'veh_12',
    service_date: '2026-08-20',
    odometer_km: 196800,
    garage: 'Gara Đại Phát Miền Bắc',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng 200.000 km',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ & bộ lọc định kỳ', action: 'THAY THẾ', part_name: 'Nhớt Hyundai Xcient + 4 lọc', quantity: 1, unit_price: 6100000, po_number: 'PO-2026-0807' },
      { category: 'Phanh', item_name: 'Thay má phanh trước/sau', action: 'THAY THẾ', part_name: 'Bộ má phanh Hyundai Xcient', quantity: 2, unit_price: 3950000, po_number: 'PO-2026-0807' },
    ],
  },
  {
    id: 'ord_2608_06',
    vehicle_id: 'veh_03',
    service_date: '2026-08-22',
    odometer_km: 288400,
    garage: 'Xưởng Lốp & Gầm Đồng Nai',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay mâm kéo (bàn xoay) bị mòn khóa hàm',
    items: [
      { category: 'Gầm-treo', item_name: 'Thay bộ ruột khóa mâm kéo JOST 50', action: 'THAY THẾ', part_name: 'Bộ kit sửa chữa mâm JOST', quantity: 1, unit_price: 6800000, po_number: 'PO-2026-0808' },
      { category: 'Gầm-treo', item_name: 'Bơm mỡ & căn chỉnh bàn xoay', action: 'SỬA CHỮA', part_name: 'Mỡ bò chịu cực áp + công', quantity: 1, unit_price: 1100000, po_number: 'PO-2026-0808' },
    ],
  },
  {
    id: 'ord_2608_07',
    vehicle_id: 'veh_13',
    service_date: '2026-08-25',
    odometer_km: 145600,
    garage: 'Gara Thành Công Auto',
    service_type: 'Sửa chữa đột xuất',
    note: 'Sửa quạt làm mát điều hòa cabin & thay rơ-le',
    items: [
      { category: 'Điều hòa', item_name: 'Thay quạt giàn nóng điều hòa', action: 'THAY THẾ', part_name: 'Quạt giàn nóng Denso 12V', quantity: 1, unit_price: 2350000, po_number: 'PO-2026-0809' },
      { category: 'Hệ thống điện', item_name: 'Thay rơ-le điều khiển quạt & cầu chì', action: 'THAY THẾ', part_name: 'Rơ-le Denso 4 chân', quantity: 2, unit_price: 320000, po_number: 'PO-2026-0809' },
    ],
  },
  {
    id: 'ord_2608_08',
    vehicle_id: 'veh_14',
    service_date: '2026-08-28',
    odometer_km: 100400,
    garage: 'Xưởng Lốp & Gầm Đồng Nai',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng cấp lớn 100.000 km xe bán tải',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt máy, dầu hộp số tự động & lọc', action: 'THAY THẾ', part_name: 'Nhớt Mitsubishi + ATF SP-III', quantity: 1, unit_price: 4350000, po_number: 'PO-2026-0810' },
      { category: 'Phanh', item_name: 'Thay má phanh trước/sau', action: 'THAY THẾ', part_name: 'Bộ má phanh Triton chính hãng', quantity: 1, unit_price: 2350000, po_number: 'PO-2026-0810' },
    ],
  },
  {
    id: 'ord_2608_09',
    vehicle_id: 'veh_07',
    service_date: '2026-08-29',
    odometer_km: 159900,
    garage: 'Xưởng Dịch Vụ Hino Sài Gòn',
    service_type: 'Kiểm định',
    note: 'Bảo dưỡng chuẩn bị kiểm định & thay bóng đèn thùng',
    items: [
      { category: 'Hệ thống điện', item_name: 'Thay bộ đèn hông & đèn hậu LED 24V', action: 'THAY THẾ', part_name: 'Bộ đèn LED thùng xe tải', quantity: 1, unit_price: 1650000, po_number: 'PO-2026-0811' },
      { category: 'Khác', item_name: 'Phí dịch vụ và căn chỉnh kiểm định', action: 'SỬA CHỮA', part_name: 'Dịch vụ đăng kiểm', quantity: 1, unit_price: 1950000, po_number: 'PO-2026-0811' },
    ],
  },

  // ================= THÁNG 07/2026 (5 orders for 6-month trend) =================
  {
    id: 'ord_2607_01',
    vehicle_id: 'veh_01',
    service_date: '2026-07-08',
    odometer_km: 212400,
    garage: 'Gara Đầu Kéo Mỹ Phước',
    service_type: 'Sửa chữa đột xuất',
    note: 'Sửa hệ thống làm mát khí nạp (intercooler)',
    items: [
      { category: 'Động cơ', item_name: 'Thay két làm mát khí nạp Intercooler', action: 'THAY THẾ', part_name: 'Intercooler nhôm Freightliner', quantity: 1, unit_price: 18500000, po_number: 'PO-2026-0701' },
      { category: 'Động cơ', item_name: 'Thay ống nối silicone chịu áp', action: 'THAY THẾ', part_name: 'Bộ ống silicone + cổ dê inox', quantity: 2, unit_price: 1450000, po_number: 'PO-2026-0701' },
    ],
  },
  {
    id: 'ord_2607_02',
    vehicle_id: 'veh_03',
    service_date: '2026-07-14',
    odometer_km: 279200,
    garage: 'Xưởng Lốp & Gầm Đồng Nai',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng 280.000 km & thay 4 lốp sau',
    items: [
      { category: 'Lốp', item_name: 'Thay lốp trục truyền động 12R22.5', action: 'THAY THẾ', part_name: 'Lốp Maxxis 12R22.5', quantity: 4, unit_price: 6800000, po_number: 'PO-2026-0702' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ & lọc nhớt', action: 'THAY THẾ', part_name: 'Nhớt Shell Rimula + 3 lọc', quantity: 1, unit_price: 5100000, po_number: 'PO-2026-0702' },
    ],
  },
  {
    id: 'ord_2607_03',
    vehicle_id: 'veh_04',
    service_date: '2026-07-19',
    odometer_km: 149800,
    garage: 'Gara Đại Phát Miền Bắc',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng 150.000 km & thay lốp trước',
    items: [
      { category: 'Lốp', item_name: 'Thay cặp lốp trước 10.00R20', action: 'THAY THẾ', part_name: 'Lốp Bridgestone 10.00R20', quantity: 2, unit_price: 7400000, po_number: 'PO-2026-0703' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt máy & lọc định kỳ', action: 'THAY THẾ', part_name: 'Nhớt Isuzu 15W-40 + bộ lọc', quantity: 1, unit_price: 3750000, po_number: 'PO-2026-0703' },
    ],
  },
  {
    id: 'ord_2607_04',
    vehicle_id: 'veh_05',
    service_date: '2026-07-23',
    odometer_km: 82500,
    garage: 'Gara Thành Công Auto',
    service_type: 'Sửa chữa đột xuất',
    note: 'Vệ sinh dàn nóng và thay dây curoa máy lạnh thùng',
    items: [
      { category: 'Điều hòa', item_name: 'Thay dây curoa máy lạnh thùng & nạp gas', action: 'THAY THẾ', part_name: 'Dây curoa Mitsuboshi + gas R404A', quantity: 1, unit_price: 3650000, po_number: 'PO-2026-0704' },
      { category: 'Hệ thống điện', item_name: 'Kiểm tra bộ điều khiển nhiệt độ cabin', action: 'SỬA CHỮA', part_name: 'Công sửa chữa mạch điều khiển', quantity: 1, unit_price: 1250000, po_number: 'PO-2026-0704' },
    ],
  },
  {
    id: 'ord_2607_05',
    vehicle_id: 'veh_11',
    service_date: '2026-07-28',
    odometer_km: 68200,
    garage: 'Gara Thành Công Auto',
    service_type: 'Sửa chữa đột xuất',
    note: 'Sơn dặm cản sau & đánh bóng đèn pha',
    items: [
      { category: 'Thân vỏ', item_name: 'Gò sơn cản sau & đánh bóng đèn', action: 'SỬA CHỮA', part_name: 'Sơn 2K + công đồng sơn', quantity: 1, unit_price: 3900000, po_number: 'PO-2026-0705' },
    ],
  },

  // ================= THÁNG 06/2026 (5 orders for 6-month trend) =================
  {
    id: 'ord_2606_01',
    vehicle_id: 'veh_06',
    service_date: '2026-06-06',
    odometer_km: 352100,
    garage: 'Gara Đầu Kéo Mỹ Phước',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay bộ ly hợp và sửa phớt hộp số',
    items: [
      { category: 'Động cơ', item_name: 'Thay bộ lá côn, bàn ép & bi T', action: 'THAY THẾ', part_name: 'Bộ ly hợp Sachs 430mm', quantity: 1, unit_price: 16800000, po_number: 'PO-2026-0601' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay dầu hộp số 85W-90', action: 'THAY THẾ', part_name: 'Dầu số Shell Spirax (16L)', quantity: 1, unit_price: 2450000, po_number: 'PO-2026-0601' },
    ],
  },
  {
    id: 'ord_2606_02',
    vehicle_id: 'veh_12',
    service_date: '2026-06-12',
    odometer_km: 188200,
    garage: 'Gara Đại Phát Miền Bắc',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng 190.000 km & thay 4 lốp rơ-moóc',
    items: [
      { category: 'Lốp', item_name: 'Thay 4 lốp trục sau 12R22.5', action: 'THAY THẾ', part_name: 'Lốp Sailun S815 12R22.5', quantity: 4, unit_price: 6400000, po_number: 'PO-2026-0602' },
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt động cơ & bộ lọc', action: 'THAY THẾ', part_name: 'Nhớt Hyundai Xcient + 4 lọc', quantity: 1, unit_price: 5900000, po_number: 'PO-2026-0602' },
    ],
  },
  {
    id: 'ord_2606_03',
    vehicle_id: 'veh_02',
    service_date: '2026-06-18',
    odometer_km: 122400,
    garage: 'Xưởng Dịch Vụ Hino Sài Gòn',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng cấp lớn 120.000 km',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay toàn bộ dầu nhớt và lọc', action: 'THAY THẾ', part_name: 'Combo bảo dưỡng 120k Hino FC', quantity: 1, unit_price: 5400000, po_number: 'PO-2026-0603' },
      { category: 'Phanh', item_name: 'Thay má phanh trước/sau', action: 'THAY THẾ', part_name: 'Bộ má phanh Hino FC', quantity: 1, unit_price: 3100000, po_number: 'PO-2026-0603' },
    ],
  },
  {
    id: 'ord_2606_04',
    vehicle_id: 'veh_07',
    service_date: '2026-06-22',
    odometer_km: 152400,
    garage: 'Xưởng Dịch Vụ Hino Sài Gòn',
    service_type: 'Định kỳ',
    note: 'Bảo dưỡng 150.000 km & thay cao su nhíp',
    items: [
      { category: 'Dầu nhớt-lọc', item_name: 'Thay nhớt máy & lọc định kỳ', action: 'THAY THẾ', part_name: 'Nhớt Hino 15W-40 + bộ lọc', quantity: 1, unit_price: 4500000, po_number: 'PO-2026-0604' },
      { category: 'Gầm-treo', item_name: 'Thay ắc nhíp và bạc nhíp sau', action: 'THAY THẾ', part_name: 'Bộ ắc nhíp Hino FL', quantity: 1, unit_price: 3850000, po_number: 'PO-2026-0604' },
    ],
  },
  {
    id: 'ord_2606_05',
    vehicle_id: 'veh_09',
    service_date: '2026-06-26',
    odometer_km: 94200,
    garage: 'Trung tâm Bảo dưỡng Isuzu Bình Dương',
    service_type: 'Sửa chữa đột xuất',
    note: 'Thay 2 lốp sau và cân chỉnh phanh',
    items: [
      { category: 'Lốp', item_name: 'Thay cặp lốp sau 8.25R16', action: 'THAY THẾ', part_name: 'Lốp Bridgestone 8.25R16', quantity: 2, unit_price: 5200000, po_number: 'PO-2026-0605' },
      { category: 'Phanh', item_name: 'Thay xi-lanh con phanh sau', action: 'THAY THẾ', part_name: 'Heo thắng sau Isuzu NQR', quantity: 2, unit_price: 1350000, po_number: 'PO-2026-0605' },
    ],
  },
];

export function buildSeedDataset(): {
  vehicles: Vehicle[];
  orders: MaintenanceOrder[];
  items: MaintenanceItem[];
  auditLogs: AuditLogEntry[];
} {
  const vehicleMap = new Map(SEED_VEHICLES.map((v) => [v.id, v]));
  const orders: MaintenanceOrder[] = [];
  const items: MaintenanceItem[] = [];

  RAW_ORDERS.forEach((raw) => {
    const v = vehicleMap.get(raw.vehicle_id);
    const createdIso = `${raw.service_date}T09:30:00.000Z`;
    orders.push({
      id: raw.id,
      vehicle_id: raw.vehicle_id,
      service_date: raw.service_date,
      odometer_km: raw.odometer_km,
      garage: raw.garage,
      driver_name: v?.driver_name ?? 'Chưa cập nhật',
      service_type: raw.service_type,
      note: raw.note,
      created_at: createdIso,
      updated_at: createdIso,
    });

    raw.items.forEach((it, idx) => {
      items.push({
        id: `${raw.id}_it_${idx + 1}`,
        order_id: raw.id,
        category: it.category,
        item_name: it.item_name,
        action: it.action,
        part_name: it.part_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        amount: it.quantity * it.unit_price,
        po_number: it.po_number,
      });
    });
  });

  const auditLogs: AuditLogEntry[] = [
    {
      id: 'log_01',
      timestamp: '2026-11-22T14:20:00.000Z',
      actor: 'Quản lý đội xe',
      action: 'CREATE',
      entity: 'order',
      summary: 'Thêm phiếu bảo dưỡng xe 51C-889.12 ngày 22/11/2026',
      details: '2 hạng mục · 4.650.000 đ · PO-2026-1119',
    },
    {
      id: 'log_02',
      timestamp: '2026-11-21T10:05:00.000Z',
      actor: 'Điều phối Bình Dương',
      action: 'CREATE',
      entity: 'order',
      summary: 'Thêm phiếu sửa chữa đột xuất xe 60H-012.34 ngày 21/11/2026',
      details: '3 hạng mục · 15.900.000 đ · PO-2026-1116',
    },
    {
      id: 'log_03',
      timestamp: '2026-11-18T16:42:00.000Z',
      actor: 'Quản lý đội xe',
      action: 'UPDATE',
      entity: 'order',
      summary: 'Cập nhật số PO-2026-1114 cho phiếu xe 61C-123.45',
      details: '2 hạng mục · Phanh & Hệ thống điện',
    },
    {
      id: 'log_04',
      timestamp: '2026-11-16T08:50:00.000Z',
      actor: 'Kỹ thuật viên xưởng',
      action: 'CREATE',
      entity: 'order',
      summary: 'Thêm phiếu xe 61H-045.67 (chưa ghi nhận số km)',
      details: '2 hạng mục · 7.850.000 đ · PO-2026-1115',
    },
  ];

  return {
    vehicles: SEED_VEHICLES,
    orders,
    items,
    auditLogs,
  };
}
