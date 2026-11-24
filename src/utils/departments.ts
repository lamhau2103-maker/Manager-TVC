import { Vehicle } from '../types';

export const FIXED_DEPARTMENTS = [
  'Văn Phòng HCM',
  'Văn Phòng Bình Phước',
  'Văn Phòng Nhà Máy BGM',
] as const;

export const CUSTOM_DEPARTMENT_VALUE = '__CUSTOM_DEPARTMENT__';
export const MAX_DEPARTMENT_LENGTH = 60;

export const LEGACY_EXCLUDED_DEPARTMENTS = [
  'Cảng Đồng Nai',
  'Hành chính - Điều phối',
  'Kho vận Bình Dương',
  'Vận tải Miền Bắc',
  'Vận tải Miền Nam',
  'Vận tải Miền Trung',
] as const;

function normalizeDeptKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');
}

const LEGACY_EXCLUDED_KEYS = new Set(LEGACY_EXCLUDED_DEPARTMENTS.map(normalizeDeptKey));

/**
 * Builds the exact ordered department list:
 * 1. Fixed offices: Văn Phòng HCM, Văn Phòng Bình Phước, Văn Phòng Nhà Máy BGM
 * 2. Any other distinct non-empty departments found on existing vehicles, sorted A-Z (vi)
 * When excludeLegacy is true, omits the 6 legacy preset names from the Add Vehicle picker.
 */
export function buildDepartmentOptions(
  vehicles: Vehicle[],
  options?: { excludeLegacy?: boolean }
): string[] {
  const excludeLegacy = Boolean(options?.excludeLegacy);
  const fixedLower = new Set(FIXED_DEPARTMENTS.map((d) => d.toLowerCase()));
  const customMap = new Map<string, string>();

  for (const v of vehicles) {
    const clean = (v.department ?? '').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (fixedLower.has(key)) continue;
    if (excludeLegacy && LEGACY_EXCLUDED_KEYS.has(normalizeDeptKey(clean))) continue;
    if (!customMap.has(key)) {
      customMap.set(key, clean);
    }
  }

  const customSorted = Array.from(customMap.values()).sort((a, b) =>
    a.localeCompare(b, 'vi', { sensitivity: 'base' })
  );

  return [...FIXED_DEPARTMENTS, ...customSorted];
}

/**
 * Validates and resolves a custom department entry:
 * - trims whitespace
 * - max 60 chars, non-empty
 * - case-insensitive dedup: if an existing option matches, returns that existing option
 */
export function resolveDepartmentInput(
  rawInput: string,
  existingOptions: string[]
): { ok: true; value: string; matchedExisting: boolean } | { ok: false; error: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, error: 'Vui lòng nhập tên bộ phận / khu vực.' };
  }
  if (trimmed.length > MAX_DEPARTMENT_LENGTH) {
    return {
      ok: false,
      error: `Tên bộ phận / khu vực không được vượt quá ${MAX_DEPARTMENT_LENGTH} ký tự.`,
    };
  }

  const lower = trimmed.toLowerCase();
  const existing = existingOptions.find((opt) => opt.trim().toLowerCase() === lower);
  if (existing) {
    return { ok: true, value: existing, matchedExisting: true };
  }

  return { ok: true, value: trimmed, matchedExisting: false };
}
