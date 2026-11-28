import React, { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Plus, Sparkles } from 'lucide-react';
import { GlobalFilters } from '../types';
import { formatCompactVND, formatVND } from '../utils/format';
import { normalizePlateKey } from '../utils/plate';

function useViewportWidth() {
  const [state, setState] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    orientSeq: 0,
  }));

  useEffect(() => {
    let timer: number | null = null;
    const onResize = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setState((prev) => ({
          ...prev,
          width: window.innerWidth,
        }));
      }, 120);
    };
    const onOrientationChange = () => {
      window.setTimeout(() => {
        setState((prev) => ({
          width: window.innerWidth,
          orientSeq: prev.orientSeq + 1,
        }));
      }, 200);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrientationChange);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrientationChange);
    };
  }, []);

  return {
    isMobile: state.width < 768,
    isTablet: state.width >= 768 && state.width < 1024,
    orientSeq: state.orientSeq,
  };
}

interface DashboardChartsProps {
  dailyData: Array<{
    day: string;
    dayNum: number;
    currentCost: number;
    prevCost: number;
    cumCurrent: number;
    cumPrev: number;
  }>;
  categoryData: Array<{
    name: string;
    value: number;
    pct: number;
    color: string;
    isGroupedOther: boolean;
  }>;
  topVehicles: Array<{
    vehicleId: string;
    plate: string;
    type: string;
    totalCost: number;
    prevCost: number;
    delta: number;
    orderCount: number;
  }>;
  poData: Array<{
    poNumber: string;
    displayLabel: string;
    totalCost: number;
    itemCount: number;
    orderCount: number;
    isMissing: boolean;
  }>;
  sixMonthSeries: Array<{
    monthKey: string;
    label: string;
    fullLabel: string;
    cost: number;
    orders: number;
  }>;
  recurringItems: Array<{
    name: string;
    category: string;
    count: number;
    totalCost: number;
  }>;
  actionByCategory: Array<{
    category: string;
    repairCost: number;
    replaceCost: number;
    repairCount: number;
    replaceCount: number;
    totalCost: number;
    repairPct: number;
    replacePct: number;
  }>;
  totalCategoryCost: number;
  monthlyBudget: number;
  periodLabel: string;
  prevLabel: string;
  activeCategory: string;
  activePo: string;
  activePlateKey?: string;
  canCreateOrder?: boolean;
  onCreateOrder?: () => void;
  onEnableDemoMode?: () => void;
  onFilterChange: (patch: Partial<GlobalFilters>) => void;
  onOpenVehicle?: (vehicleId: string, plate: string) => void;
}

const GLASS_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.90)',
  backdropFilter: 'blur(16px) saturate(180%)',
  WebkitBackdropFilter: 'blur(16px) saturate(180%)',
  borderRadius: 14,
  border: '1px solid rgba(255, 255, 255, 0.95)',
  boxShadow: '0 14px 32px -10px rgba(15, 23, 42, 0.22), 0 4px 12px -4px rgba(37, 99, 235, 0.12)',
  fontSize: 12,
  color: '#0f172a',
};

const ChartCard: React.FC<{
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, rightSlot, children, className = '' }) => (
  <div
    className={`glass-panel rounded-2xl p-4 sm:p-5 flex flex-col min-w-0 ${className}`}
  >
    <div className="flex flex-wrap items-start justify-between gap-2 mb-3 min-w-0">
      <div className="min-w-0 flex-1">
        <h3 className="fluid-section-title font-extrabold text-slate-950 leading-snug break-words">
          {title}
        </h3>
        <p className="text-xs sm:text-[11px] text-slate-600 mt-0.5 leading-relaxed break-words">
          {subtitle}
        </p>
      </div>
      {rightSlot}
    </div>
    <div className="flex-1 min-w-0 w-full">{children}</div>
  </div>
);

