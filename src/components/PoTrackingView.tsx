import React, { useState } from 'react';
import { AlertTriangle, Check, Filter } from 'lucide-react';
import { MaintenanceItem, MaintenanceOrder, Vehicle } from '../types';
import { buildPoBreakdown } from '../utils/analytics';
import { formatCompactVND, formatDateVN, formatVND } from '../utils/format';

interface PoTrackingViewProps {
  filteredItems: Array<MaintenanceItem & { order: MaintenanceOrder; vehicle?: Vehicle }>;
  canAssignPo?: boolean;
  onFilterByPo: (poNumber: string) => void;
  onAssignPo: (itemId: string, poNumber: string) => void;
  onOpenVehicle: (vehicleId: string, plate?: string) => void;
}

export const PoTrackingView: React.FC<PoTrackingViewProps> = ({
  filteredItems,
  canAssignPo = true,
  onFilterByPo,
  onAssignPo,
  onOpenVehicle,
}) => {
  const [draftPos, setDraftPos] = useState<Record<string, string>>({});

  const poBreakdown = buildPoBreakdown(filteredItems);
  const missingItems = filteredItems.filter((it) => !it.po_number.trim());
  const assignedPos = poBreakdown.filter((p) => !p.isMissing);
  const totalMissingCost = missingItems.reduce((s, i) => s + i.amount, 0);
  const totalAssignedCost = assignedPos.reduce((s, p) => s + p.totalCost, 0);

  return (
    <div className="space-y-4">
      {/* Top summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="glass-panel rounded-2xl p-4">
          <div className="text-xs font-semibold text-slate-500">Số PO phát sinh (cấp hạng mục)</div>
          <div className="mt-1 font-mono fluid-kpi-value font-extrabold text-slate-900 tabular-nums">
            {assignedPos.length} PO
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tổng hợp trực tiếp từ bảng maintenance_items
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <div className="text-xs font-semibold text-slate-500">Giá trị đã gắn số PO</div>
          <div className="mt-1 font-mono fluid-kpi-value font-extrabold text-emerald-700 tabular-nums">
            {formatCompactVND(totalAssignedCost)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">
            {formatVND(totalAssignedCost)}
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <div className="text-xs font-semibold text-slate-500">Giá trị CHƯA có số PO</div>
          <div
            className={`mt-1 font-mono fluid-kpi-value font-extrabold tabular-nums ${
              missingItems.length > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            {formatCompactVND(totalMissingCost)}
          </div>
          <div className="text-[11px] text-slate-600 mt-1">
            {missingItems.length > 0
              ? `${missingItems.length} hạng mục cần bổ sung số PO`
              : 'Đầy đủ 100% số PO trong kỳ lọc'}
          </div>
        </div>
      </div>

      {/* Missing PO Quick-Fix Panel */}
      {missingItems.length > 0 && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-amber-200/90">
          <div className="px-4 sm:px-5 py-3.5 bg-amber-50/70 border-b border-amber-200/80 flex items-start gap-2.5">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-950 leading-snug">
                {canAssignPo
                  ? `Hạng mục chưa có số PO (${missingItems.length}) — Bổ sung nhanh tại chỗ`
                  : `Hạng mục chưa có số PO (${missingItems.length})`}
              </h3>
              <p className="text-[11px] text-amber-800 mt-0.5">
                {canAssignPo
                  ? 'Nhập số PO rồi bấm Lưu để cập nhật ngay vào dữ liệu và báo cáo'
                  : 'Danh sách các hạng mục đang chờ Quản trị viên cập nhật số PO'}
              </p>
            </div>
          </div>

          {/* Mobile Stacked Quick-Fix Cards (< 768px) */}
          <div className="md:hidden divide-y divide-amber-200/60">
            {missingItems.map((it) => {
              const val = draftPos[it.id] ?? '';
              return (
                <div key={it.id} className="p-3.5 bg-white/50 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            it.vehicle && onOpenVehicle(it.vehicle.id, it.vehicle.plate)
                          }
                          className="font-mono text-sm font-extrabold text-blue-700 hover:underline"
                        >
                          {it.vehicle?.plate ?? '—'}
                        </button>
                        <span className="font-mono text-[11px] text-slate-600">
                          {formatDateVN(it.order.service_date)}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5 break-words">
                        {it.item_name}
                      </div>
                      <div className="text-[11px] text-slate-500 break-words">
                        {it.category} · {it.order.garage}
                      </div>
                    </div>
                    <div className="font-mono text-xs font-extrabold text-slate-900 tabular-nums shrink-0">
                      {formatVND(it.amount)}
                    </div>
                  </div>

                  {canAssignPo && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={val}
                        onChange={(e) =>
                          setDraftPos((prev) => ({
                            ...prev,
                            [it.id]: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="VD: PO-2026-1120"
                        className="glass-input min-h-[44px] px-3 rounded-xl text-xs font-mono uppercase flex-1 min-w-0"
                      />
                      <button
                        type="button"
                        disabled={!val.trim()}
                        onClick={() => {
                          onAssignPo(it.id, val);
                          setDraftPos((prev) => {
                            const next = { ...prev };
                            delete next[it.id];
                            return next;
                          });
                        }}
                        className="inline-flex items-center justify-center gap-1 min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold shrink-0 touch-press"
                      >
                        <Check className="w-4 h-4" />
                        Lưu
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tablet / Desktop Quick-Fix Table (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/70 bg-white/70 text-[11px] text-slate-500">
                  <th className="sticky-col-left-head py-2.5 px-4 whitespace-nowrap">Ngày</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Biển số</th>
                  <th className="py-2.5 px-3">Nhóm / Hạng mục</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Thành tiền</th>
                  {canAssignPo && (
                    <th className="py-2.5 px-4 whitespace-nowrap">Nhập số PO mới</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {missingItems.map((it) => {
                  const val = draftPos[it.id] ?? '';
                  return (
                    <tr key={it.id} className="bg-white/50">
                      <td className="sticky-col-left py-2.5 px-4 font-mono whitespace-nowrap">
                        {formatDateVN(it.order.service_date)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            it.vehicle && onOpenVehicle(it.vehicle.id, it.vehicle.plate)
                          }
                          className="font-mono font-bold text-blue-700 hover:underline"
                        >
                          {it.vehicle?.plate ?? '—'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 min-w-[180px]">
                        <div className="font-semibold text-slate-900 break-words">{it.item_name}</div>
                        <div className="text-[11px] text-slate-500 break-words">
                          {it.category} · {it.order.garage}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                        {formatVND(it.amount)}
                      </td>
                      {canAssignPo && (
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5 min-w-[200px] max-w-[240px]">
                            <input
                              type="text"
                              value={val}
                              onChange={(e) =>
                                setDraftPos((prev) => ({
                                  ...prev,
                                  [it.id]: e.target.value.toUpperCase(),
                                }))
                              }
                              placeholder="VD: PO-2026-1120"
                              className="glass-input h-9 px-2.5 rounded-lg text-xs font-mono uppercase w-full"
                            />
                            <button
                              type="button"
                              disabled={!val.trim()}
                              onClick={() => {
                                onAssignPo(it.id, val);
                                setDraftPos((prev) => {
                                  const next = { ...prev };
                                  delete next[it.id];
                                  return next;
                                });
                              }}
                              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold shrink-0"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Lưu
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full PO Breakdown Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200/70">
          <h3 className="fluid-section-title font-bold text-slate-900">
            Bảng tổng hợp chi phí theo từng số PO
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Mỗi số PO được cộng dồn chính xác từ các hạng mục có gắn PO đó (kể cả khi một phiếu tách nhiều PO).
          </p>
        </div>

        {/* Mobile Cards (< 768px) */}
        <div className="md:hidden divide-y divide-slate-200/60">
          {poBreakdown.length === 0 ? (
            <div className="py-8 px-4 text-center text-xs text-slate-500">
              Chưa có dữ liệu PO trong kỳ chọn.
            </div>
          ) : (
            poBreakdown.map((row) => (
              <div key={row.poNumber} className="p-3.5 space-y-2 bg-white/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div
                      className={`font-mono text-sm font-extrabold break-all ${
                        row.isMissing ? 'text-amber-700' : 'text-slate-900'
                      }`}
                    >
                      {row.displayLabel}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5 font-mono break-words">
                      Xe: {row.vehiclePlates.join(', ') || '—'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-extrabold text-slate-950 tabular-nums">
                      {formatVND(row.totalCost)}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {row.orderCount} phiếu · {row.itemCount} HM
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onFilterByPo(row.poNumber)}
                  className="w-full inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors touch-press"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Xem báo cáo PO
                </button>
              </div>
            ))
          )}
        </div>

        {/* Tablet & Desktop Table (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[680px] text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold text-slate-500">
                <th className="sticky-col-left-head py-3 px-4 whitespace-nowrap">Số PO</th>
                <th className="py-3 px-3 whitespace-nowrap">Biển số liên quan</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Số phiếu</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Số hạng mục</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Tổng thành tiền</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Lọc trên Dashboard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {poBreakdown.map((row) => (
                <tr key={row.poNumber} className="hover:bg-white/75 transition-colors">
                  <td className="sticky-col-left py-3 px-4 font-mono font-bold whitespace-nowrap">
                    <span className={row.isMissing ? 'text-amber-700' : 'text-slate-900'}>
                      {row.displayLabel}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-700 min-w-[150px] break-words">
                    {row.vehiclePlates.join(', ') || '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                    {row.orderCount}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                    {row.itemCount}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                    {formatVND(row.totalCost)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onFilterByPo(row.poNumber)}
                      className="inline-flex items-center gap-1 min-h-[38px] sm:min-h-[30px] px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors touch-press"
                    >
                      <Filter className="w-3 h-3" />
                      Xem báo cáo PO
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
