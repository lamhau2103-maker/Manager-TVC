import {
  EnrichedOrder,
  GlobalFilters,
  MaintenanceCategory,
  MaintenanceItem,
  MaintenanceOrder,
  Vehicle,
} from '../types';
import {
  calcPctChange,
  daysBetween,
  formatCompactVND,
  formatDateVN,
  formatKm,
  formatMonthLabel,
  formatShortMonth,
  getCurrentYearMonth,
  getMonthDateRange,
  getPreviousMonth,
  REFERENCE_TODAY,
} from './format';
import { normalizePlateKey } from './plate';


export interface DateRange {
  start: string;
  end: string;
  label: string;
}

export function resolveDateRange(filters: GlobalFilters): DateRange {
  const { periodPreset, selectedMonth, customStartDate, customEndDate } = filters;
  const fallbackYM = getCurrentYearMonth();
  const activeYM = selectedMonth || fallbackYM;
  const [yStr, mStr] = activeYM.split('-');
  const now = new Date();
  const year = Number(yStr) || now.getFullYear();
  const month = Number(mStr) || now.getMonth() + 1;

  if (periodPreset === 'month') {
    const r = getMonthDateRange(activeYM);
    return { ...r, label: formatMonthLabel(activeYM) };
  }
  if (periodPreset === 'quarter') {
    const q = Math.floor((month - 1) / 3);
    const startM = q * 3 + 1;
    const endM = startM + 2;
    const endDay = new Date(year, endM, 0).getDate();
    return {
      start: `${year}-${String(startM).padStart(2, '0')}-01`,
      end: `${year}-${String(endM).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
      label: `Quý ${q + 1}/${year}`,
    };
  }
  if (periodPreset === 'year') {
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      label: `Năm ${year}`,
    };
  }
  const activeRange = getMonthDateRange(activeYM);
  return {
    start: customStartDate || activeRange.start,
    end: customEndDate || activeRange.end,
    label: `${customStartDate || '—'} → ${customEndDate || '—'}`,
  };
}

export function resolvePreviousRange(filters: GlobalFilters): DateRange {
  const { periodPreset, selectedMonth, customStartDate, customEndDate } = filters;
  const activeYM = selectedMonth || getCurrentYearMonth();
  const [yStr, mStr] = activeYM.split('-');
  const now = new Date();
  const year = Number(yStr) || now.getFullYear();
  const month = Number(mStr) || now.getMonth() + 1;

  if (periodPreset === 'month') {
    const prevM = getPreviousMonth(activeYM, 1);
    const r = getMonthDateRange(prevM);
    return { ...r, label: formatMonthLabel(prevM) };
  }
  if (periodPreset === 'quarter') {
    const q = Math.floor((month - 1) / 3);
    const prevQStartDate = new Date(year, (q - 1) * 3, 1);
    const py = prevQStartDate.getFullYear();
    const pmStart = prevQStartDate.getMonth() + 1;
    const pmEnd = pmStart + 2;
    const endDay = new Date(py, pmEnd, 0).getDate();
    return {
      start: `${py}-${String(pmStart).padStart(2, '0')}-01`,
      end: `${py}-${String(pmEnd).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
      label: `Quý trước`,
    };
  }
  if (periodPreset === 'year') {
    return {
      start: `${year - 1}-01-01`,
      end: `${year - 1}-12-31`,
      label: `Năm ${year - 1}`,
    };
  }
  const span = Math.max(1, daysBetween(customStartDate, customEndDate) + 1);
  const startD = new Date(`${customStartDate}T00:00:00`);
  startD.setDate(startD.getDate() - span);
  const endD = new Date(`${customStartDate}T00:00:00`);
  endD.setDate(endD.getDate() - 1);
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    start: toISO(startD),
    end: toISO(endD),
    label: 'Kỳ trước',
  };
}

/**
 * Apply filters cleanly: order-level filters apply to orders/vehicles,
 * item-level filters (category, action, poNumber, item search) filter the items
 * so PO & category stats are ALWAYS calculated strictly at the maintenance_items level.
 */
