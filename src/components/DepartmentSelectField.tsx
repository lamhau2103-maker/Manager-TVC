import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Plus, Search } from 'lucide-react';
import {
  CUSTOM_DEPARTMENT_VALUE,
  MAX_DEPARTMENT_LENGTH,
} from '../utils/departments';

interface DepartmentSelectFieldProps {
  options: string[];
  selectedValue: string;
  customValue: string;
  error?: string;
  compact?: boolean;
  disabled?: boolean;
  onSelectChange: (nextValue: string) => void;
  onCustomChange: (nextCustom: string) => void;
  onCancelCustom: () => void;
}

export const DepartmentSelectField: React.FC<DepartmentSelectFieldProps> = ({
  options,
  selectedValue,
  customValue,
  error,
  compact = false,
  disabled = false,
  onSelectChange,
  onCustomChange,
  onCancelCustom,
}) => {
  const isCustomMode = selectedValue === CUSTOM_DEPARTMENT_VALUE;
  const customInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isCustomMode) {
      customInputRef.current?.focus();
    }
  }, [isCustomMode]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, searchQuery]);

  const inputHeight = compact
    ? 'min-h-[44px] sm:min-h-[36px] px-2.5 rounded-lg'
    : 'min-h-[44px] sm:min-h-[40px] px-3 rounded-xl';

  const displayLabel = isCustomMode
    ? '+ Thêm tự điền...'
    : selectedValue || '-- Chọn bộ phận / khu vực --';

  return (
    <div ref={containerRef} className="relative">
      <label
        className={`block font-semibold mb-1 ${
          compact ? 'text-[11px] text-slate-600' : 'text-xs text-slate-700'
        }`}
      >
        Bộ phận / khu vực *
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setPickerOpen((o) => !o);
          setSearchQuery('');
        }}
        className={`glass-input w-full flex items-center justify-between gap-2 text-left text-xs ${inputHeight} ${
          selectedValue ? 'text-slate-900 font-medium' : 'text-slate-500'
        } ${error && !isCustomMode ? 'border-red-400! ring-2 ring-red-500/15' : ''}`}
      >
        <span className="break-words">{displayLabel}</span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
            pickerOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {pickerOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 glass-panel-strong rounded-xl overflow-hidden shadow-xl border border-slate-200/90">
          {options.length > 4 && (
            <div className="p-2 border-b border-slate-200/70 bg-white/75">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm bộ phận / khu vực..."
                  className="glass-input w-full min-h-[38px] pl-8 pr-2.5 rounded-lg text-xs text-slate-900"
                />
              </div>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
            {filteredOptions.map((dept) => {
              const active = selectedValue === dept;
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => {
                    onSelectChange(dept);
                    setPickerOpen(false);
                  }}
                  className={`w-full min-h-[44px] px-3 py-2 text-left text-xs flex items-center justify-between gap-2 transition-colors ${
                    active ? 'bg-blue-50 text-blue-800 font-bold' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span className="break-words">{dept}</span>
                  {active && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                onSelectChange(CUSTOM_DEPARTMENT_VALUE);
                setPickerOpen(false);
              }}
              className={`w-full min-h-[44px] px-3 py-2 text-left text-xs font-bold flex items-center gap-1.5 transition-colors ${
                isCustomMode
                  ? 'bg-blue-50 text-blue-800'
                  : 'text-blue-700 hover:bg-blue-50/70 bg-blue-50/30'
              }`}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>+ Thêm tự điền...</span>
            </button>
          </div>
        </div>
      )}

      {isCustomMode && (
        <div className="mt-2 p-2.5 rounded-xl bg-white/65 border border-blue-200/80 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-semibold text-slate-700">
              Nhập tên bộ phận / khu vực
            </label>
            <span className="font-mono text-[10px] text-slate-400 tabular-nums">
              {customValue.length}/{MAX_DEPARTMENT_LENGTH}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={customInputRef}
              type="text"
              maxLength={MAX_DEPARTMENT_LENGTH}
              value={customValue}
              disabled={disabled}
              onChange={(e) => onCustomChange(e.target.value)}
              placeholder="VD: Kho Trung Chuyển Long An..."
              className={`glass-input flex-1 text-xs text-slate-900 min-h-[44px] sm:min-h-[36px] px-3 rounded-xl ${
                error ? 'border-red-400! ring-2 ring-red-500/15' : 'border-blue-300!'
              }`}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={onCancelCustom}
              className="px-3 min-h-[44px] sm:min-h-[36px] rounded-xl glass-tile text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white/85 whitespace-nowrap shrink-0 transition-colors"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-1 text-[11px] font-medium text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
