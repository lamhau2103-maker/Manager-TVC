import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Vehicle } from '../types';
import { supabase } from '../lib/supabaseClient';
import {
  extractFunctionError,
  filterMembersByPlate,
  MemberProfileRow,
} from '../utils/memberActions';
import { formatDateVN } from '../utils/format';
import { normalizePlateKey } from '../utils/plate';

/* ==================== 1. CREATE MEMBER MODAL (for existing vehicle) ==================== */
interface CreateMemberModalProps {
  vehicle: Vehicle;
  onClose: () => void;
  onSuccess: (createdUsername: string) => void;
}

export const CreateMemberModal: React.FC<CreateMemberModalProps> = ({
  vehicle,
  onClose,
  onSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg('');

    const rawId = username.trim();
    if (!/^[a-z0-9._-]{3,30}$/.test(rawId)) {
      setErrorMsg(
        'ID đăng nhập phải từ 3–30 ký tự, chỉ gồm chữ thường (a-z), số (0-9) và dấu . _ -'
      );
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Mật khẩu phải có tối thiểu 8 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Nhập lại mật khẩu chưa khớp.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'create',
          username: rawId,
          password,
          full_name: vehicle.driver_name,
          vehicle_id: vehicle.id,
        },
      });

      if (error || (data && typeof data === 'object' && 'error' in data && data.error)) {
        const msg = await extractFunctionError(error, data);
        setErrorMsg(msg);
        setSubmitting(false);
        return;
      }

      onSuccess(rawId);
    } catch (err) {
      const msg = await extractFunctionError(err);
      setErrorMsg(msg);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-3 bg-slate-900/45 backdrop-blur-md no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full sm:max-w-md max-h-[92dvh] flex flex-col glass-panel-strong rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/90 animate-sheet-up"
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-0.5">
          <span className="w-10 h-1 rounded-full bg-slate-300/90" />
        </div>
        <div className="px-5 py-4 border-b border-white/75 bg-white/55 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-600" />
              Tạo tài khoản cho xe {vehicle.plate}
            </h3>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Tài xế: <strong className="text-slate-800">{vehicle.driver_name}</strong>
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-1.5 rounded-xl glass-tile text-slate-400 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50/90 border border-red-200 text-red-800 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ID đăng nhập *
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="vd: taixe_01"
              autoFocus
              autoComplete="off"
              disabled={submitting}
              className="glass-input w-full h-10 px-3 rounded-xl text-xs font-mono text-slate-900"
            />
            <div className="text-[10px] text-slate-500 mt-1">
              3–30 ký tự gồm chữ thường (a-z), số (0-9) và dấu . _ -
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mật khẩu *
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Tối thiểu 8 ký tự"
                autoComplete="new-password"
                disabled={submitting}
                className="glass-input w-full h-10 pl-3 pr-9 rounded-xl text-xs text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPwd((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nhập lại mật khẩu *
            </label>
            <div className="relative">
              <input
                type={showConfirmPwd ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Nhập lại mật khẩu"
                autoComplete="new-password"
                disabled={submitting}
                className="glass-input w-full h-10 pl-3 pr-9 rounded-xl text-xs text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showConfirmPwd ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3.5 border-t border-white/75 bg-white/85 flex justify-end gap-2 safe-bottom">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100/90 sm:bg-transparent hover:bg-white/80"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl glass-button-primary text-white text-xs font-bold disabled:opacity-65"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Đang tạo...
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                Tạo tài khoản
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ==================== 2. TRANSFER MEMBER TO ANOTHER VEHICLE MODAL ==================== */
interface TransferMemberModalProps {
  member: MemberProfileRow;
  vehicles: Vehicle[];
  allMembers: MemberProfileRow[];
  onClose: () => void;
  onSuccess: (
    memberUsername: string,
    targetPlate: string,
    targetVehicleId: string | null,
    nextDriverName: string
  ) => void;
}

export const TransferMemberModal: React.FC<TransferMemberModalProps> = ({
  member,
  vehicles,
  allMembers,
  onClose,
  onSuccess,
}) => {
  const [searchPlate, setSearchPlate] = useState('');
  const [selectedPlate, setSelectedPlate] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState(member.full_name || '');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const currentPlateKey = normalizePlateKey(member.vehicle_plate ?? '');

  const filteredVehicles = useMemo(() => {
    const q = searchPlate.trim().toLowerCase();
    const qKey = normalizePlateKey(searchPlate);
    return vehicles.filter((v) => {
      if (!q) return true;
      return (
        v.plate_key.includes(qKey) ||
        v.plate.toLowerCase().includes(q) ||
        v.driver_name.toLowerCase().includes(q) ||
        v.department.toLowerCase().includes(q)
      );
    });
  }, [vehicles, searchPlate]);

  const conflictingMembers = useMemo(() => {
    if (!selectedPlate) return [];
    return filterMembersByPlate(allMembers, selectedPlate).filter((m) => m.id !== member.id);
  }, [allMembers, selectedPlate, member.id]);

  const handleSelectTarget = (v: Vehicle) => {
    setSelectedPlate(v.plate);
    setSelectedVehicleId(v.id);
    const targetDriver = (v.driver_name || '').trim();
    const hasRealTargetDriver =
      targetDriver.length > 0 && targetDriver.toLowerCase() !== 'chưa phân công';
    setDriverName(hasRealTargetDriver ? targetDriver : member.full_name || '');
    setConfirmOverwrite(false);
    setErrorMsg('');
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg('');

    if (!selectedPlate) {
      setErrorMsg('Vui lòng chọn biển số xe đích.');
      return;
    }
    const trimmedName = driverName.trim();
    if (!trimmedName) {
      setErrorMsg('Vui lòng nhập tên tài xế của xe đích.');
      return;
    }

    // Require explicit second confirmation if destination vehicle already has another account
    if (conflictingMembers.length > 0 && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Clear previous vehicle driver_id for this member
      await supabase.from('vehicles').update({ driver_id: null }).eq('driver_id', member.id);

      // 2. Set driver_id on target vehicle if selected
      if (selectedVehicleId) {
        const { error: vError } = await supabase
          .from('vehicles')
          .update({
            driver_id: member.id,
            driver_name: trimmedName,
          })
          .eq('id', selectedVehicleId);

        if (vError) {
          setErrorMsg(vError.message || 'Không thể cập nhật xe đích.');
          setSubmitting(false);
          return;
        }
      }

      await supabase.from('profiles').update({ full_name: trimmedName }).eq('id', member.id);

      onSuccess(member.username, selectedPlate, selectedVehicleId, trimmedName);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không kết nối được máy chủ, vui lòng thử lại.'
      );
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-3 bg-slate-900/45 backdrop-blur-md no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form
        onSubmit={handleConfirm}
        className="w-full sm:max-w-lg max-h-[92dvh] flex flex-col glass-panel-strong rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/90 animate-sheet-up"
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-0.5">
          <span className="w-10 h-1 rounded-full bg-slate-300/90" />
        </div>
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/75 bg-white/55 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-600 shrink-0" />
              Chuyển tài khoản sang xe khác
            </h3>
            <p className="text-[11px] text-slate-600 mt-0.5 break-words">
              ID: <strong className="font-mono text-slate-900">{member.username}</strong> · Hiện gắn:{' '}
              <strong className="font-mono text-slate-800">
                {member.vehicle_plate || 'Chưa gắn xe'}
              </strong>
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl glass-tile text-slate-500 hover:text-slate-800 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50/90 border border-red-200 text-red-800 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Destination vehicle picker with plate search */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Chọn xe đích *
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value)}
                placeholder="Tìm theo biển số, bộ phận hoặc tài xế..."
                className="glass-input w-full h-9 pl-8 pr-3 rounded-xl text-xs text-slate-900"
              />
            </div>

            <div className="max-h-48 overflow-y-auto rounded-2xl border border-white/80 bg-white/50 divide-y divide-slate-200/60">
              {filteredVehicles.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Không tìm thấy xe phù hợp.
                </div>
              ) : (
                filteredVehicles.map((v) => {
                  const isSelected = selectedPlate === v.plate;
                  const isCurrent = currentPlateKey && v.plate_key === currentPlateKey;
                  const existingAccs = filterMembersByPlate(allMembers, v.plate).filter(
                    (m) => m.id !== member.id
                  );

                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleSelectTarget(v)}
                      className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                        isSelected
                          ? 'bg-blue-600/15 ring-1 ring-inset ring-blue-400/70'
                          : 'hover:bg-white/75'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-slate-950">
                            {v.plate}
                          </span>
                          <span className="text-[11px] text-slate-500 truncate">
                            {v.type} · {v.department}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 truncate mt-0.5">
                          Tài xế hồ sơ xe: {v.driver_name}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-600 text-[10px] font-bold">
                            Đang gắn
                          </span>
                        )}
                        {existingAccs.length > 0 && (
                          <span
                            className="px-1.5 py-0.5 rounded-md bg-amber-100/90 border border-amber-200 text-amber-800 text-[10px] font-bold"
                            title={`Đang gắn tài khoản: ${existingAccs
                              .map((a) => a.username)
                              .join(', ')}`}
                          >
                            Đã có TK ({existingAccs.map((a) => a.username).join(', ')})
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Editable destination vehicle driver name (updates both vehicle record and profiles.full_name) */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Tên tài xế của xe đích *
              </label>
              {member.full_name &&
                member.full_name.trim() !== driverName.trim() && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setDriverName(member.full_name ?? '')}
                    className="text-[11px] font-semibold text-blue-700 hover:underline"
                  >
                    Dùng tên cũ ({member.full_name})
                  </button>
                )}
            </div>
            <input
              type="text"
              value={driverName}
              onChange={(e) => {
                setDriverName(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="Nhập họ và tên tài xế của xe đích"
              disabled={submitting}
              className="glass-input w-full h-10 px-3 rounded-xl text-xs text-slate-900"
            />
            <p className="text-[11px] text-slate-500">
              Khi xác nhận, tên này sẽ được đồng bộ vào cả hồ sơ xe đích và tài khoản thành viên.
            </p>
          </div>

          {/* Warning if target vehicle already has another member account */}
          {conflictingMembers.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Cảnh báo: Xe {selectedPlate} hiện đã có tài khoản khác!
              </div>
              <p className="text-[11px] leading-relaxed">
                Xe đích đang gắn với tài khoản{' '}
                <strong className="font-mono">
                  {conflictingMembers.map((m) => m.username).join(', ')}
                </strong>
                . {confirmOverwrite
                  ? 'Nhấn "Xác nhận vẫn chuyển" bên dưới để tiếp tục điều chuyển.'
                  : 'Vui lòng kiểm tra kỹ trước khi tiếp tục.'}
              </p>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-5 py-3.5 border-t border-white/75 bg-white/85 flex justify-end gap-2 safe-bottom">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100/90 sm:bg-transparent hover:bg-white/80"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting || !selectedPlate}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-55 transition-colors ${
              confirmOverwrite
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'glass-button-primary'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Đang chuyển...
              </>
            ) : confirmOverwrite ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                Xác nhận vẫn chuyển
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Xác nhận chuyển xe
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ==================== 3. RESET PASSWORD MODAL ==================== */
interface ResetPasswordModalProps {
  member: MemberProfileRow;
  onClose: () => void;
  onSuccess: (memberUsername: string) => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  member,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg('');

    if (password.length < 8) {
      setErrorMsg('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Nhập lại mật khẩu mới chưa khớp.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'reset_password',
          user_id: member.id,
          password,
        },
      });

      if (error || (data && typeof data === 'object' && 'error' in data && data.error)) {
        const msg = await extractFunctionError(error, data);
        setErrorMsg(msg);
        setSubmitting(false);
        return;
      }

      onSuccess(member.username);
    } catch (err) {
      const msg = await extractFunctionError(err);
      setErrorMsg(msg);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-3 bg-slate-900/45 backdrop-blur-md no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full sm:max-w-md max-h-[92dvh] flex flex-col glass-panel-strong rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/90 animate-sheet-up"
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-0.5">
          <span className="w-10 h-1 rounded-full bg-slate-300/90" />
        </div>
        <div className="px-5 py-4 border-b border-white/75 bg-white/55 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-600" />
              Đặt lại mật khẩu
            </h3>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Tài khoản: <strong className="font-mono text-slate-900">{member.username}</strong>
              {member.full_name ? ` · ${member.full_name}` : ''}
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-1.5 rounded-xl glass-tile text-slate-400 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50/90 border border-red-200 text-red-800 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mật khẩu mới *
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Tối thiểu 8 ký tự"
                autoFocus
                autoComplete="new-password"
                disabled={submitting}
                className="glass-input w-full h-10 pl-3 pr-9 rounded-xl text-xs text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPwd((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nhập lại mật khẩu mới *
            </label>
            <div className="relative">
              <input
                type={showConfirmPwd ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Nhập lại mật khẩu mới"
                autoComplete="new-password"
                disabled={submitting}
                className="glass-input w-full h-10 pl-3 pr-9 rounded-xl text-xs text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showConfirmPwd ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3.5 border-t border-white/75 bg-white/85 flex justify-end gap-2 safe-bottom">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100/90 sm:bg-transparent hover:bg-white/80"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl glass-button-primary text-white text-xs font-bold disabled:opacity-65"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Đang cập nhật...
              </>
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5" />
                Lưu mật khẩu mới
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ==================== 4. DELETE MEMBER MODAL (2-step confirmation) ==================== */
interface DeleteMemberModalProps {
  member: MemberProfileRow;
  onClose: () => void;
  onSuccess: (memberUsername: string) => void;
}

export const DeleteMemberModal: React.FC<DeleteMemberModalProps> = ({
  member,
  onClose,
  onSuccess,
}) => {
  const [stepTwoConfirmed, setStepTwoConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleDelete = async () => {
    if (submitting) return;
    if (!stepTwoConfirmed) {
      setStepTwoConfirmed(true);
      return;
    }

    setErrorMsg('');
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'delete',
          user_id: member.id,
        },
      });

      if (error || (data && typeof data === 'object' && 'error' in data && data.error)) {
        const msg = await extractFunctionError(error, data);
        setErrorMsg(msg);
        setSubmitting(false);
        return;
      }

      onSuccess(member.username);
    } catch (err) {
      const msg = await extractFunctionError(err);
      setErrorMsg(msg);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-3 bg-slate-900/50 backdrop-blur-md no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full sm:max-w-md max-h-[92dvh] flex flex-col glass-panel-strong rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border border-red-200/90 animate-sheet-up">
        <div className="sm:hidden flex justify-center pt-2.5 pb-0.5 bg-red-50/75">
          <span className="w-10 h-1 rounded-full bg-red-300/80" />
        </div>
        <div className="px-5 py-4 border-b border-red-200/70 bg-red-50/75 flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-red-900 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-600" />
            Xóa tài khoản thành viên
          </h3>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/70 text-slate-500 hover:text-slate-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50/95 border border-red-300 text-red-800 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed">
            Xóa vĩnh viễn tài khoản{' '}
            <strong className="font-mono text-red-700">{member.username}</strong>? Người này sẽ
            không đăng nhập được nữa. Thao tác không hoàn tác được.
          </p>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Lưu ý: Việc xóa tài khoản <strong>không xóa xe</strong> và{' '}
            <strong>không xóa dữ liệu bảo dưỡng</strong> của xe{' '}
            <span className="font-mono font-semibold text-slate-800">
              {member.vehicle_plate || '—'}
            </span>
            .
          </p>

          {stepTwoConfirmed && (
            <div className="p-3 rounded-xl bg-red-100/80 border border-red-300 text-red-900 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Xác nhận lần 2: Bấm nút đỏ bên dưới để xóa vĩnh viễn tài khoản này.</span>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-5 py-3.5 border-t border-white/75 bg-white/85 flex justify-end gap-2 safe-bottom">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100/90 sm:bg-transparent hover:bg-white/80"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleDelete}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-65 transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Đang xóa...
              </>
            ) : stepTwoConfirmed ? (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                Xác nhận xóa vĩnh viễn
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                Xóa tài khoản
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ==================== 5. REUSABLE "TÀI KHOẢN THÀNH VIÊN CỦA XE NÀY" CARD (ADMIN ONLY) ==================== */
interface VehicleMembersCardProps {
  vehicle: Vehicle;
  members: MemberProfileRow[];
  loading: boolean;
  loadError: string | null;
  compact?: boolean;
  onCreateClick: () => void;
  onTransferClick: (m: MemberProfileRow) => void;
  onResetPwdClick: (m: MemberProfileRow) => void;
  onDeleteClick: (m: MemberProfileRow) => void;
}

export const VehicleMembersCard: React.FC<VehicleMembersCardProps> = ({
  vehicle,
  members,
  loading,
  loadError,
  compact = false,
  onCreateClick,
  onTransferClick,
  onResetPwdClick,
  onDeleteClick,
}) => {
  return (
    <div
      className={`${
        compact
          ? 'p-4 rounded-2xl glass-tile border border-blue-200/75 bg-linear-to-br from-blue-50/50 via-white/55 to-sky-50/40'
          : 'glass-panel rounded-2xl p-5'
      } space-y-3`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600/12 text-blue-700 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-950">
              Tài khoản thành viên của xe này
            </h3>
            <p className="text-[11px] text-slate-600">
              Quản lý tài khoản đăng nhập gắn với biển số{' '}
              <strong className="font-mono text-slate-800">{vehicle.plate}</strong>
            </p>
          </div>
        </div>

        {!loading && members.length === 0 && (
          <button
            type="button"
            onClick={onCreateClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-button-primary text-white text-xs font-semibold transition-all whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Tạo tài khoản
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-3 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          Đang tải tài khoản thành viên...
        </div>
      ) : loadError ? (
        <div className="p-2.5 rounded-xl bg-red-50/85 border border-red-200 text-xs text-red-700 font-medium">
          {loadError}
        </div>
      ) : members.length === 0 ? (
        <div className="p-3 rounded-xl bg-white/55 border border-white/80 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
          <span>Xe này chưa có tài khoản thành viên nào được gắn.</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {members.map((m) => (
            <div
              key={m.id}
              className="p-3.5 rounded-xl bg-white/65 border border-white/90 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
            >
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-100/90 text-emerald-700 flex items-center justify-center shrink-0">
                  <UserCheck className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs sm:text-sm font-extrabold text-slate-950">
                      {m.username}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                      Người dùng
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 font-medium mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span>Tài xế: {m.full_name || '—'}</span>
                    {m.created_at && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                        <Calendar className="w-3 h-3" />
                        Ngày tạo: {formatDateVN(m.created_at.slice(0, 10))}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onTransferClick(m)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass-tile hover:bg-blue-50/90 text-slate-800 hover:text-blue-700 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                  Chuyển sang xe khác
                </button>
                <button
                  type="button"
                  onClick={() => onResetPwdClick(m)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass-tile hover:bg-amber-50/90 text-slate-800 hover:text-amber-800 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  Đặt lại mật khẩu
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteClick(m)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-50/90 hover:bg-red-600 text-red-700 hover:text-white border border-red-200/90 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  Xóa tài khoản
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