export function filterEnrichedOrders(
  vehicles: Vehicle[],
  orders: MaintenanceOrder[],
  items: MaintenanceItem[],
  filters: GlobalFilters,
  dateRangeOverride?: { start: string; end: string },
  ignoreDate = false
): {
  orders: EnrichedOrder[];
  items: Array<MaintenanceItem & { order: MaintenanceOrder; vehicle?: Vehicle }>;
} {
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
  const itemsByOrder = new Map<string, MaintenanceItem[]>();
  for (const it of items) {
    const arr = itemsByOrder.get(it.order_id);
    if (arr) arr.push(it);
    else itemsByOrder.set(it.order_id, [it]);
  }

  const range = dateRangeOverride ?? resolveDateRange(filters);
  const q = filters.searchQuery.trim().toLowerCase();
  const qPlateKey = normalizePlateKey(filters.searchQuery);
  const filterPlateKey = normalizePlateKey(filters.plateKey);

  const enrichedOrders: EnrichedOrder[] = [];
  const flatItems: Array<MaintenanceItem & { order: MaintenanceOrder; vehicle?: Vehicle }> = [];

  for (const ord of orders) {
    if (!ignoreDate && (ord.service_date < range.start || ord.service_date > range.end)) {
      continue;
    }

    const veh = vehicleMap.get(ord.vehicle_id);
    if (filterPlateKey && (!veh || !veh.plate_key.includes(filterPlateKey))) continue;
    if (filters.vehicleType && veh?.type !== filters.vehicleType) continue;
    if (filters.department && veh?.department !== filters.department) continue;
    if (filters.garage && ord.garage !== filters.garage) continue;
    if (filters.serviceType && ord.service_type !== filters.serviceType) continue;

    const orderItems = itemsByOrder.get(ord.id) ?? [];

    // Order-level search check (plate, garage, driver, note)
    const orderMatchesQuery =
      !q ||
      (veh && (veh.plate.toLowerCase().includes(q) || (qPlateKey.length >= 2 && veh.plate_key.includes(qPlateKey)))) ||
      ord.garage.toLowerCase().includes(q) ||
      ord.driver_name.toLowerCase().includes(q) ||
      ord.note.toLowerCase().includes(q);

    const matchedItems = orderItems.filter((it) => {
      if (filters.category && it.category !== filters.category) return false;
      if (filters.action && it.action !== filters.action) return false;
      if (filters.poNumber) {
        if (filters.poNumber === '__MISSING__') {
          if (it.po_number.trim() !== '') return false;
        } else if (it.po_number.trim().toUpperCase() !== filters.poNumber.trim().toUpperCase()) {
          return false;
        }
      }
      if (q && !orderMatchesQuery) {
        const itemMatch =
          it.item_name.toLowerCase().includes(q) ||
          it.part_name.toLowerCase().includes(q) ||
          it.po_number.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q);
        if (!itemMatch) return false;
      }
      return true;
    });

    // If item-level filters are active (or search didn't match order fields), skip orders with 0 matching items
    const hasItemLevelFilter =
      Boolean(filters.category) ||
      Boolean(filters.action) ||
      Boolean(filters.poNumber) ||
      (Boolean(q) && !orderMatchesQuery);

    if (hasItemLevelFilter && matchedItems.length === 0) continue;

    const poSet = new Set<string>();
    let totalAmount = 0;
    let hasMissingPo = false;
    let repairCount = 0;
    let replaceCount = 0;

    for (const it of matchedItems) {
      totalAmount += it.amount;
      if (it.po_number.trim()) poSet.add(it.po_number.trim());
      else hasMissingPo = true;
      if (it.action === 'SỬA CHỮA') repairCount += 1;
      else replaceCount += 1;

      flatItems.push({ ...it, order: ord, vehicle: veh });
    }

    enrichedOrders.push({
      ...ord,
      vehicle: veh,
      items: matchedItems,
      totalAmount,
      poNumbers: Array.from(poSet).sort(),
      hasMissingPo,
      repairCount,
      replaceCount,
    });
  }

  enrichedOrders.sort((a, b) => b.service_date.localeCompare(a.service_date));
  return { orders: enrichedOrders, items: flatItems };
}

/**
 * Compute total distance (km) traveled between consecutive service visits for orders in the period.
 */
export function computePeriodKmTraveled(
  periodOrders: EnrichedOrder[],
  allOrders: MaintenanceOrder[]
): number {
  const byVehicle = new Map<string, MaintenanceOrder[]>();
  for (const o of allOrders) {
    if (o.odometer_km <= 0) continue;
    const list = byVehicle.get(o.vehicle_id);
    if (list) list.push(o);
    else byVehicle.set(o.vehicle_id, [o]);
  }
  for (const list of byVehicle.values()) {
    list.sort((a, b) => a.service_date.localeCompare(b.service_date));
  }

  let totalDeltaKm = 0;
  for (const ord of periodOrders) {
    if (ord.odometer_km <= 0) continue;
    const history = byVehicle.get(ord.vehicle_id);
    if (!history) continue;
    const idx = history.findIndex((h) => h.id === ord.id);
    if (idx > 0) {
      const delta = ord.odometer_km - history[idx - 1].odometer_km;
      if (delta > 0 && delta < 100000) {
        totalDeltaKm += delta;
      }
    }
  }
  return totalDeltaKm;
}

export interface PeriodMetrics {
  orderCount: number;
  totalCost: number;
  itemCount: number;
  repairCount: number;
  replaceCount: number;
  avgCostPerOrder: number;
  avgCostPerVehicle: number;
  costPerKm: number;
  totalKmTraveled: number;
  servicedVehicleCount: number;
  totalVehicleCount: number;
  servicedVehiclePct: number;
  poCount: number;
  missingPoAmount: number;
  missingPoItemCount: number;
}

export function computePeriodMetrics(
  enrichedOrders: EnrichedOrder[],
  flatItems: MaintenanceItem[],
  allOrders: MaintenanceOrder[],
  totalVehicleCount: number
): PeriodMetrics {
  const orderCount = enrichedOrders.length;
  const totalCost = flatItems.reduce((s, it) => s + it.amount, 0);
  const itemCount = flatItems.length;
  const repairCount = flatItems.filter((it) => it.action === 'SỬA CHỮA').length;
  const replaceCount = itemCount - repairCount;

  const uniqueVehicles = new Set(enrichedOrders.map((o) => o.vehicle_id));
  const servicedVehicleCount = uniqueVehicles.size;
  const avgCostPerOrder = orderCount > 0 ? totalCost / orderCount : 0;
  const avgCostPerVehicle = servicedVehicleCount > 0 ? totalCost / servicedVehicleCount : 0;

  const totalKmTraveled = computePeriodKmTraveled(enrichedOrders, allOrders);
  const costPerKm = totalKmTraveled > 0 ? totalCost / totalKmTraveled : 0;

  const poSet = new Set<string>();
  let missingPoAmount = 0;
  let missingPoItemCount = 0;
  for (const it of flatItems) {
    if (it.po_number.trim()) poSet.add(it.po_number.trim());
    else {
      missingPoAmount += it.amount;
      missingPoItemCount += 1;
    }
  }

  return {
    orderCount,
    totalCost,
    itemCount,
    repairCount,
    replaceCount,
    avgCostPerOrder,
    avgCostPerVehicle,
    costPerKm,
    totalKmTraveled,
    servicedVehicleCount,
    totalVehicleCount,
    servicedVehiclePct: totalVehicleCount > 0 ? (servicedVehicleCount / totalVehicleCount) * 100 : 0,
    poCount: poSet.size,
    missingPoAmount,
    missingPoItemCount,
  };
}

