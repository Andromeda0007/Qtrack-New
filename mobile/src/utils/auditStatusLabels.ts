/**
 * Maps audit `from_status` / `to_status` (batch + FG enums) to user-facing product status text.
 */

/** Mirrors backend `AUDIT_CATEGORIES["status"]` — use for Status-style cards on All + Status filters. */
export const AUDIT_STATUS_ACTION_TYPES = new Set<string>([
  'ADD_AR_NUMBER',
  'APPROVE_MATERIAL',
  'REJECT_MATERIAL',
  'INITIATE_RETEST',
  'RETEST_APPROVED',
  'RETEST_REJECTED',
  'APPROVE_FG',
  'REJECT_FG',
  'RECEIVE_FG',
  'DISPATCH_FG',
]);

export function isAuditStatusAction(actionType: string | null | undefined): boolean {
  if (actionType == null || String(actionType).trim() === '') return false;
  return AUDIT_STATUS_ACTION_TYPES.has(String(actionType).trim().toUpperCase());
}

const PRODUCT_STATUS_LABELS: Record<string, string> = {
  // Raw material batch
  QUARANTINE: 'Quarantine',
  UNDER_TEST: 'Under test',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  QUARANTINE_RETEST: 'Quarantine (retest)',
  ISSUED_TO_PRODUCTION: 'Issued to production',
  // Finished goods
  CREATED: 'Created',
  QA_PENDING: 'QA pending',
  QA_APPROVED: 'QA approved',
  QA_REJECTED: 'QA rejected',
  WAREHOUSE_RECEIVED: 'Warehouse received',
  DISPATCHED: 'Dispatched',
  /** Synthetic “from” when a record is first created (audit inference) */
  NEW_PRODUCT: 'New receipt',
  NEW_FG: 'New FG batch',
};

function titleCaseEnum(s: string): string {
  return s
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a single stored status value for the From / To row. */
export function formatAuditProductStatus(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === '') return '';
  const key = String(raw).trim().toUpperCase();
  return PRODUCT_STATUS_LABELS[key] ?? titleCaseEnum(key);
}

type TransitionHint = { from?: string; to?: string };

/**
 * When DB omitted from_status/to_status (legacy), infer enum keys from action_type.
 * Values are BatchStatus / FGStatus strings as stored by the backend.
 */
function inferTransitionEnums(actionType: string | null | undefined): TransitionHint | null {
  const u = (actionType || '').toUpperCase();
  const map: Record<string, TransitionHint> = {
    ADD_AR_NUMBER: { from: 'QUARANTINE', to: 'UNDER_TEST' },
    APPROVE_MATERIAL: { from: 'UNDER_TEST', to: 'APPROVED' },
    REJECT_MATERIAL: { from: 'UNDER_TEST', to: 'REJECTED' },
    INITIATE_RETEST: { from: 'APPROVED', to: 'QUARANTINE_RETEST' },
    RETEST_APPROVED: { from: 'UNDER_TEST', to: 'APPROVED' },
    RETEST_REJECTED: { from: 'UNDER_TEST', to: 'REJECTED' },
    APPROVE_FG: { from: 'QA_PENDING', to: 'QA_APPROVED' },
    REJECT_FG: { from: 'QA_PENDING', to: 'QA_REJECTED' },
    RECEIVE_FG: { from: 'QA_APPROVED', to: 'WAREHOUSE_RECEIVED' },
    DISPATCH_FG: { from: 'WAREHOUSE_RECEIVED', to: 'DISPATCHED' },
    CREATE_PRODUCT: { from: 'NEW_PRODUCT', to: 'QUARANTINE' },
    CREATE_FG_BATCH: { from: 'NEW_FG', to: 'QA_PENDING' },
  };
  return map[u] ?? null;
}

function trimmed(s: unknown): string {
  if (s == null) return '';
  return String(s).trim();
}

/**
 * Resolved From / To labels for the Status audit filter (never raw QUARANTINE / UNDER_TEST strings).
 */
export function resolveAuditFromToLabels(item: {
  from_status?: string | null;
  to_status?: string | null;
  action_type?: string | null;
}): { from: string; to: string } {
  const inferred = inferTransitionEnums(item.action_type);

  const fromKey = trimmed(item.from_status) || inferred?.from || '';
  const toKey = trimmed(item.to_status) || inferred?.to || '';

  const fromLabel = fromKey ? formatAuditProductStatus(fromKey) : '';
  const toLabel = toKey ? formatAuditProductStatus(toKey) : '';

  return {
    from: fromLabel || 'Unknown',
    to: toLabel || 'Unknown',
  };
}
