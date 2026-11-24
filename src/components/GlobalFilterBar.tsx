import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Download,
  FileSpreadsheet,
  Filter,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  DEPARTMENTS,
  GlobalFilters,
  MAINTENANCE_CATEGORIES,
  MaintenanceAction,
  MaintenanceItem,
  MaintenanceOrder,
  PeriodPreset,
  SERVICE_TYPES,
  VEHICLE_TYPES,
  Vehicle,
} from '../types';
import { formatDateTimeVN } from '../utils/format';
import { PlateInput } from './PlateInput';

interface GlobalFilterBarProps {
  filters: GlobalFilters;
  onChange: (patch: Partial<GlobalFilters>) => void;
  onResetAll: () => void;
  vehicles: Vehicle[];
  orders: MaintenanceOrder[];
  items: MaintenanceItem[];
  lastUpdated: string;
  isSyncing: boolean;
  onRefresh: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
}

const MONTH_OPTIONS = [
  { value: '2026-11', label: 'Tháng 11/2026' },
  { value: '2026-10', label: 'Tháng 10/2026' },
  { value: '2026-09', label: 'Tháng 09/2026' },
  { value: '2026-08', label: 'Tháng 08/2026' },
  { value: '2026-07', label: 'Tháng 07/2026' },
  { value: '2026-06', label: 'Tháng 06/2026' },
];