export interface AlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'registration' | 'overdue_km' | 'unserviced_month' | 'anomaly' | 'data_quality';
  title: string;
  detail: string;
  vehicleId?: string;
  plate?: string;
  orderId?: string;
  filterAction?: Partial<GlobalFilters>;
}

export function computePriorityAlerts(
  vehicles: Vehicle[],
  allOrders: MaintenanceOrder[],
  allItems: MaintenanceItem[],
  periodOrders: EnrichedOrder[],
  periodLabel = 'tháng này'
): AlertItem[] {
  const alerts: AlertItem[] = [];
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
  const servicedVehIdsInPeriod = new Set(periodOrders.map((o) => o.vehicle_id));

  // 1. KHẨN CẤP: Xe quá hạn / sắp đến hạn đăng kiểm (trong vòng 30 ngày)
  for (const v of vehicles) {
    if (!v.registration_due_date) continue;
    const regDaysLeft = daysBetween(REFERENCE_TODAY, v.registration_due_date);
    if (regDaysLeft < 0) {
      alerts.push({
        id: `reg_expired_${v.id}`,
        severity: 'critical',
        category: 'registration',
        title: `KHẨN CẤP: Xe ${v.plate} ĐÃ QUÁ HẠN ĐĂNG KIỂM (${Math.abs(regDaysLeft)} ngày)`,
        detail: `Hạn cuối đăng kiểm: ${formatDateVN(v.registration_due_date)} · ${v.type} · Tài xế: ${v.driver_name} (${v.department})`,
        vehicleId: v.id,
        plate: v.plate,
      });
    } else if (regDaysLeft <= 30) {
      alerts.push({
        id: `reg_urgent_${v.id}`,
        severity: 'critical',
        category: 'registration',
        title: `KHẨN CẤP: Xe ${v.plate} sắp đến hạn đăng kiểm (còn ${regDaysLeft} ngày)`,
        detail: `Hạn cuối đăng kiểm: ${formatDateVN(v.registration_due_date)} · ${v.type} · Tài xế: ${v.driver_name} (${v.department})`,
        vehicleId: v.id,
        plate: v.plate,
      });
    }
  }

  // 2. CẢNH BÁO QUÁ KM (THEO CHU KỲ KM/LẦN) & SẮP CHẠM MỐC KM
  for (const v of vehicles) {
    if (v.next_service_km <= 0 || v.current_km <= 0) continue;
    const kmLeft = v.next_service_km - v.current_km;
    const cycleLabel = `${v.service_interval_km.toLocaleString('vi-VN')} km/lần`;

    if (kmLeft < 0) {
      alerts.push({
        id: `overdue_km_${v.id}`,
        severity: 'critical',
        category: 'overdue_km',
        title: `Xe ${v.plate} QUÁ KM chu kỳ bảo dưỡng (+${Math.abs(kmLeft).toLocaleString('vi-VN')} km)`,
        detail: `Hiện tại ${formatKm(v.current_km)} / Mốc hạn ${formatKm(v.next_service_km)} · Chu kỳ ${cycleLabel} · Tài xế: ${v.driver_name}${v.status === 'Ngưng' ? ' (Đang ngưng)' : ''}`,
        vehicleId: v.id,
        plate: v.plate,
      });
    } else if (kmLeft < 1000) {
      alerts.push({
        id: `upcoming_km_${v.id}`,
        severity: 'warning',
        category: 'overdue_km',
        title: `Xe ${v.plate} sắp chạm mốc chu kỳ km (còn ${kmLeft.toLocaleString('vi-VN')} km)`,
        detail: `Hiện tại ${formatKm(v.current_km)} / Mốc hạn ${formatKm(v.next_service_km)} · Chu kỳ ${cycleLabel} · Tài xế: ${v.driver_name}`,
        vehicleId: v.id,
        plate: v.plate,
      });
    }
  }

  // 3. CẢNH BÁO CÁC XE CHƯA BẢO DƯỠNG TRONG THÁNG / KỲ ĐANG CHỌN
  for (const v of vehicles) {
    if (v.status === 'Ngưng') continue;
    if (!servicedVehIdsInPeriod.has(v.id)) {
      const regText = v.registration_due_date
        ? ` · Hạn ĐK: ${formatDateVN(v.registration_due_date)}`
        : '';
      const kmText = v.current_km > 0 ? ` · Km: ${formatKm(v.current_km)}` : '';
      alerts.push({
        id: `unserviced_${v.id}`,
        severity: 'warning',
        category: 'unserviced_month',
        title: `Xe ${v.plate} chưa bảo dưỡng trong ${periodLabel.toLowerCase()}`,
        detail: `${v.type} · ${v.department} · Tài xế: ${v.driver_name}${kmText}${regText}`,
        vehicleId: v.id,
        plate: v.plate,
      });
    }
  }

  // 4. Abnormal vehicle cost (> 2x fleet average in current period)
  const costByVeh = new Map<string, number>();
  for (const o of periodOrders) {
    costByVeh.set(o.vehicle_id, (costByVeh.get(o.vehicle_id) ?? 0) + o.totalAmount);
  }
  const activeCosts = Array.from(costByVeh.values());
  const fleetAvgCost =
    activeCosts.length > 0 ? activeCosts.reduce((s, c) => s + c, 0) / activeCosts.length : 0;

  if (fleetAvgCost > 0) {
    for (const [vid, cost] of costByVeh.entries()) {
      if (cost > fleetAvgCost * 2) {
        const v = vehicleMap.get(vid);
        if (v) {
          const ratio = (cost / fleetAvgCost).toFixed(1);
          alerts.push({
            id: `cost_spike_${vid}`,
            severity: 'warning',
            category: 'anomaly',
            title: `Xe ${v.plate} chi phí bất thường (${formatCompactVND(cost)})`,
            detail: `Cao gấp ${ratio} lần mức mặt bằng đội xe trong ${periodLabel.toLowerCase()}`,
            vehicleId: vid,
            plate: v.plate,
          });
        }
      }
    }
  }

  // 5. Repeated replaced item within 90 days for the same vehicle
  const orderMap = new Map(allOrders.map((o) => [o.id, o]));
  const replaceHistory = new Map<string, Array<{ date: string; orderId: string; amount: number }>>();
  for (const it of allItems) {
    if (it.action !== 'THAY THẾ') continue;
    const ord = orderMap.get(it.order_id);
    if (!ord) continue;
    const key = `${ord.vehicle_id}__${it.item_name.trim().toLowerCase()}`;
    const arr = replaceHistory.get(key) ?? [];
    arr.push({ date: ord.service_date, orderId: ord.id, amount: it.amount });
    replaceHistory.set(key, arr);
  }
  for (const [key, list] of replaceHistory.entries()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < list.length; i++) {
      const gap = daysBetween(list[i - 1].date, list[i].date);
      if (gap > 0 && gap <= 90) {
        const [vid] = key.split('__');
        const v = vehicleMap.get(vid);
        const origItem = allItems.find(
          (x) => x.order_id === list[i].orderId && x.item_name.trim().toLowerCase() === key.split('__')[1]
        );
        if (v && origItem) {
          alerts.push({
            id: `repeat_${vid}_${i}_${origItem.id}`,
            severity: 'warning',
            category: 'anomaly',
            title: `Xe ${v.plate} thay lặp lại "${origItem.item_name}"`,
            detail: `Thay 2 lần chỉ cách nhau ${gap} ngày (${list[i - 1].date.slice(5)} và ${list[i].date.slice(5)}) — cần kiểm tra chất lượng phụ tùng/xưởng`,
            vehicleId: vid,
            plate: v.plate,
          });
          break;
        }
      }
    }
  }

  // 6. Data quality alerts: missing PO, missing km, decreasing km
  const missingPoItems = periodOrders.flatMap((o) => o.items.filter((i) => !i.po_number.trim()));
  if (missingPoItems.length > 0) {
    const missingTotal = missingPoItems.reduce((s, i) => s + i.amount, 0);
    alerts.push({
      id: 'dq_missing_po',
      severity: 'info',
      category: 'data_quality',
      title: `${missingPoItems.length} hạng mục chưa có số PO (${formatCompactVND(missingTotal)})`,
      detail: 'Bấm để lọc các phiếu có hạng mục thiếu số PO và bổ sung ngay',
      filterAction: { poNumber: '__MISSING__' },
    });
  }

  const missingKmOrders = periodOrders.filter((o) => !o.odometer_km || o.odometer_km <= 0);
  for (const o of missingKmOrders) {
    alerts.push({
      id: `dq_missing_km_${o.id}`,
      severity: 'info',
      category: 'data_quality',
      title: `Phiếu xe ${o.vehicle?.plate ?? '—'} ngày ${o.service_date.slice(8)}/${o.service_date.slice(5, 7)} thiếu số km`,
      detail: 'Cần cập nhật đồng hồ công-tơ-mét để tính chính xác chu kỳ km/lần',
      vehicleId: o.vehicle_id,
      plate: o.vehicle?.plate,
      orderId: o.id,
    });
  }

  // Decreasing km detection across all orders
  const ordersByVeh = new Map<string, MaintenanceOrder[]>();
  for (const o of allOrders) {
    if (o.odometer_km <= 0) continue;
    const arr = ordersByVeh.get(o.vehicle_id) ?? [];
    arr.push(o);
    ordersByVeh.set(o.vehicle_id, arr);
  }
  for (const [vid, list] of ordersByVeh.entries()) {
    list.sort((a, b) => a.service_date.localeCompare(b.service_date));
    for (let i = 1; i < list.length; i++) {
      if (list[i].odometer_km < list[i - 1].odometer_km) {
        const v = vehicleMap.get(vid);
        alerts.push({
          id: `dq_km_drop_${list[i].id}`,
          severity: 'info',
          category: 'data_quality',
          title: `Số km giảm bất thường trên xe ${v?.plate ?? vid}`,
          detail: `Ngày ${list[i].service_date}: ${list[i].odometer_km.toLocaleString('vi-VN')} km < lần trước ${list[i - 1].odometer_km.toLocaleString('vi-VN')} km`,
          vehicleId: vid,
          plate: v?.plate,
          orderId: list[i].id,
        });
      }
    }
  }

  const categoryWeight: Record<AlertItem['category'], number> = {
    registration: 0,
    overdue_km: 1,
    unserviced_month: 2,
    anomaly: 3,
    data_quality: 4,
  };
  const sevWeight = { critical: 0, warning: 1, info: 2 };
  alerts.sort(
    (a, b) => sevWeight[a.severity] - sevWeight[b.severity] || categoryWeight[a.category] - categoryWeight[b.category]
  );
  return alerts;
}

