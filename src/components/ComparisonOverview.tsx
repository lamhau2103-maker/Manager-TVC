import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import { MonthlyVehicleStatusRow } from '../utils/analytics';
import { Vehicle } from '../types';
import {
  daysBetween,
  formatCompactVND,
  formatDateVN,
  formatNumber,
  formatVND,
  getCurrentMonthStatusTitle,
  getLocalISODate,
} from '../utils/format';
import { normalizePlateKey } from '../utils/plate';

interface ComparisonOverviewProps {
  title?: string;
  periodLabel: string;
  prevLabel: string;
  vehicleStatuses: MonthlyVehicleStatusRow[];
  liveTodayISO?: string;
  activePlateKey?: string;
  onOpenVehicle: (vehicleId: string, plate?: string) => void;
  onOpenVehicleDrawer?: (vehicle: Vehicle) => void;
  onToggleCrossFilterPlate?: (vehicle: Vehicle) => void;
  onOpenNewOrderForVehicle?: (vehicleId: string) => void;
  canCreateOrder?: boolean;
}

export const ComparisonOverview: React.FC<ComparisonOverviewProps> = ({
  title,
  periodLabel,
  prevLabel,
  vehicleStatuses,
  liveTodayISO = getLocalISODate(),
  activePlateKey = '',
  onOpenVehicle,
  onOpenVehicleDrawer,
  onToggleCrossFilterPlate,
  onOpenNewOrderForVehicle,
  canCreateOrder = false,
}) => {
  const sectionTitle = title || getCurrentMonthStatusTitle();
  const [statusFilter, setStatusFilter] = useState<'all' | 'serviced' | 'unserviced' | 'due'>('all');

  const servicedCount = useMemo(
    () => vehicleStatuses.filter((v) => v.servicedInPeriod).length,
    [vehicleStatuses]
  );
  const unservicedCount = vehicleStatuses.length - servicedCount;
  const dueAttentionCount = useMemo(
    () => vehicleStatuses.filter((v) => v.dueStatus !== 'ok').length,
    [vehicleStatuses]
  );
  const servicedPct =
    vehicleStatuses.length > 0 ? Math.round((servicedCount / vehicleStatuses.length) * 100) : 0;

  const filteredVehicleStatuses = useMemo(() => {
    if (statusFilter === 'serviced') return vehicleStatuses.filter((v) => v.servicedInPeriod);
    if (statusFilter === 'unserviced') return vehicleStatuses.filter((v) => !v.servicedInPeriod);
    if (statusFilter === 'due') return vehicleStatuses.filter((v) => v.dueStatus !== 'ok');
    return vehicleStatuses;
  }, [vehicleStatuses, statusFilter]);

  const normalizedActiveKey = normalizePlateKey(activePlateKey);

  return (
    <section
      aria-label={sectionTitle}
      className="glass-panel rounded-2xl p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="fluid-section-title font-extrabold text-slate-950 break-words">
              {sectionTitle}
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/12 border border-emerald-500/25 text-xs sm:text-[11px] font-bold text-emerald-900 font-mono tabular-nums whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Đã làm: {servicedCount}/{vehicleStatuses.length} xe ({servicedPct}%)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/12 border border-amber-500/25 text-xs sm:text-[11px] font-bold text-amber-900 font-mono tabular-nums whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              Chưa làm: {unservicedCount} xe
            </span>
          </div>
          <p className="text-sm md:text-xs text-slate-600 leading-relaxed break-words">
            Hiển thị trực quan toàn bộ phương tiện đã phát sinh bảo dưỡng, xe chưa vào xưởng, hạn đăng kiểm và chu kỳ km · Bấm vào thẻ xe để xem nhanh lịch sử
          </p>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto lg:self-center min-w-0">
          {/* Filter Tabs */}
          <div className="flex-1 sm:flex-initial min-w-0 scroll-snap-x">
            <div className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl glass-segment min-w-max">
              {(
                [
                  { id: 'all', label: `Tất cả (${vehicleStatuses.length})` },
                  { id: 'serviced', label: `Đã bảo dưỡng (${servicedCount})` },
                  { id: 'unserviced', label: `Chưa bảo dưỡng (${unservicedCount})` },
                  { id: 'due', label: `Cần chú ý (${dueAttentionCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3.5 min-h-[40px] md:min-h-[34px] py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 ${
                    statusFilter === tab.id
                      ? 'tab-3d-active'
                      : 'tab-3d'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Coverage Progress Bar */}
      <div className="h-2 rounded-full bg-slate-900/8 border border-white/60 overflow-hidden shadow-inner">
        <div
          className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-500 shadow-[0_0_10px_rgba(16,185,129,0.4)] transition-all duration-500"
          style={{ width: `${servicedPct}%` }}
        />
      </div>

      {/* Vehicle Cards Grid */}
      {filteredVehicleStatuses.length === 0 ? (
        <div className="py-8 text-center text-sm md:text-xs text-slate-600 font-medium">
          Không có xe nào thuộc nhóm lọc này trong {periodLabel.toLowerCase()}.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {filteredVehicleStatuses.map((row) => {
            const v = row.vehicle;
            const regDaysLeft = v.registration_due_date
              ? daysBetween(liveTodayISO, v.registration_due_date)
              : row.regDaysLeft;
            const isRegExpired = regDaysLeft !== null && regDaysLeft < 0;
            const isRegUrgent = regDaysLeft !== null && regDaysLeft >= 0 && regDaysLeft <= 30;
            const isOverdue = row.dueStatus === 'overdue' || isRegExpired;
            const isUpcoming = row.dueStatus === 'upcoming' || isRegUrgent;
            const isUp = row.variance > 0;
            const isDown = row.variance < 0;
            const vehKey = v.plate_key || normalizePlateKey(v.plate);
            const isCrossFiltered = Boolean(normalizedActiveKey && vehKey === normalizedActiveKey);

            return (
              <div
                key={v.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (onOpenVehicleDrawer) {
                    onOpenVehicleDrawer(v);
                  } else {
                    onOpenVehicle(v.id, v.plate);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (onOpenVehicleDrawer) onOpenVehicleDrawer(v);
                    else onOpenVehicle(v.id, v.plate);
                  }
                }}
                className={`glass-tile rounded-xl p-3.5 flex flex-col justify-between gap-2.5 min-w-0 cursor-pointer group hover:-translate-y-0.5 ${
                  isCrossFiltered
                    ? 'bg-linear-to-br! from-blue-50/90! to-indigo-50/75! border-blue-400! ring-2 ring-blue-500/35'
                    : row.servicedInPeriod
                    ? 'border-emerald-300/80! bg-linear-to-br! from-emerald-50/65! via-white/75! to-teal-50/55!'
                    : isOverdue
                    ? 'border-red-300/85! bg-linear-to-br! from-red-50/70! via-white/75! to-rose-50/60!'
                    : ''
                }`}
              >
                {/* Top Row: Plate + Glowing Status Badge */}
                <div className="space-y-1 min-w-0">
                  <div className="flex items-start justify-between gap-1.5 min-w-0">
                    <span className="font-mono text-sm font-extrabold text-slate-950 group-hover:text-blue-700 transition-colors break-words min-w-0">
                      {v.plate}
                    </span>

                    {row.servicedInPeriod ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/12 border border-emerald-500/25 text-emerald-900 text-[11px] sm:text-[10px] font-bold whitespace-nowrap shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.85)]" />
                        Đã bảo dưỡng
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/12 border border-amber-500/25 text-amber-900 text-[11px] sm:text-[10px] font-bold whitespace-nowrap shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.85)]" />
                        Chưa làm
                      </span>
                    )}
                  </div>

                  <div className="text-xs sm:text-[11px] text-slate-600 font-medium break-words leading-snug">
                    {v.type} · {v.department}
                  </div>
                </div>

                {/* Middle Content */}
                {row.servicedInPeriod ? (
                  <div className="space-y-1.5 pt-2 border-t border-slate-900/8">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                      <span className="font-mono font-semibold text-slate-700">
                        {row.latestServiceDate ? formatDateVN(row.latestServiceDate) : '—'}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600/10 text-blue-800 break-words">
                        {row.latestServiceType || 'Bảo dưỡng'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-baseline justify-between gap-1 font-mono tabular-nums">
                      <span className="text-xs font-extrabold text-slate-950">
                        {formatCompactVND(row.currentCost)}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          isUp
                            ? 'text-red-700'
                            : isDown
                            ? 'text-emerald-700'
                            : 'text-slate-500'
                        }`}
                        title={`Chênh lệch so với ${prevLabel}: ${formatVND(row.variance)}`}
                      >
                        {row.variance > 0 ? '+' : ''}
                        {formatCompactVND(row.variance)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 pt-2 border-t border-slate-900/8">
                    <div className="flex items-start justify-between gap-1.5 text-[11px]">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <CalendarClock
                          className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                            isOverdue
                              ? 'text-red-600'
                              : isUpcoming
                              ? 'text-amber-600'
                              : 'text-slate-500'
                          }`}
                        />
                        <div className="min-w-0 leading-snug">
                          {v.registration_due_date ? (
                            <>
                              <div className="font-mono font-semibold text-slate-800">
                                ĐK: {formatDateVN(v.registration_due_date)}
                              </div>
                              <div
                                className={`text-[10.5px] font-bold tabular-nums mt-0.5 ${
                                  isRegExpired
                                    ? 'text-red-700'
                                    : isRegUrgent
                                    ? 'text-amber-800'
                                    : 'text-emerald-700'
                                }`}
                              >
                                {isRegExpired
                                  ? `Quá hạn ${Math.abs(regDaysLeft ?? 0)} ngày`
                                  : isRegUrgent
                                  ? `Còn ${regDaysLeft} ngày (Khẩn)`
                                  : `Còn ${regDaysLeft} ngày`}
                              </div>
                            </>
                          ) : row.kmLeft < 0 ? (
                            <span className="font-semibold text-red-700">
                              Quá {formatNumber(Math.abs(row.kmLeft))} km
                            </span>
                          ) : (
                            <span className="text-slate-600">Chưa có lịch ĐK</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Urgent registration or km-cycle badge for already-serviced vehicles */}
                {row.servicedInPeriod && (isRegExpired || isRegUrgent || row.kmLeft < 1000) && (
                  <div
                    className={`inline-flex items-start gap-1 text-[10px] font-bold px-2 py-1 rounded-md leading-snug ${
                      isRegExpired || row.kmLeft < 0
                        ? 'bg-red-500/12 text-red-800 border border-red-400/35'
                        : 'bg-amber-500/12 text-amber-900 border border-amber-400/35'
                    }`}
                  >
                    <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>
                      {isRegExpired
                        ? `Quá hạn ĐK ${Math.abs(regDaysLeft ?? 0)} ngày`
                        : isRegUrgent
                        ? `ĐK còn ${regDaysLeft} ngày`
                        : row.kmLeft < 0
                        ? `Quá chu kỳ ${formatNumber(Math.abs(row.kmLeft))} km`
                        : `Sắp tới mốc km (còn ${formatNumber(row.kmLeft)} km)`}
                    </span>
                  </div>
                )}

                {/* Card Footer */}
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  {onToggleCrossFilterPlate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleCrossFilterPlate(v);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                        isCrossFiltered
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white/65 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-white/90'
                      }`}
                    >
                      <Filter className="w-3 h-3 shrink-0" />
                      <span>{isCrossFiltered ? 'Đang lọc' : 'Lọc phiếu'}</span>
                    </button>
                  )}

                  {canCreateOrder && onOpenNewOrderForVehicle && !row.servicedInPeriod && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenNewOrderForVehicle(v.id);
                      }}
                      className="flex-1 min-h-[32px] inline-flex items-center justify-center gap-1 py-1 px-2 rounded-lg glass-button-primary text-white text-[11px] font-semibold touch-press"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Lập phiếu
                    </button>
                  )}

                  <span className="ml-auto text-[10.5px] font-bold text-slate-500 group-hover:text-blue-700 transition-colors whitespace-nowrap">
                    Chi tiết →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
