import React from 'react';
import { ChevronRight, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AlertItem } from '../utils/analytics';
import { GlobalFilters } from '../types';

interface PriorityAlertsPanelProps {
  alerts: AlertItem[];
  onOpenVehicle: (vehicleId: string, plate?: string) => void;
  onApplyFilter: (patch: Partial<GlobalFilters>) => void;
  onOpenNewOrderForVehicle?: (vehicleId: string) => void;
  headerAction?: React.ReactNode;
}

export const PriorityAlertsPanel: React.FC<PriorityAlertsPanelProps> = ({
  alerts,
  onOpenVehicle,
  onApplyFilter,
  headerAction,
}) => {
  const registrationAlerts = alerts.filter((a) => a.category === 'registration');
  const expiredCount = registrationAlerts.filter((a) =>
    a.title.toLowerCase().includes('quá hạn')
  ).length;
  const upcomingCount = registrationAlerts.length - expiredCount;

  return (
    <section
      aria-label="Góc Cảnh Báo Khẩn"
      className="glass-panel rounded-2xl p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="fluid-section-title font-extrabold text-slate-950">
              Góc Cảnh Báo Khẩn ({registrationAlerts.length})
            </h2>
            {registrationAlerts.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-linear-to-r from-red-600 to-rose-600 text-white text-[11px] font-extrabold shadow-xs whitespace-nowrap">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                {expiredCount > 0 ? `${expiredCount} quá hạn` : ''}
                {expiredCount > 0 && upcomingCount > 0 ? ' · ' : ''}
                {upcomingCount > 0 ? `${upcomingCount} sắp hết hạn` : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
            Danh sách các xe đã quá hạn hoặc sắp đến hạn đăng kiểm (≤ 30 ngày) cần ưu tiên xử lý ngay
          </p>
        </div>

        {headerAction && <div className="flex items-center gap-2 shrink-0">{headerAction}</div>}
      </div>

      {registrationAlerts.length === 0 ? (
        <div className="py-6 px-4 text-center rounded-xl bg-linear-to-br from-emerald-50/70 via-white/55 to-teal-50/60 border border-emerald-300/70 backdrop-blur-md">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-700 mb-2">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-emerald-950">
            Không có xe nào quá hạn hoặc sắp hết hạn đăng kiểm.
          </p>
          <p className="text-[11px] text-emerald-800 mt-0.5">
            Toàn bộ phương tiện hiện đang còn hiệu lực đăng kiểm an toàn (&gt; 30 ngày).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {registrationAlerts.map((al) => {
            const isExpired = al.title.toLowerCase().includes('quá hạn');
            return (
              <button
                key={al.id}
                type="button"
                onClick={() => {
                  if (al.filterAction) {
                    onApplyFilter(al.filterAction);
                  } else if (al.vehicleId) {
                    onOpenVehicle(al.vehicleId, al.plate);
                  }
                }}
                className={`glass-tile w-full min-h-[52px] text-left p-3.5 rounded-xl flex items-start justify-between gap-2.5 touch-press hover:-translate-y-0.5 ${
                  isExpired
                    ? 'bg-linear-to-r! from-red-100/80! via-red-50/70! to-white/70! border-red-300/90!'
                    : 'bg-linear-to-r! from-amber-100/75! via-amber-50/65! to-white/70! border-amber-300/90!'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <ShieldAlert
                    className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${
                      isExpired ? 'text-red-600' : 'text-amber-600'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                          isExpired
                            ? 'bg-red-600 text-white'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        {isExpired ? 'ĐÃ QUÁ HẠN ĐĂNG KIỂM' : 'SẮP HẾT HẠN ĐĂNG KIỂM'}
                      </span>
                    </div>
                    <div className="text-xs sm:text-[13px] font-bold text-slate-950 leading-snug break-words">
                      {al.title}
                    </div>
                    <div className="text-xs text-slate-700 mt-1 leading-relaxed break-words">
                      {al.detail}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4.5 h-4.5 text-slate-500 shrink-0 mt-1" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