export interface SmartSummary {
  text: string;
  level: 'normal' | 'attention' | 'action';
  levelLabel: string;
}

export function buildSmartSummary(
  periodLabel: string,
  prevLabel: string,
  current: PeriodMetrics,
  previous: PeriodMetrics,
  topVehicle: { plate: string; totalCost: number } | null,
  alerts: AlertItem[]
): SmartSummary {
  const regUrgentCount = alerts.filter((a) => a.category === 'registration').length;
  const overdueKmCount = alerts.filter(
    (a) => a.category === 'overdue_km' && a.severity === 'critical'
  ).length;
  const unservicedCount = alerts.filter((a) => a.category === 'unserviced_month').length;
  const pct = calcPctChange(current.totalCost, previous.totalCost);

  let pctPhrase = '';
  if (pct !== null && previous.totalCost > 0) {
    const absPct = Math.abs(Math.round(pct));
    if (pct > 1) pctPhrase = ` (tăng ${absPct}% so với ${prevLabel.toLowerCase()})`;
    else if (pct < -1) pctPhrase = ` (giảm ${absPct}% so với ${prevLabel.toLowerCase()})`;
    else pctPhrase = ` (tương đương ${prevLabel.toLowerCase()})`;
  }

  const parts: string[] = [];
  if (current.totalCost === 0) {
    parts.push(`${periodLabel}: chưa ghi nhận chi phí bảo dưỡng nào phù hợp bộ lọc hiện tại.`);
  } else {
    parts.push(
      `${periodLabel}: tổng chi phí bảo dưỡng ${formatCompactVND(current.totalCost)}${pctPhrase}.`
    );
  }

  if (topVehicle && topVehicle.totalCost > 0) {
    parts.push(`Xe ${topVehicle.plate} tốn nhiều nhất (${formatCompactVND(topVehicle.totalCost)}).`);
  }

  const alertBits: string[] = [];
  if (regUrgentCount > 0) alertBits.push(`${regUrgentCount} xe khẩn cấp đăng kiểm`);
  if (overdueKmCount > 0) alertBits.push(`${overdueKmCount} xe quá chu kỳ km`);
  if (unservicedCount > 0) alertBits.push(`${unservicedCount} xe chưa bảo dưỡng trong kỳ`);

  if (alertBits.length > 0) {
    parts.push(`Cần lưu ý: ${alertBits.join(', ')}.`);
  } else {
    parts.push('Toàn bộ đội xe đang trong hạn đăng kiểm và chu kỳ bảo dưỡng an toàn.');
  }

  let level: SmartSummary['level'] = 'normal';
  let levelLabel = 'Bình thường';

  if (regUrgentCount > 0 || overdueKmCount > 0 || (pct !== null && pct > 25)) {
    level = 'action';
    levelLabel = 'Cần xử lý khẩn';
  } else if (unservicedCount > 0 || (pct !== null && pct > 10) || current.missingPoItemCount > 0) {
    level = 'attention';
    levelLabel = 'Cần chú ý';
  }

  return {
    text: parts.join(' '),
    level,
    levelLabel,
  };
}

