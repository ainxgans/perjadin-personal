const BULAN_INDO = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/**
 * Formats YYYY-MM-DD to "D MMMM YYYY" (e.g. "20 November 2026")
 * Safe against UTC / local timezone shifts by parsing string components directly.
 */
export const formatDateIndo = (s: string | null | undefined): string => {
  if (!s) return '';
  const parts = s.slice(0, 10).split('-');
  if (parts.length !== 3) return s;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 0 || month > 11) return s;
  return `${day} ${BULAN_INDO[month]} ${year}`;
};

/**
 * Calculates inclusive number of trip days from YYYY-MM-DD strings.
 */
export const getTripDays = (startStr: string | null | undefined, endStr: string | null | undefined): number => {
  if (!startStr) return 0;
  const sParts = startStr.slice(0, 10).split('-').map(Number);
  const eParts = (endStr || startStr).slice(0, 10).split('-').map(Number);
  if (sParts.length !== 3 || eParts.length !== 3) return 0;
  const sMs = Date.UTC(sParts[0], sParts[1] - 1, sParts[2]);
  const eMs = Date.UTC(eParts[0], eParts[1] - 1, eParts[2]);
  if (isNaN(sMs) || isNaN(eMs) || eMs < sMs) return 0;
  return Math.round((eMs - sMs) / 86400000) + 1;
};

/**
 * Formats trip start and end date in full Indonesian format with day count:
 * - Same day: "20 November 2026 (1 hari)"
 * - Date range: "20 November 2026 — 25 November 2026 (6 hari)"
 */
export const formatTripDateIndo = (startStr: string | null | undefined, endStr: string | null | undefined): string => {
  if (!startStr && !endStr) return '';
  const days = getTripDays(startStr, endStr);
  const suffix = days > 0 ? ` (${days} hari)` : '';
  if (!startStr) return formatDateIndo(endStr);
  if (!endStr || startStr === endStr) return `${formatDateIndo(startStr)}${suffix}`;
  return `${formatDateIndo(startStr)} — ${formatDateIndo(endStr)}${suffix}`;
};
