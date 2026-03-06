import { format, parseISO, isValid } from 'date-fns';

export const formatDate = (date: string | null | undefined): string => {
  if (!date) return '—';
  try {
    const parsed = parseISO(date);
    if (!isValid(parsed)) return date;
    return format(parsed, 'dd MMM yyyy');
  } catch {
    return date;
  }
};

export const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '—';
  try {
    const parsed = parseISO(date);
    if (!isValid(parsed)) return date;
    return format(parsed, 'dd MMM yyyy, HH:mm');
  } catch {
    return date;
  }
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