/**
 * 6-month trend anchored at selectedMonth (or current month).
 */
export function buildSixMonthSeries(
  vehicles: Vehicle[],
  orders: MaintenanceOrder[],
  items: MaintenanceItem[],
  filters: GlobalFilters
) {
  const anchorMonth = filters.selectedMonth || getCurrentYearMonth();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    months.push(getPreviousMonth(anchorMonth, i));
  }

  return months.map((ym) => {
    const range = getMonthDateRange(ym);
    const res = filterEnrichedOrders(vehicles, orders, items, filters, range);
    const metrics = computePeriodMetrics(res.orders, res.items, orders, vehicles.length);
    return {
      monthKey: ym,
      label: formatShortMonth(ym),
      fullLabel: formatMonthLabel(ym),
      cost: metrics.totalCost,
      orders: metrics.orderCount,
      items: metrics.itemCount,
      avgPerOrder: metrics.avgCostPerOrder,
      avgPerVehicle: metrics.avgCostPerVehicle,
      costPerKm: metrics.costPerKm,
      servicedPct: metrics.servicedVehiclePct,
      poCount: metrics.poCount,
    };
  });
}

/**
 * Daily cost trend within selected month (with dashed previous-month comparison).
 */
export function buildDailyTrendData(
  currentOrders: EnrichedOrder[],
  previousOrders: EnrichedOrder[],
  selectedMonth: string
) {
  const [yStr, mStr] = (selectedMonth || getCurrentYearMonth()).split('-');
  const now = new Date();
  const daysInMonth = new Date(
    Number(yStr) || now.getFullYear(),
    Number(mStr) || now.getMonth() + 1,
    0
  ).getDate();
  const currMap = new Map<number, number>();
  const prevMap = new Map<number, number>();

  for (const o of currentOrders) {
    const day = Number(o.service_date.slice(8, 10));
    if (day >= 1 && day <= 31) currMap.set(day, (currMap.get(day) ?? 0) + o.totalAmount);
  }
  for (const o of previousOrders) {
    const day = Number(o.service_date.slice(8, 10));
    if (day >= 1 && day <= 31) prevMap.set(day, (prevMap.get(day) ?? 0) + o.totalAmount);
  }

  const rows: Array<{
    day: string;
    dayNum: number;
    currentCost: number;
    prevCost: number;
    cumCurrent: number;
    cumPrev: number;
  }> = [];

  let cumC = 0;
  let cumP = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const c = currMap.get(d) ?? 0;
    const p = prevMap.get(d) ?? 0;
    cumC += c;
    cumP += p;
    rows.push({
      day: String(d).padStart(2, '0'),
      dayNum: d,
      currentCost: c,
      prevCost: p,
      cumCurrent: cumC,
      cumPrev: cumP,
    });
  }
  return rows;
}

/**
 * Category breakdown (max 5 top categories + "Khác" = strictly <= 6 colors).
 */
export const CHART_PALETTE_6 = [
  '#2563EB', // Cobalt Blue
  '#0D9488', // Teal
  '#D97706', // Amber
  '#4F46E5', // Indigo
  '#0284C7', // Sky
  '#64748B', // Slate ("Khác")
];

