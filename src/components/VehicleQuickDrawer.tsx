import React, { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Filter,
  Gauge,
  Plus,
  ShieldAlert,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { EnrichedOrder, MaintenanceItem, MaintenanceOrder, Vehicle } from '../types';
import {
  daysBetween,
  formatCompactVND,
  formatDateVN,
  formatKm,
  formatVND,
  getLocalISODate,
} from '../utils/format';
import { VietnamesePlateBadge } from './PlateInput';

interface VehicleQuickDrawerProps {
  vehicle: Vehicle | null;
  allOrders: MaintenanceOrder[];
  allItems: MaintenanceItem[];
  isFilteredByThisVehicle: boolean;
  canCreateOrderForVehicle: boolean;
  liveTodayISO?: string;
  onClose: () => void;
  onToggleFilterByVehicle: (vehicle: Vehicle) => void;
  onOpenFullProfile: (vehicleId: string, plate: string) => void;
  onCreateOrderForVehicle?: (vehicleId: string) => void;
}

export const VehicleQuickDrawer: React.FC<VehicleQuickDrawerProps> = ({
  vehicle,
  allOrders,
  allItems,
  isFilteredByThisVehicle,
  canCreateOrderForVehicle,
  liveTodayISO = getLocalISODate(),
  onClose,
  onToggleFilterByVehicle,
  onOpenFullProfile,
  onCreateOrderForVehicle,
}) => {
  useEffect(() => {
    if (!vehicle) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [vehicle, onClose]);

  const { vehicleOrders, totalCost, regDaysLeft } = useMemo(() => {
    if (!vehicle) {
      return { vehicleOrders: [] as EnrichedOrder[], totalCost: 0, regDaysLeft: null as number | null };
    }
    const itemsByOrder = new Map<string, MaintenanceItem[]>();
    for (const it of allItems) {
      const arr = itemsByOrder.get(it.order_id) ?? [];
      arr.push(it);
      itemsByOrder.set(it.order_id, arr);
    }

    const enriched: EnrichedOrder[] = allOrders
      .filter((o) => o.vehicle_id === vehicle.id || o.vehicle_id === vehicle.plate)
      .sort((a, b) => b.service_date.localeCompare(a.service_date))
      .map((o) => {
        const list = itemsByOrder.get(o.id) ?? [];
        const poSet = new Set(list.map((i) => i.po_number.trim()).filter(Boolean));
        return {
          ...o,
          vehicle,
          items: list,
          totalAmount: list.reduce((s, x) => s + x.amount, 0),
          poNumbers: Array.from(poSet).sort(),
          hasMissingPo: list.some((i) => !i.po_number.trim()),
          repairCount: list.filter((i) => i.action === 'SỬA CHỮA').length,
          replaceCount: list.filter((i) => i.action === 'THAY THẾ').length,
        };
      });

    const total = enriched.reduce((s, o) => s + o.totalAmount, 0);
    const rDays = vehicle.registration_due_date
      ? daysBetween(liveTodayISO, vehicle.registration_due_date)
      : null;

    return {
      vehicleOrders: enriched,
      totalCost: total,
      regDaysLeft: rDays,
    };
  }, [vehicle, allOrders, allItems, liveTodayISO]);

  const recentOrders = vehicleOrders.slice(0, 6);
  const isRegExpired = regDaysLeft !== null && regDaysLeft < 0;
  const isRegUrgent = regDaysLeft !== null && regDaysLeft >= 0 && regDaysLeft <= 30;

  return (
    <AnimatePresence>
      {vehicle && (
        <motion.div
          key="vehicle-quick-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-xs no-print"
          onClick={onClose}
        >
          <motion.aside
            key={vehicle.id}
            role="dialog"
            aria-modal="true"
            aria-label={`Hồ sơ nhanh xe ${vehicle.plate}`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md sm:max-w-lg h-[100dvh] glass-panel-strong border-l border-white/90 shadow-2xl flex flex-col overflow-hidden safe-top safe-bottom"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/75 bg-white/50 backdrop-blur-xl flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <VietnamesePlateBadge plate={vehicle.plate} size="md" square />
                <div className="min-w-0">
                  <div className="text-base font-extrabold text-slate-950 truncate">
                    {vehicle.brand_model || 'Phương tiện đội xe'}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5 truncate">
                    {vehicle.type} · {vehicle.department}
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs text-slate-700 mt-1">
                    <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-semibold truncate">{vehicle.driver_name}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng ngăn kéo thông tin xe"
                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl glass-tile text-slate-600 hover:text-slate-950 shrink-0"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Quick Metrics Strip */}
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-tile rounded-xl p-3.5">
                  <div className="text-[11px] font-medium text-slate-600">Tổng chi phí lũy kế</div>
                  <div className="mt-1 font-mono text-lg font-extrabold text-blue-700 tabular-nums">
                    {formatCompactVND(totalCost)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                    {vehicleOrders.length} phiếu bảo dưỡng
                  </div>
                </div>

                <div
                  className={`rounded-xl border p-3.5 backdrop-blur-md ${
                    isRegExpired
                      ? 'bg-red-50/80 border-red-300/80 text-red-950'
                      : isRegUrgent
                      ? 'bg-amber-50/80 border-amber-300/80 text-amber-950'
                      : 'bg-emerald-50/75 border-emerald-300/75 text-emerald-950'
                  }`}
                >
                  <div className="text-[11px] font-semibold flex items-center gap-1">
                    {isRegExpired || isRegUrgent ? (
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    )}
                    Hạn đăng kiểm
                  </div>
                  <div className="mt-1 font-mono text-base font-extrabold tabular-nums">
                    {vehicle.registration_due_date
                      ? formatDateVN(vehicle.registration_due_date)
                      : 'Chưa nhập'}
                  </div>
                  <div className="text-[11px] font-semibold mt-0.5 tabular-nums">
                    {regDaysLeft === null
                      ? 'Chưa cập nhật ngày'
                      : regDaysLeft < 0
                      ? `Quá hạn ${Math.abs(regDaysLeft)} ngày`
                      : `Còn ${regDaysLeft} ngày`}
                  </div>
                </div>
              </div>

              {/* Odometer & Status */}
              <div className="glass-tile rounded-xl p-3.5 grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-start gap-2">
                  <Gauge className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-slate-600 text-[11px]">Số km &amp; Chu kỳ</div>
                    <div className="font-mono font-bold text-slate-950 mt-0.5 tabular-nums">
                      {vehicle.current_km > 0 ? formatKm(vehicle.current_km) : 'Chưa ghi nhận'}
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono">
                      Chu kỳ: {vehicle.service_interval_km.toLocaleString('vi-VN')} km
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <CalendarClock className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-slate-600 text-[11px]">Trạng thái xe</div>
                    <div className="font-bold text-slate-950 mt-0.5">{vehicle.status}</div>
                    <div className="text-[11px] text-slate-600">
                      {vehicle.next_service_km > 0
                        ? `Mốc tiếp: ${formatKm(vehicle.next_service_km)}`
                        : 'Theo dõi định kỳ'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Maintenance History */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-950 flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-blue-600" />
                    Lịch sử bảo dưỡng gần nhất ({recentOrders.length})
                  </h3>
                  {vehicleOrders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenFullProfile(vehicle.id, vehicle.plate);
                        onClose();
                      }}
                      className="text-[11px] font-semibold text-blue-700 hover:underline inline-flex items-center gap-0.5"
                    >
                      Xem tất cả
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {recentOrders.length === 0 ? (
                  <div className="glass-subtle rounded-xl border-dashed! p-6 text-center space-y-1.5">
                    <Wrench className="w-5 h-5 text-slate-500 mx-auto" />
                    <div className="text-xs font-semibold text-slate-800">
                      Xe {vehicle.plate} chưa có lịch sử bảo dưỡng
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Các phiếu phát sinh của xe này sẽ hiển thị ngay tại đây.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {recentOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="glass-tile rounded-xl p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                              {formatDateVN(ord.service_date)}
                            </span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                              {ord.service_type}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-extrabold text-slate-950 tabular-nums shrink-0">
                            {formatVND(ord.totalAmount)}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-1">
                          <span className="truncate">{ord.garage}</span>
                          {ord.odometer_km > 0 && (
                            <span className="font-mono font-semibold text-slate-700 tabular-nums">
                              {formatKm(ord.odometer_km)}
                            </span>
                          )}
                        </div>

                        {ord.items.length > 0 && (
                          <div className="pt-1.5 border-t border-slate-100 space-y-1">
                            {ord.items.slice(0, 3).map((it) => (
                              <div
                                key={it.id}
                                className="flex items-center justify-between gap-2 text-[11px]"
                              >
                                <span className="text-slate-700 truncate">• {it.item_name}</span>
                                <span className="font-mono text-slate-500 shrink-0 tabular-nums">
                                  {it.po_number || formatCompactVND(it.amount)}
                                </span>
                              </div>
                            ))}
                            {ord.items.length > 3 && (
                              <div className="text-[10px] text-slate-400">
                                + {ord.items.length - 3} hạng mục khác
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Quick Actions */}
            <div className="px-5 py-4 border-t border-white/75 bg-white/55 backdrop-blur-xl space-y-2">
              {canCreateOrderForVehicle && onCreateOrderForVehicle && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCreateOrderForVehicle(vehicle.id);
                  }}
                  className="w-full min-h-[44px] px-4 rounded-xl glass-button-primary text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 touch-press"
                >
                  <Plus className="w-4 h-4" />
                  Tạo phiếu bảo dưỡng cho xe này
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onToggleFilterByVehicle(vehicle)}
                  className={`min-h-[42px] px-3 rounded-xl text-xs font-semibold border inline-flex items-center justify-center gap-1.5 transition-colors touch-press ${
                    isFilteredByThisVehicle
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'glass-tile text-slate-800'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {isFilteredByThisVehicle ? 'Bỏ lọc xe này' : 'Lọc phiếu xe này'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onOpenFullProfile(vehicle.id, vehicle.plate);
                    onClose();
                  }}
                  className="min-h-[42px] px-3 rounded-xl glass-tile text-slate-900 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors touch-press"
                >
                  <span>Xem hồ sơ đầy đủ</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
