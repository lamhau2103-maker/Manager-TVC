import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Minus,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Wallet,
} from 'lucide-react';
import { PeriodMetrics } from '../utils/analytics';
import { Vehicle } from '../types';
import { calcPctChange, daysBetween, formatVND, getLocalISODate } from '../utils/format';

function useAnimatedNumber(target: number, durationMs = 440): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const startVal = prevRef.current;
    if (startVal === target) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      prevRef.current = target;
      setDisplay(target);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(startVal + (target - startVal) * eased);
      setDisplay(next);
      if (t < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
        setDisplay(target);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      prevRef.current = target;
    };
  }, [target, durationMs]);

  return display;
}

interface KpiSummaryRowProps {
  currentMetrics: PeriodMetrics;
  prevMetrics: PeriodMetrics;
  vehicles: Vehicle[];
  periodLabel: string;
  prevLabel: string;
  liveTodayISO?: string;
  isLoading?: boolean;
  onFilterByMissingPo?: () => void;
  onOpenVehiclesTab?: () => void;
}

export const KpiSummaryRow: React.FC<KpiSummaryRowProps> = ({
  currentMetrics,
  prevMetrics,
  vehicles,
  periodLabel,
  prevLabel,
  liveTodayISO = getLocalISODate(),
  isLoading = false,
  onFilterByMissingPo,
  onOpenVehiclesTab,
}) => {
  const animatedTotalCost = useAnimatedNumber(Math.round(currentMetrics.totalCost));
  const animatedServicedCount = useAnimatedNumber(currentMetrics.servicedVehicleCount, 360);
  const animatedOrderCount = useAnimatedNumber(currentMetrics.orderCount, 360);
  const animatedPoCount = useAnimatedNumber(currentMetrics.poCount, 360);

  if (isLoading) {
    return (
      <section aria-label="Đang tải chỉ số tổng quan" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="glass-panel rounded-2xl p-4 sm:p-5 space-y-3 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-32 bg-slate-300/60 rounded" />
              <div className="h-9 w-9 bg-slate-300/60 rounded-xl" />
            </div>
            <div className="h-7 w-40 bg-slate-300/60 rounded" />
            <div className="h-3 w-28 bg-slate-200/70 rounded" />
          </div>
        ))}
      </section>
    );
  }

  const pctChange = calcPctChange(currentMetrics.totalCost, prevMetrics.totalCost);
  const absPct = pctChange !== null ? Math.abs(Math.round(pctChange)) : null;
  const isCostDown = pctChange !== null && pctChange < -0.5;
  const isCostUp = pctChange !== null && pctChange > 0.5;

  const totalVehicles = vehicles.length;
  const servicedPct =
    totalVehicles > 0
      ? Math.min(100, Math.round((currentMetrics.servicedVehicleCount / totalVehicles) * 100))
      : 0;

  let regExpiredCount = 0;
  let regUpcomingCount = 0;
  let regSafeCount = 0;

  for (const v of vehicles) {
    if (!v.registration_due_date) {
      regSafeCount += 1;
      continue;
    }
    const left = daysBetween(liveTodayISO, v.registration_due_date);
    if (left < 0) regExpiredCount += 1;
    else if (left <= 30) regUpcomingCount += 1;
    else regSafeCount += 1;
  }

  const alertVehicleCount = regExpiredCount + regUpcomingCount;
  const hasExpired = regExpiredCount > 0;
  const hasWarning = alertVehicleCount > 0;

  return (
    <section
      aria-label="Chỉ số tổng quan bảo dưỡng"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5"
    >
      {/* Card 1: Tổng chi phí bảo dưỡng kỳ chọn */}
      <div className="glass-panel relative overflow-hidden rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 min-w-0 hover:-translate-y-0.5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full bg-blue-500/12 blur-2xl"
        />
        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-700 truncate">
              Tổng chi phí bảo dưỡng
            </div>
            <div className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
              {periodLabel}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-600/25 ring-1 ring-white/40 flex items-center justify-center shrink-0">
            <Wallet className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="relative space-y-2 min-w-0">
          <div className="font-mono text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight tabular-nums truncate">
            {formatVND(animatedTotalCost)}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {pctChange === null ? (
              currentMetrics.totalCost > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/12 border border-amber-500/25 text-amber-900 font-semibold text-[11px]">
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-700" />
                  Mới phát sinh so với {prevLabel.toLowerCase()}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-600 font-medium text-[11px]">
                  <Minus className="w-3.5 h-3.5 text-slate-400" />
                  0% so với {prevLabel.toLowerCase()}
                </span>
              )
            ) : isCostDown ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/12 border border-emerald-500/25 text-emerald-800 font-bold text-[11px] font-mono tabular-nums">
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                -{absPct}% so với {prevLabel.toLowerCase()}
              </span>
            ) : isCostUp ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/12 border border-red-500/25 text-red-800 font-bold text-[11px] font-mono tabular-nums">
                <ArrowUpRight className="w-3.5 h-3.5 text-red-600" />
                +{absPct}% so với {prevLabel.toLowerCase()}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-600 font-medium text-[11px]">
                <Minus className="w-3.5 h-3.5 text-slate-400" />
                0% so với {prevLabel.toLowerCase()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card 2: Tiến độ bảo dưỡng đội xe */}
      <div className="glass-panel relative overflow-hidden rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 min-w-0 hover:-translate-y-0.5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full bg-teal-500/14 blur-2xl"
        />
        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-700 truncate">
              Tiến độ bảo dưỡng đội xe
            </div>
            <div className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
              Số xe đã vào xưởng trong kỳ
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-600/25 ring-1 ring-white/40 flex items-center justify-center shrink-0">
            <Truck className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="relative space-y-2 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="font-mono text-xl sm:text-2xl font-extrabold text-slate-950 tabular-nums">
              {animatedServicedCount}/{totalVehicles}{' '}
              <span className="text-sm font-bold text-slate-600">xe</span>
            </div>
            <span className="font-mono text-xs font-extrabold text-teal-800 px-2 py-0.5 rounded-md bg-teal-500/12 border border-teal-500/20 tabular-nums">
              {servicedPct}%
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="h-2 w-full rounded-full bg-slate-900/8 border border-white/60 overflow-hidden shadow-inner">
              <div
                className="h-full rounded-full bg-linear-to-r from-teal-500 to-emerald-500 shadow-[0_0_10px_rgba(20,184,166,0.45)] transition-all duration-500"
                style={{ width: `${servicedPct}%` }}
              />
            </div>
            <div className="text-[11px] font-medium text-slate-600 tabular-nums">
              {totalVehicles - currentMetrics.servicedVehicleCount > 0
                ? `Còn ${totalVehicles - currentMetrics.servicedVehicleCount} xe chưa phát sinh bảo dưỡng`
                : totalVehicles > 0
                ? '100% đội xe đã bảo dưỡng trong kỳ'
                : 'Chưa có xe trong đội'}
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Số lượng phiếu & PO phát sinh */}
      <div className="glass-panel relative overflow-hidden rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 min-w-0 hover:-translate-y-0.5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full bg-indigo-500/14 blur-2xl"
        />
        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-700 truncate">
              Phiếu bảo dưỡng &amp; Mã PO
            </div>
            <div className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
              Chứng từ đang theo dõi
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-600/25 ring-1 ring-white/40 flex items-center justify-center shrink-0">
            <ClipboardList className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="relative space-y-2 min-w-0">
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-950">
              {animatedOrderCount}
            </span>
            <span className="text-xs font-semibold text-slate-600">phiếu</span>
            <span className="text-slate-300">·</span>
            <span className="text-xl sm:text-2xl font-extrabold text-indigo-700">
              {animatedPoCount}
            </span>
            <span className="text-xs font-semibold text-slate-600">mã PO</span>
          </div>

          <div className="text-[11px] flex flex-wrap items-center gap-1.5">
            <span className="text-slate-600 font-mono font-semibold tabular-nums">
              {currentMetrics.itemCount} hạng mục
            </span>
            {currentMetrics.missingPoItemCount > 0 ? (
              <button
                type="button"
                onClick={onFilterByMissingPo}
                className="text-amber-800 hover:text-amber-950 font-bold underline underline-offset-2"
              >
                {currentMetrics.missingPoItemCount} hạng mục thiếu PO
              </button>
            ) : currentMetrics.itemCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đủ PO 100%
              </span>
            ) : (
              <span className="text-slate-500">Chưa có hạng mục</span>
            )}
          </div>
        </div>
      </div>

      {/* Card 4: Tình trạng đăng kiểm & Cảnh báo */}
      <button
        type="button"
        onClick={onOpenVehiclesTab}
        className={`glass-panel relative overflow-hidden text-left rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 min-w-0 hover:-translate-y-0.5 ${
          hasExpired
            ? 'border-red-300/90! bg-linear-to-br from-red-50/85 via-white/75 to-rose-50/75!'
            : hasWarning
            ? 'border-amber-300/90! bg-linear-to-br from-amber-50/85 via-white/75 to-orange-50/70!'
            : ''
        }`}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl ${
            hasExpired
              ? 'bg-red-500/18'
              : hasWarning
              ? 'bg-amber-500/18'
              : 'bg-emerald-500/14'
          }`}
        />
        <div className="relative flex items-start justify-between gap-2 w-full">
          <div className="min-w-0">
            <div
              className={`text-xs font-bold truncate ${
                hasExpired
                  ? 'text-red-900'
                  : hasWarning
                  ? 'text-amber-950'
                  : 'text-slate-700'
              }`}
            >
              Đăng kiểm &amp; Cảnh báo
            </div>
            <div
              className={`text-[11px] font-medium truncate mt-0.5 ${
                hasExpired
                  ? 'text-red-700'
                  : hasWarning
                  ? 'text-amber-800'
                  : 'text-slate-500'
              }`}
            >
              Kiểm tra hạn ≤ 30 ngày
            </div>
          </div>
          <div
            className={`w-10 h-10 rounded-xl shadow-md ring-1 ring-white/40 flex items-center justify-center shrink-0 text-white ${
              hasExpired
                ? 'bg-linear-to-br from-red-500 to-rose-600 shadow-red-500/25'
                : hasWarning
                ? 'bg-linear-to-br from-amber-500 to-orange-600 shadow-amber-500/25'
                : 'bg-linear-to-br from-emerald-500 to-green-600 shadow-emerald-600/25'
            }`}
          >
            {hasWarning ? (
              <ShieldAlert className="w-4.5 h-4.5" />
            ) : (
              <ShieldCheck className="w-4.5 h-4.5" />
            )}
          </div>
        </div>

        <div className="relative space-y-2 w-full min-w-0">
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span
              className={`text-xl sm:text-2xl font-extrabold ${
                hasExpired
                  ? 'text-red-700'
                  : hasWarning
                  ? 'text-amber-800'
                  : 'text-emerald-700'
              }`}
            >
              {regSafeCount}/{totalVehicles}
            </span>
            <span className="text-xs font-semibold text-slate-600">xe an toàn</span>
          </div>

          <div className="text-[11px] font-semibold">
            {hasExpired ? (
              <span className="text-red-700">
                {regExpiredCount} quá hạn · {regUpcomingCount} sắp hết hạn
              </span>
            ) : hasWarning ? (
              <span className="text-amber-800">
                {regUpcomingCount} xe sắp đến hạn đăng kiểm (≤ 30 ngày)
              </span>
            ) : totalVehicles > 0 ? (
              <span className="text-emerald-700">
                Tất cả phương tiện còn hạn đăng kiểm an toàn
              </span>
            ) : (
              <span className="text-slate-500">Chưa có phương tiện</span>
            )}
          </div>
        </div>
      </button>
    </section>
  );
};