export function buildCategoryBreakdown(items: MaintenanceItem[]) {
  const map = new Map<string, number>();
  for (const it of items) {
    map.set(it.category, (map.get(it.category) ?? 0) + it.amount);
  }
  const sorted = Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const total = sorted.reduce((s, r) => s + r.value, 0);

  if (sorted.length <= 6) {
    return sorted.map((r, i) => ({
      ...r,
      pct: total > 0 ? (r.value / total) * 100 : 0,
      color: CHART_PALETTE_6[i % CHART_PALETTE_6.length],
      isGroupedOther: false,
    }));
  }

  const top5 = sorted.slice(0, 5);
  const restValue = sorted.slice(5).reduce((s, r) => s + r.value, 0);
  const combined = [...top5, { name: 'Khác', value: restValue }];
  return combined.map((r, i) => ({
    ...r,
    pct: total > 0 ? (r.value / total) * 100 : 0,
    color: CHART_PALETTE_6[i],
    isGroupedOther: i === 5,
  }));
}

export function buildTopVehicles(
  enrichedOrders: EnrichedOrder[],
  prevOrders: EnrichedOrder[] = []
) {
  const prevMap = new Map<string, number>();
  for (const o of prevOrders) {
    prevMap.set(o.vehicle_id, (prevMap.get(o.vehicle_id) ?? 0) + o.totalAmount);
  }

  const map = new Map<
    string,
    {
      vehicleId: string;
      plate: string;
      type: string;
      totalCost: number;
      prevCost: number;
      delta: number;
      orderCount: number;
    }
  >();
  for (const o of enrichedOrders) {
    const key = o.vehicle_id;
    const prev = map.get(key);
    if (prev) {
      prev.totalCost += o.totalAmount;
      prev.orderCount += 1;
    } else {
      const pCost = prevMap.get(key) ?? 0;
      map.set(key, {
        vehicleId: o.vehicle_id,
        plate: o.vehicle?.plate ?? o.vehicle_id,
        type: o.vehicle?.type ?? '',
        totalCost: o.totalAmount,
        prevCost: pCost,
        delta: 0,
        orderCount: 1,
      });
    }
  }
  return Array.from(map.values())
    .map((r) => ({ ...r, delta: r.totalCost - r.prevCost }))
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10);
}

export interface ComparisonRow {
  key: string;
  label: string;
  currentCost: number;
  prevCost: number;
  delta: number;
  pct: number | null;
}

export function buildPeriodComparisonByDimension(
  currentItems: Array<MaintenanceItem & { order: MaintenanceOrder; vehicle?: Vehicle }>,
  prevItems: Array<MaintenanceItem & { order: MaintenanceOrder; vehicle?: Vehicle }>,
  dimension: 'category' | 'department' | 'vehicleType'
): ComparisonRow[] {
  const getKey = (it: MaintenanceItem & { order: MaintenanceOrder; vehicle?: Vehicle }) => {
    if (dimension === 'category') return it.category;
    if (dimension === 'department') return it.vehicle?.department || 'Chưa phân bộ phận';
    return it.vehicle?.type || 'Khác';
  };

  const currMap = new Map<string, number>();
  const prevMap = new Map<string, number>();
  const allKeys = new Set<string>();

  for (const it of currentItems) {
    const k = getKey(it);
    allKeys.add(k);
    currMap.set(k, (currMap.get(k) ?? 0) + it.amount);
  }
  for (const it of prevItems) {
    const k = getKey(it);
    allKeys.add(k);
    prevMap.set(k, (prevMap.get(k) ?? 0) + it.amount);
  }

  return Array.from(allKeys)
    .map((k) => {
      const c = currMap.get(k) ?? 0;
      const p = prevMap.get(k) ?? 0;
      return {
        key: k,
        label: k,
        currentCost: c,
        prevCost: p,
        delta: c - p,
        pct: calcPctChange(c, p),
      };
    })
    .sort((a, b) => Math.max(b.currentCost, b.prevCost) - Math.max(a.currentCost, a.prevCost))
    .slice(0, 7);
}

/**
 * PO breakdown computed strictly from maintenance_items (PO lives at item level!).
 */
