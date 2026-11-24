import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  History,
  Layers,
  ListPlus,
  Lock,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  DEFAULT_GARAGES,
  DEPARTMENTS,
  EnrichedOrder,
  MaintenanceAction,
  MaintenanceCategory,
  MaintenanceItem,
  MaintenanceOrder,
  SERVICE_TYPES,
  ServiceType,
  VEHICLE_TYPE_PRESETS,
  Vehicle,
  VehicleType,
} from '../types';
import {
  formatCompactVND,
  formatDateVN,
  formatKm,
  formatVND,
} from '../utils/format';
import { REFERENCE_TODAY } from '../data/seedData';
import { PlateInput } from './PlateInput';

interface DraftItem {
  localId: string;
  id?: string;
  preservedCategory?: MaintenanceCategory;
  preservedPartName?: string;
  item_name: string;
  action: MaintenanceAction;
  quantity: number;
  po_number: string;
}

function createEmptyDraftItem(defaultPo = ''): DraftItem {
  return {
    localId: `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    item_name: '',
    action: 'THAY THẾ',
    quantity: 1,
    po_number: defaultPo,
  };
}

/**
 * Automatically infer category silently from Vietnamese item_name so
 * dashboard category charts remain accurate without cluttering the form.
 */
function inferCategoryFromItemName(
  itemName: string,
  fallback?: MaintenanceCategory
): MaintenanceCategory {
  if (fallback) return fallback;
  const s = itemName.toLowerCase();
  if (/lốp|vỏ xe|vá|mâm|van hơi|đảo lốp/.test(s)) return 'Lốp';
  if (/phanh|thắng|bố thắng|tăng bua|heo thắng/.test(s)) return 'Phanh';
  if (/nhớt|dầu cầu|dầu hộp số|lọc gió|lọc dầu|lọc nhiên liệu|lọc nhớt|nước làm mát/.test(s))
    return 'Dầu nhớt-lọc';
  if (/động cơ|turbo|kim phun|ly hợp|lá côn|bàn ép|két nước|curoa|bơm cao áp|egr|máy/.test(s))
    return 'Động cơ';
  if (/điện|ắc quy|bình|đèn|cảm biến|abs|củ đề|máy phát|ecu|rơ-le|gạt mưa/.test(s))
    return 'Hệ thống điện';
  if (/gầm|nhíp|phuộc|giảm xóc|thước lái|rô-tuyn|bạc đạn|moay-ơ|các-đăng|bầu hơi|tắc kê|mâm kéo/.test(s))
    return 'Gầm-treo';
  if (/điều hòa|máy lạnh|dàn lạnh|dàn nóng|lốc lạnh|gas|quạt gió/.test(s)) return 'Điều hòa';
  if (/thân vỏ|gò|sơn|kính|gương|cửa|cản|gioăng/.test(s)) return 'Thân vỏ';
  return 'Khác';
}

/**
 * Distribute order-level total amount across items weighted by quantity
 * so integer sum matches totalOrderAmount to the exact đồng.
 */
function distributeOrderTotalAcrossItems(
  validItems: DraftItem[],
  totalOrderAmount: number
): Array<Omit<MaintenanceItem, 'id' | 'order_id'> & { id?: string }> {
  const safeTotal = Math.max(0, Math.round(totalOrderAmount || 0));
  const weights = validItems.map((it) => Math.max(1, Number(it.quantity) || 1));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let remaining = safeTotal;

  return validItems.map((it, idx) => {
    const qty = Math.max(1, Number(it.quantity) || 1);
    const isLast = idx === validItems.length - 1;
    const allocated = isLast
      ? remaining
      : Math.round((safeTotal * weights[idx]) / totalWeight);
    remaining -= allocated;
    const unitPrice = qty > 0 ? Math.round(allocated / qty) : allocated;

    return {
      id: it.id,
      category: inferCategoryFromItemName(it.item_name, it.preservedCategory),
      item_name: it.item_name.trim(),
      action: it.action,
      part_name: it.preservedPartName ?? '',
      quantity: qty,
      unit_price: unitPrice,
      amount: Math.max(0, allocated),
      po_number: it.po_number.trim().toUpperCase(),
    };
  });
}

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  editingOrder?: EnrichedOrder | null;
  preselectedVehicleId?: string | null;
  vehicles: Vehicle[];
  allOrders: MaintenanceOrder[];
  allItems: MaintenanceItem[];
  onQuickCreateVehicle: (
    payload: Omit<Vehicle, 'id' | 'plate_key'>
  ) => { ok: true; vehicle: Vehicle } | { ok: false; error: string };
  onBulkAddPlates: (
    rawEntries: string[],
    defaultType?: VehicleType,
    defaultDepartment?: string
  ) => { added: Vehicle[]; skipped: string[] };
  onSaveOrder: (
    orderPayload: Omit<MaintenanceOrder, 'id' | 'created_at' | 'updated_at'> & { id?: string },
    itemPayloads: Array<Omit<MaintenanceItem, 'id' | 'order_id'> & { id?: string }>
  ) => void;
  onAppendToExistingOrder: (
    orderId: string,
    newItems: Array<Omit<MaintenanceItem, 'id' | 'order_id'>>
  ) => void;
}

export const OrderFormModal: React.FC<OrderFormModalProps> = ({
  isOpen,
  onClose,
  isAdmin = false,
  editingOrder,
  preselectedVehicleId,
  vehicles,
  allOrders,
  allItems,
  onQuickCreateVehicle,
  onBulkAddPlates,
  onSaveOrder,
  onAppendToExistingOrder,
}) => {
  const { isAdmin: authIsAdmin, driverName: authDriverName } = useAuth();
  const effectiveIsAdmin = isAdmin || authIsAdmin;
  const lockedUserDriverName =
    !effectiveIsAdmin && !editingOrder && authDriverName.trim() ? authDriverName.trim() : '';
  const isDriverLocked = Boolean(lockedUserDriverName);

  const [serviceDate, setServiceDate] = useState(REFERENCE_TODAY);
  const [plateText, setPlateText] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [serviceIntervalKm, setServiceIntervalKm] = useState('10000');
  const [serviceType, setServiceType] = useState<ServiceType>('Định kỳ');
  const [garage, setGarage] = useState(DEFAULT_GARAGES[0]);
  const [driverName, setDriverName] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([createEmptyDraftItem()]);
  const [totalOrderAmountInput, setTotalOrderAmountInput] = useState('');
  const [note, setNote] = useState('');
  const [confirmKmOverride, setConfirmKmOverride] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Admin pre-loaded plate list panel state
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminBulkText, setAdminBulkText] = useState('');
  const [adminDefaultType, setAdminDefaultType] = useState<VehicleType>(VEHICLE_TYPE_PRESETS[0]);
  const [adminDefaultDept, setAdminDefaultDept] = useState(DEPARTMENTS[0]);
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);

  // Populate form when opening
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setConfirmKmOverride(false);
    setShowAdminPanel(false);
    setAdminFeedback(null);

    if (editingOrder) {
      const veh = vehicles.find((v) => v.id === editingOrder.vehicle_id);
      setServiceDate(editingOrder.service_date);
      setPlateText(veh?.plate ?? '');
      setSelectedVehicleId(editingOrder.vehicle_id);
      setOdometerKm(editingOrder.odometer_km ? String(editingOrder.odometer_km) : '');
      setServiceIntervalKm(
        String(editingOrder.service_interval_km || veh?.service_interval_km || 10000)
      );
      setServiceType(editingOrder.service_type);
      setGarage(editingOrder.garage);
      setDriverName(editingOrder.driver_name);
      setTotalOrderAmountInput(
        editingOrder.totalAmount > 0 ? String(editingOrder.totalAmount) : ''
      );
      setNote(editingOrder.note);
      setDraftItems(
        editingOrder.items.length > 0
          ? editingOrder.items.map((it) => ({
              localId: it.id,
              id: it.id,
              preservedCategory: it.category,
              preservedPartName: it.part_name,
              item_name: it.item_name,
              action: it.action,
              quantity: it.quantity,
              po_number: it.po_number,
            }))
          : [createEmptyDraftItem()]
      );
      return;
    }

    // New order: NEVER auto-fill or auto-select vehicle plate for any role
    setPlateText('');
    setSelectedVehicleId('');
    setOdometerKm('');
    setServiceIntervalKm('10000');
    setDriverName(isDriverLocked ? lockedUserDriverName : '');
    setServiceDate(REFERENCE_TODAY);
    setServiceType('Định kỳ');
    setGarage(DEFAULT_GARAGES[0]);
    setTotalOrderAmountInput('');
    setNote('');
    setDraftItems([createEmptyDraftItem()]);
  }, [isOpen, editingOrder, vehicles, isDriverLocked, lockedUserDriverName, preselectedVehicleId]);

  // Keep locked driver name synchronized if vehicle data updates while modal is open
  useEffect(() => {
    if (isOpen && isDriverLocked) {
      setDriverName(lockedUserDriverName);
    }
  }, [isOpen, isDriverLocked, lockedUserDriverName]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId),
    [vehicles, selectedVehicleId]
  );

  // 3 most recent maintenance orders for selected vehicle
  const recentVehicleOrders = useMemo(() => {
    if (!selectedVehicleId) return [];
    const itemsByOrder = new Map<string, MaintenanceItem[]>();
    for (const it of allItems) {
      const arr = itemsByOrder.get(it.order_id) ?? [];
      arr.push(it);
      itemsByOrder.set(it.order_id, arr);
    }
    return allOrders
      .filter((o) => o.vehicle_id === selectedVehicleId && o.id !== editingOrder?.id)
      .sort((a, b) => b.service_date.localeCompare(a.service_date))
      .slice(0, 3)
      .map((o) => {
        const list = itemsByOrder.get(o.id) ?? [];
        return {
          ...o,
          itemCount: list.length,
          total: list.reduce((s, x) => s + x.amount, 0),
          summary: list.map((x) => x.item_name).slice(0, 2).join(', '),
        };
      });
  }, [selectedVehicleId, allOrders, allItems, editingOrder?.id]);

  // Latest prior odometer km before current serviceDate
  const priorMaxKm = useMemo(() => {
    if (!selectedVehicleId) return 0;
    const prevOrders = allOrders.filter(
      (o) =>
        o.vehicle_id === selectedVehicleId &&
        o.id !== editingOrder?.id &&
        o.service_date <= serviceDate &&
        o.odometer_km > 0
    );
    if (prevOrders.length === 0) return 0;
    return Math.max(...prevOrders.map((o) => o.odometer_km));
  }, [selectedVehicleId, allOrders, serviceDate, editingOrder?.id]);

  // Same vehicle + same date duplicate check
  const sameDayOrder = useMemo(() => {
    if (!selectedVehicleId || !serviceDate || editingOrder) return null;
    return (
      allOrders.find(
        (o) => o.vehicle_id === selectedVehicleId && o.service_date === serviceDate
      ) ?? null
    );
  }, [selectedVehicleId, serviceDate, allOrders, editingOrder]);

  const numericKm = Number(odometerKm) || 0;
  const numericIntervalKm = Math.max(1000, Number(serviceIntervalKm) || 10000);
  const computedNextDueKm = numericKm > 0 ? numericKm + numericIntervalKm : 0;
  const isKmLowerThanPrior = numericKm > 0 && priorMaxKm > 0 && numericKm < priorMaxKm;

  const totalOrderAmount = Math.max(
    0,
    Number(String(totalOrderAmountInput).replace(/[^0-9]/g, '')) || 0
  );

  const garageOptions = useMemo(
    () =>
      Array.from(new Set([...DEFAULT_GARAGES, ...allOrders.map((o) => o.garage).filter(Boolean)])),
    [allOrders]
  );

  const distinctPos = useMemo(
    () => Array.from(new Set(draftItems.map((d) => d.po_number.trim().toUpperCase()).filter(Boolean))),
    [draftItems]
  );

  if (!isOpen) return null;

  const handleVehicleSelected = (veh: Vehicle) => {
    setSelectedVehicleId(veh.id);
    setPlateText(veh.plate);
    // Only Admin auto-fills driver name from selected vehicle; user role keeps their own driver name
    if (effectiveIsAdmin) {
      setDriverName(veh.driver_name);
    }
    if (!odometerKm && veh.current_km > 0) setOdometerKm(String(veh.current_km));
    if (veh.service_interval_km > 0) setServiceIntervalKm(String(veh.service_interval_km));
  };

  const handleAdminBulkImport = () => {
    if (!effectiveIsAdmin) return;
    const tokens = adminBulkText
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length === 0) {
      setAdminFeedback('Vui lòng nhập ít nhất 1 biển số xe (mỗi dòng 1 biển số hoặc cách nhau dấu phẩy).');
      return;
    }
    const res = onBulkAddPlates(tokens, adminDefaultType, adminDefaultDept);
    if (res.added.length > 0) {
      setAdminBulkText('');
      setAdminFeedback(
        `Đã nạp ${res.added.length} biển số mới vào danh sách xổ xuống${
          res.skipped.length > 0 ? ` (bỏ qua ${res.skipped.length} biển trùng/không hợp lệ)` : ''
        }.`
      );
      if (res.added.length === 1) {
        handleVehicleSelected(res.added[0]);
      }
    } else {
      setAdminFeedback(
        `Không có biển số mới nào được thêm (${res.skipped.length} biển số đã tồn tại hoặc chưa hợp lệ).`
      );
    }
  };

  const updateItem = (localId: string, patch: Partial<DraftItem>) => {
    setDraftItems((prev) =>
      prev.map((row) => (row.localId === localId ? { ...row, ...patch } : row))
    );
  };

  const handleAddRow = () => {
    const lastPo = draftItems[draftItems.length - 1]?.po_number ?? '';
    setDraftItems((prev) => [...prev, createEmptyDraftItem(lastPo)]);
  };

  const handleRemoveRow = (localId: string) => {
    setDraftItems((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.localId !== localId)));
  };

  const validateDraft = (): boolean => {
    setErrorMsg('');
    if (!serviceDate) {
      setErrorMsg('Vui lòng chọn ngày bảo dưỡng.');
      return false;
    }
    if (!selectedVehicleId) {
      setErrorMsg(
        effectiveIsAdmin
          ? 'Vui lòng chọn biển số xe từ danh sách đã nạp (hoặc dùng nút "Admin: Nạp danh sách biển số").'
          : 'Vui lòng chọn biển số xe từ danh sách phương tiện.'
      );
      return false;
    }
    if (isKmLowerThanPrior && !confirmKmOverride) {
      setErrorMsg(
        `Số km (${numericKm.toLocaleString('vi-VN')} km) nhỏ hơn lần bảo dưỡng trước (${priorMaxKm.toLocaleString('vi-VN')} km). Hãy kiểm tra lại hoặc tích xác nhận giữ nguyên số km này.`
      );
      return false;
    }
    const validItems = draftItems.filter((it) => it.item_name.trim().length > 0);
    if (validItems.length === 0) {
      setErrorMsg('Cần nhập ít nhất 1 tên hạng mục bảo dưỡng.');
      return false;
    }
    if (totalOrderAmount <= 0) {
      setErrorMsg('Vui lòng nhập Thành tiền tổng của cả phiếu bảo dưỡng (> 0 đ).');
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDraft()) return;

    const validDrafts = draftItems.filter((it) => it.item_name.trim().length > 0);
    const distributedItems = distributeOrderTotalAcrossItems(validDrafts, totalOrderAmount);

    const finalDriverName = isDriverLocked
      ? lockedUserDriverName
      : effectiveIsAdmin
      ? driverName.trim() || selectedVehicle?.driver_name || ''
      : driverName.trim();

    onSaveOrder(
      {
        id: editingOrder?.id,
        vehicle_id: selectedVehicleId,
        service_date: serviceDate,
        odometer_km: numericKm,
        service_interval_km: numericIntervalKm,
        garage: garage.trim() || 'Chưa xác định',
        driver_name: finalDriverName,
        service_type: serviceType,
        note: note.trim(),
      },
      distributedItems
    );
    onClose();
  };

  const handleMergeIntoSameDay = () => {
    if (!sameDayOrder) return;
    const validDrafts = draftItems.filter((it) => it.item_name.trim().length > 0);
    if (validDrafts.length === 0) {
      setErrorMsg('Hãy nhập ít nhất 1 tên hạng mục trước khi gộp vào phiếu cũ.');
      return;
    }
    const distributed = distributeOrderTotalAcrossItems(validDrafts, totalOrderAmount).map(
      ({ id: _ignore, ...rest }) => rest
    );
    onAppendToExistingOrder(sameDayOrder.id, distributed);
    onClose();
  };

  const handleFormFocusCapture = (e: React.FocusEvent<HTMLFormElement>) => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA')
    ) {
      window.setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 260);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/40 backdrop-blur-md no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        onFocusCapture={handleFormFocusCapture}
        className="w-full sm:max-w-[720px] lg:max-w-4xl max-h-[92dvh] flex flex-col glass-panel-strong rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/90 relative animate-sheet-up"
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-0.5 relative z-10">
          <span className="w-10 h-1 rounded-full bg-slate-300/90" />
        </div>

        {/* Subtle luminous glass corner sheen */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-sky-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-blue-500/15 blur-3xl"
        />

        {/* Header */}
        <div className="relative z-10 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/75 flex flex-wrap items-center justify-between gap-2.5 bg-white/50 backdrop-blur-xl">
          <div className="min-w-0 flex-1">
            <h2 className="fluid-section-title font-extrabold tracking-tight text-slate-950">
              {editingOrder ? 'Chỉnh sửa phiếu bảo dưỡng' : 'Thêm phiếu bảo dưỡng mới'}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Biểu mẫu gộp 1 bước nhanh gọn · Tự động cập nhật số km, chu kỳ km/lần và cảnh báo đội xe
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {effectiveIsAdmin && (
              <button
                type="button"
                onClick={() => {
                  setShowAdminPanel((s) => !s);
                  setAdminFeedback(null);
                }}
                className={`inline-flex items-center gap-1.5 min-h-[40px] sm:min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border whitespace-nowrap ${
                  showAdminPanel
                    ? 'bg-blue-600 text-white border-blue-400/60 shadow-sm'
                    : 'bg-white/75 hover:bg-white text-blue-700 border-white/90 shadow-2xs'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Admin: Nạp biển số</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl glass-tile text-slate-500 hover:text-slate-900 hover:bg-white/80 transition-all"
              aria-label="Đóng biểu mẫu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Unified Body */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-50/85 backdrop-blur-md border border-red-200/90 text-red-900 text-xs font-semibold flex items-start gap-2.5 shadow-xs">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Expandable Admin Bulk Plate Pre-loader */}
          {effectiveIsAdmin && showAdminPanel && (
            <div className="p-4 rounded-2xl bg-linear-to-br from-blue-50/85 via-white/70 to-sky-50/75 backdrop-blur-xl border border-blue-200/80 space-y-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <ListPlus className="w-4 h-4 text-blue-600" />
                    Khu vực Admin nạp sẵn danh sách biển số xe
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Dán danh sách biển số (mỗi dòng 1 biển hoặc cách nhau dấu phẩy). Khi thành viên bấm vào ô biển số, toàn bộ danh sách này sẽ xổ ra để tìm chọn chính xác.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdminPanel(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {adminFeedback && (
                <div className="px-3 py-2 rounded-xl bg-white/85 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{adminFeedback}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-7">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Danh sách biển số cần nạp thêm
                  </label>
                  <textarea
                    rows={3}
                    value={adminBulkText}
                    onChange={(e) => setAdminBulkText(e.target.value)}
                    placeholder={`VD:\n51C-998.12\n61H-445.21\n29C-881.20`}
                    className="glass-input w-full p-2.5 rounded-xl text-xs font-mono uppercase placeholder:normal-case"
                  />
                </div>
                <div className="md:col-span-5 flex flex-col justify-between gap-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Loại xe mặc định
                      </label>
                      <select
                        value={adminDefaultType}
                        onChange={(e) => setAdminDefaultType(e.target.value)}
                        className="glass-input w-full h-9 px-2.5 rounded-xl text-xs"
                      >
                        {VEHICLE_TYPE_PRESETS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Bộ phận mặc định
                      </label>
                      <select
                        value={adminDefaultDept}
                        onChange={(e) => setAdminDefaultDept(e.target.value)}
                        className="glass-input w-full h-9 px-2.5 rounded-xl text-xs"
                      >
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAdminBulkImport}
                    className="w-full h-9 px-3.5 rounded-xl glass-button-primary text-white text-xs font-semibold transition-all"
                  >
                    Nạp danh sách vào hệ thống
                  </button>
                </div>
              </div>

              {/* Quick clickable list of all preloaded plates */}
              <div className="pt-2 border-t border-white/75">
                <div className="text-[11px] font-semibold text-slate-600 mb-1.5">
                  Danh sách biển số đã nạp sẵn ({vehicles.length} xe — bấm để chọn nhanh):
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {vehicles.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        handleVehicleSelected(v);
                        setShowAdminPanel(false);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all border ${
                        selectedVehicleId === v.id
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-white/75 hover:bg-blue-50 text-slate-800 border-white/90'
                      }`}
                    >
                      {v.plate}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* UNIFIED SINGLE-STEP FORM CONTAINER */}
          <div className="glass-tile rounded-2xl p-4 sm:p-5 space-y-5">
            {/* PART 1: EXACT FIELD ORDER
                Ngày bảo dưỡng -> Biển số xe -> Số km hiện tại -> Chu kỳ km/lần -> Loại bảo dưỡng -> Gara -> Tên tài xế */}
            <div className="space-y-3.5">
              {/* Row A: Ngày bảo dưỡng, Biển số xe, Số km hiện tại, Chu kỳ km/lần */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
                {/* 1. Ngày bảo dưỡng */}
                <div className="lg:col-span-3">
                  <label
                    htmlFor="order-service-date"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Ngày bảo dưỡng *
                  </label>
                  <input
                    id="order-service-date"
                    type="date"
                    required
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    className="glass-input w-full h-11 px-3 rounded-xl text-xs font-mono font-semibold text-slate-900"
                  />
                </div>

                {/* 2. Biển số xe */}
                <div className="lg:col-span-4">
                  <PlateInput
                    id="order-plate-input"
                    label={`Biển số xe * (${vehicles.length} xe đã nạp)`}
                    vehicles={vehicles}
                    value={plateText}
                    autoFocus={!editingOrder && typeof window !== 'undefined' && window.innerWidth >= 768}
                    showPlatePreview={false}
                    showAllSuggestions
                    allowQuickCreate={effectiveIsAdmin}
                    onQuickCreateVehicle={effectiveIsAdmin ? onQuickCreateVehicle : undefined}
                    placeholder="Bấm để xổ danh sách hoặc gõ biển số..."
                    onChange={(plate, matched) => {
                      setPlateText(plate);
                      if (matched) {
                        handleVehicleSelected(matched);
                      } else {
                        setSelectedVehicleId('');
                      }
                    }}
                    onSelectVehicle={handleVehicleSelected}
                  />
                </div>

                {/* 3. Số km hiện tại */}
                <div className="lg:col-span-3">
                  <label
                    htmlFor="order-odometer-km"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Số km hiện tại
                  </label>
                  <input
                    id="order-odometer-km"
                    type="number"
                    min={0}
                    value={odometerKm}
                    onChange={(e) => {
                      setOdometerKm(e.target.value);
                      setConfirmKmOverride(false);
                    }}
                    placeholder="VD: 145000"
                    className={`glass-input w-full h-11 px-3 rounded-xl text-xs font-mono font-bold text-slate-900 tabular-nums ${
                      isKmLowerThanPrior ? 'border-amber-400! ring-2 ring-amber-400/20' : ''
                    }`}
                  />
                </div>

                {/* 4. Chu kỳ km / lần */}
                <div className="lg:col-span-2">
                  <label
                    htmlFor="order-interval-km"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Chu kỳ km / lần
                  </label>
                  <input
                    id="order-interval-km"
                    type="number"
                    min={1000}
                    step={500}
                    value={serviceIntervalKm}
                    onChange={(e) => setServiceIntervalKm(e.target.value)}
                    placeholder="10000"
                    className="glass-input w-full h-11 px-3 rounded-xl text-xs font-mono font-bold text-blue-800 tabular-nums"
                  />
                </div>
              </div>

              {/* Row B: Loại bảo dưỡng, Gara, Tên tài xế */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 5. Loại bảo dưỡng */}
                <div>
                  <label
                    htmlFor="order-service-type"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Loại bảo dưỡng
                  </label>
                  <select
                    id="order-service-type"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value as ServiceType)}
                    className="glass-input w-full h-10 px-3 rounded-xl text-xs font-medium text-slate-900"
                  >
                    {SERVICE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 6. Gara */}
                <div>
                  <label
                    htmlFor="order-garage"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Gara
                  </label>
                  <input
                    id="order-garage"
                    type="text"
                    list="garage-datalist"
                    value={garage}
                    onChange={(e) => setGarage(e.target.value)}
                    placeholder="Chọn hoặc nhập tên gara"
                    className="glass-input w-full h-10 px-3 rounded-xl text-xs text-slate-900"
                  />
                  <datalist id="garage-datalist">
                    {garageOptions.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>

                {/* 7. Tên tài xế */}
                <div>
                  <label
                    htmlFor="order-driver"
                    className="flex items-center justify-between gap-1 text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    <span>Tên tài xế</span>
                    {isDriverLocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                        <Lock className="w-3 h-3" />
                        Chỉ đọc
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      id="order-driver"
                      type="text"
                      value={isDriverLocked ? lockedUserDriverName : driverName}
                      readOnly={isDriverLocked}
                      onChange={(e) => {
                        if (!isDriverLocked) setDriverName(e.target.value);
                      }}
                      placeholder="Họ và tên tài xế"
                      className={`glass-input w-full h-10 px-3 rounded-xl text-xs ${
                        isDriverLocked
                          ? 'pr-8 bg-slate-100/75! text-slate-700 font-semibold cursor-not-allowed select-none'
                          : 'text-slate-900'
                      }`}
                    />
                    {isDriverLocked && (
                      <Lock
                        className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Compact scientific vehicle context strip when a plate is selected */}
              {selectedVehicle && (
                <div className="rounded-xl bg-linear-to-r from-blue-50/70 via-white/60 to-sky-50/60 border border-white/90 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-extrabold text-blue-900 bg-white/85 px-2 py-0.5 rounded-md border border-blue-200/80">
                        {selectedVehicle.plate}
                      </span>
                      <span className="font-bold text-slate-900">
                        {selectedVehicle.type} · {selectedVehicle.brand_model}
                      </span>
                      <span className="text-slate-600">({selectedVehicle.department})</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] tabular-nums">
                      <span className="text-slate-600">
                        Hạn ĐK:{' '}
                        <strong className="text-slate-900">
                          {selectedVehicle.registration_due_date
                            ? formatDateVN(selectedVehicle.registration_due_date)
                            : 'Chưa nhập'}
                        </strong>
                      </span>
                      {computedNextDueKm > 0 && (
                        <span className="text-blue-800 font-bold bg-blue-100/70 px-2 py-0.5 rounded-md">
                          Mốc km bảo dưỡng tiếp theo: {formatKm(computedNextDueKm)}
                        </span>
                      )}
                    </div>
                  </div>

                  {recentVehicleOrders.length > 0 && (
                    <div className="pt-1.5 border-t border-white/75 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700 mr-1">
                        <History className="w-3.5 h-3.5 text-blue-600" />
                        Gần nhất:
                      </span>
                      {recentVehicleOrders.map((ro) => (
                        <span
                          key={ro.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/75 border border-white/90 font-mono text-[10px] text-slate-700"
                        >
                          <strong>{formatDateVN(ro.service_date)}</strong> · {formatKm(ro.odometer_km)} ·{' '}
                          {formatCompactVND(ro.total)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Same-day duplicate order guardrail */}
              {sameDayOrder && (
                <div className="p-3.5 rounded-xl bg-amber-50/85 border border-amber-300/90 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">
                        Đã có phiếu bảo dưỡng cho xe {selectedVehicle?.plate} vào ngày{' '}
                        {formatDateVN(serviceDate)}!
                      </div>
                      <div className="text-amber-800 mt-0.5">
                        Xưởng: {sameDayOrder.garage} · Loại: {sameDayOrder.service_type}. Có thể gộp hạng mục vào phiếu cũ để tránh trùng phiếu.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleMergeIntoSameDay}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Gộp vào phiếu cũ
                  </button>
                </div>
              )}

              {/* Lower km warning */}
              {isKmLowerThanPrior && (
                <div className="p-3 rounded-xl bg-amber-50/85 border border-amber-200 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    Số km nhập vào ({numericKm.toLocaleString('vi-VN')} km) nhỏ hơn lần trước (
                    {priorMaxKm.toLocaleString('vi-VN')} km).
                  </span>
                  <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmKmOverride}
                      onChange={(e) => setConfirmKmOverride(e.target.checked)}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    Xác nhận vẫn lưu số km này
                  </label>
                </div>
              )}
            </div>

            <hr className="border-white/75" />

            {/* PART 2: DANH SÁCH HẠNG MỤC
                Tên hạng mục -> Hành động -> SL -> Số PO (hạng mục) */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900">
                    Danh sách hạng mục bảo dưỡng ({draftItems.length})
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Nhập Tên hạng mục, Hành động, SL và Số PO gắn theo từng hạng mục
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/75 hover:bg-white border border-white/90 text-blue-700 text-xs font-semibold shadow-2xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm hạng mục
                </button>
              </div>

              <div className="space-y-2.5">
                {draftItems.map((row, idx) => (
                  <div
                    key={row.localId}
                    className="p-3 rounded-xl bg-white/55 backdrop-blur-md border border-white/85 space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700">
                        Hạng mục #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {idx > 0 && draftItems[idx - 1].po_number && (
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(row.localId, {
                                po_number: draftItems[idx - 1].po_number,
                              })
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900"
                          >
                            <Copy className="w-3 h-3" />
                            Chép PO dòng trên ({draftItems[idx - 1].po_number})
                          </button>
                        )}
                        {draftItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.localId)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                            aria-label="Xóa dòng hạng mục"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                          Tên hạng mục *
                        </label>
                        <input
                          type="text"
                          value={row.item_name}
                          onChange={(e) => updateItem(row.localId, { item_name: e.target.value })}
                          placeholder="VD: Thay má phanh trước, thay nhớt động cơ..."
                          className="glass-input w-full h-9 px-3 rounded-xl text-xs"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                          Hành động
                        </label>
                        <select
                          value={row.action}
                          onChange={(e) =>
                            updateItem(row.localId, {
                              action: e.target.value as MaintenanceAction,
                            })
                          }
                          className="glass-input w-full h-9 px-2.5 rounded-xl text-xs font-semibold"
                        >
                          <option value="THAY THẾ">THAY THẾ</option>
                          <option value="SỬA CHỮA">SỬA CHỮA</option>
                        </select>
                      </div>

                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                          SL
                        </label>
                        <input
                          type="number"
                          min={1}
                          step="any"
                          value={row.quantity}
                          onChange={(e) =>
                            updateItem(row.localId, { quantity: Number(e.target.value) })
                          }
                          className="glass-input w-full h-9 px-2 rounded-xl text-xs font-mono text-right"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                          Số PO (hạng mục)
                        </label>
                        <input
                          type="text"
                          value={row.po_number}
                          onChange={(e) =>
                            updateItem(row.localId, { po_number: e.target.value.toUpperCase() })
                          }
                          placeholder="PO-2026-..."
                          className="glass-input w-full h-9 px-2.5 rounded-xl text-xs font-mono uppercase"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <hr className="border-white/75" />

            {/* PART 3: THÀNH TIỀN TỔNG CỦA CẢ PHIẾU BẢO DƯỠNG (VNĐ) + GHI CHÚ */}
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-linear-to-r from-blue-600/10 via-sky-500/8 to-teal-500/10 backdrop-blur-md border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <label
                    htmlFor="order-total-amount"
                    className="block text-xs font-extrabold text-blue-950"
                  >
                    Thành tiền tổng của cả phiếu bảo dưỡng (VNĐ) *
                  </label>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Nhập tổng giá trị thanh toán của cả phiếu bảo dưỡng — hệ thống tự phân bổ chính xác theo PO & hạng mục
                  </p>
                </div>
                <div className="sm:w-72 shrink-0 space-y-1">
                  <input
                    id="order-total-amount"
                    type="number"
                    min={0}
                    step={10000}
                    required
                    value={totalOrderAmountInput}
                    onChange={(e) => setTotalOrderAmountInput(e.target.value)}
                    placeholder="VD: 15500000"
                    className="glass-input w-full h-11 px-3.5 rounded-xl font-mono text-base font-extrabold text-blue-700 text-right tabular-nums"
                  />
                  <div className="text-right font-mono text-[11px] font-semibold text-slate-600 tabular-nums">
                    {totalOrderAmount > 0
                      ? `${formatVND(totalOrderAmount)} (${formatCompactVND(totalOrderAmount)})`
                      : '0 đ'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghi chú phiếu (tùy chọn)
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú tình trạng xe, bảo hành hoặc lưu ý cho lần bảo dưỡng kế tiếp..."
                  className="glass-input w-full p-3 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Footer */}
        <div className="relative z-10 px-4 sm:px-6 py-3 sm:py-4 border-t border-white/75 bg-white/85 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 safe-bottom">
          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-3 text-xs">
            <div>
              <span className="text-slate-600">Tổng phiếu: </span>
              <strong className="font-mono text-base font-extrabold text-blue-700 tabular-nums">
                {formatVND(totalOrderAmount)}
              </strong>
            </div>
            {distinctPos.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {distinctPos.map((po) => (
                  <span
                    key={po}
                    className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/80 font-mono text-[11px] font-bold text-blue-800"
                  >
                    {po}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100/90 sm:bg-transparent hover:bg-white/80 transition-colors touch-press"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 py-2.5 rounded-xl glass-button-primary text-white text-xs font-bold transition-all touch-press"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>{editingOrder ? 'Lưu thay đổi' : 'Lưu phiếu bảo dưỡng'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
