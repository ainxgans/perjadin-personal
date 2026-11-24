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
 * Formats trip start and end date in full Indonesian format:
 * - Same day: "20 November 2026"
 * - Date range: "20 November 2026 — 25 November 2026"
 */
export const formatTripDateIndo = (startStr: string | null | undefined, endStr: string | null | undefined): string => {
  if (!startStr && !endStr) return '';
  if (!startStr) return formatDateIndo(endStr);
  if (!endStr || startStr === endStr) return formatDateIndo(startStr);
  return `${formatDateIndo(startStr)} — ${formatDateIndo(endStr)}`;
};
