import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Database,
  FileSpreadsheet,
  History,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { AuditLogEntry, Vehicle } from '../types';
import { formatDateTimeVN, formatDateVN } from '../utils/format';
import { buildDepartmentOptions } from '../utils/departments';
import { normalizePlateKey } from '../utils/plate';
import { fetchAllMemberProfiles, MemberProfileRow } from '../utils/memberActions';
import { VietnamesePlateBadge } from './PlateInput';
import {
  DeleteMemberModal,
  ResetPasswordModal,
  TransferMemberModal,
} from './MemberActionModals';

interface SettingsAuditViewProps {
  auditLogs: AuditLogEntry[];
  vehicles: Vehicle[];
  isAdmin: boolean;
  vehicleCount: number;
  orderCount: number;
  itemCount: number;
  onOpenImport: () => void;
  onExportExcel: () => void;
  onResetDemo: () => void;
  onUpdateVehicle?: (
    vehicleId: string,
    updates: Partial<Omit<Vehicle, 'id' | 'plate_key'>>,
    opts?: { silent?: boolean }
  ) => { ok: boolean; error?: string };
  onNotify?: (msg: string) => void;
}

export const SettingsAuditView: React.FC<SettingsAuditViewProps> = ({
  auditLogs,
  vehicles,
  isAdmin,
  vehicleCount,
  orderCount,
  itemCount,
  onOpenImport,
  onExportExcel,
  onResetDemo,
  onUpdateVehicle,
  onNotify,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const [filterAction, setFilterAction] = useState<'ALL' | AuditLogEntry['action']>('ALL');

  // Admin-only Group B: Member Management state
  const [members, setMembers] = useState<MemberProfileRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberDeptFilter, setMemberDeptFilter] = useState('');
  const [transferTarget, setTransferTarget] = useState<MemberProfileRow | null>(null);
  const [resetPwdTarget, setResetPwdTarget] = useState<MemberProfileRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemberProfileRow | null>(null);

  const departmentOptions = useMemo(() => buildDepartmentOptions(vehicles), [vehicles]);

  const vehicleByPlateKey = useMemo(() => {
    const map = new Map<string, Vehicle>();
    for (const v of vehicles) {
      map.set(v.plate_key, v);
    }
    return map;
  }, [vehicles]);

  const loadMembers = useCallback(async () => {
    if (!isAdmin) return;
    setMembersLoading(true);
    setMembersError(null);
    const { members: list, error } = await fetchAllMemberProfiles();
    setMembers(list);
    setMembersError(error);
    setMembersLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadMembers();
    }
  }, [isAdmin, loadMembers]);

  const enrichedMembers = useMemo(() => {
    return members.map((m) => {
      const pKey = normalizePlateKey(m.vehicle_plate ?? '');
      const matchedVehicle = pKey ? vehicleByPlateKey.get(pKey) ?? null : null;
      return {
        member: m,
        matchedVehicle,
        department: matchedVehicle?.department ?? '',
      };
    });
  }, [members, vehicleByPlateKey]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    const qKey = normalizePlateKey(memberSearch);

    return enrichedMembers.filter(({ member, department }) => {
      if (memberDeptFilter === '__UNASSIGNED__') {
        if (department) return false;
      } else if (memberDeptFilter) {
        if (department.toLowerCase() !== memberDeptFilter.toLowerCase()) return false;
      }

      if (q) {
        const plateKey = normalizePlateKey(member.vehicle_plate ?? '');
        const matchId = member.username.toLowerCase().includes(q);
        const matchName = (member.full_name ?? '').toLowerCase().includes(q);
        const matchPlate =
          (member.vehicle_plate ?? '').toLowerCase().includes(q) ||
          (qKey.length > 0 && plateKey.includes(qKey));
        return matchId || matchName || matchPlate;
      }

      return true;
    });
  }, [enrichedMembers, memberSearch, memberDeptFilter]);

  const visibleLogs =
    filterAction === 'ALL'
      ? auditLogs
      : auditLogs.filter((l) => l.action === filterAction);

  const actionMeta: Record<AuditLogEntry['action'], { label: string; color: string }> = {
    CREATE: { label: 'Thêm mới', color: 'text-emerald-700' },
    UPDATE: { label: 'Cập nhật', color: 'text-blue-700' },
    DELETE: { label: 'Xóa', color: 'text-red-700' },
    IMPORT: { label: 'Nhập Excel', color: 'text-indigo-700' },
  };

  return (
    <div className="space-y-4">
      {/* Data Source & Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 glass-panel rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-start gap-2.5">
            <Database className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="fluid-section-title font-bold text-slate-900">
                Nguồn dữ liệu & Kiến trúc 3 bảng quan hệ
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Đồng bộ dữ liệu thời gian thực lên Supabase Realtime giữa mọi thiết bị, kèm bộ nhớ đệm cục bộ để phản hồi tức thì
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="p-3 rounded-xl bg-white/75 border border-slate-200/70">
              <div className="font-mono text-[11px] font-semibold text-slate-500 break-all">
                vehicles
              </div>
              <div className="font-mono text-xl font-extrabold text-slate-900 tabular-nums mt-0.5">
                {vehicleCount}
              </div>
              <div className="text-[11px] text-slate-500">hồ sơ xe</div>
            </div>
            <div className="p-3 rounded-xl bg-white/75 border border-slate-200/70">
              <div className="font-mono text-[11px] font-semibold text-slate-500 break-all">
                maintenance_orders
              </div>
              <div className="font-mono text-xl font-extrabold text-slate-900 tabular-nums mt-0.5">
                {orderCount}
              </div>
              <div className="text-[11px] text-slate-500">phiếu bảo dưỡng</div>
            </div>
            <div className="p-3 rounded-xl bg-white/75 border border-slate-200/70">
              <div className="font-mono text-[11px] font-semibold text-slate-500 break-all">
                maintenance_items
              </div>
              <div className="font-mono text-xl font-extrabold text-slate-900 tabular-nums mt-0.5">
                {itemCount}
              </div>
              <div className="text-[11px] text-slate-500">hạng mục (gắn PO)</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div>
            <h3 className="fluid-section-title font-bold text-slate-900">Thao tác dữ liệu</h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Nhập hàng loạt từ Excel/CSV (UPSERT), xuất sao lưu hoặc đặt lại dữ liệu mẫu ban đầu.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenImport}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors touch-press"
            >
              <Upload className="w-3.5 h-3.5" />
              Nhập Excel / CSV
            </button>
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors touch-press"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Xuất sao lưu Excel
            </button>

            {confirmReset ? (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onResetDemo();
                    setConfirmReset(false);
                  }}
                  className="min-h-[44px] sm:min-h-[38px] px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold"
                >
                  Xác nhận khôi phục
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-[44px] sm:min-h-[38px] px-3 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl glass-input text-xs font-semibold text-slate-700 hover:text-red-700 touch-press"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Khôi phục dữ liệu mẫu
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Admin-only Group B: Member Management Table */}
      {isAdmin && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600/12 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                <Users className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <h3 className="fluid-section-title font-bold text-slate-900">
                  Quản lý thành viên ({members.length})
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Toàn bộ tài khoản thành viên (role = user), bao gồm điều chuyển xe, đặt lại mật khẩu và xóa tài khoản
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
              {/* Search by ID or plate */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Tìm theo ID hoặc biển số..."
                  className="glass-input w-full min-h-[44px] sm:min-h-[36px] pl-8 pr-3 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2">
                {/* Filter by Department using Group A ordered list */}
                <select
                  value={memberDeptFilter}
                  onChange={(e) => setMemberDeptFilter(e.target.value)}
                  className="glass-input flex-1 sm:flex-initial min-h-[44px] sm:min-h-[36px] px-3 rounded-xl text-xs text-slate-800 sm:max-w-[220px]"
                >
                  <option value="">Tất cả bộ phận / khu vực</option>
                  {departmentOptions.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                  <option value="__UNASSIGNED__">Chưa gắn xe / Chưa có bộ phận</option>
                </select>

                <button
                  type="button"
                  onClick={loadMembers}
                  disabled={membersLoading}
                  title="Làm mới danh sách thành viên"
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[36px] px-3 rounded-xl glass-tile hover:bg-white/85 text-xs font-semibold text-slate-700 disabled:opacity-50 shrink-0 touch-press"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${membersLoading ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </div>
            </div>
          </div>

          {membersError && (
            <div className="mx-4 sm:mx-5 my-3 p-3 rounded-xl bg-red-50/90 border border-red-200 text-xs font-semibold text-red-700">
              {membersError}
            </div>
          )}

          {/* Mobile Member Cards (< 640px) */}
          <div className="sm:hidden divide-y divide-white/65">
            {membersLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  Đang tải danh sách thành viên...
                </span>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-slate-500">
                Không có tài khoản thành viên nào phù hợp bộ lọc.
              </div>
            ) : (
              filteredMembers.map(({ member, matchedVehicle, department }) => (
                <div key={member.id} className="p-3.5 space-y-2.5 bg-white/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-extrabold text-slate-950 break-all">
                        {member.username}
                      </div>
                      <div className="text-xs font-medium text-slate-700 mt-0.5 break-words">
                        {member.full_name || 'Chưa cập nhật tên tài xế'}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 shrink-0 tabular-nums">
                      {member.created_at ? formatDateVN(member.created_at.slice(0, 10)) : '—'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {member.vehicle_plate ? (
                      <>
                        <VietnamesePlateBadge plate={member.vehicle_plate} size="sm" />
                        {!matchedVehicle && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100/90 text-amber-800 text-[10px] font-bold">
                            Không có trong đội xe
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                        Chưa gắn xe
                      </span>
                    )}
                    {department && (
                      <span className="text-xs text-slate-700 font-medium break-words">
                        · {department}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setTransferTarget(member)}
                      className="inline-flex items-center justify-center gap-1 min-h-[42px] px-2 rounded-xl glass-tile text-slate-700 hover:text-blue-700 text-[11px] font-semibold touch-press"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                      Chuyển xe
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetPwdTarget(member)}
                      className="inline-flex items-center justify-center gap-1 min-h-[42px] px-2 rounded-xl glass-tile text-slate-700 hover:text-amber-800 text-[11px] font-semibold touch-press"
                    >
                      <KeyRound className="w-3.5 h-3.5 shrink-0" />
                      Đặt lại MK
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(member)}
                      className="inline-flex items-center justify-center gap-1 min-h-[42px] px-2 rounded-xl bg-red-50/90 text-red-700 border border-red-200/80 text-[11px] font-semibold touch-press"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      Xóa
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Tablet & Desktop Member Table (>= 640px) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/60 bg-white/40 backdrop-blur-md text-[11px] font-semibold text-slate-600">
                  <th className="sticky-col-left-head py-3 px-4 whitespace-nowrap">ID đăng nhập</th>
                  <th className="py-3 px-3 whitespace-nowrap">Tên tài xế</th>
                  <th className="py-3 px-3 whitespace-nowrap">Biển số xe đang gắn</th>
                  <th className="py-3 px-3 whitespace-nowrap">Bộ phận / khu vực</th>
                  <th className="py-3 px-3 whitespace-nowrap">Ngày tạo</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {membersLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        Đang tải danh sách thành viên...
                      </span>
                    </td>
                  </tr>
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Không có tài khoản thành viên nào phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map(({ member, matchedVehicle, department }) => (
                    <tr key={member.id} className="hover:bg-white/65 transition-colors">
                      <td className="sticky-col-left py-3 px-4 font-mono font-extrabold text-slate-950 whitespace-nowrap">
                        {member.username}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {member.full_name || '—'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {member.vehicle_plate ? (
                          <div className="inline-flex items-center gap-1.5">
                            <VietnamesePlateBadge plate={member.vehicle_plate} size="sm" />
                            {!matchedVehicle && (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-100/90 text-amber-800 text-[10px] font-bold">
                                Không có trong đội xe
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                            Chưa gắn xe
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-700 break-words">
                        {department || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap tabular-nums">
                        {member.created_at ? formatDateVN(member.created_at.slice(0, 10)) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setTransferTarget(member)}
                            title="Chuyển sang xe khác"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg glass-tile hover:bg-blue-50/90 text-slate-700 hover:text-blue-700 text-[11px] font-semibold transition-colors"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                            Chuyển xe
                          </button>
                          <button
                            type="button"
                            onClick={() => setResetPwdTarget(member)}
                            title="Đặt lại mật khẩu"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg glass-tile hover:bg-amber-50/90 text-slate-700 hover:text-amber-800 text-[11px] font-semibold transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5 shrink-0" />
                            Đặt lại MK
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(member)}
                            title="Xóa tài khoản"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50/90 hover:bg-red-600 text-red-700 hover:text-white border border-red-200/80 text-[11px] font-semibold transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Log */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200/70 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <History className="w-4.5 h-4.5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="fluid-section-title font-bold text-slate-900">
                Nhật ký thay đổi (Audit Log)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ghi nhận tự động mọi thao tác thêm, sửa, xóa phiếu, gán PO và nhập Excel
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto scroll-snap-x">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/60 min-w-max">
              {(
                [
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'CREATE', label: 'Thêm mới' },
                  { id: 'UPDATE', label: 'Cập nhật' },
                  { id: 'DELETE', label: 'Xóa' },
                  { id: 'IMPORT', label: 'Nhập Excel' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilterAction(t.id)}
                  className={`px-3 min-h-[38px] sm:min-h-[30px] py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    filterAction === t.id
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

        {/* Mobile Audit Cards (< 640px) */}
        <div className="sm:hidden divide-y divide-slate-200/60">
          {visibleLogs.length === 0 ? (
            <div className="py-8 px-4 text-center text-xs text-slate-500">
              Chưa có nhật ký thay đổi phù hợp.
            </div>
          ) : (
            visibleLogs.map((log) => (
              <div key={log.id} className="p-3.5 space-y-1.5 bg-white/30">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className={`font-bold ${actionMeta[log.action].color}`}>
                    {actionMeta[log.action].label}
                  </span>
                  <span className="font-mono text-slate-500 tabular-nums">
                    {formatDateTimeVN(log.timestamp)}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-900 break-words leading-snug">
                  {log.summary}
                </div>
                <div className="text-[11px] text-slate-600 break-words">
                  <span className="font-semibold text-slate-800">{log.actor}</span>
                  {log.details ? ` · ${log.details}` : ''}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Tablet & Desktop Audit Table (>= 640px) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full min-w-[700px] text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold text-slate-500">
                <th className="sticky-col-left-head py-3 px-4 whitespace-nowrap">Thời gian</th>
                <th className="py-3 px-3 whitespace-nowrap">Người thực hiện</th>
                <th className="py-3 px-3 whitespace-nowrap">Thao tác</th>
                <th className="py-3 px-3">Nội dung thay đổi</th>
                <th className="py-3 px-4">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {visibleLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/70">
                  <td className="sticky-col-left py-3 px-4 font-mono text-slate-600 whitespace-nowrap tabular-nums">
                    {formatDateTimeVN(log.timestamp)}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                    {log.actor}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className={`font-bold ${actionMeta[log.action].color}`}>
                      {actionMeta[log.action].label}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-900 min-w-[200px] break-words">
                    {log.summary}
                  </td>
                  <td className="py-3 px-4 text-slate-500 min-w-[180px] break-words">
                    {log.details || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Admin-only Member Action Modals */}
      {isAdmin && transferTarget && (
        <TransferMemberModal
          member={transferTarget}
          vehicles={vehicles}
          allMembers={members}
          onClose={() => setTransferTarget(null)}
          onSuccess={(memberId, targetPlate, targetVehicleId, nextDriverName) => {
            if (targetVehicleId && nextDriverName) {
              onUpdateVehicle?.(
                targetVehicleId,
                { driver_name: nextDriverName },
                { silent: true }
              );
            }
            setTransferTarget(null);
            loadMembers();
            onNotify?.(`Đã chuyển tài khoản ${memberId} sang xe ${targetPlate}`);
          }}
        />
      )}

      {isAdmin && resetPwdTarget && (
        <ResetPasswordModal
          member={resetPwdTarget}
          onClose={() => setResetPwdTarget(null)}
          onSuccess={(memberId) => {
            setResetPwdTarget(null);
            onNotify?.(`Đã đặt lại mật khẩu cho tài khoản ${memberId}`);
          }}
        />
      )}

      {isAdmin && deleteTarget && (
        <DeleteMemberModal
          member={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={(memberId) => {
            setDeleteTarget(null);
            loadMembers();
            onNotify?.(`Đã xóa vĩnh viễn tài khoản ${memberId}`);
          }}
        />
      )}
    </div>
  );
};
