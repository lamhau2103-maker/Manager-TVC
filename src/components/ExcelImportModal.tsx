import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';
import { MaintenanceItem, MaintenanceOrder, Vehicle } from '../types';
import {
  ParsedImportRow,
  downloadImportTemplate,
  parseImportFile,
} from '../utils/excel';
import { formatDateVN, formatVND } from '../utils/format';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  orders: MaintenanceOrder[];
  items: MaintenanceItem[];
  onConfirmImport: (rows: ParsedImportRow[]) => {
    inserted: number;
    updated: number;
    createdVehicles: number;
  };
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  orders,
  items,
  onConfirmImport,
}) => {
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [resultBanner, setResultBanner] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const valid = rows.filter((r) => r.status === 'valid').length;
    const warning = rows.filter((r) => r.status === 'warning').length;
    const error = rows.filter((r) => r.status === 'error').length;
    const updates = rows.filter((r) => r.status !== 'error' && r.upsertMode === 'update').length;
    const inserts = rows.filter((r) => r.status !== 'error' && r.upsertMode === 'insert').length;
    return { valid, warning, error, updates, inserts };
  }, [rows]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setResultBanner(null);
    setFileName(file.name);
    try {
      const parsed = await parseImportFile(file, vehicles, orders, items);
      if (parsed.length === 0) {
        setParseError('File không có dòng dữ liệu nào. Vui lòng kiểm tra lại định dạng cột theo file mẫu.');
      }
      setRows(parsed);
    } catch {
      setParseError('Không thể đọc file Excel/CSV này. Vui lòng kiểm tra định dạng (.xlsx, .xls, .csv).');
      setRows([]);
    }
    e.target.value = '';
  };

  const handleImport = () => {
    const importable = rows.filter((r) => r.status !== 'error');
    if (importable.length === 0) return;
    const res = onConfirmImport(importable);
    setResultBanner(
      `Nhập thành công: thêm mới ${res.inserted} hạng mục, cập nhật (UPSERT) ${res.updated} hạng mục${
        res.createdVehicles > 0 ? `, tạo mới ${res.createdVehicles} xe` : ''
      }.`
    );
    setRows([]);
    setFileName('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-5 bg-slate-900/40 backdrop-blur-sm no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-[760px] lg:max-w-5xl max-h-[92dvh] flex flex-col glass-panel-strong rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl border border-white/90 animate-sheet-up">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200/80 flex items-center justify-between gap-2 bg-white/60">
          <div className="min-w-0">
            <h2 className="fluid-section-title font-bold text-slate-900">
              Nhập dữ liệu hàng loạt từ Excel / CSV (UPSERT)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Khóa đối chiếu chống trùng: Biển số + Ngày bảo dưỡng + Tên hạng mục + Số PO. Dòng trùng sẽ tự động cập nhật.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 shrink-0"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {resultBanner && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{resultBanner}</span>
            </div>
          )}

          {parseError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Action bar: Download template + Choose file */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8 p-4 rounded-xl border-2 border-dashed border-blue-300/80 bg-blue-50/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-700 flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {fileName || 'Chọn file Excel (.xlsx, .xls) hoặc CSV'}
                  </div>
                  <div className="text-xs text-slate-500">
                    Hỗ trợ nhiều hạng mục và nhiều số PO trên cùng một phiếu bảo dưỡng
                  </div>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                Chọn file tải lên
              </button>
            </div>

            <div className="md:col-span-4 p-4 rounded-xl bg-white/75 border border-slate-200 flex flex-col justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                File mẫu chuẩn cột
              </div>
              <p className="text-[11px] text-slate-500">
                Gồm sẵn ví dụ phiếu chia 2 số PO để đối chiếu định dạng cột chính xác.
              </p>
              <button
                type="button"
                onClick={downloadImportTemplate}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Tải file mẫu Excel
              </button>
            </div>
          </div>

          {/* Preview table */}
          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="font-semibold text-slate-700">
                  Tổng {rows.length} dòng đọc được:
                </span>
                <span className="text-emerald-700 font-semibold">
                  ● {stats.inserts} thêm mới
                </span>
                <span className="text-amber-700 font-semibold">
                  ● {stats.updates} cập nhật (UPSERT) · {stats.warning} cần xác nhận
                </span>
                <span className="text-red-700 font-semibold">
                  ● {stats.error} dòng lỗi (sẽ bỏ qua)
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white/80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-600">
                      <th className="py-2.5 px-3 font-semibold">Dòng</th>
                      <th className="py-2.5 px-3 font-semibold">Trạng thái</th>
                      <th className="py-2.5 px-3 font-semibold">Biển số</th>
                      <th className="py-2.5 px-3 font-semibold">Ngày</th>
                      <th className="py-2.5 px-3 font-semibold">Hạng mục</th>
                      <th className="py-2.5 px-3 font-semibold">Số PO</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Thành tiền</th>
                      <th className="py-2.5 px-3 font-semibold">Chi tiết kiểm tra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => {
                      const rowBg =
                        r.status === 'error'
                          ? 'bg-red-50/80'
                          : r.status === 'warning'
                          ? 'bg-amber-50/65'
                          : 'bg-white/60';
                      return (
                        <tr key={r.rowIndex} className={rowBg}>
                          <td className="py-2 px-3 font-mono text-slate-500">#{r.rowIndex}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {r.status === 'error' ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                                <AlertCircle className="w-3.5 h-3.5" /> Lỗi
                              </span>
                            ) : r.status === 'warning' ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                <AlertTriangle className="w-3.5 h-3.5" />{' '}
                                {r.upsertMode === 'update' ? 'Cập nhật' : 'Xác nhận'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Hợp lệ
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {r.plate || '—'}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                            {r.service_date ? formatDateVN(r.service_date) : '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-800 max-w-[200px] truncate">
                            {r.item_name || '—'}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                            {r.po_number || <span className="text-amber-700">Trống</span>}
                          </td>
                          <td className="py-2 px-3 font-mono font-semibold text-right tabular-nums whitespace-nowrap">
                            {formatVND(r.amount)}
                          </td>
                          <td className="py-2 px-3 text-[11px] text-slate-600">
                            {r.messages.length > 0 ? r.messages.join(' · ') : 'Sẵn sàng nhập mới'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-200/80 bg-white/85 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 safe-bottom">
          <div className="text-[11px] sm:text-xs text-slate-500">
            Màu đỏ = lỗi không thể nhập · Màu vàng = cảnh báo / UPSERT cần xác nhận
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 sm:bg-transparent hover:bg-slate-100"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={stats.inserts + stats.updates === 0}
              onClick={handleImport}
              className="flex-1 sm:flex-initial min-h-[44px] px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Xác nhận nhập ({stats.inserts + stats.updates} dòng)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
