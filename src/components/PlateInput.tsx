import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Plus,
  Truck,
  X,
} from 'lucide-react';
import {
  VEHICLE_TYPE_PRESETS,
  Vehicle,
} from '../types';
import {
  formatVietnamesePlate,
  isValidVietnamesePlate,
  normalizePlateKey,
  splitPlateLines,
} from '../utils/plate';
import { addDaysISO, formatKm } from '../utils/format';
import { REFERENCE_TODAY } from '../data/seedData';
import {
  buildDepartmentOptions,
  CUSTOM_DEPARTMENT_VALUE,
  resolveDepartmentInput,
} from '../utils/departments';
import { DepartmentSelectField } from './DepartmentSelectField';

export interface PlateInputProps {
  vehicles: Vehicle[];
  value: string; // Formatted plate string
  onChange: (plate: string, matchedVehicle?: Vehicle) => void;
  onSelectVehicle?: (vehicle: Vehicle) => void;
  onQuickCreateVehicle?: (
    payload: Omit<Vehicle, 'id' | 'plate_key'>
  ) => { ok: true; vehicle: Vehicle } | { ok: false; error: string };
  placeholder?: string;
  showPlatePreview?: boolean;
  allowQuickCreate?: boolean;
  allowCustomFormatOverride?: boolean;
  compact?: boolean;
  autoFocus?: boolean;
  showAllSuggestions?: boolean;
  label?: string;
  id?: string;
}

