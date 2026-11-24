import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  EyeOff,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import { MonthlyVehicleStatusRow } from '../utils/analytics';
import { DashboardBlockId } from '../types';
import {
  formatCompactVND,
  formatDateVN,
  formatNumber,
  formatVND,
} from '../utils/format';

interface ComparisonOverviewProps {
  periodLabel: string;
  prevLabel: string;
  vehicleStatuses: MonthlyVehicleStatusRow[];
  onOpenVehicle: (vehicleId: string, plate?: string) => void;
  onOpenNewOrderForVehicle: (vehicleId: string) => void;
  isAdminMode?: boolean;
  onToggleBlock?: (block: DashboardBlockId) => void;
}

export const ComparisonOverview: React.FC<ComparisonOverviewProps> = ({
  periodLabel,
  prevLabel,
  vehicleStatuses,
  onOpenVehicle,
  onOpenNewOrderForVehicle,
  isAdminMode = false,
  onToggleBlock,
}) => {
  // Fleet monthly servicing status filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'serviced' | 'unserviced' | 'due'>('all');

  // Fleet monthly servicing status metrics
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

  return (
    <section
      aria-label="Thông tin bảo dưỡng trong tháng ( đến hiện tại )"
      className="glass-panel rounded-2xl p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-sm sm:text-base font-bold text-slate-950">
              Thông tin bảo dưỡng trong tháng ( đến hiện tại )
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-100/85 border border-emerald-200 text-[11px] font-bold text-emerald-900 font-mono tabular-nums">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Đã làm: {servicedCount}/{vehicleStatuses.length} xe ({servicedPct}%)
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/75 border border-slate-200/80 text-[11px] font-bold text-slate-700 font-mono tabular-nums">
              <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              Chưa làm: {unservicedCount} xe
            </span>
          </div>
          <p className="text-[11px] text-slate-600">
            Hiển thị trực quan toàn bộ phương tiện đã phát sinh bảo dưỡng, xe chưa vào xưởng, hạn đăng kiểm và chu kỳ km
          </p>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto lg:self-center min-w-0">
          {/* Filter Tabs */}
          <div className="flex-1 sm:flex-initial min-w-0 scroll-snap-x">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl glass-segment min-w-max">
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
                  className={`px-3 min-h-[38px] sm:min-h-[32px] py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-white/92 text-blue-700 shadow-xs'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {isAdminMode && onToggleBlock && (
            <button
              type="button"
              onClick={() => onToggleBlock('monthly_status')}
              title="Quyền Admin: Ẩn khối Thông tin bảo dưỡng trong tháng ( đến hiện tại )"
              className="min-w-[38px] min-h-[38px] sm:min-w-[32px] sm:min-h-[32px] inline-flex items-center justify-center rounded-xl glass-tile text-slate-500 hover:text-red-700 hover:bg-white/85 transition-colors shrink-0"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Thin Glass Coverage Bar */}
      <div className="h-2 rounded-full bg-white/55 border border-white/85 overflow-hidden">
        <div
          className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-500 transition-all duration-500"
          style={{ width: `${servicedPct}%` }}
        />
      </div>

      {/* Vehicle Cards Grid */}
      {filteredVehicleStatuses.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          Không có xe nào thuộc nhóm lọc này trong {periodLabel.toLowerCase()}.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {filteredVehicleStatuses.map((row) => {
            const v = row.vehicle;
            const isOverdue = row.dueStatus === 'overdue';
            const isUpcoming = row.dueStatus === 'upcoming';
            const isUp = row.variance > 0;
            const isDown = row.variance < 0;

            return (
              <div
                key={v.id}
                className={`rounded-xl p-3 border transition-all flex flex-col justify-between gap-2.5 ${
                  row.servicedInPeriod
                    ? 'bg-white/62 border-emerald-200/80 hover:bg-white/82 shadow-xs'
                    : isOverdue
                    ? 'bg-red-50/60 border-red-200/90 hover:bg-red-50/85'
                    : 'glass-tile hover:bg-white/75'
                }`}
              >
                {/* Top Row: Plate + Serviced Status */}
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenVehicle(v.id, v.plate)}
                      className="font-mono text-xs font-extrabold text-slate-950 hover:text-blue-700 transition-colors text-left break-words"
                    >
                      {v.plate}
                    </button>

                    {row.servicedInPeriod ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 text-[10px] font-bold whitespace-nowrap shrink-0">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        Đã làm
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-700 text-[10px] font-bold whitespace-nowrap shrink-0">
                        <Clock className="w-3 h-3 shrink-0" />
                        Chưa làm
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-600 break-words leading-snug">
                    {v.type} · {v.department}
                  </div>
                </div>

                {/* Middle Content: Serviced Detail OR Unserviced Due Status */}
                {row.servicedInPeriod ? (
                  <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                      <span className="font-mono text-slate-600">
                        {row.latestServiceDate ? formatDateVN(row.latestServiceDate) : '—'}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50/90 text-blue-800 break-words">
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
                  <div className="space-y-2 pt-1 border-t border-slate-200/60">
                    <div className="flex items-start gap-1 text-[11px]">
                      <CalendarClock
                        className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                          isOverdue
                            ? 'text-red-600'
                            : isUpcoming
                            ? 'text-amber-600'
                            : 'text-slate-500'
                        }`}
                      />
                      <span
                        className={`font-semibold break-words leading-snug ${
                          isOverdue
                            ? 'text-red-800'
                            : isUpcoming
                            ? 'text-amber-800'
                            : 'text-slate-600'
                        }`}
                      >
                        {row.regStatus === 'expired'
                          ? `Quá ĐK ${Math.abs(row.regDaysLeft ?? 0)} ngày`
                          : row.regStatus === 'urgent'
                          ? `ĐK khẩn: còn ${row.regDaysLeft} ngày`
                          : row.kmLeft < 0
                          ? `Quá ${formatNumber(Math.abs(row.kmLeft))} km`
                          : row.kmLeft < 1000
                          ? `Còn ${formatNumber(row.kmLeft)} km`
                          : v.registration_due_date
                          ? `ĐK: ${formatDateVN(v.registration_due_date)}`
                          : 'Chưa có lịch'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenNewOrderForVehicle(v.id)}
                      className="w-full min-h-[40px] sm:min-h-[34px] inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-blue-600/90 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors touch-press"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Lập phiếu ngay
                    </button>
                  </div>
                )}

                {/* Urgent registration or km-cycle badge for already-serviced vehicles */}
                {row.servicedInPeriod && (row.regStatus !== 'ok' || row.kmLeft < 1000) && (
                  <div
                    className={`inline-flex items-start gap-1 text-[10px] font-bold px-2 py-1 rounded-md leading-snug ${
                      row.regStatus === 'expired' || row.kmLeft < 0
                        ? 'bg-red-100/90 text-red-800'
                        : 'bg-amber-100/90 text-amber-900'
                    }`}
                  >
                    <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>
                      {row.regStatus === 'expired'
                        ? `Quá hạn ĐK ${Math.abs(row.regDaysLeft ?? 0)} ngày`
                        : row.regStatus === 'urgent'
                        ? `ĐK còn ${row.regDaysLeft} ngày`
                        : row.kmLeft < 0
                        ? `Quá chu kỳ ${formatNumber(Math.abs(row.kmLeft))} km`
                        : `Sắp tới mốc km (còn ${formatNumber(row.kmLeft)} km)`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
