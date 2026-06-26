/**
 * Helpers for the "monthly guarantee" sticker feature.
 *
 * Encoding:
 *   - The sticker is a **Data Matrix** (ECC200) at the smallest possible size
 *     (10×10 modules). A 10×10 Data Matrix can encode up to **6 numeric
 *     characters** — so we encode the month/year as exactly 6 digits: `YYYYMM`
 *     (e.g. `202606` for June 2026). No prefix is added so the data fits.
 *   - The scanner accepts both bare `YYYYMM` and the legacy `MP-YYYYMM` for
 *     backwards compatibility with already-printed QR stickers.
 */

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Build the Data Matrix payload string for a given year/month (month is 1-12). */
export function buildGuaranteePayload(year: number, month1to12: number): string {
  const mm = String(month1to12).padStart(2, '0');
  return `${year}${mm}`;
}

/** Convenience: payload for "now" (current month/year of the device). */
export function currentMonthPayload(): { payload: string; year: number; month: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return { payload: buildGuaranteePayload(year, month), year, month };
}

export interface ParsedGuarantee {
  valid: boolean;
  raw: string;
  year?: number;
  month?: number;
  monthName?: string;
  prettyLabel?: string;
}

/**
 * Try to interpret a scanned QR string as a Mass Power guarantee sticker.
 * Accepts both `MP-YYYYMM` (current format) and a bare 6-digit `YYYYMM`
 * (fallback for stickers printed without the prefix).
 */
export function parseGuaranteePayload(raw: string): ParsedGuarantee {
  if (!raw) return { valid: false, raw };
  const trimmed = raw.trim().toUpperCase();
  const m = /^(?:MP-)?(\d{4})(\d{2})$/.exec(trimmed);
  if (!m) return { valid: false, raw: trimmed };
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (year < 2000 || year > 2999 || month < 1 || month > 12) {
    return { valid: false, raw: trimmed };
  }
  const monthName = MONTH_NAMES[month - 1];
  return {
    valid: true,
    raw: trimmed,
    year,
    month,
    monthName,
    prettyLabel: `${monthName} ${year}`,
  };
}