export const VietnamesePlateBadge: React.FC<{
  plate: string;
  size?: 'sm' | 'md' | 'lg';
  square?: boolean;
}> = ({ plate, size = 'md', square = false }) => {
  const display = formatVietnamesePlate(plate) || '51C-000.00';
  const lines = splitPlateLines(display);

  if (square) {
    return (
      <div
        className={`inline-flex flex-col items-center justify-center rounded-md border-2 border-slate-900 bg-white text-slate-950 font-mono font-bold tracking-wider shadow-sm select-none relative ${
          size === 'lg' ? 'px-4 py-1.5 min-w-[126px]' : 'px-2.5 py-1 min-w-[92px]'
        }`}
      >
        <span className="absolute top-1 left-1.5 w-1 h-1 rounded-full bg-slate-400" />
        <span className="absolute top-1 right-1.5 w-1 h-1 rounded-full bg-slate-400" />
        <span className={size === 'lg' ? 'text-lg leading-tight' : 'text-xs leading-tight'}>
          {lines.top}
        </span>
        <span className={size === 'lg' ? 'text-xl leading-tight' : 'text-sm leading-tight'}>
          {lines.bottom}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-md border-[1.5px] border-slate-900 bg-white text-slate-950 font-mono font-bold tracking-wider shadow-xs select-none relative ${
        size === 'lg'
          ? 'px-4 py-1.5 text-lg'
          : size === 'sm'
          ? 'px-2 py-0.5 text-xs'
          : 'px-3 py-1 text-sm'
      }`}
    >
      <span className="w-1 h-1 rounded-full bg-slate-400 mr-2 shrink-0" />
      <span className="whitespace-nowrap">{display}</span>
      <span className="w-1 h-1 rounded-full bg-slate-400 ml-2 shrink-0" />
    </div>
  );
};

export const PlateInput: React.FC<PlateInputProps> = ({
  vehicles,
  value,
  onChange,
  onSelectVehicle,
  onQuickCreateVehicle,
  placeholder = 'VD: 61C-123.45 hoặc 51c12345',
  showPlatePreview = true,
  allowQuickCreate = false,
  allowCustomFormatOverride = true,
  compact = false,
  autoFocus = false,
  showAllSuggestions = false,
  label,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [overrideInvalid, setOverrideInvalid] = useState(false);
  const [showQuickForm, setShowQuickForm] = useState(false);

  // Quick-add vehicle state
  const [qTypePreset, setQTypePreset] = useState<string>(VEHICLE_TYPE_PRESETS[0]);
  const [qCustomType, setQCustomType] = useState('');
  const [qBrand, setQBrand] = useState('');
  const [qDriver, setQDriver] = useState('');
  const [qDept, setQDept] = useState('');
  const [qCustomDept, setQCustomDept] = useState('');
  const [qDeptError, setQDeptError] = useState('');
  const [qRegDueDate, setQRegDueDate] = useState(addDaysISO(REFERENCE_TODAY, 180));
  const [qError, setQError] = useState('');

  const departmentOptions = useMemo(
    () => buildDepartmentOptions(vehicles, { excludeLegacy: true }),
    [vehicles]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const plateKey = normalizePlateKey(value);
  const exactMatch = useMemo(
    () => vehicles.find((v) => v.plate_key === plateKey),
    [vehicles, plateKey]
  );

  const suggestions = useMemo(() => {
    const limit = showAllSuggestions ? 100 : 8;
    if (!plateKey) return vehicles.slice(0, limit);
    return vehicles
      .filter(
        (v) =>
          v.plate_key.includes(plateKey) ||
          v.driver_name.toLowerCase().includes(value.trim().toLowerCase()) ||
          v.type.toLowerCase().includes(value.trim().toLowerCase())
      )
      .slice(0, limit);
  }, [vehicles, plateKey, value, showAllSuggestions]);

  const isInvalidFormat =
    value.trim().length >= 3 &&
    !exactMatch &&
    !overrideInvalid &&
    !isValidVietnamesePlate(value);

  useEffect(() => {
    setHighlightIdx(0);
  }, [suggestions.length, value]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatVietnamesePlate(raw);
    setOverrideInvalid(false);
    const key = normalizePlateKey(formatted);
    const match = vehicles.find((v) => v.plate_key === key);
    onChange(formatted, match);
    setIsOpen(true);
  };

  const selectVehicle = (veh: Vehicle) => {
    setOverrideInvalid(false);
    onChange(veh.plate, veh);
    onSelectVehicle?.(veh);
    setIsOpen(false);
    setShowQuickForm(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && isOpen) {
      if (suggestions[highlightIdx]) {
        e.preventDefault();
        selectVehicle(suggestions[highlightIdx]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleQuickCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onQuickCreateVehicle) return;
    setQError('');
    setQDeptError('');
    const resolvedType = qTypePreset === '__CUSTOM__' ? qCustomType.trim() : qTypePreset;
    if (!resolvedType) {
      setQError('Vui lòng nhập loại xe.');
      return;
    }

    let resolvedDept = qDept;
    if (qDept === CUSTOM_DEPARTMENT_VALUE) {
      const check = resolveDepartmentInput(qCustomDept, departmentOptions);
      if (!check.ok) {
        setQDeptError(check.error);
        return;
      }
      resolvedDept = check.value;
    } else if (!resolvedDept.trim()) {
      setQDeptError('Vui lòng chọn hoặc nhập bộ phận / khu vực.');
      return;
    }

    const res = onQuickCreateVehicle({
      plate: formatVietnamesePlate(value),
      type: resolvedType,
      brand_model: qBrand.trim() || 'Chưa cập nhật',
      driver_name: qDriver.trim() || 'Chưa phân công',
      department: resolvedDept,
      status: 'Đang hoạt động',
      registration_due_date: qRegDueDate || addDaysISO(REFERENCE_TODAY, 180),
      current_km: 0,
      service_interval_km: 10000,
      service_interval_days: 90,
      next_service_km: 0,
      next_service_date: '',
    });

    if (!res.ok) {
      setQError(res.error);
      return;
    }

    selectVehicle(res.vehicle);
    setQBrand('');
    setQDriver('');
    setQCustomType('');
    setQDept('');
    setQCustomDept('');
    setQDeptError('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-700 mb-1.5"
        >
          {label}
        </label>
      )}

      <div
        className={`glass-input flex items-center rounded-xl transition-all ${
          compact ? 'min-h-[44px] sm:min-h-[36px] h-11 sm:h-9 px-2.5' : 'min-h-[44px] h-11 px-3.5'
        } ${
          isInvalidFormat
            ? 'border-red-400! ring-2 ring-red-500/15'
            : exactMatch
            ? 'border-blue-500/60!'
            : ''
        }`}
      >
        <Truck
          className={`shrink-0 mr-2 ${
            exactMatch ? 'text-blue-600' : 'text-slate-400'
          } ${compact ? 'w-4 h-4' : 'w-4.5 h-4.5'}`}
        />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          onFocus={() => setIsOpen(true)}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full bg-transparent outline-none uppercase font-mono font-bold tracking-wider text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 ${
            compact ? 'text-xs' : 'text-base'
          }`}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('', undefined);
              setOverrideInvalid(false);
              setShowQuickForm(false);
              inputRef.current?.focus();
            }}
            aria-label="Xóa biển số"
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setIsOpen((o) => !o);
            inputRef.current?.focus();
          }}
          aria-label="Mở danh sách biển số"
          className="p-1 text-slate-400 hover:text-blue-700 rounded-md transition-colors shrink-0 ml-0.5"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-150 ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
          />
        </button>
      </div>

      {/* Format validation warning with override */}
      {isInvalidFormat && (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-red-600">
          <span className="inline-flex items-center gap-1 font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Biển số chưa đúng định dạng chuẩn (VD: 51C-123.45)
          </span>
          {allowCustomFormatOverride && (
            <button
              type="button"
              onClick={() => setOverrideInvalid(true)}
              className="text-blue-700 hover:text-blue-900 font-semibold underline underline-offset-2 whitespace-nowrap"
            >
              Vẫn dùng biển số này
            </button>
          )}
        </div>
      )}

      {/* Live Vietnamese license plate preview */}
      {showPlatePreview && value.trim().length > 0 && (
        <div className="mt-2 flex items-center gap-3">
          <VietnamesePlateBadge plate={value} size={compact ? 'sm' : 'md'} />
          <div className="text-xs text-slate-600 min-w-0 truncate">
            {exactMatch ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                <Check className="w-3.5 h-3.5 shrink-0" />
                {exactMatch.type} · {exactMatch.driver_name} · {formatKm(exactMatch.current_km)}
              </span>
            ) : (
              <span className="text-slate-500">
                Xem trước biển số Việt Nam ({plateKey})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Autocomplete dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 glass-panel-strong rounded-xl overflow-hidden shadow-xl border border-slate-200/90">
          {suggestions.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {suggestions.map((veh, idx) => {
                const isActive = idx === highlightIdx;
                const statusColor =
                  veh.status === 'Đang hoạt động'
                    ? 'text-emerald-700'
                    : veh.status === 'Đang bảo dưỡng'
                    ? 'text-amber-700'
                    : 'text-slate-500';
                return (
                  <li key={veh.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlightIdx(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectVehicle(veh);
                      }}
                      className={`w-full min-h-[48px] text-left px-3 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                        isActive ? 'bg-blue-50/90' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            {veh.plate}
                          </span>
                          <span className="text-xs text-slate-600 break-words">· {veh.type}</span>
                        </div>
                        <div className="text-xs text-slate-600 break-words mt-0.5">
                          {veh.driver_name} · {veh.department}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                          {formatKm(veh.current_km)}
                        </div>
                        <div className={`text-[11px] font-medium ${statusColor}`}>
                          {veh.status}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-3.5 py-3 text-xs text-slate-500">
              Không tìm thấy biển số khớp với <strong className="font-mono text-slate-800">{value}</strong>.
            </div>
          )}

          {/* Quick-add new vehicle trigger when plate not in system */}
          {allowQuickCreate && onQuickCreateVehicle && plateKey.length >= 4 && !exactMatch && (
            <div className="border-t border-slate-200/80 bg-blue-50/60 p-2">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsOpen(false);
                  setShowQuickForm(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm xe mới với biển số {formatVietnamesePlate(value)}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Inline compact Quick-Add Vehicle drawer */}
      {showQuickForm && onQuickCreateVehicle && (
        <div className="mt-2.5 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-bold text-blue-950">
              Thêm nhanh xe mới: <span className="font-mono">{formatVietnamesePlate(value)}</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowQuickForm(false)}
              className="text-slate-500 hover:text-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {qError && (
            <div className="mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
              {qError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Loại xe</label>
              <select
                value={qTypePreset}
                onChange={(e) => setQTypePreset(e.target.value)}
                className="glass-input w-full h-9 px-2.5 rounded-lg text-xs"
              >
                {VEHICLE_TYPE_PRESETS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="__CUSTOM__">Khác (tự điền)...</option>
              </select>
              {qTypePreset === '__CUSTOM__' && (
                <input
                  type="text"
                  value={qCustomType}
                  onChange={(e) => setQCustomType(e.target.value)}
                  placeholder="Nhập loại xe..."
                  className="glass-input w-full h-9 px-2.5 rounded-lg text-xs mt-1.5"
                />
              )}
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Hãng / Model</label>
              <input
                type="text"
                value={qBrand}
                onChange={(e) => setQBrand(e.target.value)}
                placeholder="VD: Toyota Fortuner..."
                className="glass-input w-full h-9 px-2.5 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Tài xế phụ trách</label>
              <input
                type="text"
                value={qDriver}
                onChange={(e) => setQDriver(e.target.value)}
                placeholder="Họ và tên tài xế"
                className="glass-input w-full h-9 px-2.5 rounded-lg text-xs"
              />
            </div>
            <DepartmentSelectField
              options={departmentOptions}
              selectedValue={qDept}
              customValue={qCustomDept}
              error={qDeptError}
              compact
              onSelectChange={(val) => {
                setQDept(val);
                if (val !== CUSTOM_DEPARTMENT_VALUE) setQCustomDept('');
                if (qDeptError) setQDeptError('');
              }}
              onCustomChange={(val) => {
                setQCustomDept(val);
                if (qDeptError) setQDeptError('');
              }}
              onCancelCustom={() => {
                setQDept('');
                setQCustomDept('');
                setQDeptError('');
              }}
            />
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Ngày hạn cuối đăng kiểm
              </label>
              <input
                type="date"
                value={qRegDueDate}
                onChange={(e) => setQRegDueDate(e.target.value)}
                className="glass-input w-full h-9 px-2.5 rounded-lg text-xs font-mono"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowQuickForm(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleQuickCreateSubmit}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Lưu xe & Chọn ngay
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