export function buildPoBreakdown(
  flatItems: Array<MaintenanceItem & { order: MaintenanceOrder; vehicle?: Vehicle }>
) {
  const map = new Map<
    string,
    {
      poNumber: string;
      displayLabel: string;
      totalCost: number;
      itemCount: number;
      orderIds: Set<string>;
      vehiclePlates: Set<string>;
      isMissing: boolean;
    }
  >();

  for (const it of flatItems) {
    const raw = it.po_number.trim();
    const key = raw || '__MISSING__';
    const existing = map.get(key);
    if (existing) {
      existing.totalCost += it.amount;
      existing.itemCount += 1;
      existing.orderIds.add(it.order_id);
      if (it.vehicle?.plate) existing.vehiclePlates.add(it.vehicle.plate);
    } else {
      map.set(key, {
        poNumber: key,
        displayLabel: raw || 'Chưa có PO',
        totalCost: it.amount,
        itemCount: 1,
        orderIds: new Set([it.order_id]),
        vehiclePlates: new Set(it.vehicle?.plate ? [it.vehicle.plate] : []),
        isMissing: !raw,
      });
    }
  }

  return Array.from(map.values())
    .map((entry) => ({
      poNumber: entry.poNumber,
      displayLabel: entry.displayLabel,
      totalCost: entry.totalCost,
      itemCount: entry.itemCount,
      orderCount: entry.orderIds.size,
      vehicleCount: entry.vehiclePlates.size,
      vehiclePlates: Array.from(entry.vehiclePlates),
      isMissing: entry.isMissing,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

/**
 * Top recurring items / parts (by frequency & total cost).
 */
export function buildTopRecurringItems(items: MaintenanceItem[]) {
  const map = new Map<
    string,
    {
      name: string;
      category: MaintenanceCategory;
      count: number;
      totalCost: number;
    }
  >();
  for (const it of items) {
    const norm = it.item_name.trim();
    const key = norm.toLowerCase();
    const prev = map.get(key);
    if (prev) {
      prev.count += 1;
      prev.totalCost += it.amount;
    } else {
      map.set(key, {
        name: norm,
        category: it.category,
        count: 1,
        totalCost: it.amount,
      });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || b.totalCost - a.totalCost)
    .slice(0, 8);
}

/**
 * Repair vs Replace stacked breakdown by category.
 */
export function buildActionByCategory(items: MaintenanceItem[]) {
  const map = new Map<
    string,
    {
      category: string;
      repairCost: number;
      replaceCost: number;
      repairCount: number;
      replaceCount: number;
      totalCost: number;
    }
  >();

  for (const it of items) {
    const entry = map.get(it.category) ?? {
      category: it.category,
      repairCost: 0,
      replaceCost: 0,
      repairCount: 0,
      replaceCount: 0,
      totalCost: 0,
    };
    if (it.action === 'SỬA CHỮA') {
      entry.repairCost += it.amount;
      entry.repairCount += 1;
    } else {
      entry.replaceCost += it.amount;
      entry.replaceCount += 1;
    }
    entry.totalCost += it.amount;
    map.set(it.category, entry);
  }

  return Array.from(map.values())
    .sort((a, b) => b.totalCost - a.totalCost)
    .map((r) => ({
      ...r,
      repairPct: r.totalCost > 0 ? Math.round((r.repairCost / r.totalCost) * 100) : 0,
      replacePct: r.totalCost > 0 ? Math.round((r.replaceCost / r.totalCost) * 100) : 0,
    }));
}

export interface HeatmapMonthCol {
  monthKey: string;
  label: string;
  fullLabel: string;
}

export interface HeatmapCell {
  monthKey: string;
  label: string;
  cost: number;
  deltaPrev: number | null;
}

export interface HeatmapRow {
  id: string;
  label: string;
  sublabel: string;
  cells: HeatmapCell[];
  currentCost: number;
  prevCost: number;
  variance: number;
  variancePct: number | null;
  vehicleId?: string;
  plate?: string;
}

/**
 * Build a 4-month Cost & Variance Heatmap by Department and by Vehicle.
 */
export function buildCostVarianceHeatmap(
  vehicles: Vehicle[],
  orders: MaintenanceOrder[],
  items: MaintenanceItem[],
  filters: GlobalFilters
): {
  months: HeatmapMonthCol[];
  byDepartment: HeatmapRow[];
  byVehicle: HeatmapRow[];
} {
  const anchorMonth = filters.selectedMonth || getCurrentYearMonth();
  // Compute 5 months so even the earliest displayed month (4th back) has a valid MoM delta
  const allMonths: string[] = [];
  for (let i = 4; i >= 0; i--) {
    allMonths.push(getPreviousMonth(anchorMonth, i));
  }
  const displayMonths: HeatmapMonthCol[] = allMonths.slice(1).map((ym) => ({
    monthKey: ym,
    label: formatShortMonth(ym),
    fullLabel: formatMonthLabel(ym),
  }));

  // Aggregate cost per month by department and by vehicle
  const deptMonthMap = new Map<string, Map<string, number>>();
  const vehMonthMap = new Map<string, Map<string, number>>();

  for (const ym of allMonths) {
    const range = getMonthDateRange(ym);
    const filtered = filterEnrichedOrders(vehicles, orders, items, filters, range);

    for (const ord of filtered.orders) {
      const dept = ord.vehicle?.department || 'Khác';
      if (!deptMonthMap.has(dept)) deptMonthMap.set(dept, new Map());
      const dm = deptMonthMap.get(dept)!;
      dm.set(ym, (dm.get(ym) ?? 0) + ord.totalAmount);

      if (!vehMonthMap.has(ord.vehicle_id)) vehMonthMap.set(ord.vehicle_id, new Map());
      const vm = vehMonthMap.get(ord.vehicle_id)!;
      vm.set(ym, (vm.get(ym) ?? 0) + ord.totalAmount);
    }
  }

  // Ensure all active departments present in filtered fleet appear
  const allDepts = Array.from(
    new Set([
      ...deptMonthMap.keys(),
      ...vehicles
        .filter((v) => !filters.department || v.department === filters.department)
        .filter((v) => !filters.vehicleType || v.type === filters.vehicleType)
        .map((v) => v.department),
    ])
  );

  const byDepartment: HeatmapRow[] = allDepts
    .map((dept) => {
      const mMap = deptMonthMap.get(dept) ?? new Map<string, number>();
      const cells: HeatmapCell[] = displayMonths.map((col, idx) => {
        const prevYm = allMonths[idx];
        const cost = mMap.get(col.monthKey) ?? 0;
        const prevCost = mMap.get(prevYm) ?? 0;
        return {
          monthKey: col.monthKey,
          label: col.label,
          cost,
          deltaPrev: cost - prevCost,
        };
      });
      const currentCost = cells[cells.length - 1]?.cost ?? 0;
      const prevCost = cells[cells.length - 2]?.cost ?? 0;
      const variance = currentCost - prevCost;
      const deptVehCount = vehicles.filter((v) => v.department === dept).length;
      return {
        id: dept,
        label: dept,
        sublabel: `${deptVehCount} xe`,
        cells,
        currentCost,
        prevCost,
        variance,
        variancePct: calcPctChange(currentCost, prevCost),
      };
    })
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance) || b.currentCost - a.currentCost);

  const filterPlateKey = normalizePlateKey(filters.plateKey);
  const matchingVehicles = vehicles.filter((v) => {
    if (filterPlateKey && !v.plate_key.includes(filterPlateKey)) return false;
    if (filters.vehicleType && v.type !== filters.vehicleType) return false;
    if (filters.department && v.department !== filters.department) return false;
    return true;
  });

  const byVehicle: HeatmapRow[] = matchingVehicles
    .map((v) => {
      const mMap = vehMonthMap.get(v.id) ?? new Map<string, number>();
      const cells: HeatmapCell[] = displayMonths.map((col, idx) => {
        const prevYm = allMonths[idx];
        const cost = mMap.get(col.monthKey) ?? 0;
        const prevCost = mMap.get(prevYm) ?? 0;
        return {
          monthKey: col.monthKey,
          label: col.label,
          cost,
          deltaPrev: cost - prevCost,
        };
      });
      const currentCost = cells[cells.length - 1]?.cost ?? 0;
      const prevCost = cells[cells.length - 2]?.cost ?? 0;
      const variance = currentCost - prevCost;
      return {
        id: v.id,
        label: v.plate,
        sublabel: `${v.type} · ${v.department}`,
        cells,
        currentCost,
        prevCost,
        variance,
        variancePct: calcPctChange(currentCost, prevCost),
        vehicleId: v.id,
        plate: v.plate,
      };
    })
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance) || b.currentCost - a.currentCost);

  return {
    months: displayMonths,
    byDepartment,
    byVehicle,
  };
}

export interface MonthlyVehicleStatusRow {
  vehicle: Vehicle;
  servicedInPeriod: boolean;
  orderCountInPeriod: number;
  latestServiceDate: string | null;
  latestServiceType: string | null;
  latestGarage: string | null;
  currentCost: number;
  prevCost: number;
  variance: number;
  variancePct: number | null;
  dueStatus: 'overdue' | 'upcoming' | 'ok';
  kmLeft: number;
  daysLeft: number;
  regDaysLeft: number | null;
  regStatus: 'expired' | 'urgent' | 'ok';
}

/**
 * Build current-period fleet servicing checklist showing which vehicles
 * HAVE and HAVE NOT been serviced so far in the selected period,
 * together with km-cycle overdue status and registration expiry urgency.
 */
export function buildMonthlyVehicleStatus(
  vehicles: Vehicle[],
  currentOrders: EnrichedOrder[],
  prevOrders: EnrichedOrder[],
  filters: GlobalFilters
): MonthlyVehicleStatusRow[] {
  const filterPlateKey = normalizePlateKey(filters.plateKey);
  const scopedVehicles = vehicles.filter((v) => {
    if (filterPlateKey && !v.plate_key.includes(filterPlateKey)) return false;
    if (filters.vehicleType && v.type !== filters.vehicleType) return false;
    if (filters.department && v.department !== filters.department) return false;
    return true;
  });

  const currByVeh = new Map<string, EnrichedOrder[]>();
  for (const o of currentOrders) {
    const arr = currByVeh.get(o.vehicle_id) ?? [];
    arr.push(o);
    currByVeh.set(o.vehicle_id, arr);
  }

  const prevCostByVeh = new Map<string, number>();
  for (const o of prevOrders) {
    prevCostByVeh.set(o.vehicle_id, (prevCostByVeh.get(o.vehicle_id) ?? 0) + o.totalAmount);
  }

  return scopedVehicles
    .map((v) => {
      const vOrders = (currByVeh.get(v.id) ?? []).sort((a, b) =>
        b.service_date.localeCompare(a.service_date)
      );
      const currentCost = vOrders.reduce((s, o) => s + o.totalAmount, 0);
      const prevCost = prevCostByVeh.get(v.id) ?? 0;
      const variance = currentCost - prevCost;

      const hasKmTracking = v.next_service_km > 0 && v.current_km > 0;
      const kmLeft = hasKmTracking ? v.next_service_km - v.current_km : 999999;
      const daysLeft = v.next_service_date
        ? daysBetween(REFERENCE_TODAY, v.next_service_date)
        : 999;

      const regDaysLeft = v.registration_due_date
        ? daysBetween(REFERENCE_TODAY, v.registration_due_date)
        : null;
      const regStatus: MonthlyVehicleStatusRow['regStatus'] =
        regDaysLeft === null
          ? 'ok'
          : regDaysLeft < 0
          ? 'expired'
          : regDaysLeft <= 30
          ? 'urgent'
          : 'ok';

      const dueStatus: MonthlyVehicleStatusRow['dueStatus'] =
        (hasKmTracking && kmLeft < 0) || regStatus === 'expired'
          ? 'overdue'
          : (hasKmTracking && kmLeft < 1000) || regStatus === 'urgent'
          ? 'upcoming'
          : 'ok';

      return {
        vehicle: v,
        servicedInPeriod: vOrders.length > 0,
        orderCountInPeriod: vOrders.length,
        latestServiceDate: vOrders[0]?.service_date ?? null,
        latestServiceType: vOrders[0]?.service_type ?? null,
        latestGarage: vOrders[0]?.garage ?? null,
        currentCost,
        prevCost,
        variance,
        variancePct: calcPctChange(currentCost, prevCost),
        dueStatus,
        kmLeft,
        daysLeft,
        regDaysLeft,
        regStatus,
      };
    })
    .sort((a, b) => {
      if (a.servicedInPeriod !== b.servicedInPeriod) return a.servicedInPeriod ? -1 : 1;
      return b.currentCost - a.currentCost;
    });
}

