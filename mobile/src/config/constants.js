// Material Status
export const MATERIAL_STATUS = {
  QUARANTINE: "QUARANTINE",
  UNDER_TEST: "UNDER_TEST",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  DISPENSED: "DISPENSED",
};

// User Roles
export const ROLES = {
  OPERATOR: "Operator",
  VIEWER: "Viewer",
  ADMIN: "Admin",
};

// Account Status
export const ACCOUNT_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    ME: "/auth/me",
  },
  USERS: {
    PENDING: "/users/pending",
    APPROVE: "/users",
    REJECT: "/users",
    LIST: "/users",
  },
  MATERIALS: {
    CREATE: "/materials/create",
    SCAN: "/materials/scan",
    GET: "/materials",
    SAMPLING: "/materials",
    APPROVE: "/materials",
    REJECT: "/materials",
    UPDATE_RACK: "/materials",
    DISPENSE: "/materials",
    HISTORY: "/materials",
    QR_LABEL: "/materials",
  },
  INVENTORY: {
    INWARD: "/inventory/inward",
    OUTWARD: "/inventory/outward",
    EXPIRY_ALERTS: "/inventory/expiry-alerts",
  },
};

// Colors
export const COLORS = {
  primary: "#007AFF",
  secondary: "#5856D6",
  success: "#34C759",
  danger: "#FF3B30",
  warning: "#FF9500",
  info: "#5AC8FA",
  light: "#F2F2F7",
  dark: "#1C1C1E",
  white: "#FFFFFF",
  black: "#000000",
  gray: "#3E3E43",
  purple: "#9B59B6",
  teal: "#16A085",
};

// Role Colors
export const ROLE_COLORS = {
  [ROLES.ADMIN]: "#FF3B30",
  [ROLES.OPERATOR]: "#9B59B6",
  [ROLES.VIEWER]: "#16A085",
};

// Status Colors
export const STATUS_COLORS = {
  [MATERIAL_STATUS.QUARANTINE]: "#FFA726",
  [MATERIAL_STATUS.UNDER_TEST]: "#7E57C2",
  [MATERIAL_STATUS.APPROVED]: "#34C759",
  [MATERIAL_STATUS.REJECTED]: "#FF3B30",
  [MATERIAL_STATUS.DISPENSED]: "#3E3E43",
};

