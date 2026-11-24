import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Clock, FileText, Search, Truck, X } from 'lucide-react';
import { MaintenanceItem, MaintenanceOrder, Vehicle } from '../types';
import { normalizePlateKey } from '../utils/plate';
import { formatKm, formatVND } from '../utils/format';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  orders: MaintenanceOrder[];
  items: MaintenanceItem[];
  recentPlates: string[];
  onSelectVehicle: (vehicleId: string, plate: string) => void;
  onFilterByPo: (poNumber: string) => void;
  onFilterBySearch: (query: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  orders,
  items,
  recentPlates,
  onSelectVehicle,
  onFilterByPo,
  onFilterBySearch,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  const matchedVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qKey = normalizePlateKey(query);
    if (!q) return vehicles.slice(0, 6);
    return vehicles
      .filter(
        (v) =>
          (qKey && v.plate_key.includes(qKey)) ||
          v.plate.toLowerCase().includes(q) ||
          v.driver_name.toLowerCase().includes(q) ||
          v.brand_model.toLowerCase().includes(q) ||
          v.department.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [vehicles, query]);

  const matchedPos = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    const poTotals = new Map<string, { po: string; count: number; total: number }>();
    for (const it of items) {
      if (!it.po_number) continue;
      if (!it.po_number.toUpperCase().includes(q)) continue;
      const prev = poTotals.get(it.po_number) ?? { po: it.po_number, count: 0, total: 0 };
      prev.count += 1;
      prev.total += it.amount;
      poTotals.set(it.po_number, prev);
    }
    return Array.from(poTotals.values()).slice(0, 4);
  }, [items, query]);

  const matchedItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const vehMap = new Map(vehicles.map((v) => [v.id, v]));
    return items
      .filter(
        (it) =>
          it.item_name.toLowerCase().includes(q) ||
          it.part_name.toLowerCase().includes(q)
      )
      .slice(0, 4)
      .map((it) => {
        const ord = orderMap.get(it.order_id);
        const veh = ord ? vehMap.get(ord.vehicle_id) : undefined;
        return { item: it, plate: veh?.plate ?? '—', date: ord?.service_date ?? '' };
      });
  }, [items, orders, vehicles, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, matchedVehicles.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (matchedVehicles[activeIndex]) {
        const v = matchedVehicles[activeIndex];
        onSelectVehicle(v.id, v.plate);
        onClose();
      } else if (matchedPos[0]) {
        onFilterByPo(matchedPos[0].po);
        onClose();
      } else if (query.trim()) {
        onFilterBySearch(query.trim());
        onClose();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-start justify-center sm:pt-[10dvh] sm:px-4 bg-slate-900/40 backdrop-blur-sm no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full sm:max-w-[720px] max-h-[90dvh] flex flex-col glass-panel-strong rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl border border-white/85 animate-sheet-up"
        onKeyDown={handleKeyDown}
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <span className="w-10 h-1 rounded-full bg-slate-300/90" />
        </div>
        <div className="flex items-center px-4 py-3 border-b border-slate-200/70 gap-2">
          <Search className="w-5 h-5 text-blue-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nhập biển số (VD: 61c12345), số PO, hạng mục hoặc tên tài xế..."
            className="w-full min-h-[40px] bg-transparent outline-none text-base text-slate-900 placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-xl shrink-0"
            aria-label="Đóng tìm kiếm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5 Recently searched plates */}
        {recentPlates.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200/60 flex items-center gap-2 scroll-snap-x">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 whitespace-nowrap shrink-0">
              <Clock className="w-3.5 h-3.5" />
              Tìm gần đây:
            </span>
            {recentPlates.map((plate) => {
              const veh = vehicles.find(
                (v) => v.plate_key === normalizePlateKey(plate)
              );
              return (
                <button
                  key={plate}
                  type="button"
                  onClick={() => {
                    if (veh) {
                      onSelectVehicle(veh.id, veh.plate);
                      onClose();
                    } else {
                      setQuery(plate);
                    }
                  }}
                  className="min-h-[36px] px-3 py-1 rounded-lg bg-white/90 hover:bg-blue-50 border border-slate-200 text-xs font-mono font-semibold text-slate-800 hover:text-blue-700 hover:border-blue-300 transition-colors whitespace-nowrap shrink-0"
                >
                  {plate}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 max-h-[64dvh] overflow-y-auto p-3 space-y-4">
          {/* Matched vehicles */}
          <div>
            <div className="px-2 mb-1.5 text-[11px] font-semibold text-slate-500">
              Hồ sơ xe ({matchedVehicles.length}) — Chạm hoặc nhấn Enter để mở
            </div>
            {matchedVehicles.length > 0 ? (
              <div className="space-y-1">
                {matchedVehicles.map((v, idx) => (
                  <button
                    key={v.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      onSelectVehicle(v.id, v.plate);
                      onClose();
                    }}
                    className={`w-full min-h-[52px] flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors touch-press ${
                      idx === activeIndex ? 'bg-blue-50/90 text-blue-950' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            {v.plate}
                          </span>
                          <span className="text-xs text-slate-600 break-words">
                            · {v.type}
                            {v.brand_model ? ` · ${v.brand_model}` : ''}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 break-words mt-0.5">
                          {v.driver_name} · {v.department} · {formatKm(v.current_km)}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-2 py-2 text-xs text-slate-500">Không có xe nào khớp.</p>
            )}
          </div>

          {/* Matched POs */}
          {matchedPos.length > 0 && (
            <div>
              <div className="px-2 mb-1.5 text-[11px] font-semibold text-slate-500">
                Số PO ({matchedPos.length})
              </div>
              <div className="space-y-1">
                {matchedPos.map((p) => (
                  <button
                    key={p.po}
                    type="button"
                    onClick={() => {
                      onFilterByPo(p.po);
                      onClose();
                    }}
                    className="w-full min-h-[46px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 text-left transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                      <span className="font-mono font-semibold text-sm text-slate-900 break-all">
                        {p.po}
                      </span>
                      <span className="text-xs text-slate-500">({p.count} hạng mục)</span>
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-800 tabular-nums shrink-0">
                      {formatVND(p.total)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matched items */}
          {matchedItems.length > 0 && (
            <div>
              <div className="px-2 mb-1.5 text-[11px] font-semibold text-slate-500">
                Hạng mục / Phụ tùng
              </div>
              <div className="space-y-1">
                {matchedItems.map(({ item, plate }) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onFilterBySearch(item.item_name);
                      onClose();
                    }}
                    className="w-full min-h-[48px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 text-left transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="text-sm font-medium text-slate-900 break-words">
                        {item.item_name}
                      </div>
                      <div className="text-xs text-slate-600 break-words">
                        {plate} · {item.part_name || item.category}
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-800 tabular-nums shrink-0">
                      {formatVND(item.amount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hidden sm:flex px-4 py-2 bg-slate-50/70 border-t border-slate-200/60 items-center justify-between text-[11px] text-slate-500">
          <span>↑↓ để chọn · Enter để mở hồ sơ xe · Esc để đóng</span>
          <span>Phím tắt: Ctrl+K hoặc /</span>
        </div>
        <div className="sm:hidden px-4 py-2.5 bg-white/80 border-t border-slate-200/60 safe-bottom">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
