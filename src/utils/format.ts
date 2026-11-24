/**
 * Vietnamese locale formatting for currency (VNĐ), compact amounts, dates, and km.
 */

export function formatVND(amount: number): string {
  const rounded = Math.round(amount || 0);
  return `${rounded.toLocaleString('vi-VN')} đ`;
}

export function formatCompactVND(amount: number): string {
  const val = Math.round(amount || 0);
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    const billions = abs / 1_000_000_000;
    return `${sign}${billions.toLocaleString('vi-VN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} tỷ`;
  }
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    return `${sign}${millions.toLocaleString('vi-VN', {
      minimumFractionDigits: millions >= 100 ? 0 : 1,
      maximumFractionDigits: 1,
    })} tr`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000).toLocaleString('vi-VN')} nghìn`;
  }
  return `${sign}${abs.toLocaleString('vi-VN')} đ`;
}

export function formatKm(km: number): string {
  if (!Number.isFinite(km)) return '0 km';
  return `${Math.round(km).toLocaleString('vi-VN')} km`;
}

export function formatNumber(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDateVN(isoDate: string): string {
  if (!isoDate) return '—';
  const clean = isoDate.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatDateTimeVN(isoDateTime: string | Date): string {
  const d = typeof isoDateTime === 'string' ? new Date(isoDateTime) : isoDateTime;
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${hh}:${mm} ${dd}/${mo}/${yyyy}`;
}

export function formatMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-');
  if (!y || !m) return yearMonth;
  return `Tháng ${Number(m)}/${y}`;
}

export function formatShortMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-');
  if (!y || !m) return yearMonth;
  return `T${Number(m)}/${y.slice(2)}`;
}

export function getMonthDateRange(yearMonth: string): { start: string; end: string } {
  const [yStr, mStr] = yearMonth.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${yStr}-${mStr.padStart(2, '0')}-01`,
    end: `${yStr}-${mStr.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function getPreviousMonth(yearMonth: string, offset = 1): string {
  const [yStr, mStr] = yearMonth.split('-');
  const d = new Date(Number(yStr), Number(mStr) - 1 - offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(`${dateA.slice(0, 10)}T00:00:00`);
  const b = new Date(`${dateB.slice(0, 10)}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function calcPctChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return ((current - previous) / previous) * 100;
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
