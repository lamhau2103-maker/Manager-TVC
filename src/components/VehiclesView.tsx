import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
  ShieldAlert,
  UserPlus,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  EnrichedOrder,
  MaintenanceItem,
  MaintenanceOrder,
  VEHICLE_STATUSES,
  VEHICLE_TYPE_PRESETS,
  Vehicle,
  VehicleStatus,
} from '../types';
import { REFERENCE_TODAY } from '../data/seedData';
import {
  addDaysISO,
  daysBetween,
  formatCompactVND,
  formatDateVN,
  formatKm,
  formatShortMonth,
  formatVND,
} from '../utils/format';
import { PlateInput, VietnamesePlateBadge } from './PlateInput';
import { OrdersTable } from './OrdersTable';
import {
  buildDepartmentOptions,
  CUSTOM_DEPARTMENT_VALUE,
  resolveDepartmentInput,
} from '../utils/departments';
import { DepartmentSelectField } from './DepartmentSelectField';
import {
  extractFunctionError,
  fetchAllMemberProfiles,
  filterMembersByPlate,
  MemberProfileRow,
} from '../utils/memberActions';
import {
  CreateMemberModal,
  DeleteMemberModal,
  ResetPasswordModal,
  TransferMemberModal,
  VehicleMembersCard,
} from './MemberActionModals';

const CUSTOM_TYPE_VALUE = '__CUSTOM__';

interface VehiclesViewProps {
  vehicles: Vehicle[];
  allOrders: MaintenanceOrder[];
  allItems: MaintenanceItem[];
  selectedVehicleId: string | null;
  isAdmin: boolean;
  onSelectVehicle: (vehicleId: string | null) => void;
  onAddVehicle: (
    payload: Omit<Vehicle, 'id' | 'plate_key'>,
    opts?: { silent?: boolean }
  ) => { ok: true; vehicle: Vehicle } | { ok: false; error: string };
  onUpdateVehicle: (
    vehicleId: string,
    updates: Partial<Omit<Vehicle, 'id' | 'plate_key'>>,
    opts?: { silent?: boolean }
  ) => { ok: boolean; error?: string };
  onOpenNewOrderForVehicle: (vehicleId: string) => void;
  onEditOrder: (order: EnrichedOrder) => void;
  onDeleteOrder: (orderId: string) => void;
  onFilterByPo: (poNumber: string) => void;
  onNotify?: (msg: string) => void;
}

function getKmCycleState(v: Vehicle): {
  status: 'overdue' | 'upcoming' | 'ok' | 'untracked';
  kmLeft: number;
  label: string;
} {
  if (v.next_service_km <= 0 || v.current_km <= 0) {
    return { status: 'untracked', kmLeft: 0, label: 'Chưa ghi nhận km' };
  }
  const kmLeft = v.next_service_km - v.current_km;
  if (kmLeft < 0) {
    return { status: 'overdue', kmLeft, label: 'Quá chu kỳ km' };
  }
  if (kmLeft < 1000) {
    return { status: 'upcoming', kmLeft, label: 'Sắp chạm mốc km' };
  }
  return { status: 'ok', kmLeft, label: 'Trong chu kỳ km' };
}

function getRegState(v: Vehicle): {
  status: 'expired' | 'urgent' | 'ok' | 'missing';
  daysLeft: number | null;
  label: string;
} {
  if (!v.registration_due_date) {
    return { status: 'missing', daysLeft: null, label: 'Chưa có hạn ĐK' };
  }
  const daysLeft = daysBetween(REFERENCE_TODAY, v.registration_due_date);
  if (daysLeft < 0) {
    return { status: 'expired', daysLeft, label: `Quá hạn ${Math.abs(daysLeft)} ngày` };
  }
  if (daysLeft <= 30) {
    return { status: 'urgent', daysLeft, label: `Còn ${daysLeft} ngày (Khẩn)` };
  }
  return { status: 'ok', daysLeft, label: `Còn ${daysLeft} ngày` };
}

