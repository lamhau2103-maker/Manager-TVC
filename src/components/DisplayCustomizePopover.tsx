import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { AppPage, DashboardBlockId } from '../types';

interface DisplayCustomizePopoverProps {
  isAdminMode: boolean;
  hiddenDashboardBlocks: DashboardBlockId[];
  hiddenReportTabs: AppPage[];
  blockLabels: Record<DashboardBlockId, string>;
  navTabs: Array<{ id: AppPage; label: string }>;
  onToggleAdminMode: () => void;
  onToggleBlockVisibility: (block: DashboardBlockId) => void;
  onToggleTabVisibility: (tab: AppPage) => void;
  onResetAll: () => void;
}

const ToggleSwitch: React.FC<{ checked: boolean; label: string; onToggle: () => void }> = ({
  checked,
  label,
  onToggle,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onToggle}
    className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl hover:bg-white/75 transition-colors text-left"
  >
    <span className="text-xs font-medium text-slate-800 leading-snug break-words flex-1">
      {label}
    </span>
    <span
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
          checked ? 'translate-x-4.5' : 'translate-x-1'
        }`}
      />
    </span>
  </button>
);

export const DisplayCustomizePopover: React.FC<DisplayCustomizePopoverProps> = ({
  isAdminMode,
  hiddenDashboardBlocks,
  hiddenReportTabs,
  blockLabels,
  navTabs,
  onToggleAdminMode,
  onToggleBlockVisibility,
  onToggleTabVisibility,
  onResetAll,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const hiddenCount = hiddenDashboardBlocks.length + hiddenReportTabs.length;
  const blockOrder: DashboardBlockId[] = [
    'kpi_summary',
    'monthly_status',
    'alerts',
    'charts',
    'orders_table',
  ];

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1.5 min-h-[44px] md:min-h-[40px] px-3 md:px-3.5 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap touch-press ${
          open || hiddenCount > 0
            ? 'bg-blue-600/12 border-blue-400/50 text-blue-800 shadow-xs'
            : 'glass-tile text-slate-800'
        }`}
      >
        <SlidersHorizontal className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">Tùy chỉnh hiển thị</span>
        {hiddenCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-md bg-blue-600 text-white font-mono text-[10px] font-bold leading-none">
            {hiddenCount} ẩn
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 max-w-[calc(100vw-1.5rem)] max-h-[78dvh] overflow-y-auto glass-panel-strong rounded-2xl p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-300/40">
              <div>
                <div className="text-xs font-extrabold text-slate-950">
                  Tùy chỉnh hiển thị
                </div>
                <div className="text-[11px] text-slate-600">
                  Bật hoặc tắt các khu vực và tab báo cáo
                </div>
              </div>
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={onResetAll}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-700 hover:bg-blue-500/10"
                >
                  <RotateCcw className="w-3 h-3" />
                  Mặc định
                </button>
              )}
            </div>

            {/* Admin/Viewer Mode */}
            <div className="rounded-xl glass-subtle p-1">
              <ToggleSwitch
                checked={isAdminMode}
                label="Chế độ Quản trị (luôn hiện khối quản lý)"
                onToggle={onToggleAdminMode}
              />
            </div>

            {/* Dashboard Sections */}
            <div className="space-y-0.5">
              <div className="px-2 text-[11px] font-bold text-slate-500">
                Các khu vực trên Tổng quan
              </div>
              {blockOrder.map((blk) => (
                <ToggleSwitch
                  key={blk}
                  checked={!hiddenDashboardBlocks.includes(blk)}
                  label={blockLabels[blk]}
                  onToggle={() => onToggleBlockVisibility(blk)}
                />
              ))}
            </div>

            <hr className="border-slate-100" />

            {/* Navigation Tabs */}
            <div className="space-y-0.5">
              <div className="px-2 text-[11px] font-bold text-slate-500">
                Các tab điều hướng
              </div>
              {navTabs
                .filter((t) => t.id !== 'dashboard')
                .map((t) => (
                  <ToggleSwitch
                    key={t.id}
                    checked={!hiddenReportTabs.includes(t.id)}
                    label={t.label}
                    onToggle={() => onToggleTabVisibility(t.id)}
                  />
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