const EmptyChartBanner: React.FC<{
  message: string;
  canCreateOrder?: boolean;
  onCreateOrder?: () => void;
  onEnableDemoMode?: () => void;
}> = ({ message, canCreateOrder, onCreateOrder, onEnableDemoMode }) => (
  <div className="glass-subtle min-h-[72px] rounded-xl border-dashed! px-4 py-3 flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-8 h-8 rounded-lg glass-tile text-slate-500 flex items-center justify-center shrink-0">
        <BarChart3 className="w-4 h-4" />
      </div>
      <span className="text-xs font-medium text-slate-700 leading-snug break-words">
        {message}
      </span>
    </div>

    {canCreateOrder && onCreateOrder ? (
      <button
        type="button"
        onClick={onCreateOrder}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-button-primary text-white text-xs font-semibold whitespace-nowrap shrink-0 touch-press"
      >
        <Plus className="w-3.5 h-3.5" />
        Tạo phiếu bảo dưỡng ngay
      </button>
    ) : onEnableDemoMode ? (
      <button
        type="button"
        onClick={onEnableDemoMode}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/12 hover:bg-indigo-600/20 border border-indigo-400/40 text-indigo-800 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors touch-press"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Bật dữ liệu mẫu
      </button>
    ) : null}
  </div>
);

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  dailyData,
  categoryData,
  topVehicles,
  poData,
  sixMonthSeries,
  recurringItems,
  actionByCategory,
  totalCategoryCost,
  monthlyBudget,
  periodLabel,
  prevLabel,
  activeCategory,
  activePo,
  activePlateKey = '',
  canCreateOrder = false,
  onCreateOrder,
  onEnableDemoMode,
  onFilterChange,
}) => {
  const [dailyMode, setDailyMode] = useState<'cumulative' | 'daily'>('cumulative');
  const { isMobile, orientSeq } = useViewportWidth();
  const topPoSlice = poData.slice(0, 10);

  const sixMonthWithBudget = sixMonthSeries.map((m) => ({
    ...m,
    budget: monthlyBudget,
    variance: m.cost - monthlyBudget,
  }));

  const isDailyEmpty = dailyData.every((d) => d.currentCost === 0 && d.prevCost === 0);
  const isSixMonthEmpty = sixMonthSeries.every((m) => m.cost === 0);
  const totalTopVehicleCost = topVehicles.reduce((s, r) => s + r.totalCost, 0);
  const totalPoSliceCost = topPoSlice.reduce((s, r) => s + r.totalCost, 0);
  const normalizedActivePlate = normalizePlateKey(activePlateKey);

  return (
    <section aria-label="Biểu đồ phân tích" className="space-y-4">
      {/* Row 1: Daily trend (7 cols) + Category Donut (5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Chart 1 */}
        <ChartCard
          className="xl:col-span-7 min-w-0"
          title="Chi phí diễn biến thế nào trong tháng?"
          subtitle={`So sánh ${periodLabel} với ${prevLabel} (đường nét đứt) · Đơn vị: VNĐ`}
          rightSlot={
            !isDailyEmpty ? (
              <div className="inline-flex gap-1.5 p-1 rounded-xl glass-segment text-[11px]">
                <button
                  type="button"
                  onClick={() => setDailyMode('cumulative')}
                  className={`px-3 min-h-[34px] sm:min-h-[28px] py-1 rounded-lg font-bold ${
                    dailyMode === 'cumulative'
                      ? 'tab-3d-active'
                      : 'tab-3d'
                  }`}
                >
                  Lũy kế
                </button>
                <button
                  type="button"
                  onClick={() => setDailyMode('daily')}
                  className={`px-3 min-h-[34px] sm:min-h-[28px] py-1 rounded-lg font-bold ${
                    dailyMode === 'daily'
                      ? 'tab-3d-active'
                      : 'tab-3d'
                  }`}
                >
                  Theo ngày
                </button>
              </div>
            ) : undefined
          }
        >
          {isDailyEmpty ? (
            <EmptyChartBanner
              message={`Chưa có phát sinh chi phí theo ngày trong ${periodLabel.toLowerCase()}.`}
              canCreateOrder={canCreateOrder}
              onCreateOrder={onCreateOrder}
              onEnableDemoMode={onEnableDemoMode}
            />
          ) : (
            <div className="w-full h-64 sm:h-72 min-w-0">
              <ResponsiveContainer key={`daily-${orientSeq}`} width="100%" height="100%">
                <AreaChart
                  data={dailyData}
                  margin={{ top: 8, right: isMobile ? 6 : 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.34} />
                      <stop offset="55%" stopColor="#3B82F6" stopOpacity={0.14} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: isMobile ? 10 : 11, fill: '#475569' }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(148,163,184,0.45)' }}
                    interval={isMobile ? 5 : 2}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCompactVND(Number(v))}
                    tick={{ fontSize: isMobile ? 10 : 11, fill: '#475569' }}
                    tickLine={false}
                    axisLine={false}
                    width={isMobile ? 48 : 64}
                  />
                  <Tooltip
                    contentStyle={GLASS_TOOLTIP_STYLE}
                    labelFormatter={(l) => `Ngày ${l}`}
                    formatter={(value: unknown, name: unknown) => {
                      const num = Number(value) || 0;
                      const share =
                        totalCategoryCost > 0
                          ? ` (${Math.round((num / totalCategoryCost) * 100)}% tổng kỳ)`
                          : '';
                      return [
                        `${formatVND(num)}${name === 'cumCurrent' || name === 'currentCost' ? share : ''}`,
                        name === 'cumCurrent' || name === 'currentCost' ? periodLabel : prevLabel,
                      ];
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                    formatter={(v) =>
                      v === 'cumCurrent' || v === 'currentCost' ? periodLabel : prevLabel
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey={dailyMode === 'cumulative' ? 'cumCurrent' : 'currentCost'}
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fill="url(#costGrad)"
                  />
                  <Line
                    type="monotone"
                    dataKey={dailyMode === 'cumulative' ? 'cumPrev' : 'prevCost'}
                    stroke="#64748B"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Chart 2 */}
        <ChartCard
          className="xl:col-span-5 min-w-0"
          title="Tiền đang đi vào đâu?"
          subtitle="Phân bổ theo nhóm hạng mục (tối đa 6 màu) · Bấm vào lát cắt để lọc"
        >
          {categoryData.length === 0 ? (
            <EmptyChartBanner
              message="Chưa có dữ liệu phân bổ hạng mục trong kỳ chọn."
              canCreateOrder={canCreateOrder}
              onCreateOrder={onCreateOrder}
              onEnableDemoMode={onEnableDemoMode}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 xl:grid-cols-1 2xl:grid-cols-12 items-center gap-3 h-full">
              <div className="md:col-span-6 xl:col-span-1 2xl:col-span-6 relative h-56 sm:h-60 min-w-0 w-full">
                <ResponsiveContainer key={`pie-${orientSeq}`} width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="58%"
                      outerRadius="86%"
                      paddingAngle={2}
                      onClick={(_entry, index) => {
                        const row = categoryData[index];
                        if (!row || row.isGroupedOther) return;
                        onFilterChange({
                          category: activeCategory === row.name ? '' : row.name,
                        });
                      }}
                      className="cursor-pointer outline-none"
                    >
                      {categoryData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.color}
                          opacity={activeCategory && activeCategory !== entry.name ? 0.35 : 1}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(
                        val: unknown,
                        _n: unknown,
                        item: { payload?: { pct?: number } }
                      ) => [
                        `${formatVND(Number(val) || 0)} (${Math.round(item?.payload?.pct ?? 0)}% tỷ trọng)`,
                        'Chi phí',
                      ]}
                      contentStyle={GLASS_TOOLTIP_STYLE}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] text-slate-600 font-semibold">Tổng chi</span>
                  <span className="font-mono font-extrabold text-sm sm:text-base text-slate-950 tabular-nums">
                    {formatCompactVND(totalCategoryCost)}
                  </span>
                </div>
              </div>

              <div className="md:col-span-6 xl:col-span-1 2xl:col-span-6 space-y-1.5 min-w-0">
                {categoryData.map((c) => {
                  const selected = activeCategory === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      disabled={c.isGroupedOther}
                      onClick={() =>
                        onFilterChange({ category: selected ? '' : c.name })
                      }
                      className={`w-full min-h-[40px] sm:min-h-[34px] flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                        selected
                          ? 'bg-blue-600/12 ring-1 ring-blue-400/60 shadow-2xs'
                          : 'hover:bg-white/70'
                      } ${c.isGroupedOther ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="font-medium text-slate-800 text-left break-words leading-snug">
                          {c.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0 font-mono tabular-nums">
                        <span className="font-bold text-slate-900">{formatCompactVND(c.value)}</span>
                        <span className="text-[11px] text-slate-500 ml-1.5">
                          ({Math.round(c.pct)}%)
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Row 2: Top 10 Vehicles (6 cols) + PO Breakdown (6 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Chart 3: Side-by-side Vehicle Cost Comparison (Current vs Previous) */}
        <ChartCard
          className="xl:col-span-6 min-w-0"
          title="Xe nào tốn nhiều nhất so với kỳ trước?"
          subtitle={`So sánh Top 10 xe: ${periodLabel} vs ${prevLabel} · Bấm cột để lọc bảng phiếu bên dưới`}
        >
          {topVehicles.length === 0 ? (
            <EmptyChartBanner
              message="Chưa có dữ liệu chi phí theo xe trong kỳ."
              canCreateOrder={canCreateOrder}
              onCreateOrder={onCreateOrder}
              onEnableDemoMode={onEnableDemoMode}
            />
          ) : (
            <div className="w-full h-72 sm:h-80 min-w-0">
              <ResponsiveContainer key={`topv-${orientSeq}`} width="100%" height="100%">
                <BarChart
                  data={topVehicles}
                  layout="vertical"
                  margin={{ top: 4, right: isMobile ? 10 : 18, left: 2, bottom: 4 }}
                  barGap={2}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.3)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickCount={isMobile ? 4 : 5}
                    tickFormatter={(v) => formatCompactVND(Number(v))}
                    tick={{ fontSize: isMobile ? 10 : 11, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="plate"
                    width={isMobile ? 76 : 92}
                    tick={{
                      fontSize: isMobile ? 10 : 11,
                      fill: '#0f172a',
                      fontFamily: 'JetBrains Mono',
                      fontWeight: 600,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(37,99,235,0.07)' }}
                    contentStyle={GLASS_TOOLTIP_STYLE}
                    formatter={(value: unknown, name: unknown) => {
                      const num = Number(value) || 0;
                      const pct =
                        totalTopVehicleCost > 0
                          ? ` (${Math.round((num / totalTopVehicleCost) * 100)}% tỷ trọng)`
                          : '';
                      return [
                        `${formatVND(num)}${name === 'totalCost' ? pct : ''}`,
                        name === 'totalCost' ? periodLabel : prevLabel,
                      ];
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                    formatter={(v) => (v === 'totalCost' ? periodLabel : prevLabel)}
                  />
                  <Bar
                    dataKey="totalCost"
                    radius={[0, 5, 5, 0]}
                    barSize={11}
                    className="cursor-pointer"
                    onClick={(_entry, index) => {
                      const row = topVehicles[index];
                      if (row?.plate) {
                        const rowKey = normalizePlateKey(row.plate);
                        onFilterChange({
                          plateKey: normalizedActivePlate === rowKey ? '' : row.plate,
                        });
                      }
                    }}
                  >
                    {topVehicles.map((entry, idx) => {
                      const rowKey = normalizePlateKey(entry.plate);
                      const dimmed = Boolean(
                        normalizedActivePlate && normalizedActivePlate !== rowKey
                      );
                      return (
                        <Cell
                          key={entry.vehicleId}
                          fill={idx === 0 ? '#DC2626' : '#2563EB'}
                          opacity={dimmed ? 0.35 : 1}
                        />
                      );
                    })}
                  </Bar>
                  <Bar
                    dataKey="prevCost"
                    fill="#94A3B8"
                    radius={[0, 4, 4, 0]}
                    barSize={8}
                    className="cursor-pointer"
                    onClick={(_entry, index) => {
                      const row = topVehicles[index];
                      if (row?.plate) {
                        const rowKey = normalizePlateKey(row.plate);
                        onFilterChange({
                          plateKey: normalizedActivePlate === rowKey ? '' : row.plate,
                        });
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Chart 4 */}
        <ChartCard
          className="xl:col-span-6 min-w-0"
          title="Mỗi PO chiếm bao nhiêu?"
          subtitle="Tổng hợp theo từng hạng mục gắn số PO · Bấm cột để lọc toàn dashboard"
        >
          {topPoSlice.length === 0 ? (
            <EmptyChartBanner
              message="Chưa có dữ liệu chứng từ PO trong kỳ."
              canCreateOrder={canCreateOrder}
              onCreateOrder={onCreateOrder}
              onEnableDemoMode={onEnableDemoMode}
            />
          ) : (
            <div className="w-full h-72 sm:h-80 min-w-0">
              <ResponsiveContainer key={`po-${orientSeq}`} width="100%" height="100%">
                <BarChart
                  data={topPoSlice}
                  layout="vertical"
                  margin={{ top: 4, right: isMobile ? 10 : 20, left: 2, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" horizontal={false} />
                  <XAxis
                    type="number"
                    tickCount={isMobile ? 4 : 5}
                    tickFormatter={(v) => formatCompactVND(Number(v))}
                    tick={{ fontSize: isMobile ? 10 : 11, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="displayLabel"
                    width={isMobile ? 84 : 106}
                    tick={{
                      fontSize: isMobile ? 10 : 11,
                      fill: '#0f172a',
                      fontFamily: 'JetBrains Mono',
                      fontWeight: 600,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(13,148,136,0.07)' }}
                    contentStyle={GLASS_TOOLTIP_STYLE}
                    formatter={(
                      value: unknown,
                      _n: unknown,
                      item: { payload?: { itemCount?: number; orderCount?: number } }
                    ) => {
                      const num = Number(value) || 0;
                      const pct =
                        totalPoSliceCost > 0
                          ? `${Math.round((num / totalPoSliceCost) * 100)}% tỷ trọng`
                          : '0%';
                      return [
                        `${formatVND(num)} · ${pct} (${item?.payload?.itemCount ?? 0} hạng mục · ${item?.payload?.orderCount ?? 0} phiếu)`,
                        'Giá trị PO',
                      ];
                    }}
                  />
                  <Bar
                    dataKey="totalCost"
                    radius={[0, 6, 6, 0]}
                    barSize={18}
                    className="cursor-pointer"
                    onClick={(_entry, index) => {
                      const row = topPoSlice[index];
                      if (!row?.poNumber) return;
                      onFilterChange({
                        poNumber: activePo === row.poNumber ? '' : row.poNumber,
                      });
                    }}
                  >
                    {topPoSlice.map((entry) => (
                      <Cell
                        key={entry.poNumber}
                        fill={entry.isMissing ? '#D97706' : '#0D9488'}
                        opacity={activePo && activePo !== entry.poNumber ? 0.35 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Row 3: 6-month Trend + Repair vs Replace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Chart 5: 6-Month Cost vs Monthly Budget */}
        <ChartCard
          className="xl:col-span-6 min-w-0"
          title="Xu hướng chi phí 6 tháng so với ngân sách"
          subtitle={`Cột: Thực chi tháng (đỏ = vượt ngân sách ${formatCompactVND(monthlyBudget)}) · Nét đứt: Ngân sách tháng · Bấm cột chọn tháng`}
        >
          {isSixMonthEmpty ? (
            <EmptyChartBanner
              message="Chưa có dữ liệu chi phí trong 6 tháng gần nhất."
              canCreateOrder={canCreateOrder}
              onCreateOrder={onCreateOrder}
              onEnableDemoMode={onEnableDemoMode}
            />
          ) : (
            <div className="w-full h-64 sm:h-72 min-w-0">
              <ResponsiveContainer key={`sixm-${orientSeq}`} width="100%" height="100%">
                <ComposedChart
                  data={sixMonthWithBudget}
                  margin={{ top: 8, right: isMobile ? 8 : 14, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    angle={isMobile ? -25 : 0}
                    textAnchor={isMobile ? 'end' : 'middle'}
                    height={isMobile ? 42 : 30}
                    tick={{ fontSize: isMobile ? 10 : 11, fill: '#334155', fontWeight: 600 }}
                    axisLine={{ stroke: 'rgba(148,163,184,0.45)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCompactVND(Number(v))}
                    tick={{ fontSize: isMobile ? 10 : 11, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                    width={isMobile ? 48 : 66}
                  />
                  <Tooltip
                    contentStyle={GLASS_TOOLTIP_STYLE}
                    formatter={(
                      value: unknown,
                      name: unknown,
                      item: { payload?: { variance?: number } }
                    ) => {
                      const num = Number(value) || 0;
                      if (name === 'cost') {
                        const v = item?.payload?.variance ?? 0;
                        const pctBudget =
                          monthlyBudget > 0 ? Math.round((num / monthlyBudget) * 100) : 0;
                        const diffLabel =
                          v > 0
                            ? `Vượt +${formatCompactVND(v)}`
                            : `Dư ${formatCompactVND(Math.abs(v))}`;
                        return [
                          `${formatVND(num)} (${pctBudget}% ngân sách · ${diffLabel})`,
                          'Chi phí thực tế',
                        ];
                      }
                      return [formatVND(num), 'Ngân sách tháng'];
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                    formatter={(v) =>
                      v === 'cost' ? 'Chi phí thực tế (VNĐ)' : 'Ngân sách tháng'
                    }
                  />
                  <Bar
                    dataKey="cost"
                    radius={[8, 8, 0, 0]}
                    barSize={isMobile ? 22 : 36}
                    className="cursor-pointer"
                    onClick={(_entry, index) => {
                      const row = sixMonthWithBudget[index];
                      if (row?.monthKey) {
                        onFilterChange({ periodPreset: 'month', selectedMonth: row.monthKey });
                      }
                    }}
                  >
                    {sixMonthWithBudget.map((m) => (
                      <Cell
                        key={m.monthKey}
                        fill={
                          m.cost > monthlyBudget
                            ? '#DC2626'
                            : m.cost >= monthlyBudget * 0.85
                            ? '#D97706'
                            : '#2563EB'
                        }
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="budget"
                    stroke="#0D9488"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Chart 7: Sửa chữa hay thay thế? */}
        <ChartCard
          className="xl:col-span-6 min-w-0"
          title="Sửa chữa hay thay thế?"
          subtitle="Tỷ lệ chi phí Thay thế so với Sửa chữa theo từng nhóm hạng mục · Bấm để lọc"
        >
          {actionByCategory.length === 0 ? (
            <EmptyChartBanner
              message="Chưa có dữ liệu so sánh Thay thế / Sửa chữa."
              canCreateOrder={canCreateOrder}
              onCreateOrder={onCreateOrder}
              onEnableDemoMode={onEnableDemoMode}
            />
          ) : (
            <div className="w-full h-64 sm:h-72 min-w-0">
              <ResponsiveContainer key={`act-${orientSeq}`} width="100%" height="100%">
                <BarChart
                  data={actionByCategory}
                  layout="vertical"
                  margin={{ top: 4, right: isMobile ? 10 : 16, left: 2, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickCount={isMobile ? 4 : 5}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: isMobile ? 10 : 11, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={isMobile ? 78 : 96}
                    tick={{ fontSize: isMobile ? 10 : 11, fill: '#0f172a', fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={GLASS_TOOLTIP_STYLE}
                    formatter={(
                      value: unknown,
                      name: unknown,
                      item: { payload?: { replaceCost?: number; repairCost?: number } }
                    ) => {
                      const isReplace = name === 'replacePct';
                      const amt = isReplace
                        ? item?.payload?.replaceCost ?? 0
                        : item?.payload?.repairCost ?? 0;
                      return [
                        `${formatVND(amt)} (${value}% tỷ trọng)`,
                        isReplace ? 'THAY THẾ' : 'SỬA CHỮA',
                      ];
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                    formatter={(v) => (v === 'replacePct' ? 'THAY THẾ' : 'SỬA CHỮA')}
                  />
                  <Bar
                    dataKey="replacePct"
                    stackId="a"
                    fill="#2563EB"
                    barSize={16}
                    className="cursor-pointer"
                    onClick={(_entry, index) => {
                      const row = actionByCategory[index];
                      if (row?.category) {
                        onFilterChange({
                          category: activeCategory === row.category ? '' : row.category,
                        });
                      }
                    }}
                  />
                  <Bar
                    dataKey="repairPct"
                    stackId="a"
                    fill="#0D9488"
                    radius={[0, 5, 5, 0]}
                    barSize={16}
                    className="cursor-pointer"
                    onClick={(_entry, index) => {
                      const row = actionByCategory[index];
                      if (row?.category) {
                        onFilterChange({
                          category: activeCategory === row.category ? '' : row.category,
                        });
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Row 4: Chart 6 — Hỏng gì nhiều nhất? */}
      <ChartCard
        title="Hỏng gì nhiều nhất?"
        subtitle="Top hạng mục / phụ tùng phát sinh lặp lại nhiều nhất theo số lần & tổng chi phí · Bấm để lọc chi tiết"
      >
        {recurringItems.length === 0 ? (
          <EmptyChartBanner
            message="Chưa có dữ liệu hạng mục lặp lại trong kỳ chọn."
            canCreateOrder={canCreateOrder}
            onCreateOrder={onCreateOrder}
            onEnableDemoMode={onEnableDemoMode}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {recurringItems.map((item, idx) => {
              const maxCount = Math.max(...recurringItems.map((x) => x.count), 1);
              const pctWidth = Math.max(12, Math.round((item.count / maxCount) * 100));
              const sharePct =
                totalCategoryCost > 0
                  ? Math.round((item.totalCost / totalCategoryCost) * 100)
                  : 0;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => onFilterChange({ searchQuery: item.name })}
                  className="glass-tile text-left min-h-[56px] p-3.5 rounded-xl space-y-2 touch-press hover:-translate-y-0.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 break-words leading-snug">
                      <span className="font-mono text-xs font-bold text-slate-500 mr-1.5">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      <span className="text-xs font-bold text-slate-950">{item.name}</span>
                      <span className="text-[11px] text-slate-600 ml-1.5">· {item.category}</span>
                    </div>
                    <div className="text-right shrink-0 font-mono tabular-nums">
                      <span className="text-xs font-bold text-blue-700">{item.count} lần</span>
                      <span className="text-slate-300 mx-1.5">/</span>
                      <span className="text-xs font-bold text-slate-950">
                        {formatCompactVND(item.totalCost)}
                      </span>
                      <span className="text-[10.5px] text-slate-600 ml-1">({sharePct}%)</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-900/8 border border-white/60 overflow-hidden shadow-inner">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-blue-600 to-indigo-500 transition-all"
                      style={{ width: `${pctWidth}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ChartCard>
    </section>
  );
};
