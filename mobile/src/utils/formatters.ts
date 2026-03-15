const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

/** Date only in IST: "06 Mar 2025" */
export const formatDate = (date: string | null | undefined): string => {
  if (!date) return '—';
  const ts = getISTTimestamp(date);
  if (ts == null) return date;
  const ist = new Date(ts);
  const d = ist.getUTCDate();
  const m = MONTHS[ist.getUTCMonth()];
  const y = ist.getUTCFullYear();
  return `${d.toString().padStart(2, '0')} ${m} ${y}`;
};

/** Date and time in IST: "06 Mar 2025, 8:30 PM" */
export const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '—';
  const ts = getISTTimestamp(date);
  if (ts == null) return date;
  const ist = new Date(ts);
  const d = ist.getUTCDate();
  const m = MONTHS[ist.getUTCMonth()];
  const y = ist.getUTCFullYear();
  const h = ist.getUTCHours();
  const min = ist.getUTCMinutes();
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${d.toString().padStart(2, '0')} ${m} ${y}, ${h12}:${min.toString().padStart(2, '0')} ${ampm}`;
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
