/**
 * Vietnamese license plate normalization, auto-formatting, and validation.
 * Regex suggestion: ^\d{2}[A-Z]{1,2}\d?-?(\d{4,5}|\d{3}\.\d{2})$
 */

export const VN_PLATE_REGEX = /^\d{2}[A-Z]{1,2}\d?-?(\d{4,5}|\d{3}\.\d{2})$/;

/**
 * Strip dots, dashes, spaces, and uppercase for unique plate_key matching.
 * Example: "51c-123.45" -> "51C12345"
 */
export function normalizePlateKey(raw: string): string {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Auto-format a Vietnamese plate while typing or normalizing:
 * 2 province digits + 1-2 series letters (+ optional series digit) + "-" + 4 or 5 digits
 * (if 5 digits, inserts "." before the last 2 digits: 12345 -> 123.45).
 */
export function formatVietnamesePlate(raw: string): string {
  const upper = (raw || '').toUpperCase().replace(/\s+/g, '');
  const clean = upper.replace(/[^A-Z0-9]/g, '');
  if (!clean) return '';

  // Match standard Vietnamese structure: 2 digits + 1-2 letters + optional digit + remaining digits
  // Example 1: 51C12345 -> prefix 51C, suffix 12345 -> 51C-123.45
  // Example 2: 61LD00845 -> prefix 61LD, suffix 00845 -> 61LD-008.45
  // Example 3: 51C1234 -> prefix 51C, suffix 1234 -> 51C-1234
  // Example 4: 59X112345 -> prefix 59X1, suffix 12345 -> 59X1-123.45
  const match = clean.match(/^(\d{2})([A-Z]{1,2})(\d*)$/);
  if (!match) {
    // Partially typed or non-standard special plate
    return upper;
  }

  const [, province, letters, digits] = match;
  if (!digits) {
    return `${province}${letters}`;
  }

  // If 6 digits after letters, first digit is series digit (e.g. 59X1-123.45)
  if (digits.length === 6) {
    const seriesDigit = digits[0];
    const num = digits.slice(1);
    return `${province}${letters}${seriesDigit}-${num.slice(0, 3)}.${num.slice(3)}`;
  }

  // Standard 5 digits -> XXX.XX
  if (digits.length === 5) {
    return `${province}${letters}-${digits.slice(0, 3)}.${digits.slice(3)}`;
  }

  // 1..4 digits -> -XXXX
  if (digits.length <= 4) {
    return `${province}${letters}-${digits}`;
  }

  // > 6 digits, preserve best effort
  return `${province}${letters}-${digits.slice(0, 3)}.${digits.slice(3)}`;
}

export function isValidVietnamesePlate(plate: string): boolean {
  const trimmed = (plate || '').trim().toUpperCase();
  if (!trimmed) return false;
  return VN_PLATE_REGEX.test(trimmed);
}

/**
 * Split formatted plate into two lines for authentic square/rectangular VN plate preview
 */
export function splitPlateLines(plate: string): { top: string; bottom: string } {
  const formatted = formatVietnamesePlate(plate);
  const idx = formatted.indexOf('-');
  if (idx === -1) {
    return { top: formatted || '51C', bottom: '000.00' };
  }
  return {
    top: formatted.slice(0, idx),
    bottom: formatted.slice(idx + 1) || '...',
  };
}