export const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({
  filters,
  onChange,
  onResetAll,
  vehicles,
  orders,
  items,
  lastUpdated,
  isSyncing,
  onRefresh,
  onExportExcel,
  onExportPdf,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const garages = useMemo(
    () => Array.from(new Set(orders.map((o) => o.garage).filter(Boolean))).sort(),
    [orders]
  );

  const vehicleTypeOptions = useMemo(
    () => Array.from(new Set([...VEHICLE_TYPES, ...vehicles.map((v) => v.type).filter(Boolean)])),
    [vehicles]
  );

  const poOptions = useMemo(
    () =>
      Array.from(
        new Set(items.map((i) => i.po_number.trim()).filter(Boolean))
      ).sort((a, b) => b.localeCompare(a)),
    [items]
  );

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (filters.plateKey) {
      chips.push({
        key: 'plate',
        label: `Biển số: ${filters.plateKey}`,
        clear: () => onChange({ plateKey: '' }),
      });
    }
    if (filters.vehicleType) {
      chips.push({
        key: 'vtype',
        label: `Loại xe: ${filters.vehicleType}`,
        clear: () => onChange({ vehicleType: '' }),
      });
    }
    if (filters.department) {
      chips.push({
        key: 'dept',
        label: `Bộ phận: ${filters.department}`,
        clear: () => onChange({ department: '' }),
      });
    }
    if (filters.garage) {
      chips.push({
        key: 'garage',
        label: `Gara: ${filters.garage}`,
        clear: () => onChange({ garage: '' }),
      });
    }
    if (filters.category) {
      chips.push({
        key: 'cat',
        label: `Nhóm: ${filters.category}`,
        clear: () => onChange({ category: '' }),
      });
    }
    if (filters.serviceType) {
      chips.push({
        key: 'stype',
        label: `Loại BD: ${filters.serviceType}`,
        clear: () => onChange({ serviceType: '' }),
      });
    }
    if (filters.action) {
      chips.push({
        key: 'action',
        label: `Hành động: ${filters.action}`,
        clear: () => onChange({ action: '' }),
      });
    }
    if (filters.poNumber) {
      chips.push({
        key: 'po',
        label:
          filters.poNumber === '__MISSING__'
            ? 'PO: Chưa có số PO'
            : `PO: ${filters.poNumber}`,
        clear: () => onChange({ poNumber: '' }),
      });
    }
    if (filters.searchQuery.trim()) {
      chips.push({
        key: 'q',
        label: `Tìm: "${filters.searchQuery.trim()}"`,
        clear: () => onChange({ searchQuery: '' }),
      });
    }
    return chips;
  }, [filters, onChange]);

  return (
    <section
      aria-label="Bộ lọc toàn cục"
      className="lg:sticky lg:top-2 z-30 glass-panel-strong rounded-2xl p-3 sm:p-4 no-print"
    >
      {/* Row 1: Period + Quick Search + Actions + Live Sync */}
      <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-2.5 justify-between">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {/* Period Preset Segmented Control with horizontal snap on narrow mobile */}
          <div className="w-full sm:w-auto scroll-snap-x">
            <div className="inline-flex items-center p-1 rounded-xl glass-segment min-w-max">
              {(
                [
                  { id: 'month', label: 'Tháng' },
                  { id: 'quarter', label: 'Quý này' },
                  { id: 'year', label: 'Năm nay' },
                  { id: 'custom', label: 'Tùy chọn' },
                ] as Array<{ id: PeriodPreset; label: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChange({ periodPreset: opt.id })}
                  className={`min-h-[38px] sm:min-h-[32px] px-3 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 touch-press ${
                    filters.periodPreset === opt.id
                      ? 'bg-white/95 text-blue-700 shadow-xs'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Month dropdown or Custom date range */}
          {filters.periodPreset === 'month' && (
            <div className="relative flex items-center flex-1 sm:flex-initial min-w-[155px]">
              <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
              <select
                aria-label="Chọn tháng báo cáo"
                value={filters.selectedMonth}
                onChange={(e) => onChange({ selectedMonth: e.target.value })}
                className="glass-input w-full sm:w-auto min-h-[44px] sm:min-h-[36px] h-11 sm:h-9 pl-8 pr-7 rounded-xl text-xs font-semibold text-slate-800"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filters.periodPreset === 'custom' && (
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 w-full sm:w-auto">
              <input
                type="date"
                aria-label="Từ ngày"
                value={filters.customStartDate}
                onChange={(e) => onChange({ customStartDate: e.target.value })}
                className="glass-input flex-1 sm:flex-initial min-h-[44px] sm:min-h-[36px] h-11 sm:h-9 px-2.5 rounded-xl text-xs font-mono"
              />
              <span className="text-xs text-slate-400">→</span>
              <input
                type="date"
                aria-label="Đến ngày"
                value={filters.customEndDate}
                onChange={(e) => onChange({ customEndDate: e.target.value })}
                className="glass-input flex-1 sm:flex-initial min-h-[44px] sm:min-h-[36px] h-11 sm:h-9 px-2.5 rounded-xl text-xs font-mono"
              />
            </div>
          )}

          {/* Quick Search */}
          <div className="relative w-full sm:w-56 md:w-64">
            <Search className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => onChange({ searchQuery: e.target.value })}
              placeholder="Tìm biển số, hạng mục, PO..."
              className="glass-input w-full min-h-[44px] sm:min-h-[36px] h-11 sm:h-9 pl-9 sm:pl-8 pr-9 rounded-xl text-xs text-slate-900 placeholder:text-slate-400"
            />
            {filters.searchQuery && (
              <button
                type="button"
                onClick={() => onChange({ searchQuery: '' })}
                className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-slate-400 hover:text-slate-700"
                aria-label="Xóa từ khóa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Toggle Advanced Filters */}
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[36px] px-3 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 touch-press ${
              showAdvanced || activeChips.length > 0
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'glass-input text-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Bộ lọc chi tiết
            {activeChips.length > 0 && (
              <span className="ml-0.5 font-mono text-[11px] bg-blue-600 text-white rounded-md px-1.5 py-0.2">
                {activeChips.length}
              </span>
            )}
          </button>
        </div>

        {/* Right: Sync timestamp + Export PDF / Excel */}
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <div className="hidden xl:flex items-center gap-2 text-xs text-slate-600 pr-1">
            <span className="relative flex h-2 w-2" title="Đang kết nối dữ liệu thời gian thực">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="whitespace-nowrap">
              Cập nhật lần cuối:{' '}
              <strong className="font-mono font-semibold text-slate-800 tabular-nums">
                {formatDateTimeVN(lastUpdated)}
              </strong>
            </span>
            <button
              type="button"
              onClick={onRefresh}
              title="Làm mới dữ liệu ngay"
              className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>

          <button
            type="button"
            onClick={onExportPdf}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[36px] px-3 rounded-xl text-xs font-semibold text-slate-800 glass-tile hover:bg-white/80 transition-all whitespace-nowrap shrink-0 touch-press"
          >
            <Printer className="w-3.5 h-3.5 text-slate-700" />
            Xuất PDF
          </button>

          <button
            type="button"
            onClick={onExportExcel}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[36px] px-3 rounded-xl text-xs font-semibold text-white bg-emerald-600/90 hover:bg-emerald-700 border border-emerald-300/50 shadow-sm shadow-emerald-700/20 transition-all whitespace-nowrap shrink-0 touch-press"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Collapsible Advanced Filters Grid */}
      {showAdvanced && (
        <div className="mt-3 pt-3 border-t border-slate-200/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Biển số xe
            </label>
            <PlateInput
              vehicles={vehicles}
              value={filters.plateKey}
              onChange={(plate) => onChange({ plateKey: plate })}
              showPlatePreview={false}
              compact
              placeholder="Gõ biển số..."
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Loại xe
            </label>
            <select
              value={filters.vehicleType}
              onChange={(e) => onChange({ vehicleType: e.target.value })}
              className="glass-input w-full h-9 px-2.5 rounded-xl text-xs"
            >
              <option value="">Tất cả loại xe</option>
              {vehicleTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Bộ phận / Khu vực
            </label>
            <select
              value={filters.department}
              onChange={(e) => onChange({ department: e.target.value })}
              className="glass-input w-full h-9 px-2.5 rounded-xl text-xs"
            >
              <option value="">Tất cả bộ phận</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Gara / Xưởng dịch vụ
            </label>
            <select
              value={filters.garage}
              onChange={(e) => onChange({ garage: e.target.value })}
              className="glass-input w-full h-9 px-2.5 rounded-xl text-xs"
            >
              <option value="">Tất cả gara</option>
              {garages.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Nhóm hạng mục
            </label>
            <select
              value={filters.category}
              onChange={(e) => onChange({ category: e.target.value })}
              className="glass-input w-full h-9 px-2.5 rounded-xl text-xs"
            >
              <option value="">Tất cả nhóm hạng mục</option>
              {MAINTENANCE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Loại bảo dưỡng
            </label>
            <select
              value={filters.serviceType}
              onChange={(e) => onChange({ serviceType: e.target.value })}
              className="glass-input w-full h-9 px-2.5 rounded-xl text-xs"
            >
              <option value="">Tất cả loại bảo dưỡng</option>
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Hành động
            </label>
            <select
              value={filters.action}
              onChange={(e) => onChange({ action: e.target.value as '' | MaintenanceAction })}
              className="glass-input w-full h-9 px-2.5 rounded-xl text-xs"
            >
              <option value="">Tất cả (Sửa chữa & Thay thế)</option>
              <option value="THAY THẾ">THAY THẾ</option>
              <option value="SỬA CHỮA">SỬA CHỮA</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Số PO (theo hạng mục)
            </label>
            <select
              value={filters.poNumber}
              onChange={(e) => onChange({ poNumber: e.target.value })}
              className="glass-input w-full h-9 px-2.5 rounded-xl text-xs font-mono"
            >
              <option value="">Tất cả số PO</option>
              <option value="__MISSING__">⚠ Hạng mục chưa có PO</option>
              {poOptions.map((po) => (
                <option key={po} value={po}>
                  {po}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Active filter chips bar + mobile sync indicator */}
      {(activeChips.length > 0 || true) && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.length > 0 ? (
              <>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 mr-1">
                  <Filter className="w-3 h-3" />
                  Đang lọc:
                </span>
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.clear}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-800 text-xs font-semibold transition-colors"
                  >
                    <span>{chip.label}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onResetAll}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Xóa tất cả bộ lọc
                </button>
              </>
            ) : (
              <span className="xl:hidden inline-flex items-center gap-2 text-[11px] text-slate-500">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Cập nhật lần cuối: <strong className="font-mono text-slate-700">{formatDateTimeVN(lastUpdated)}</strong>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="text-blue-600 hover:text-blue-800 font-semibold ml-1"
                >
                  Làm mới
                </button>
              </span>
            )}
          </div>
          {/* Keep Download icon used cleanly if needed */}
          <span className="sr-only">
            <Download className="w-3 h-3" />
          </span>
        </div>
      )}
    </section>
  );
};
