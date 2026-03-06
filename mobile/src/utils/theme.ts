export const Colors = {
  primary: '#1e3a5f',
  primaryLight: '#2d5a8e',
  primaryDark: '#142840',
  accent: '#f0a500',
  accentLight: '#f7c04a',

  success: '#28a745',
  successLight: '#d4edda',
  warning: '#ffc107',
  warningLight: '#fff3cd',
  danger: '#dc3545',
  dangerLight: '#f8d7da',
  info: '#17a2b8',
  infoLight: '#d1ecf1',

  background: '#f5f7fa',
  surface: '#ffffff',
  border: '#dee2e6',
  borderLight: '#f0f0f0',

  textPrimary: '#212529',
  textSecondary: '#6c757d',
  textMuted: '#adb5bd',
  textOnPrimary: '#ffffff',

  // Batch status colors
  statusQuarantine: '#fd7e14',
  statusUnderTest: '#007bff',
  statusApproved: '#28a745',
  statusRejected: '#dc3545',
  statusRetest: '#6f42c1',
  statusIssued: '#20c997',
};

export const BatchStatusColors: Record<string, { bg: string; text: string; label: string }> = {
  QUARANTINE:           { bg: '#fff3cd', text: '#856404', label: 'Quarantine' },
  UNDER_TEST:           { bg: '#cce5ff', text: '#004085', label: 'Under Test' },
  APPROVED:             { bg: '#d4edda', text: '#155724', label: 'Approved' },
  REJECTED:             { bg: '#f8d7da', text: '#721c24', label: 'Rejected' },
  QUARANTINE_RETEST:    { bg: '#e2d9f3', text: '#432874', label: 'Quarantine (Retest)' },
  ISSUED_TO_PRODUCTION: { bg: '#d1ecf1', text: '#0c5460', label: 'Issued to Production' },
};

export const FGStatusColors: Record<string, { bg: string; text: string; label: string }> = {
  CREATED:            { bg: '#e2e3e5', text: '#383d41', label: 'Created' },
  QA_PENDING:         { bg: '#fff3cd', text: '#856404', label: 'QA Pending' },
  QA_APPROVED:        { bg: '#d4edda', text: '#155724', label: 'QA Approved' },
  QA_REJECTED:        { bg: '#f8d7da', text: '#721c24', label: 'QA Rejected' },
  WAREHOUSE_RECEIVED: { bg: '#cce5ff', text: '#004085', label: 'In Warehouse' },
  DISPATCHED:         { bg: '#d1ecf1', text: '#0c5460', label: 'Dispatched' },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  title: 28,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
};
