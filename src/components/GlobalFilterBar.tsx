import React, { useMemo, useState } from 'react';
import {
  Calendar,
  FileSpreadsheet,
  Filter,
  Printer,
  RefreshCw,
  RotateCcw,
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

  const renderAdvancedFields = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="min-w-0">
        <label className="block text-xs font-semibold text-slate-700 mb-1">
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

      <div className="min-w-0">
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Loại xe
        </label>
        <select
          value={filters.vehicleType}
          onChange={(e) => onChange({ vehicleType: e.target.value })}
          className="glass-input w-full min-h-[44px] md:min-h-[38px] px-3 rounded-xl text-sm md:text-xs text-slate-900"
        >
          <option value="">Tất cả loại xe</option>
          {vehicleTypeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0">
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Bộ phận / Khu vực
        </label>
        <select
          value={filters.department}
          onChange={(e) => onChange({ department: e.target.value })}
          className="glass-input w-full min-h-[44px] md:min-h-[38px] px-3 rounded-xl text-sm md:text-xs text-slate-900"
        >
          <option value="">Tất cả bộ phận</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0">
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Gara / Xưởng dịch vụ
        </label>
        <select
          value={filters.garage}
          onChange={(e) => onChange({ garage: e.target.value })}
          className="glass-input w-full min-h-[44px] md:min-h-[38px] px-3 rounded-xl text-sm md:text-xs text-slate-900"
        >
          <option value="">Tất cả gara</option>
          {garages.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0">
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Nhóm hạng mục
        </label>
        <select
          value={filters.category}
          onChange={(e) => onChange({ category: e.target.value })}
          className="glass-input w-full min-h-[44px] md:min-h-[38px] px-3 rounded-xl text-sm md:text-xs text-slate-900"
        >
          <option value="">Tất cả nhóm hạng mục</option>
          {MAINTENANCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0">
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Loại bảo dưỡng
        </label>
        <select
          value={filters.serviceType}
          onChange={(e) => onChange({ serviceType: e.target.value })}
          className="glass-input w-full min-h-[44px] md:min-h-[38px] px-3 rounded-xl text-sm md:text-xs text-slate-900"
        >
          <option value="">Tất cả loại bảo dưỡng</option>
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0">
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Hành động
        </label>
        <select
          value={filters.action}
          onChange={(e) => onChange({ action: e.target.value as '' | MaintenanceAction })}
          className="glass-input w-full min-h-[44px] md:min-h-[38px] px-3 rounded-xl text-sm md:text-xs text-slate-900"
        >
          <option value="">Tất cả (Sửa chữa & Thay thế)</option>
          <option value="THAY THẾ">THAY THẾ</option>
          <option value="SỬA CHỮA">SỬA CHỮA</option>
        </select>
      </div>

      <div className="min-w-0">
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Số PO (theo hạng mục)
        </label>
        <select
          value={filters.poNumber}
          onChange={(e) => onChange({ poNumber: e.target.value })}
          className="glass-input w-full min-h-[44px] md:min-h-[38px] px-3 rounded-xl text-sm md:text-xs font-mono text-slate-900"
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
  );

  return (
    <>
      <section
        aria-label="Bộ lọc toàn cục"
        className="glass-panel-strong rounded-2xl p-3 sm:p-4 no-print space-y-2.5 w-full min-w-0"
      >
        {/* Controls Row: Mobile stacks cleanly; Desktop wraps horizontally */}
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2.5 justify-between min-w-0">
          <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 min-w-0 flex-1">
            {/* Period Preset Segmented Control: 4 equal columns on mobile, inline on >=768px */}
            <div className="grid grid-cols-4 md:inline-flex items-center p-1 rounded-xl glass-segment w-full md:w-auto gap-0.5">
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
                  className={`min-h-[40px] md:min-h-[34px] px-1.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap text-center truncate touch-press ${
                    filters.periodPreset === opt.id
                      ? 'bg-white/95 text-blue-700 shadow-xs'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Month dropdown or Custom date range + Advanced Filters trigger */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap md:items-center gap-2 w-full md:w-auto min-w-0">
              {filters.periodPreset === 'month' && (
                <div className="relative flex items-center w-full md:w-auto md:min-w-[164px]">
                  <Calendar className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
                  <select
                    aria-label="Chọn tháng báo cáo"
                    value={filters.selectedMonth}
                    onChange={(e) => onChange({ selectedMonth: e.target.value })}
                    className="glass-input w-full min-h-[44px] md:min-h-[38px] pl-9 pr-7 rounded-xl text-sm md:text-xs font-semibold text-slate-800"
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
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:flex md:items-center gap-2 w-full md:w-auto">
                  <input
                    type="date"
                    aria-label="Từ ngày"
                    value={filters.customStartDate}
                    onChange={(e) => onChange({ customStartDate: e.target.value })}
                    className="glass-input w-full md:w-auto min-h-[44px] md:min-h-[38px] px-3 rounded-xl text-sm md:text-xs font-mono"
                  />
                  <span className="hidden md:inline text-xs text-slate-400">→</span>
                  <input
                    type="date"
                    aria-label="Đến ngày"
                    value={filters.customEndDate}
                    onChange={(e) => onChange({ customEndDate: e.target.value })}
                    className="glass-input w-full md:w-auto min-h-[44px] md:min-h-[38px] px-3 rounded-xl text-sm md:text-xs font-mono"
                  />
                </div>
              )}

              {/* Toggle Advanced Filters */}
              <button
                type="button"
                onClick={() => setShowAdvanced((s) => !s)}
                className={`w-full md:w-auto inline-flex items-center justify-center gap-1.5 min-h-[44px] md:min-h-[38px] px-3.5 rounded-xl text-sm md:text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 touch-press ${
                  showAdvanced || activeChips.length > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'glass-input text-slate-800'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0" />
                <span>Bộ lọc chi tiết</span>
                {activeChips.length > 0 && (
                  <span className="ml-0.5 font-mono text-[11px] bg-blue-600 text-white rounded-md px-1.5 py-0.5 leading-none">
                    {activeChips.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Right: Export PDF / Excel — equal 2-col grid on mobile, inline flex on >=768px */}
          <div className="grid grid-cols-2 md:flex md:items-center gap-2 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={onExportPdf}
              className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 min-h-[44px] md:min-h-[38px] px-3.5 rounded-xl text-sm md:text-xs font-semibold text-slate-800 glass-tile hover:bg-white/85 transition-all whitespace-nowrap shrink-0 touch-press"
            >
              <Printer className="w-4 h-4 md:w-3.5 md:h-3.5 text-slate-700 shrink-0" />
              <span>Xuất PDF</span>
            </button>

            <button
              type="button"
              onClick={onExportExcel}
              className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 min-h-[44px] md:min-h-[38px] px-3.5 rounded-xl text-sm md:text-xs font-semibold text-white bg-emerald-600/95 hover:bg-emerald-700 border border-emerald-300/50 shadow-sm shadow-emerald-700/20 transition-all whitespace-nowrap shrink-0 touch-press"
            >
              <FileSpreadsheet className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0" />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>

        {/* Desktop Collapsible Advanced Filters Grid (>= 768px) */}
        {showAdvanced && (
          <div className="hidden md:block pt-3 border-t border-slate-200/70">
            {renderAdvancedFields()}
          </div>
        )}

        {/* Bottom Meta Row: Active filter chips + Clean Wrapping Sync Timestamp */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-0.5">
          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 mr-0.5 whitespace-nowrap">
                <Filter className="w-3.5 h-3.5 shrink-0" />
                Đang lọc:
              </span>
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.clear}
                  className="inline-flex items-center gap-1 min-h-[32px] px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-800 text-xs font-semibold transition-colors max-w-full"
                >
                  <span className="truncate">{chip.label}</span>
                  <X className="w-3.5 h-3.5 shrink-0" />
                </button>
              ))}
              <button
                type="button"
                onClick={onResetAll}
                className="inline-flex items-center gap-1 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                Xóa tất cả
              </button>
            </div>
          )}

          {/* Sync Status Line — clean wrap, never breaks word-by-word */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 ml-auto">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className="relative flex h-2 w-2 shrink-0" title="Đang kết nối dữ liệu thời gian thực">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Cập nhật lần cuối:</span>
              <strong className="font-mono font-semibold text-slate-800 tabular-nums">
                {formatDateTimeVN(lastUpdated)}
              </strong>
            </span>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1 px-2 py-1 -my-1 rounded-lg text-blue-700 hover:bg-blue-50 font-semibold whitespace-nowrap transition-colors touch-press"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>
      </section>

      {/* Mobile Full-Screen Bottom Sheet Modal for Advanced Filters (< 768px) */}
      {showAdvanced && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 backdrop-blur-sm no-print"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAdvanced(false);
          }}
        >
          <div className="w-full max-h-[90dvh] flex flex-col glass-panel-strong rounded-t-3xl overflow-hidden shadow-2xl border-t border-white/90 animate-sheet-up">
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="w-10 h-1 rounded-full bg-slate-300/90" />
            </div>
            <div className="px-4 py-3 border-b border-slate-200/75 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-950 truncate">
                  Bộ lọc chi tiết
                </h3>
                <p className="text-xs text-slate-600">
                  Lọc theo biển số, loại xe, bộ phận, gara, hạng mục hoặc số PO
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvanced(false)}
                aria-label="Đóng bộ lọc chi tiết"
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl glass-tile text-slate-600 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">{renderAdvancedFields()}</div>

            <div className="px-4 py-3 border-t border-slate-200/75 bg-white/85 flex items-center gap-2 safe-bottom">
              <button
                type="button"
                onClick={() => {
                  onResetAll();
                }}
                className="flex-1 min-h-[44px] px-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold"
              >
                Xóa bộ lọc
              </button>
              <button
                type="button"
                onClick={() => setShowAdvanced(false)}
                className="flex-1 min-h-[44px] px-4 rounded-xl glass-button-primary text-white text-sm font-bold"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
