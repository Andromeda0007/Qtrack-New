const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function ensureUTC(iso: string): string {
  return iso && !/Z$/i.test(iso) ? iso.trim() + 'Z' : iso;
}

function getISTTimestamp(iso: string): number | null {
  try {
    const d = new Date(ensureUTC(iso));
    return Number.isNaN(d.getTime()) ? null : d.getTime() + IST_OFFSET_MS;
  } catch {
    return null;
  }
}

/**
 * Calendar date as DD-MM-YYYY (app standard).
 * - Plain YYYY-MM-DD from API: reversed (no timezone shift).
 * - ISO datetimes: calendar date in IST (matches warehouse/QC convention).
 * - Already DD-MM-YYYY: returned as-is.
 */
export const formatDate = (date: string | null | undefined): string => {
  if (!date) return '—';
  const s = String(date).trim();
  if (!s) return '—';
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  const ts = getISTTimestamp(s);
  if (ts != null) {
    const ist = new Date(ts);
    return `${pad2(ist.getUTCDate())}-${pad2(ist.getUTCMonth() + 1)}-${ist.getUTCFullYear()}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad2(parsed.getDate())}-${pad2(parsed.getMonth() + 1)}-${parsed.getFullYear()}`;
  }
  return s;
};

/** Alias for call sites that emphasize DMY display (same as formatDate). */
export const formatDateDMY = formatDate;

/**
 * Parse user input: DD-MM-YYYY or DD/MM/YYYY (and optional YYYY-MM-DD) → YYYY-MM-DD for APIs.
 * Returns null if invalid or empty.
 */
export const parseDMYToISO = (input: string): string | null => {
  const t = input.trim();
  if (!t) return null;
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(t);
  if (dmy) {
    const dd = parseInt(dmy[1], 10);
    const mm = parseInt(dmy[2], 10);
    const yyyy = parseInt(dmy[3], 10);
    if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 1900 || yyyy > 2100) return null;
    const iso = `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
    const check = new Date(`${iso}T12:00:00Z`);
    if (check.getUTCFullYear() !== yyyy || check.getUTCMonth() + 1 !== mm || check.getUTCDate() !== dd) {
      return null;
    }
    return iso;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
};

/** Date and time in IST: "06-03-2025, 8:30 PM" */
export const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '—';
  const ts = getISTTimestamp(date);
  if (ts == null) return date;
  const ist = new Date(ts);
  const dd = pad2(ist.getUTCDate());
  const mo = pad2(ist.getUTCMonth() + 1);
  const y = ist.getUTCFullYear();
  const h = ist.getUTCHours();
  const min = ist.getUTCMinutes();
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${dd}-${mo}-${y}, ${h12}:${pad2(min)} ${ampm}`;
};

/** Time only in IST: "8:30 PM" */
export const formatTimeIST = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const ts = getISTTimestamp(iso);
  if (ts == null) return iso;
  const ist = new Date(ts);
  const h = ist.getUTCHours();
  const min = ist.getUTCMinutes();
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${h12}:${min.toString().padStart(2, '0')} ${ampm}`;
};

/** For chat list: today → time; else "6 Mar" */
export const formatTimeOrDateIST = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const ts = getISTTimestamp(iso);
  if (ts == null) return '';
  const ist = new Date(ts);
  const now = new Date();
  const nowIst = new Date(now.getTime() + IST_OFFSET_MS);
  const sameDay =
    ist.getUTCDate() === nowIst.getUTCDate() &&
    ist.getUTCMonth() === nowIst.getUTCMonth() &&
    ist.getUTCFullYear() === nowIst.getUTCFullYear();
  if (sameDay) {
    const h = ist.getUTCHours();
    const min = ist.getUTCMinutes();
    const h12 = h % 12 || 12;
    const ampm = h < 12 ? 'AM' : 'PM';
    return `${h12}:${min.toString().padStart(2, '0')} ${ampm}`;
  }
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}`;
};

export const formatQuantity = (qty: string | number | null | undefined, unit = ''): string => {
  if (qty === null || qty === undefined) return '—';
  const num = parseFloat(String(qty));
  const formatted = Number.isInteger(num) ? num.toString() : num.toFixed(3).replace(/\.?0+$/, '');
  return unit ? `${formatted} ${unit}` : formatted;
};

export const formatRole = (role: string): string => {
  return role
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
};
