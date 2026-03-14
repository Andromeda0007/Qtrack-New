// ─── Auth ────────────────────────────────────────────────────────────────────
export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  username: string;
  role: string;
  is_first_login: boolean;
}

export interface UserProfile {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: number | null;
  role: string;
  is_first_login: boolean;
  is_active: boolean;
  last_login: string | null;
}

// ─── Roles ───────────────────────────────────────────────────────────────────
export type RoleName =
  | 'WAREHOUSE_HEAD'
  | 'WAREHOUSE_USER'
  | 'QC_EXECUTIVE'
  | 'QC_HEAD'
  | 'QA_EXECUTIVE'
  | 'QA_HEAD'
  | 'PRODUCTION_USER'
  | 'PURCHASE_USER';

// ─── Inventory ───────────────────────────────────────────────────────────────
export type BatchStatus =
  | 'QUARANTINE'
  | 'UNDER_TEST'
  | 'APPROVED'
  | 'REJECTED'
  | 'QUARANTINE_RETEST'
  | 'ISSUED_TO_PRODUCTION';

export interface Batch {
  id: number;
  batch_number: string;
  material_name: string | null;
  material_code: string | null;
  supplier_name: string | null;
  grn_number: string | null;
  total_quantity: string;
  remaining_quantity: string;
  status: BatchStatus;
  expiry_date: string | null;
  retest_date: string | null;
  retest_cycle: number;
  manufacture_date?: string | null;
  pack_size?: string | null;
  pack_type?: string;
  qr_code_path?: string | null;
  ar_number?: string | null;
}

export interface StockMovement {
  id: number;
  movement_type: string;
  quantity: string;
  performed_by: number;
  remarks: string | null;
  created_at: string;
}

export interface Material {
  id: number;
  material_name: string;
  material_code: string;
  unit_of_measure: string;
  default_pack_size: string | null;
  is_active: boolean;
}

export interface Supplier {
  id: number;
  supplier_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

export interface Location {
  id: number;
  location_name: string;
  location_type: string;
}

// ─── QC ──────────────────────────────────────────────────────────────────────
export interface QCResult {
  id: number;
  batch_id: number;
  ar_number: string;
  sample_quantity: string | null;
  test_status: 'UNDER_TEST' | 'APPROVED' | 'REJECTED';
  test_remarks: string | null;
  retest_date: string | null;
}

export interface GradeTransfer {
  id: number;
  batch_id: number;
  old_material_code: string;
  new_material_code: string;
  reason: string | null;
  requested_by: number;
  created_at: string;
}

// ─── Finished Goods ──────────────────────────────────────────────────────────
export type FGStatus =
  | 'CREATED'
  | 'QA_PENDING'
  | 'QA_APPROVED'
  | 'QA_REJECTED'
  | 'WAREHOUSE_RECEIVED'
  | 'DISPATCHED';

export interface FGBatch {
  id: number;
  product_name: string;
  batch_number: string;
  manufacture_date: string;
  expiry_date: string;
  quantity: string;
  net_weight: string | null;
  gross_weight: string | null;
  carton_count: number | null;
  status: FGStatus;
  qr_code_path: string | null;
  shipper_label_path: string | null;
  created_at: string;
}

// ─── Notifications ───────────────────────────────────────────────────────────
export interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  entity_type: string | null;
  entity_id: number | null;
  created_at: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export interface ChatRoom {
  id: number;
  name: string;
  room_type: 'GLOBAL' | 'DEPARTMENT' | 'PRIVATE';
  description: string | null;
}

export interface Message {
  id: number;
  room_id: number;
  sender_id: number;
  message_text: string | null;
  media_url: string | null;
  created_at: string;
}

// ─── Users ───────────────────────────────────────────────────────────────────
export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: number | null;
  role_id: number;
  role_name: string | null;
  is_active: boolean;
  is_first_login: boolean;
  last_login: string | null;
  created_at: string;
}

export interface Role {
  id: number;
  role_name: string;
  description: string | null;
}

// ─── Navigation ──────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Login: undefined;
  ChangePassword: undefined;
  Main: undefined;
};
