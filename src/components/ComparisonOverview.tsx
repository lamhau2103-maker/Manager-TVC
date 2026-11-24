import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  EyeOff,
  Flame,
  Minus,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  HeatmapMonthCol,
  HeatmapRow,
  MonthlyVehicleStatusRow,
  PeriodMetrics,
} from '../utils/analytics';
import { DashboardBlockId, GlobalFilters } from '../types';
import {
  calcPctChange,
  formatCompactVND,
  formatDateVN,
  formatNumber,
  formatVND,
} from '../utils/format';

function useCountUp(target: number, duration = 420): number {
  const [val, setVal] = useState(target);
  useEffect(() => {
    const start = val;
    const diff = target - start;
    if (Math.abs(diff) < 1) {
      setVal(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(start + diff * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return val;
}

interface ComparisonOverviewProps {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  periodBudget: number;
  monthlyBudget: number;
  isMonthPreset: boolean;
  onUpdateMonthlyBudget: (nextBudget: number) => void;
  periodLabel: string;
  prevLabel: string;
  heatmap: {
    months: HeatmapMonthCol[];
    byDepartment: HeatmapRow[];
    byVehicle: HeatmapRow[];
  };
  vehicleStatuses: MonthlyVehicleStatusRow[];
  activeFilters: GlobalFilters;
  onFilterChange: (patch: Partial<GlobalFilters>) => void;
  onFilterMissingPo: () => void;
  onOpenVehicle: (vehicleId: string, plate?: string) => void;
  onOpenNewOrderForVehicle: (vehicleId: string) => void;
  hideBudgetHeatmap?: boolean;
  hideMonthlyStatus?: boolean;
  isAdminMode?: boolean;
  onToggleBlock?: (block: DashboardBlockId) => void;
}

export const ComparisonOverview: React.FC<ComparisonOverviewProps> = ({
  current,
  previous,
  periodBudget,
  monthlyBudget,
  isMonthPreset,
  onUpdateMonthlyBudget,
  periodLabel,
  prevLabel,
  heatmap,
  vehicleStatuses,
  activeFilters,
  onFilterChange,
  onFilterMissingPo,
  onOpenVehicle,
  onOpenNewOrderForVehicle,
  hideBudgetHeatmap = false,
  hideMonthlyStatus = false,
  isAdminMode = false,
  onToggleBlock,
}) => {
  // Budget inline editor
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState(String(monthlyBudget));

  // Heatmap controls
  const [heatmapScope, setHeatmapScope] = useState<'department' | 'vehicle'>('department');
  const [heatmapMetric, setHeatmapMetric] = useState<'variance' | 'cost'>('variance');
  const [showAllVehiclesHeatmap, setShowAllVehiclesHeatmap] = useState(false);

  // Fleet monthly servicing status filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'serviced' | 'unserviced' | 'due'>('all');

  const animatedTotal = useCountUp(current.totalCost);

  // Budget & Variance calculations
  const safeBudget = Math.max(periodBudget, 1);
  const budgetUtilizationPct = (current.totalCost / safeBudget) * 100;
  const budgetVariance = current.totalCost - periodBudget; // > 0 = over budget, <= 0 = remaining
  const budgetVariancePct = (budgetVariance / safeBudget) * 100;

  const momVariance = current.totalCost - previous.totalCost;
  const momPct = calcPctChange(current.totalCost, previous.totalCost);

  const budgetState: 'safe' | 'warning' | 'over' =
    budgetUtilizationPct > 100 ? 'over' : budgetUtilizationPct >= 85 ? 'warning' : 'safe';

  const budgetMeta =
    budgetState === 'over'
      ? {
          label: 'Vượt ngân sách',
          pill: 'bg-red-100/90 text-red-800 border-red-200',
          bar: 'bg-linear-to-r from-red-600 via-rose-500 to-red-500',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />,
        }
      : budgetState === 'warning'
      ? {
          label: 'Sát trần ngân sách',
          pill: 'bg-amber-100/90 text-amber-900 border-amber-200',
          bar: 'bg-linear-to-r from-amber-500 via-orange-500 to-amber-400',
          icon: <Flame className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
        }
      : {
          label: 'Trong ngân sách',
          pill: 'bg-emerald-100/90 text-emerald-800 border-emerald-200',
          bar: 'bg-linear-to-r from-blue-600 via-sky-500 to-teal-500',
          icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
        };

  const handleOpenBudgetEdit = () => {
    setBudgetDraft(String(monthlyBudget));
    setEditingBudget(true);
  };

  const handleSaveBudget = () => {
    const parsed = Number(budgetDraft.replace(/[^\d]/g, ''));
    if (Number.isFinite(parsed) && parsed >= 1_000_000) {
      onUpdateMonthlyBudget(parsed);
      setEditingBudget(false);
    }
  };

  // Heatmap matrix normalization
  const rawHeatmapRows = heatmapScope === 'department' ? heatmap.byDepartment : heatmap.byVehicle;
  const visibleHeatmapRows =
    heatmapScope === 'vehicle' && !showAllVehiclesHeatmap
      ? rawHeatmapRows.slice(0, 7)
      : rawHeatmapRows;

  const { maxCellCost, maxAbsDelta } = useMemo(() => {
    let maxC = 1;
    let maxD = 1;
    for (const r of rawHeatmapRows) {
      for (const c of r.cells) {
        if (c.cost > maxC) maxC = c.cost;
        if (c.deltaPrev !== null && Math.abs(c.deltaPrev) > maxD) {
          maxD = Math.abs(c.deltaPrev);
        }
      }
    }
    return { maxCellCost: maxC, maxAbsDelta: maxD };
  }, [rawHeatmapRows]);

  const getHeatmapCellStyle = (cost: number, deltaPrev: number | null) => {
    if (heatmapMetric === 'variance') {
      if (deltaPrev === null || deltaPrev === 0) {
        return 'bg-white/40 border-white/70 text-slate-400';
      }
      const ratio = Math.min(1, Math.abs(deltaPrev) / maxAbsDelta);
      if (deltaPrev > 0) {
        if (ratio >= 0.65) return 'bg-red-500/30 border-red-300/80 text-red-950 font-bold';
        if (ratio >= 0.3) return 'bg-red-500/18 border-red-200/80 text-red-900 font-semibold';
        return 'bg-red-500/10 border-red-200/60 text-red-800 font-medium';
      } else {
        if (ratio >= 0.65) return 'bg-emerald-500/28 border-emerald-300/80 text-emerald-950 font-bold';
        if (ratio >= 0.3) return 'bg-emerald-500/18 border-emerald-200/80 text-emerald-900 font-semibold';
        return 'bg-emerald-500/10 border-emerald-200/60 text-emerald-800 font-medium';
      }
    }

    // Cost intensity mode
    if (cost <= 0) return 'bg-white/35 border-white/65 text-slate-400';
    const ratio = Math.min(1, cost / maxCellCost);
    if (ratio >= 0.78) return 'bg-red-500/26 border-red-300/80 text-red-950 font-bold';
    if (ratio >= 0.5) return 'bg-blue-600/25 border-blue-300/80 text-blue-950 font-bold';
    if (ratio >= 0.25) return 'bg-sky-500/18 border-sky-200/80 text-sky-950 font-semibold';
    return 'bg-sky-400/10 border-sky-200/60 text-slate-800 font-medium';
  };

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
    <div className="space-y-4">
      {/* ROW 1: Budget Progress & Variance (5 cols) + Cost Variance Heatmap (7 cols) */}
      {!hideBudgetHeatmap && (
      <section
        aria-label="Ngân sách và biểu đồ nhiệt biến động chi phí"
        className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch"
      >
        {/* LEFT CARD: Tổng chi phí thực tế so với Ngân sách tháng */}
        <div className="xl:col-span-5 glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            {/* Header & Budget Edit Trigger */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="fluid-section-title font-bold text-slate-950 leading-snug">
                  Tổng chi phí thực tế so với Ngân sách
                </h2>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  Kỳ đối chiếu: <strong className="text-slate-800">{periodLabel}</strong>
                  {!isMonthPreset && (
                    <span className="ml-1 text-slate-500">
                      (quy đổi từ ngân sách tháng {formatCompactVND(monthlyBudget)})
                    </span>
                  )}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap shrink-0 ${budgetMeta.pill}`}
              >
                {budgetMeta.icon}
                {budgetMeta.label}
              </span>
            </div>

            {/* Hero Actual Spend vs Budget Target */}
            <div className="flex flex-wrap items-baseline justify-between gap-3 pt-1">
              <div className="min-w-0">
                <div className="font-mono fluid-kpi-value font-extrabold tracking-tight text-slate-950 tabular-nums leading-none">
                  {formatCompactVND(animatedTotal)}
                </div>
                <div className="mt-1.5 font-mono text-xs font-medium text-slate-600 tabular-nums break-words">
                  Thực chi: {formatVND(current.totalCost)}
                </div>
              </div>

              {/* Inline Budget Editor */}
              <div className="text-left sm:text-right">
                {editingBudget ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={budgetDraft}
                      onChange={(e) => setBudgetDraft(e.target.value.replace(/[^\d]/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveBudget();
                        if (e.key === 'Escape') setEditingBudget(false);
                      }}
                      placeholder="VNĐ / tháng"
                      className="w-36 min-h-[44px] sm:min-h-[34px] px-2.5 rounded-xl glass-input font-mono text-xs font-bold text-slate-900 text-right"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveBudget}
                      className="min-w-[44px] min-h-[44px] sm:min-w-[34px] sm:min-h-[34px] inline-flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 touch-press"
                      title="Lưu ngân sách tháng"
                    >
                      <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingBudget(false)}
                      className="min-w-[44px] min-h-[44px] sm:min-w-[34px] sm:min-h-[34px] inline-flex items-center justify-center rounded-xl glass-tile text-slate-600 hover:text-slate-900 touch-press"
                      title="Hủy"
                    >
                      <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenBudgetEdit}
                    className="group inline-flex flex-col items-start sm:items-end text-left sm:text-right min-h-[44px] justify-center hover:opacity-90 transition-opacity touch-press"
                    title="Nhấn để điều chỉnh ngân sách tháng"
                  >
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 group-hover:text-blue-700">
                      Ngân sách kỳ
                      <Pencil className="w-3 h-3 opacity-70" />
                    </span>
                    <span className="font-mono text-base font-extrabold text-slate-900 tabular-nums">
                      {formatCompactVND(periodBudget)}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Glassy Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Mức sử dụng ngân sách</span>
                <span
                  className={`font-mono font-extrabold tabular-nums ${
                    budgetState === 'over'
                      ? 'text-red-700'
                      : budgetState === 'warning'
                      ? 'text-amber-700'
                      : 'text-blue-700'
                  }`}
                >
                  {budgetUtilizationPct.toFixed(1)}%
                </span>
              </div>

              <div className="relative h-4 rounded-full bg-white/60 border border-white/90 shadow-inner overflow-hidden">
                {/* 85% warning threshold marker */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-slate-400/70 z-10 pointer-events-none"
                  style={{ left: '85%' }}
                  title="Ngưỡng cảnh báo 85% ngân sách"
                />
                <div
                  className={`h-full rounded-full transition-all duration-500 ${budgetMeta.bar}`}
                  style={{ width: `${Math.min(100, Math.max(2, budgetUtilizationPct))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 tabular-nums">
                <span>0 đ</span>
                <span>Ngưỡng cảnh báo 85% ({formatCompactVND(periodBudget * 0.85)})</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* 2 Variance Comparison Glass Tiles (Chênh lệch thay cho chỉ số trung bình) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Tile 1: Budget Variance */}
            <div className="glass-tile rounded-xl p-3 space-y-1">
              <div className="text-[11px] font-semibold text-slate-600">
                Chênh lệch Ngân sách
              </div>
              <div
                className={`flex items-center gap-1 font-mono text-base font-extrabold tabular-nums ${
                  budgetVariance > 0 ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                {budgetVariance > 0 ? (
                  <ArrowUpRight className="w-4 h-4 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {budgetVariance > 0 ? '+' : '-'}
                  {formatCompactVND(Math.abs(budgetVariance))}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 font-medium">
                {budgetVariance > 0
                  ? `Vượt trần +${Math.abs(budgetVariancePct).toFixed(1)}%`
                  : `Còn dư ${Math.abs(budgetVariancePct).toFixed(1)}% hạn mức`}
              </div>
            </div>

            {/* Tile 2: Period-over-Period Variance */}
            <div className="glass-tile rounded-xl p-3 space-y-1">
              <div className="text-[11px] font-semibold text-slate-600 leading-snug">
                Chênh lệch vs {prevLabel}
              </div>
              <div
                className={`flex items-center gap-1 font-mono text-base font-extrabold tabular-nums ${
                  momVariance > 0
                    ? 'text-red-700'
                    : momVariance < 0
                    ? 'text-emerald-700'
                    : 'text-slate-700'
                }`}
              >
                {momVariance > 0 ? (
                  <ArrowUpRight className="w-4 h-4 shrink-0" />
                ) : momVariance < 0 ? (
                  <ArrowDownRight className="w-4 h-4 shrink-0" />
                ) : (
                  <Minus className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {momVariance > 0 ? '+' : ''}
                  {formatCompactVND(momVariance)}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 font-mono tabular-nums">
                {prevLabel}: {formatCompactVND(previous.totalCost)}
                {momPct !== null && (
                  <span className="ml-1 font-bold">
                    ({momPct > 0 ? '+' : ''}
                    {Math.round(momPct)}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Missing PO actionable alert */}
          {current.missingPoItemCount > 0 && (
            <button
              type="button"
              onClick={onFilterMissingPo}
              className="w-full min-h-[44px] flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50/75 hover:bg-amber-50/95 border border-amber-200/90 text-xs text-amber-900 font-semibold transition-colors touch-press"
            >
              <span className="inline-flex items-center gap-1.5 text-left">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Chưa gắn PO: {formatCompactVND(current.missingPoAmount)}
              </span>
              <span className="text-amber-700 underline underline-offset-2 whitespace-nowrap">
                Lọc xem ngay
              </span>
            </button>
          )}
        </div>

        {/* RIGHT CARD: Biến động chi phí theo bộ phận / xe (Biểu đồ nhiệt Heatmap) */}
        <div className="xl:col-span-7 glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5">
          {/* Header + Dual Segmented Switchers */}
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-950">
                Biến động chi phí theo {heatmapScope === 'department' ? 'bộ phận' : 'từng xe'} (Biểu đồ nhiệt)
              </h2>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Xếp theo mức chênh lệch lớn nhất 4 tháng gần nhất · Bấm vào dòng để{' '}
                {heatmapScope === 'department' ? 'lọc bộ phận' : 'mở hồ sơ xe'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Dimension Toggle */}
              <div className="inline-flex items-center p-0.5 rounded-xl glass-segment">
                <button
                  type="button"
                  onClick={() => setHeatmapScope('department')}
                  className={`px-2.5 min-h-[36px] sm:min-h-[28px] py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    heatmapScope === 'department'
                      ? 'bg-white/90 text-blue-700 shadow-xs'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  Theo bộ phận
                </button>
                <button
                  type="button"
                  onClick={() => setHeatmapScope('vehicle')}
                  className={`px-2.5 min-h-[36px] sm:min-h-[28px] py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    heatmapScope === 'vehicle'
                      ? 'bg-white/90 text-blue-700 shadow-xs'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  Theo từng xe
                </button>
              </div>

              {/* Cell Mode Toggle */}
              <div className="inline-flex items-center p-0.5 rounded-xl glass-segment">
                <button
                  type="button"
                  onClick={() => setHeatmapMetric('variance')}
                  className={`px-2.5 min-h-[36px] sm:min-h-[28px] py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    heatmapMetric === 'variance'
                      ? 'bg-white/90 text-blue-700 shadow-xs'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  Chênh lệch (+/-)
                </button>
                <button
                  type="button"
                  onClick={() => setHeatmapMetric('cost')}
                  className={`px-2.5 min-h-[36px] sm:min-h-[28px] py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    heatmapMetric === 'cost'
                      ? 'bg-white/90 text-blue-700 shadow-xs'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  Chi phí
                </button>
              </div>

              {isAdminMode && onToggleBlock && (
                <button
                  type="button"
                  onClick={() => onToggleBlock('budget_heatmap')}
                  title="Quyền Admin: Ẩn khối Ngân sách & Biểu đồ nhiệt"
                  className="min-w-[36px] min-h-[36px] sm:min-w-[30px] sm:min-h-[30px] inline-flex items-center justify-center rounded-xl glass-tile text-slate-500 hover:text-red-700 hover:bg-white/85 transition-colors"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Heatmap Grid */}
          {visibleHeatmapRows.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-10 text-xs text-slate-500">
              Không có dữ liệu chi phí phù hợp bộ lọc hiện tại.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full border-separate border-spacing-y-1.5 border-spacing-x-1.5 min-w-[560px]">
                <thead>
                  <tr className="text-[11px] font-semibold text-slate-600">
                    <th className="sticky-col-left-head text-left pb-1 pl-2 pr-2 rounded-lg font-semibold min-w-[140px] sm:min-w-[165px]">
                      {heatmapScope === 'department' ? 'Bộ phận / Khu vực' : 'Biển số xe'}
                    </th>
                    {heatmap.months.map((m, idx) => (
                      <th
                        key={m.monthKey}
                        className={`text-center pb-1 font-mono whitespace-nowrap ${
                          idx === heatmap.months.length - 1
                            ? 'text-blue-800 font-bold'
                            : 'text-slate-600'
                        }`}
                      >
                        {m.label}
                      </th>
                    ))}
                    <th className="text-right pb-1 pr-1.5 font-semibold whitespace-nowrap">
                      Biến động kỳ này
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHeatmapRows.map((row) => {
                    const isDeptActive =
                      heatmapScope === 'department' && activeFilters.department === row.id;
                    const isUp = row.variance > 0;
                    const isDown = row.variance < 0;

                    return (
                      <tr
                        key={row.id}
                        onClick={() => {
                          if (heatmapScope === 'department') {
                            onFilterChange({
                              department: activeFilters.department === row.id ? '' : row.id,
                            });
                          } else if (row.vehicleId) {
                            onOpenVehicle(row.vehicleId, row.plate);
                          }
                        }}
                        className={`group cursor-pointer transition-colors ${
                          isDeptActive ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        {/* Row Title (sticky on horizontal scroll) */}
                        <td
                          className={`sticky-col-left py-2 px-2.5 rounded-xl border transition-colors ${
                            isDeptActive
                              ? 'bg-blue-50/95 border-blue-300'
                              : 'border-white/85 group-hover:bg-white/95 group-hover:border-blue-200'
                          }`}
                        >
                          <div
                            className={`text-xs font-bold text-slate-900 break-words leading-snug ${
                              heatmapScope === 'vehicle' ? 'font-mono whitespace-nowrap' : ''
                            }`}
                          >
                            {row.label}
                          </div>
                          <div className="text-[10px] text-slate-500 break-words leading-snug">
                            {row.sublabel}
                          </div>
                        </td>

                        {/* 4-Month Heat Cells */}
                        {row.cells.map((cell, idx) => {
                          const isLatest = idx === row.cells.length - 1;
                          const cellClass = getHeatmapCellStyle(cell.cost, cell.deltaPrev);
                          const displayVal =
                            heatmapMetric === 'variance'
                              ? cell.deltaPrev === null || cell.deltaPrev === 0
                                ? '0'
                                : `${cell.deltaPrev > 0 ? '+' : ''}${formatCompactVND(cell.deltaPrev)}`
                              : cell.cost > 0
                              ? formatCompactVND(cell.cost)
                              : '—';

                          const tooltipText = `${row.label} (${cell.label}): Chi phí ${formatVND(
                            cell.cost
                          )} · Chênh lệch tháng trước: ${
                            cell.deltaPrev === null
                              ? '—'
                              : `${cell.deltaPrev > 0 ? '+' : ''}${formatVND(cell.deltaPrev)}`
                          }`;

                          return (
                            <td
                              key={cell.monthKey}
                              title={tooltipText}
                              className={`py-2 px-1.5 rounded-xl border text-center font-mono text-[11px] tabular-nums whitespace-nowrap transition-transform group-hover:scale-[1.01] ${cellClass} ${
                                isLatest ? 'ring-1 ring-blue-400/60' : ''
                              }`}
                            >
                              {displayVal}
                            </td>
                          );
                        })}

                        {/* Rightmost Variance Summary */}
                        <td className="py-1.5 px-2.5 rounded-xl bg-white/50 border border-white/80 text-right font-mono tabular-nums whitespace-nowrap">
                          <div
                            className={`inline-flex items-center justify-end gap-0.5 text-xs font-extrabold ${
                              isUp
                                ? 'text-red-700'
                                : isDown
                                ? 'text-emerald-700'
                                : 'text-slate-500'
                            }`}
                          >
                            {isUp ? (
                              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                            ) : isDown ? (
                              <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <Minus className="w-3 h-3 shrink-0" />
                            )}
                            <span>
                              {row.variance > 0 ? '+' : ''}
                              {formatCompactVND(row.variance)}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {formatCompactVND(row.currentCost)}
                            {row.variancePct !== null && (
                              <span
                                className={`ml-1 font-semibold ${
                                  isUp
                                    ? 'text-red-700'
                                    : isDown
                                    ? 'text-emerald-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                ({row.variancePct > 0 ? '+' : ''}
                                {Math.round(row.variancePct)}%)
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer: Color Scale Legend + Expand Vehicles Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/70 text-[11px] text-slate-600">
            {heatmapMetric === 'variance' ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-700">Thang biến động:</span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-xs bg-emerald-500/30 border border-emerald-300" />
                  Giảm chi mạnh
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-xs bg-white/60 border border-slate-200" />
                  Ổn định
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-xs bg-red-500/30 border border-red-300" />
                  Tăng chi đột biến
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-700">Thang chi phí:</span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-xs bg-sky-400/15 border border-sky-200" />
                  Thấp
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-xs bg-blue-600/25 border border-blue-300" />
                  Trung bình cao
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-xs bg-red-500/28 border border-red-300" />
                  Điểm nóng chi phí
                </span>
              </div>
            )}

            {heatmapScope === 'vehicle' && rawHeatmapRows.length > 7 && (
              <button
                type="button"
                onClick={() => setShowAllVehiclesHeatmap((prev) => !prev)}
                className="text-xs font-bold text-blue-700 hover:underline whitespace-nowrap"
              >
                {showAllVehiclesHeatmap
                  ? 'Thu gọn Top 7 xe biến động'
                  : `Xem tất cả ${rawHeatmapRows.length} xe`}
              </button>
            )}
          </div>
        </div>
      </section>
      )}

      {/* ROW 2: Tình trạng bảo dưỡng đội xe trong kỳ (Đã làm vs Chưa làm đến hiện tại) */}
      {!hideMonthlyStatus && (
      <section
        aria-label="Tình trạng bảo dưỡng đội xe trong kỳ"
        className="glass-panel rounded-2xl p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-sm sm:text-base font-bold text-slate-950">
                Xe nào đã bảo dưỡng trong {periodLabel.toLowerCase()}? (đến hiện tại)
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

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:self-center">
            {/* Filter Tabs */}
            <div className="w-full sm:w-auto scroll-snap-x">
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
                title="Quyền Admin: Ẩn khối Tình trạng bảo dưỡng trong kỳ"
                className="min-w-[38px] min-h-[38px] sm:min-w-[32px] sm:min-h-[32px] inline-flex items-center justify-center rounded-xl glass-tile text-slate-500 hover:text-red-700 hover:bg-white/85 transition-colors"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
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
                        row.regStatus === 'expired' || row.regStatus === 'urgent' || row.kmLeft < 0
                          ? 'bg-red-100/90 text-red-800'
                          : 'bg-amber-100/90 text-amber-900'
                      }`}
                    >
                      <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5" />
                      <span className="break-words">
                        {row.regStatus === 'expired'
                          ? `Quá hạn ĐK ${Math.abs(row.regDaysLeft ?? 0)} ngày`
                          : row.regStatus === 'urgent'
                          ? `Đăng kiểm khẩn: còn ${row.regDaysLeft} ngày`
                          : row.kmLeft < 0
                          ? `Quá ${formatNumber(Math.abs(row.kmLeft))} km chu kỳ`
                          : `Sắp chạm km (còn ${formatNumber(row.kmLeft)} km)`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}
    </div>
  );
};
