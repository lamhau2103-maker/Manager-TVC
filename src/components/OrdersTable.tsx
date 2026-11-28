import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Edit3,
  Filter,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { EnrichedOrder } from '../types';
import { formatDateVN, formatKm, formatVND } from '../utils/format';

interface CrossFilterChip {
  key: string;
  label: string;
  clear: () => void;
}

interface OrdersTableProps {
  orders: EnrichedOrder[];
  canModifyOrders?: boolean;
  onOpenVehicle: (vehicleId: string, plate?: string) => void;
  onEditOrder: (order: EnrichedOrder) => void;
  onDeleteOrder: (orderId: string) => void;
  onFilterByPo?: (poNumber: string) => void;
  onAddNew?: () => void;
  title?: string;
  subtitle?: string;
  crossFilterChips?: CrossFilterChip[];
  onClearAllCrossFilters?: () => void;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  canModifyOrders = true,
  onOpenVehicle,
  onEditOrder,
  onDeleteOrder,
  onFilterByPo,
  onAddNew,
  title = 'Chi tiết các phiếu bảo dưỡng',
  subtitle = 'Bấm vào từng dòng để mở rộng toàn bộ hạng mục, phụ tùng và số PO chi tiết',
  crossFilterChips = [],
  onClearAllCrossFilters,
}) => {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const hasCrossFilter = crossFilterChips.length > 0;

  return (
    <div
      className={`glass-panel rounded-2xl overflow-hidden ${
        hasCrossFilter ? 'border-blue-400/90! ring-2 ring-blue-500/20' : ''
      }`}
    >
      <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/70 bg-white/30 flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="fluid-section-title font-extrabold text-slate-950 break-words">{title}</h3>
            {hasCrossFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600/12 border border-blue-400/35 text-[11px] font-bold text-blue-800">
                <Filter className="w-3 h-3 shrink-0" />
                Đang lọc theo biểu đồ / xe
              </span>
            )}
          </div>
          <p className="text-sm md:text-xs text-slate-600 mt-0.5 leading-relaxed break-words">{subtitle}</p>
        </div>
        <div className="text-sm md:text-xs text-slate-700 tabular-nums shrink-0">
          Hiển thị <strong className="text-slate-950">{orders.length}</strong> phiếu · Tổng{' '}
          <strong className="font-mono text-blue-700">
            {formatVND(orders.reduce((s, o) => s + o.totalAmount, 0))}
          </strong>
        </div>
      </div>

      {hasCrossFilter && (
        <div className="px-4 sm:px-5 py-2.5 bg-blue-500/8 border-b border-blue-300/40 backdrop-blur-sm flex flex-wrap items-center justify-between gap-2 no-print">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-blue-950 whitespace-nowrap">
              Đang lọc chi tiết:
            </span>
            {crossFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/85 border border-blue-300/70 hover:bg-white text-blue-800 text-xs font-semibold shadow-2xs transition-colors"
              >
                <span>{chip.label}</span>
                <X className="w-3.5 h-3.5 shrink-0" />
              </button>
            ))}
          </div>
          {onClearAllCrossFilters && (
            <button
              type="button"
              onClick={onClearAllCrossFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/85 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold whitespace-nowrap transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              Xóa lọc
            </button>
          )}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="p-8 sm:p-10 text-center space-y-3">
          <p className="text-sm font-medium text-slate-600">
            Không có phiếu bảo dưỡng nào khớp với bộ lọc hiện tại.
          </p>
          {onAddNew && (
            <button
              type="button"
              onClick={onAddNew}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl glass-button-primary text-white text-xs font-semibold touch-press"
            >
              <Plus className="w-4 h-4" />
              Thêm phiếu bảo dưỡng đầu tiên
            </button>
          )}
        </div>
      ) : (
        <>
          {/* MOBILE & SMALL TABLET (< 768px): Vertical Expandable Glass Cards */}
          <div className="md:hidden divide-y divide-white/65">
            {orders.map((ord) => {
              const isExpanded = Boolean(expandedIds[ord.id]);
              return (
                <div
                  key={ord.id}
                  className={`p-3.5 space-y-2.5 transition-colors ${
                    isExpanded ? 'bg-blue-50/40' : 'bg-white/25'
                  }`}
                >
                  {/* Card Top: Date + Plate + Total */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (ord.vehicle) onOpenVehicle(ord.vehicle.id, ord.vehicle.plate);
                          }}
                          className="font-mono text-sm font-extrabold text-blue-700 hover:underline text-left"
                        >
                          {ord.vehicle?.plate ?? ord.vehicle_id}
                        </button>
                        <span className="font-mono text-[11px] font-semibold text-slate-600 tabular-nums">
                          {formatDateVN(ord.service_date)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 break-words leading-snug">
                        {ord.vehicle?.type ? `${ord.vehicle.type} · ` : ''}
                        <strong className="font-semibold text-slate-900">{ord.driver_name}</strong>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-extrabold text-slate-950 tabular-nums">
                        {formatVND(ord.totalAmount)}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {ord.items.length} hạng mục ({ord.replaceCount}T/{ord.repairCount}S)
                      </div>
                    </div>
                  </div>

                  {/* Middle Info: Garage, Service Type, Odometer */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-white/55 border border-white/80 text-[11px]">
                    <div className="min-w-0">
                      <div className="text-slate-500">Gara / Loại BD</div>
                      <div className="font-semibold text-slate-900 break-words leading-snug">
                        {ord.garage}
                      </div>
                      <div className="text-slate-600 break-words">{ord.service_type}</div>
                    </div>
                    <div className="min-w-0 text-right">
                      <div className="text-slate-500">Số km đồng hồ</div>
                      {ord.odometer_km > 0 ? (
                        <div className="font-mono font-bold text-slate-800 tabular-nums mt-0.5">
                          {formatKm(ord.odometer_km)}
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-1 text-amber-700 font-semibold mt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Thiếu km
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PO Badges */}
                  {(ord.poNumbers.length > 0 || ord.hasMissingPo) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ord.poNumbers.map((po) => (
                        <button
                          key={po}
                          type="button"
                          onClick={() => onFilterByPo?.(po)}
                          className="px-2.5 py-1 rounded-lg bg-white/75 border border-white/95 shadow-2xs font-mono text-[11px] font-semibold text-slate-800"
                        >
                          {po}
                        </button>
                      ))}
                      {ord.hasMissingPo && (
                        <button
                          type="button"
                          onClick={() => onFilterByPo?.('__MISSING__')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Thiếu PO
                        </button>
                      )}
                    </div>
                  )}

                  {/* Card Actions Row */}
                  <div className="flex items-center justify-between gap-2 pt-0.5 no-print">
                    <button
                      type="button"
                      onClick={() => toggleExpand(ord.id)}
                      className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl glass-tile text-xs font-semibold text-blue-700 touch-press"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      {isExpanded ? 'Thu gọn hạng mục' : `Xem ${ord.items.length} hạng mục`}
                    </button>

                    {canModifyOrders &&
                      (confirmDeleteId === ord.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteOrder(ord.id);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[40px] px-3 rounded-xl bg-red-600 text-white text-xs font-semibold"
                          >
                            Xóa
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[40px] px-3 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditOrder(ord)}
                            aria-label="Chỉnh sửa phiếu"
                            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl glass-tile text-slate-600 hover:text-blue-700 touch-press"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(ord.id)}
                            aria-label="Xóa phiếu"
                            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl glass-tile text-slate-600 hover:text-red-600 touch-press"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                  </div>

                  {/* Expanded Items Cards on Mobile */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-white/70 space-y-2">
                      {ord.note && (
                        <div className="text-xs text-slate-700 bg-white/55 rounded-xl p-2.5 border border-white/80">
                          <span className="font-semibold text-slate-900">Ghi chú: </span>
                          {ord.note}
                        </div>
                      )}
                      {ord.items.map((it) => (
                        <div
                          key={it.id}
                          className="p-2.5 rounded-xl bg-white/70 border border-white/90 space-y-1 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-slate-900 break-words leading-snug">
                              {it.item_name}
                            </div>
                            <span
                              className={`text-[10px] font-bold whitespace-nowrap shrink-0 px-1.5 py-0.5 rounded-md ${
                                it.action === 'THAY THẾ'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-teal-50 text-teal-700'
                              }`}
                            >
                              {it.action}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 break-words">
                            {it.category}
                            {it.part_name ? ` · ${it.part_name}` : ''}
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px] font-mono tabular-nums">
                            <span className="text-slate-600">
                              SL: <strong className="text-slate-900">{it.quantity}</strong> ·{' '}
                              {formatVND(it.amount)}
                            </span>
                            {it.po_number ? (
                              <button
                                type="button"
                                onClick={() => onFilterByPo?.(it.po_number)}
                                className="font-bold text-blue-700 underline underline-offset-2"
                              >
                                {it.po_number}
                              </button>
                            ) : (
                              <span className="text-amber-700 font-semibold">Chưa có PO</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* TABLET & DESKTOP (>= 768px): Full Table with sticky first column & horizontal scroll */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[820px] text-left border-collapse">
              <thead>
                <tr className="border-b border-white/60 bg-white/40 backdrop-blur-md text-[11px] font-semibold text-slate-600">
                  <th className="sticky-col-left-head py-3 pl-4 pr-3 whitespace-nowrap">Biển số & Xe</th>
                  <th className="py-3 px-3 whitespace-nowrap">Ngày</th>
                  <th className="py-3 px-3 whitespace-nowrap">Gara / Loại BD</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Số km</th>
                  <th className="py-3 px-3 whitespace-nowrap">Số PO (theo hạng mục)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Hạng mục</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Tổng chi phí</th>
                  {canModifyOrders && (
                    <th className="py-3 pl-2 pr-4 text-right whitespace-nowrap no-print">Thao tác</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/55 text-xs">
                {orders.map((ord) => {
                  const isExpanded = Boolean(expandedIds[ord.id]);
                  return (
                    <React.Fragment key={ord.id}>
                      <tr
                        onClick={() => toggleExpand(ord.id)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? 'bg-blue-50/50' : 'hover:bg-white/50'
                        }`}
                      >
                        <td className="sticky-col-left py-3 pl-3.5 pr-3">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-slate-400 shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (ord.vehicle) onOpenVehicle(ord.vehicle.id, ord.vehicle.plate);
                                }}
                                className="font-mono font-bold text-sm text-blue-700 hover:text-blue-900 hover:underline text-left whitespace-nowrap"
                              >
                                {ord.vehicle?.plate ?? ord.vehicle_id}
                              </button>
                              <div className="text-[11px] text-slate-500 break-words leading-snug">
                                {ord.vehicle?.type} · {ord.driver_name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap tabular-nums">
                          {formatDateVN(ord.service_date)}
                        </td>
                        <td className="py-3 px-3 min-w-[160px]">
                          <div className="font-medium text-slate-800 break-words leading-snug">
                            {ord.garage}
                          </div>
                          <div className="text-[11px] text-slate-500 break-words">
                            {ord.service_type}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {ord.odometer_km > 0 ? (
                            <span className="text-slate-700 font-medium">
                              {formatKm(ord.odometer_km)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Thiếu km
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap items-center gap-1">
                            {ord.poNumbers.map((po) => (
                              <button
                                key={po}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFilterByPo?.(po);
                                }}
                                title={`Lọc toàn dashboard theo ${po}`}
                                className="px-2 py-0.5 rounded-md bg-white/65 hover:bg-blue-50/90 border border-white/90 shadow-2xs font-mono text-[11px] font-semibold text-slate-800 hover:text-blue-800 transition-colors whitespace-nowrap"
                              >
                                {po}
                              </button>
                            ))}
                            {ord.hasMissingPo && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFilterByPo?.('__MISSING__');
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[11px] font-semibold text-amber-800 whitespace-nowrap"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                Thiếu PO
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap text-slate-600">
                          <span className="font-semibold text-slate-800">{ord.items.length}</span>{' '}
                          <span className="text-[11px] text-slate-500">
                            ({ord.replaceCount}T / {ord.repairCount}S)
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatVND(ord.totalAmount)}
                        </td>
                        {canModifyOrders && (
                          <td
                            className="py-3 pl-2 pr-4 text-right whitespace-nowrap no-print"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {confirmDeleteId === ord.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteOrder(ord.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold"
                                >
                                  Xóa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-semibold"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onEditOrder(ord)}
                                  title="Chỉnh sửa phiếu"
                                  className="p-2 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(ord.id)}
                                  title="Xóa phiếu"
                                  className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>

                      {/* Expanded Drill-down Items Table */}
                      {isExpanded && (
                        <tr className="bg-white/30">
                          <td colSpan={canModifyOrders ? 8 : 7} className="px-5 py-3.5">
                            <div className="space-y-2.5">
                              {ord.note && (
                                <div className="text-xs text-slate-700">
                                  <span className="font-semibold text-slate-900">Ghi chú phiếu: </span>
                                  {ord.note}
                                </div>
                              )}
                              <div className="overflow-x-auto rounded-xl glass-tile">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-white/70 bg-white/45 text-[11px] text-slate-600">
                                      <th className="py-2 px-3 font-semibold">Nhóm</th>
                                      <th className="py-2 px-3 font-semibold">Hạng mục</th>
                                      <th className="py-2 px-3 font-semibold">Hành động</th>
                                      <th className="py-2 px-3 font-semibold">Phụ tùng / Vật tư</th>
                                      <th className="py-2 px-3 font-semibold text-right">SL</th>
                                      <th className="py-2 px-3 font-semibold text-right">Đơn giá</th>
                                      <th className="py-2 px-3 font-semibold text-right">Thành tiền</th>
                                      <th className="py-2 px-3 font-semibold">Số PO</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {ord.items.map((it) => (
                                      <tr key={it.id} className="hover:bg-slate-50/60">
                                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                          {it.category}
                                        </td>
                                        <td className="py-2 px-3 font-medium text-slate-900">
                                          {it.item_name}
                                        </td>
                                        <td className="py-2 px-3 whitespace-nowrap">
                                          <span
                                            className={`font-semibold text-[11px] ${
                                              it.action === 'THAY THẾ'
                                                ? 'text-blue-700'
                                                : 'text-teal-700'
                                            }`}
                                          >
                                            {it.action}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 text-slate-600">
                                          {it.part_name || '—'}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                                          {it.quantity}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                                          {formatVND(it.unit_price)}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-slate-900">
                                          {formatVND(it.amount)}
                                        </td>
                                        <td className="py-2 px-3 whitespace-nowrap">
                                          {it.po_number ? (
                                            <button
                                              type="button"
                                              onClick={() => onFilterByPo?.(it.po_number)}
                                              className="font-mono font-semibold text-blue-700 hover:underline"
                                            >
                                              {it.po_number}
                                            </button>
                                          ) : (
                                            <span className="text-amber-700 font-semibold">
                                              Chưa có PO
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