export const VehiclesView: React.FC<VehiclesViewProps> = ({
  vehicles,
  allOrders,
  allItems,
  selectedVehicleId,
  isAdmin,
  onSelectVehicle,
  onAddVehicle,
  onUpdateVehicle,
  onOpenNewOrderForVehicle,
  onEditOrder,
  onDeleteOrder,
  onFilterByPo,
  onNotify,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'reg_urgent' | 'overdue_km' | 'ok'>('all');
  const [searchPlate, setSearchPlate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Streamlined Vehicle Modal form state (no year, current_km, interval_km, next_km, next_date; adds registration_due_date + custom type)
  const [fPlate, setFPlate] = useState('');
  const [fTypePreset, setFTypePreset] = useState<string>(VEHICLE_TYPE_PRESETS[0]);
  const [fCustomType, setFCustomType] = useState('');
  const [fBrand, setFBrand] = useState('');
  const [fDriver, setFDriver] = useState('');
  const [fDept, setFDept] = useState('');
  const [fCustomDept, setFCustomDept] = useState('');
  const [fDeptError, setFDeptError] = useState('');
  const [fStatus, setFStatus] = useState<VehicleStatus>('Đang hoạt động');
  const [fRegDueDate, setFRegDueDate] = useState(addDaysISO(REFERENCE_TODAY, 180));
  const [fError, setFError] = useState('');

  // Admin-only optional member account creation state (inside Add Vehicle modal)
  const [memberUsername, setMemberUsername] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberConfirmPassword, setMemberConfirmPassword] = useState('');
  const [showMemberPwd, setShowMemberPwd] = useState(false);
  const [showMemberConfirmPwd, setShowMemberConfirmPwd] = useState(false);
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [createdVehicleForRetry, setCreatedVehicleForRetry] = useState<Vehicle | null>(null);

  // Admin-only Group B: existing member profiles & action modals
  const [allMembers, setAllMembers] = useState<MemberProfileRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [createMemberForVehicle, setCreateMemberForVehicle] = useState<Vehicle | null>(null);
  const [transferMemberTarget, setTransferMemberTarget] = useState<MemberProfileRow | null>(null);
  const [resetPwdMemberTarget, setResetPwdMemberTarget] = useState<MemberProfileRow | null>(null);
  const [deleteMemberTarget, setDeleteMemberTarget] = useState<MemberProfileRow | null>(null);

  const departmentOptions = useMemo(
    () => buildDepartmentOptions(vehicles, { excludeLegacy: true }),
    [vehicles]
  );

  const refreshMembers = useCallback(async () => {
    if (!isAdmin) return;
    setMembersLoading(true);
    setMembersError(null);
    const { members, error } = await fetchAllMemberProfiles();
    setAllMembers(members);
    setMembersError(error);
    setMembersLoading(false);
  }, [isAdmin]);

  // Fetch member profiles only for Admin when viewing a vehicle detail or editing a vehicle
  useEffect(() => {
    if (!isAdmin) return;
    if (selectedVehicleId || editingVehicle) {
      refreshMembers();
    }
  }, [isAdmin, selectedVehicleId, editingVehicle, refreshMembers]);

  const itemsByOrder = useMemo(() => {
    const m = new Map<string, MaintenanceItem[]>();
    for (const it of allItems) {
      const arr = m.get(it.order_id);
      if (arr) arr.push(it);
      else m.set(it.order_id, [it]);
    }
    return m;
  }, [allItems]);

  const vehicleStatsMap = useMemo(() => {
    const map = new Map<string, { orderCount: number; totalCost: number; lastDate: string }>();
    for (const o of allOrders) {
      const list = itemsByOrder.get(o.id) ?? [];
      const sum = list.reduce((s, it) => s + it.amount, 0);
      const prev = map.get(o.vehicle_id);
      if (prev) {
        prev.orderCount += 1;
        prev.totalCost += sum;
        if (o.service_date > prev.lastDate) prev.lastDate = o.service_date;
      } else {
        map.set(o.vehicle_id, { orderCount: 1, totalCost: sum, lastDate: o.service_date });
      }
    }
    return map;
  }, [allOrders, itemsByOrder]);

  const resetMemberAccountState = () => {
    setMemberUsername('');
    setMemberPassword('');
    setMemberConfirmPassword('');
    setShowMemberPwd(false);
    setShowMemberConfirmPwd(false);
    setIsCreatingMember(false);
    setMemberError('');
    setCreatedVehicleForRetry(null);
  };

  const openCreateModal = () => {
    if (!isAdmin) return;
    setEditingVehicle(null);
    setFPlate('');
    setFTypePreset(VEHICLE_TYPE_PRESETS[0]);
    setFCustomType('');
    setFBrand('');
    setFDriver('');
    setFDept('');
    setFCustomDept('');
    setFDeptError('');
    setFStatus('Đang hoạt động');
    setFRegDueDate(addDaysISO(REFERENCE_TODAY, 180));
    setFError('');
    resetMemberAccountState();
    setShowModal(true);
  };

  const openEditModal = (v: Vehicle) => {
    if (!isAdmin) return;
    setEditingVehicle(v);
    setFPlate(v.plate);
    if (VEHICLE_TYPE_PRESETS.includes(v.type)) {
      setFTypePreset(v.type);
      setFCustomType('');
    } else {
      setFTypePreset(CUSTOM_TYPE_VALUE);
      setFCustomType(v.type);
    }
    setFBrand(v.brand_model);
    setFDriver(v.driver_name);
    setFDept(v.department || '');
    setFCustomDept('');
    setFDeptError('');
    setFStatus(v.status);
    setFRegDueDate(v.registration_due_date || addDaysISO(REFERENCE_TODAY, 180));
    setFError('');
    resetMemberAccountState();
    setShowModal(true);
  };

  const resolveFormDepartment = (): { ok: true; value: string } | { ok: false } => {
    if (fDept === CUSTOM_DEPARTMENT_VALUE) {
      const check = resolveDepartmentInput(fCustomDept, departmentOptions);
      if (!check.ok) {
        setFDeptError(check.error);
        return { ok: false };
      }
      if (check.matchedExisting) {
        setFDept(check.value);
        setFCustomDept('');
      }
      return { ok: true, value: check.value };
    }
    if (!fDept.trim()) {
      setFDeptError('Vui lòng chọn hoặc nhập bộ phận / khu vực.');
      return { ok: false };
    }
    return { ok: true, value: fDept.trim() };
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingMember) return;
    setFError('');
    setFDeptError('');
    setMemberError('');

    // Edit existing vehicle flow (Admin only)
    if (editingVehicle) {
      if (!isAdmin) {
        setFError('Chỉ Admin mới có quyền cập nhật thông tin xe.');
        return;
      }
      const resolvedType =
        fTypePreset === CUSTOM_TYPE_VALUE ? fCustomType.trim() : fTypePreset;
      if (!resolvedType) {
        setFError('Vui lòng nhập loại xe tự điền.');
        return;
      }
      const deptRes = resolveFormDepartment();
      if (!deptRes.ok) return;
      if (!fRegDueDate) {
        setFError('Vui lòng chọn ngày hạn cuối đăng kiểm.');
        return;
      }

      const res = onUpdateVehicle(editingVehicle.id, {
        plate: fPlate,
        type: resolvedType,
        brand_model: fBrand.trim() || 'Chưa cập nhật',
        driver_name: fDriver.trim() || 'Chưa phân công',
        department: deptRes.value,
        status: fStatus,
        registration_due_date: fRegDueDate,
      });
      if (!res.ok) {
        setFError(res.error || 'Lỗi cập nhật xe');
        return;
      }
      setShowModal(false);
      return;
    }

    // Create new vehicle (+ optional Admin member account) — strictly Admin only
    if (!isAdmin) {
      setFError('Chỉ Admin mới có quyền thêm xe mới.');
      return;
    }

    const rawId = memberUsername.trim();
    const wantsMemberAccount =
      isAdmin &&
      (Boolean(createdVehicleForRetry) ||
        Boolean(rawId || memberPassword || memberConfirmPassword));

    // Validate optional member account fields BEFORE adding vehicle
    if (wantsMemberAccount) {
      if (!/^[a-z0-9._-]{3,30}$/.test(rawId)) {
        setMemberError(
          'ID đăng nhập phải từ 3–30 ký tự, chỉ gồm chữ thường (a-z), số (0-9) và dấu . _ -'
        );
        return;
      }
      if (memberPassword.length < 8) {
        setMemberError('Mật khẩu phải có tối thiểu 8 ký tự.');
        return;
      }
      if (memberPassword !== memberConfirmPassword) {
        setMemberError('Nhập lại mật khẩu chưa khớp với mật khẩu.');
        return;
      }
    }

    // Step 1: Add vehicle first (skip if vehicle was already added on previous retry)
    let addedVehicle = createdVehicleForRetry;
    if (!addedVehicle) {
      const resolvedType =
        fTypePreset === CUSTOM_TYPE_VALUE ? fCustomType.trim() : fTypePreset;
      if (!resolvedType) {
        setFError('Vui lòng nhập loại xe tự điền.');
        return;
      }
      const deptRes = resolveFormDepartment();
      if (!deptRes.ok) return;
      if (!fRegDueDate) {
        setFError('Vui lòng chọn ngày hạn cuối đăng kiểm.');
        return;
      }

      const payload: Omit<Vehicle, 'id' | 'plate_key'> = {
        plate: fPlate,
        type: resolvedType,
        brand_model: fBrand.trim() || 'Chưa cập nhật',
        driver_name: fDriver.trim() || 'Chưa phân công',
        department: deptRes.value,
        status: fStatus,
        registration_due_date: fRegDueDate,
        current_km: 0,
        service_interval_km: 10000,
        service_interval_days: 90,
        next_service_km: 0,
        next_service_date: '',
      };

      const res = onAddVehicle(payload, { silent: wantsMemberAccount });
      if (!res.ok) {
        setFError(res.error);
        return;
      }
      addedVehicle = res.vehicle;
    }

    // If no member account requested, finish immediately
    if (!wantsMemberAccount) {
      setShowModal(false);
      return;
    }

    // Step 2: Invoke Supabase Edge Function `create-member`
    setIsCreatingMember(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'create',
          username: rawId,
          password: memberPassword,
          full_name: addedVehicle.driver_name,
          vehicle_id: addedVehicle.id,
        },
      });

      if (error || (data && typeof data === 'object' && 'error' in data && data.error)) {
        const serverErrorMsg = await extractFunctionError(error, data);
        // Preserve already-added vehicle so retry does NOT duplicate the vehicle
        setCreatedVehicleForRetry(addedVehicle);
        setMemberError(`Xe đã thêm, nhưng tạo tài khoản thất bại: ${serverErrorMsg}`);
        setIsCreatingMember(false);
        return;
      }

      // Both vehicle and member account succeeded
      resetMemberAccountState();
      setShowModal(false);
      onNotify?.(`Đã thêm xe và tạo tài khoản thành viên ${rawId}`);
    } catch (err) {
      const serverErrorMsg = await extractFunctionError(err);
      setCreatedVehicleForRetry(addedVehicle);
      setMemberError(`Xe đã thêm, nhưng tạo tài khoản thất bại: ${serverErrorMsg}`);
      setIsCreatingMember(false);
    }
  };

  // ==================== VEHICLE PROFILE VIEW ====================
  const activeVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  const profileData = useMemo(() => {
    if (!activeVehicle) return null;
    const vOrders: EnrichedOrder[] = allOrders
      .filter((o) => o.vehicle_id === activeVehicle.id)
      .sort((a, b) => b.service_date.localeCompare(a.service_date))
      .map((o) => {
        const list = itemsByOrder.get(o.id) ?? [];
        const poSet = new Set(list.map((i) => i.po_number.trim()).filter(Boolean));
        return {
          ...o,
          vehicle: activeVehicle,
          items: list,
          totalAmount: list.reduce((s, x) => s + x.amount, 0),
          poNumbers: Array.from(poSet).sort(),
          hasMissingPo: list.some((i) => !i.po_number.trim()),
          repairCount: list.filter((i) => i.action === 'SỬA CHỮA').length,
          replaceCount: list.filter((i) => i.action === 'THAY THẾ').length,
        };
      });

    const totalCost = vOrders.reduce((s, o) => s + o.totalAmount, 0);

    // Monthly spend bar data
    const monthMap = new Map<string, number>();
    for (const o of vOrders) {
      const ym = o.service_date.slice(0, 7);
      monthMap.set(ym, (monthMap.get(ym) ?? 0) + o.totalAmount);
    }
    const monthlySpend = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, cost]) => ({ month: formatShortMonth(ym), cost }));

    return {
      orders: vOrders,
      totalCost,
      monthlySpend,
      kmState: getKmCycleState(activeVehicle),
      regState: getRegState(activeVehicle),
    };
  }, [activeVehicle, allOrders, itemsByOrder]);

  if (activeVehicle && profileData) {
    const kmColor =
      profileData.kmState.status === 'overdue'
        ? 'text-red-700 bg-red-50/80 border-red-200'
        : profileData.kmState.status === 'upcoming'
        ? 'text-amber-800 bg-amber-50/80 border-amber-200'
        : 'text-emerald-700 bg-emerald-50/80 border-emerald-200';

    const regColor =
      profileData.regState.status === 'expired' || profileData.regState.status === 'urgent'
        ? 'text-red-800 bg-red-50/85 border-red-300'
        : 'text-emerald-800 bg-emerald-50/75 border-emerald-200';

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => onSelectVehicle(null)}
            className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-[36px] text-xs font-semibold text-slate-600 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại danh sách đội xe
          </button>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {isAdmin && (
              <button
                type="button"
                onClick={() => openEditModal(activeVehicle)}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl glass-input text-xs font-semibold text-slate-700 touch-press"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Sửa thông tin xe
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenNewOrderForVehicle(activeVehicle.id)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] px-4 py-2 rounded-xl glass-button-primary text-white text-xs font-semibold transition-all touch-press"
            >
              <Plus className="w-4 h-4" />
              Thêm phiếu cho xe này
            </button>
          </div>
        </div>

        {/* Profile Header Card */}
        <div className="glass-panel-strong rounded-2xl p-4 sm:p-5 grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5 items-center">
          <div className="xl:col-span-5 flex flex-col sm:flex-row items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
            <VietnamesePlateBadge plate={activeVehicle.plate} size="lg" square />
            <div className="min-w-0 flex-1">
              <div className="text-base sm:text-lg font-extrabold text-slate-900 break-words">
                {activeVehicle.brand_model}
              </div>
              <div className="text-xs text-slate-600 mt-0.5 break-words">
                {activeVehicle.type} · {activeVehicle.department}
              </div>
              <div className="text-xs text-slate-600 mt-1 break-words leading-relaxed">
                Tài xế: <strong className="text-slate-900">{activeVehicle.driver_name}</strong> ·{' '}
                Trạng thái: <strong className="text-slate-900">{activeVehicle.status}</strong>
              </div>
            </div>
          </div>

          <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4 gap-3 min-w-0">
            <div className="p-3 rounded-xl glass-tile">
              <div className="text-[11px] text-slate-600">Tổng chi phí lũy kế</div>
              <div className="mt-1 font-mono text-base font-extrabold text-blue-700 tabular-nums">
                {formatCompactVND(profileData.totalCost)}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                {profileData.orders.length} phiếu bảo dưỡng
              </div>
            </div>

            <div className="p-3 rounded-xl glass-tile">
              <div className="text-[11px] text-slate-600">Số km & Chu kỳ</div>
              <div className="mt-1 font-mono text-base font-extrabold text-slate-950 tabular-nums">
                {activeVehicle.current_km > 0 ? formatKm(activeVehicle.current_km) : 'Chưa ghi'}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5 font-mono">
                Chu kỳ: {activeVehicle.service_interval_km.toLocaleString('vi-VN')} km/lần
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${kmColor}`}>
              <div className="text-[11px] font-semibold">Tình trạng chu kỳ km</div>
              <div className="mt-1 font-mono text-sm font-extrabold tabular-nums">
                {profileData.kmState.label}
              </div>
              <div className="text-[11px] mt-0.5 font-mono">
                {profileData.kmState.status === 'untracked'
                  ? 'Cập nhật khi lập phiếu'
                  : profileData.kmState.kmLeft < 0
                  ? `Quá ${Math.abs(profileData.kmState.kmLeft).toLocaleString('vi-VN')} km`
                  : `Còn ${profileData.kmState.kmLeft.toLocaleString('vi-VN')} km`}
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${regColor}`}>
              <div className="text-[11px] font-semibold">Hạn cuối đăng kiểm</div>
              <div className="mt-1 font-mono text-sm font-extrabold tabular-nums">
                {activeVehicle.registration_due_date
                  ? formatDateVN(activeVehicle.registration_due_date)
                  : '—'}
              </div>
              <div className="text-[11px] mt-0.5 font-semibold">
                {profileData.regState.label}
              </div>
            </div>
          </div>
        </div>

        {/* Admin-only Group B: Member accounts linked to this vehicle */}
        {isAdmin && (
          <VehicleMembersCard
            vehicle={activeVehicle}
            members={filterMembersByPlate(allMembers, activeVehicle.plate)}
            loading={membersLoading}
            loadError={membersError}
            onCreateClick={() => setCreateMemberForVehicle(activeVehicle)}
            onTransferClick={(m) => setTransferMemberTarget(m)}
            onResetPwdClick={(m) => setResetPwdMemberTarget(m)}
            onDeleteClick={(m) => setDeleteMemberTarget(m)}
          />
        )}

        {/* Monthly spend chart for this vehicle */}
        {profileData.monthlySpend.length > 0 && (
          <div className="glass-panel rounded-2xl p-4 sm:p-5 min-w-0">
            <h3 className="fluid-section-title font-bold text-slate-900 break-words">
              Chi phí bảo dưỡng theo từng tháng của xe {activeVehicle.plate}
            </h3>
            <p className="text-xs sm:text-[11px] text-slate-500 mb-3">
              Theo dõi biến động chi phí để phát hiện sớm xe xuống cấp
            </p>
            <div className="w-full h-52 sm:h-60 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profileData.monthlySpend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis
                    tickFormatter={(v) => formatCompactVND(Number(v))}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    width={56}
                  />
                  <Tooltip formatter={(v: unknown) => formatVND(Number(v) || 0)} />
                  <Bar dataKey="cost" fill="#2563EB" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Full History Table */}
        <OrdersTable
          orders={profileData.orders}
          canModifyOrders={isAdmin}
          title={`Lịch sử toàn bộ phiếu bảo dưỡng — ${activeVehicle.plate}`}
          subtitle="Bấm vào từng phiếu để xem đầy đủ hạng mục và số PO"
          onOpenVehicle={(vid) => onSelectVehicle(vid)}
          onEditOrder={onEditOrder}
          onDeleteOrder={onDeleteOrder}
          onFilterByPo={onFilterByPo}
          onAddNew={() => onOpenNewOrderForVehicle(activeVehicle.id)}
        />

        {showModal && renderVehicleModal()}
        {renderAdminMemberModals()}
      </div>
    );
  }

  // ==================== FLEET LIST VIEW ====================
  const regUrgentCount = vehicles.filter((v) => {
    const r = getRegState(v);
    return r.status === 'expired' || r.status === 'urgent';
  }).length;
  const overdueKmCount = vehicles.filter((v) => getKmCycleState(v).status === 'overdue').length;

  const filteredVehicles = vehicles.filter((v) => {
    const km = getKmCycleState(v);
    const reg = getRegState(v);
    if (statusFilter === 'reg_urgent' && reg.status !== 'expired' && reg.status !== 'urgent') {
      return false;
    }
    if (statusFilter === 'overdue_km' && km.status !== 'overdue') {
      return false;
    }
    if (
      statusFilter === 'ok' &&
      (km.status === 'overdue' || reg.status === 'expired' || reg.status === 'urgent')
    ) {
      return false;
    }

    if (searchPlate.trim()) {
      const q = searchPlate.trim().toLowerCase();
      const qKey = searchPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      return (
        v.plate_key.includes(qKey) ||
        v.driver_name.toLowerCase().includes(q) ||
        v.brand_model.toLowerCase().includes(q) ||
        v.type.toLowerCase().includes(q) ||
        v.department.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function renderVehicleModal() {
    if (!isAdmin) return null;
    const previewRegDays = fRegDueDate ? daysBetween(REFERENCE_TODAY, fRegDueDate) : null;

    const handleModalFocusCapture = (e: React.FocusEvent<HTMLFormElement>) => {
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
          if (e.target === e.currentTarget) setShowModal(false);
        }}
      >
        <form
          onSubmit={handleSaveVehicle}
          onFocusCapture={handleModalFocusCapture}
          className="w-full sm:max-w-[720px] max-h-[92dvh] flex flex-col glass-panel-strong rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/90 animate-sheet-up"
        >
          <div className="sm:hidden flex justify-center pt-2.5 pb-0.5">
            <span className="w-10 h-1 rounded-full bg-slate-300/90" />
          </div>

          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/75 flex items-center justify-between gap-2 bg-white/55 backdrop-blur-xl">
            <div className="min-w-0 flex-1">
              <h3 className="fluid-section-title font-extrabold text-slate-950">
                {editingVehicle ? `Cập nhật xe ${editingVehicle.plate}` : 'Thêm xe mới vào đội xe'}
              </h3>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                Nhập thông tin phương tiện và hạn cuối đăng kiểm · Số km & chu kỳ km/lần sẽ tự cập nhật khi lập phiếu bảo dưỡng
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              aria-label="Đóng"
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl glass-tile text-slate-500 hover:text-slate-800 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto">
            {fError && (
              <div className="p-3 rounded-xl bg-red-50/90 border border-red-200 text-red-700 text-xs font-semibold">
                {fError}
              </div>
            )}

            <PlateInput
              label="Biển số xe * (tự động kiểm tra trùng)"
              vehicles={vehicles}
              value={fPlate}
              onChange={(plate) => setFPlate(plate)}
              showPlatePreview
              allowQuickCreate={false}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Loại xe: 4 presets + Tự điền */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Loại xe *
                </label>
                <select
                  value={fTypePreset}
                  onChange={(e) => setFTypePreset(e.target.value)}
                  className="glass-input w-full h-10 px-3 rounded-xl text-xs font-medium text-slate-900"
                >
                  {VEHICLE_TYPE_PRESETS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value={CUSTOM_TYPE_VALUE}>Khác (tự điền)...</option>
                </select>
                {fTypePreset === CUSTOM_TYPE_VALUE && (
                  <input
                    type="text"
                    required
                    value={fCustomType}
                    onChange={(e) => setFCustomType(e.target.value)}
                    placeholder="Nhập loại xe (VD: Xe tải 5T, Đầu kéo...)"
                    className="glass-input w-full h-10 px-3 rounded-xl text-xs mt-2 border-blue-300!"
                    autoFocus
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hãng / Model
                </label>
                <input
                  type="text"
                  value={fBrand}
                  onChange={(e) => setFBrand(e.target.value)}
                  placeholder="VD: Toyota Fortuner, Ford Ranger..."
                  className="glass-input w-full h-10 px-3 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tài xế phụ trách
                </label>
                <input
                  type="text"
                  value={fDriver}
                  onChange={(e) => setFDriver(e.target.value)}
                  placeholder="Họ và tên tài xế"
                  className="glass-input w-full h-10 px-3 rounded-xl text-xs"
                />
              </div>

              <DepartmentSelectField
                options={departmentOptions}
                selectedValue={fDept}
                customValue={fCustomDept}
                error={fDeptError}
                disabled={isCreatingMember}
                onSelectChange={(val) => {
                  setFDept(val);
                  if (val !== CUSTOM_DEPARTMENT_VALUE) setFCustomDept('');
                  if (fDeptError) setFDeptError('');
                }}
                onCustomChange={(val) => {
                  setFCustomDept(val);
                  if (fDeptError) setFDeptError('');
                }}
                onCancelCustom={() => {
                  setFDept(editingVehicle?.department || '');
                  setFCustomDept('');
                  setFDeptError('');
                }}
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trạng thái
                </label>
                <select
                  value={fStatus}
                  onChange={(e) => setFStatus(e.target.value as VehicleStatus)}
                  className="glass-input w-full h-10 px-3 rounded-xl text-xs"
                >
                  {VEHICLE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ngày hạn cuối đăng kiểm */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ngày hạn cuối đăng kiểm *
                </label>
                <input
                  type="date"
                  required
                  value={fRegDueDate}
                  onChange={(e) => setFRegDueDate(e.target.value)}
                  className="glass-input w-full h-10 px-3 rounded-xl text-xs font-mono font-semibold text-slate-900"
                />
                {previewRegDays !== null && (
                  <div
                    className={`mt-1 text-[11px] font-semibold flex items-center gap-1 ${
                      previewRegDays < 0
                        ? 'text-red-700'
                        : previewRegDays <= 30
                        ? 'text-amber-800'
                        : 'text-emerald-700'
                    }`}
                  >
                    <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                    {previewRegDays < 0
                      ? `Đã quá hạn đăng kiểm ${Math.abs(previewRegDays)} ngày`
                      : previewRegDays <= 30
                      ? `Sắp đến hạn đăng kiểm khẩn cấp (còn ${previewRegDays} ngày)`
                      : `An toàn · Còn ${previewRegDays} ngày đến hạn đăng kiểm`}
                  </div>
                )}
              </div>
            </div>

            {/* Admin-only optional Member Account section when adding a new vehicle */}
            {isAdmin && !editingVehicle && (
              <div className="mt-2 p-4 rounded-2xl glass-tile border border-blue-200/75 bg-linear-to-br from-blue-50/55 via-white/55 to-sky-50/45 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-blue-600 shrink-0" />
                      Tài khoản thành viên (tùy chọn)
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Để trống nếu chỉ muốn thêm xe. Nếu nhập, hệ thống sẽ tự tạo tài khoản đăng nhập cho tài xế xe này.
                    </p>
                  </div>
                  {createdVehicleForRetry && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100/90 border border-emerald-200 text-emerald-800 text-[10px] font-bold whitespace-nowrap shrink-0">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      Đã lưu xe {createdVehicleForRetry.plate}
                    </span>
                  )}
                </div>

                {memberError && (
                  <div className="p-2.5 rounded-xl bg-red-50/90 border border-red-200 text-red-800 text-xs font-semibold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{memberError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ID đăng nhập
                    </label>
                    <input
                      type="text"
                      value={memberUsername}
                      onChange={(e) => {
                        setMemberUsername(e.target.value);
                        if (memberError) setMemberError('');
                      }}
                      placeholder="vd: taixe_01"
                      autoComplete="off"
                      disabled={isCreatingMember}
                      className="glass-input w-full h-10 px-3 rounded-xl text-xs font-mono text-slate-900"
                    />
                    <div className="text-[10px] text-slate-500 mt-1">
                      3–30 ký tự: a-z, 0-9, dấu . _ -
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Mật khẩu
                    </label>
                    <div className="relative">
                      <input
                        type={showMemberPwd ? 'text' : 'password'}
                        value={memberPassword}
                        onChange={(e) => {
                          setMemberPassword(e.target.value);
                          if (memberError) setMemberError('');
                        }}
                        placeholder="Tối thiểu 8 ký tự"
                        autoComplete="new-password"
                        disabled={isCreatingMember}
                        className="glass-input w-full h-10 pl-3 pr-9 rounded-xl text-xs text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMemberPwd((p) => !p)}
                        title={showMemberPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        {showMemberPwd ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nhập lại mật khẩu
                    </label>
                    <div className="relative">
                      <input
                        type={showMemberConfirmPwd ? 'text' : 'password'}
                        value={memberConfirmPassword}
                        onChange={(e) => {
                          setMemberConfirmPassword(e.target.value);
                          if (memberError) setMemberError('');
                        }}
                        placeholder="Nhập lại mật khẩu"
                        autoComplete="new-password"
                        disabled={isCreatingMember}
                        className="glass-input w-full h-10 pl-3 pr-9 rounded-xl text-xs text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMemberConfirmPwd((p) => !p)}
                        title={showMemberConfirmPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        {showMemberConfirmPwd ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Admin-only Group B: Member accounts linked to this vehicle inside Edit Vehicle modal */}
            {isAdmin && editingVehicle && (
              <VehicleMembersCard
                vehicle={editingVehicle}
                members={filterMembersByPlate(allMembers, editingVehicle.plate)}
                loading={membersLoading}
                loadError={membersError}
                compact
                onCreateClick={() => setCreateMemberForVehicle(editingVehicle)}
                onTransferClick={(m) => setTransferMemberTarget(m)}
                onResetPwdClick={(m) => setResetPwdMemberTarget(m)}
                onDeleteClick={(m) => setDeleteMemberTarget(m)}
              />
            )}
          </div>

          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-white/75 bg-white/85 backdrop-blur-xl flex items-center justify-end gap-2 safe-bottom">
            <button
              type="button"
              disabled={isCreatingMember}
              onClick={() => {
                if (createdVehicleForRetry) {
                  onNotify?.(`Đã thêm xe ${createdVehicleForRetry.plate} vào đội xe.`);
                }
                resetMemberAccountState();
                setShowModal(false);
              }}
              className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100/90 sm:bg-transparent hover:bg-white/80 disabled:opacity-50"
            >
              {createdVehicleForRetry ? 'Đóng (giữ xe đã thêm)' : 'Hủy'}
            </button>
            <button
              type="submit"
              disabled={isCreatingMember}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 py-2.5 rounded-xl glass-button-primary text-white text-xs font-bold disabled:opacity-65"
            >
              {isCreatingMember ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tạo tài khoản...
                </>
              ) : createdVehicleForRetry ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  Thử tạo tài khoản lại
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Lưu hồ sơ xe
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 min-w-0 flex-1">
          <div className="w-full sm:w-64 shrink-0">
            <PlateInput
              vehicles={vehicles}
              value={searchPlate}
              onChange={(plate) => setSearchPlate(plate)}
              onSelectVehicle={(v) => onSelectVehicle(v.id)}
              showPlatePreview={false}
              compact
              placeholder="Tìm biển số / chọn mở hồ sơ..."
            />
          </div>

          <div className="w-full sm:w-auto scroll-snap-x">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl glass-segment min-w-max">
              {(
                [
                  { id: 'all', label: `Tất cả (${vehicles.length})` },
                  { id: 'reg_urgent', label: `Đăng kiểm khẩn (${regUrgentCount})` },
                  { id: 'overdue_km', label: `Quá chu kỳ km (${overdueKmCount})` },
                  { id: 'ok', label: 'An toàn' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setStatusFilter(t.id)}
                  className={`min-h-[38px] sm:min-h-[32px] px-3 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 touch-press ${
                    statusFilter === t.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Strictly render "Thêm xe mới" ONLY for Admin */}
        {isAdmin && (
          <button
            type="button"
            onClick={openCreateModal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] px-4 py-2 rounded-xl glass-button-primary text-white text-xs font-bold transition-all shrink-0 touch-press"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Thêm xe mới
          </button>
        )}
      </div>

      {/* MOBILE VIEW (< 768px): Vertical Glass Cards showing ALL fields cleanly without clipping */}
      <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredVehicles.length === 0 ? (
          <div className="sm:col-span-2 glass-panel rounded-2xl p-6 text-center text-sm text-slate-500">
            Không có xe nào khớp với bộ lọc hiện tại.
          </div>
        ) : (
          filteredVehicles.map((v) => {
            const km = getKmCycleState(v);
            const reg = getRegState(v);
            const st = vehicleStatsMap.get(v.id);
            const regUrgent = reg.status === 'expired' || reg.status === 'urgent';
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelectVehicle(v.id)}
                className={`w-full text-left glass-panel rounded-2xl p-4 space-y-3 transition-all touch-press ${
                  regUrgent
                    ? 'border-red-300/90 bg-linear-to-br from-red-50/65 via-white/55 to-white/45'
                    : km.status === 'overdue'
                    ? 'border-amber-300/90 bg-linear-to-br from-amber-50/55 via-white/55 to-white/45'
                    : ''
                }`}
              >
                {/* Header: Biển số + Loại xe + Trạng thái */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <VietnamesePlateBadge plate={v.plate} size="sm" />
                    <div className="text-xs font-bold text-slate-900 break-words">
                      {v.type}
                      {v.brand_model ? ` · ${v.brand_model}` : ''}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                      v.status === 'Đang hoạt động'
                        ? 'bg-emerald-100/90 text-emerald-800'
                        : v.status === 'Đang bảo dưỡng'
                        ? 'bg-amber-100/90 text-amber-800'
                        : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {v.status}
                  </span>
                </div>

                {/* Details Grid: Tài xế / Bộ phận / Hạn đăng kiểm / Chu kỳ km */}
                <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-white/70 text-xs">
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-semibold text-slate-500">Tài xế</div>
                    <div className="font-semibold text-slate-900 break-words mt-0.5">
                      {v.driver_name}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="text-[10.5px] font-semibold text-slate-500">Bộ phận / khu vực</div>
                    <div className="font-medium text-slate-800 break-words mt-0.5">
                      {v.department}
                    </div>
                  </div>

                  <div
                    className={`p-2 rounded-xl border ${
                      regUrgent
                        ? 'bg-red-50/90 border-red-200'
                        : 'bg-white/55 border-white/80'
                    }`}
                  >
                    <div className="text-[10.5px] font-semibold text-slate-500">Hạn đăng kiểm</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {regUrgent ? (
                        <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      )}
                      <span className="font-mono font-bold text-slate-900">
                        {v.registration_due_date ? formatDateVN(v.registration_due_date) : '—'}
                      </span>
                    </div>
                    <div
                      className={`text-[10.5px] font-bold mt-0.5 break-words ${
                        regUrgent ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {reg.label}
                    </div>
                  </div>

                  <div
                    className={`p-2 rounded-xl border ${
                      km.status === 'overdue'
                        ? 'bg-red-50/90 border-red-200'
                        : km.status === 'upcoming'
                        ? 'bg-amber-50/90 border-amber-200'
                        : 'bg-white/55 border-white/80'
                    }`}
                  >
                    <div className="text-[10.5px] font-semibold text-slate-500">Chu kỳ km / Hiện tại</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {km.status === 'overdue' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      ) : km.status === 'upcoming' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      )}
                      <span className="font-mono font-bold text-slate-900">
                        {v.current_km > 0 ? formatKm(v.current_km) : 'Chưa ghi'}
                      </span>
                    </div>
                    <div className="text-[10.5px] font-mono text-slate-600 mt-0.5 break-words">
                      {km.status === 'untracked'
                        ? `CK ${v.service_interval_km.toLocaleString('vi-VN')} km`
                        : km.kmLeft < 0
                        ? `Quá ${Math.abs(km.kmLeft).toLocaleString('vi-VN')} km`
                        : `Còn ${km.kmLeft.toLocaleString('vi-VN')} km`}
                    </div>
                  </div>
                </div>

                {/* Footer: Chi phí lũy kế */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/70">
                  <span className="text-[11px] font-semibold text-slate-600">
                    Chi phí lũy kế ({st?.orderCount ?? 0} phiếu)
                  </span>
                  <span className="font-mono text-sm font-extrabold text-blue-700 tabular-nums">
                    {formatVND(st?.totalCost ?? 0)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* IPAD / TABLET COMPACT TABLE (768px - 1023px): Grouped columns with sticky first column */}
      <div className="hidden md:block lg:hidden glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/60 bg-white/45 backdrop-blur-md text-[11px] font-semibold text-slate-600">
                <th className="sticky-col-left-head py-3 px-3.5 whitespace-nowrap">Biển số & Phương tiện</th>
                <th className="py-3 px-3 whitespace-nowrap">Tài xế / Bộ phận</th>
                <th className="py-3 px-3 whitespace-nowrap">Đăng kiểm & Chu kỳ km</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">Chi phí lũy kế</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {filteredVehicles.map((v) => {
                const km = getKmCycleState(v);
                const reg = getRegState(v);
                const st = vehicleStatsMap.get(v.id);
                return (
                  <tr
                    key={v.id}
                    onClick={() => onSelectVehicle(v.id)}
                    className="cursor-pointer hover:bg-blue-50/45 transition-colors"
                  >
                    <td className="sticky-col-left py-3 px-3.5 align-top">
                      <VietnamesePlateBadge plate={v.plate} size="sm" />
                      <div className="font-semibold text-slate-900 mt-1 break-words">
                        {v.brand_model}
                      </div>
                      <div className="text-[11px] text-slate-500 break-words">
                        {v.type} ·{' '}
                        <span
                          className={`font-semibold ${
                            v.status === 'Đang hoạt động'
                              ? 'text-emerald-700'
                              : v.status === 'Đang bảo dưỡng'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="font-semibold text-slate-900 break-words">
                        {v.driver_name}
                      </div>
                      <div className="text-[11px] text-slate-600 break-words mt-0.5">
                        {v.department}
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top space-y-1.5">
                      <div>
                        <div className="flex items-center gap-1">
                          {reg.status === 'expired' || reg.status === 'urgent' ? (
                            <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                          <span className="font-mono font-semibold text-slate-900">
                            ĐK: {v.registration_due_date ? formatDateVN(v.registration_due_date) : '—'}
                          </span>
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${
                            reg.status === 'expired' || reg.status === 'urgent'
                              ? 'text-red-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {reg.label}
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-slate-600">
                        {v.current_km > 0 ? formatKm(v.current_km) : 'Chưa ghi km'} ·{' '}
                        <span
                          className={
                            km.status === 'overdue'
                              ? 'text-red-700 font-bold'
                              : km.status === 'upcoming'
                              ? 'text-amber-800 font-semibold'
                              : ''
                          }
                        >
                          {km.status === 'untracked'
                            ? `CK ${v.service_interval_km.toLocaleString('vi-VN')}`
                            : km.kmLeft < 0
                            ? `Quá ${Math.abs(km.kmLeft).toLocaleString('vi-VN')} km`
                            : `Còn ${km.kmLeft.toLocaleString('vi-VN')} km`}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3.5 align-top text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatVND(st?.totalCost ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* LAPTOP / DESKTOP FULL TABLE (>= 1024px) */}
      <div className="hidden lg:block glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/60 bg-white/40 backdrop-blur-md text-[11px] font-semibold text-slate-600">
                <th className="sticky-col-left-head py-3 px-4 whitespace-nowrap">Biển số & Loại xe</th>
                <th className="py-3 px-3 whitespace-nowrap">Tài xế / Bộ phận</th>
                <th className="py-3 px-3 whitespace-nowrap">Trạng thái</th>
                <th className="py-3 px-3 whitespace-nowrap">Hạn cuối đăng kiểm</th>
                <th className="py-3 px-3 whitespace-nowrap">Chu kỳ km / Hiện tại</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Chi phí lũy kế</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {filteredVehicles.map((v) => {
                const km = getKmCycleState(v);
                const reg = getRegState(v);
                const st = vehicleStatsMap.get(v.id);
                return (
                  <tr
                    key={v.id}
                    onClick={() => onSelectVehicle(v.id)}
                    className="cursor-pointer hover:bg-blue-50/45 transition-colors"
                  >
                    <td className="sticky-col-left py-3 px-4">
                      <div className="flex items-center gap-3">
                        <VietnamesePlateBadge plate={v.plate} size="sm" />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 break-words">{v.brand_model}</div>
                          <div className="text-[11px] text-slate-500 break-words">{v.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800 break-words">{v.driver_name}</div>
                      <div className="text-[11px] text-slate-500 break-words">{v.department}</div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          v.status === 'Đang hoạt động'
                            ? 'text-emerald-700'
                            : v.status === 'Đang bảo dưỡng'
                            ? 'text-amber-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {reg.status === 'expired' || reg.status === 'urgent' ? (
                          <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                        <span className="font-mono font-semibold text-slate-900">
                          {v.registration_due_date ? formatDateVN(v.registration_due_date) : '—'}
                        </span>
                      </div>
                      <div
                        className={`text-[11px] font-semibold mt-0.5 ${
                          reg.status === 'expired' || reg.status === 'urgent'
                            ? 'text-red-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {reg.label}
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {km.status === 'overdue' ? (
                          <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        ) : km.status === 'upcoming' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                        <span
                          className={`font-mono font-semibold ${
                            km.status === 'overdue'
                              ? 'text-red-700'
                              : km.status === 'upcoming'
                              ? 'text-amber-800'
                              : 'text-slate-800'
                          }`}
                        >
                          {v.current_km > 0 ? formatKm(v.current_km) : 'Chưa ghi nhận'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {km.status === 'untracked'
                          ? `Chu kỳ ${v.service_interval_km.toLocaleString('vi-VN')} km/lần`
                          : km.kmLeft < 0
                          ? `Quá ${Math.abs(km.kmLeft).toLocaleString('vi-VN')} km (CK ${v.service_interval_km.toLocaleString('vi-VN')})`
                          : `Còn ${km.kmLeft.toLocaleString('vi-VN')} km (CK ${v.service_interval_km.toLocaleString('vi-VN')})`}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatVND(st?.totalCost ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && renderVehicleModal()}
      {renderAdminMemberModals()}
    </div>
  );

  function renderAdminMemberModals() {
    if (!isAdmin) return null;
    return (
      <>
        {createMemberForVehicle && (
          <CreateMemberModal
            vehicle={createMemberForVehicle}
            onClose={() => setCreateMemberForVehicle(null)}
            onSuccess={(createdId) => {
              const plate = createMemberForVehicle.plate;
              setCreateMemberForVehicle(null);
              refreshMembers();
              onNotify?.(`Đã tạo tài khoản thành viên ${createdId} cho xe ${plate}`);
            }}
          />
        )}

        {transferMemberTarget && (
          <TransferMemberModal
            member={transferMemberTarget}
            vehicles={vehicles}
            allMembers={allMembers}
            onClose={() => setTransferMemberTarget(null)}
            onSuccess={(memberId, targetPlate, targetVehicleId, nextDriverName) => {
              if (targetVehicleId && nextDriverName) {
                onUpdateVehicle(
                  targetVehicleId,
                  { driver_name: nextDriverName },
                  { silent: true }
                );
              }
              setTransferMemberTarget(null);
              refreshMembers();
              onNotify?.(`Đã chuyển tài khoản ${memberId} sang xe ${targetPlate}`);
            }}
          />
        )}

        {resetPwdMemberTarget && (
          <ResetPasswordModal
            member={resetPwdMemberTarget}
            onClose={() => setResetPwdMemberTarget(null)}
            onSuccess={(memberId) => {
              setResetPwdMemberTarget(null);
              onNotify?.(`Đã đặt lại mật khẩu cho tài khoản ${memberId}`);
            }}
          />
        )}

        {deleteMemberTarget && (
          <DeleteMemberModal
            member={deleteMemberTarget}
            onClose={() => setDeleteMemberTarget(null)}
            onSuccess={(memberId) => {
              setDeleteMemberTarget(null);
              refreshMembers();
              onNotify?.(`Đã xóa vĩnh viễn tài khoản ${memberId}`);
            }}
          />
        )}
      </>
    );
  }
};
