import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, RoleName } from '../types';

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setAuth: (token: string, user: UserProfile) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  updateUser: (user: UserProfile) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: async (token: string, user: UserProfile) => {
    await AsyncStorage.setItem('access_token', token);
    await AsyncStorage.setItem('user_data', JSON.stringify(user));
    set({ token, user, isAuthenticated: true, isLoading: false });
  },

  clearAuth: async () => {
    await AsyncStorage.multiRemove(['access_token', 'user_data']);
    set({ token: null, user: null, isAuthenticated: false, isLoading: false });
  },

  loadFromStorage: async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const userData = await AsyncStorage.getItem('user_data');
      if (token && userData) {
        set({
          token,
          user: JSON.parse(userData),
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  updateUser: (user: UserProfile) => {
    AsyncStorage.setItem('user_data', JSON.stringify(user));
    set({ user });
  },
}));

// Role permission helpers
export const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  WAREHOUSE_HEAD: ['CREATE_USER', 'MANAGE_USERS', 'VIEW_AUDIT_LOGS', 'CREATE_PRODUCT', 'UPDATE_LOCATION', 'ISSUE_STOCK', 'RECEIVE_FG', 'DISPATCH_FG', 'REVISE_PRODUCT', 'REPRINT_LABEL', 'APPROVE_CORRECTION', 'ADJUST_STOCK', 'VIEW_STOCK', 'VIEW_REPORTS', 'REQUEST_GRADE_TRANSFER', 'MANAGE_CHAT', 'SEND_MESSAGE'],
  WAREHOUSE_USER: ['CREATE_PRODUCT', 'UPDATE_LOCATION', 'ISSUE_STOCK', 'RECEIVE_FG', 'DISPATCH_FG', 'VIEW_STOCK'],
  QC_EXECUTIVE: ['GENERATE_AR_NUMBER', 'WITHDRAW_SAMPLE', 'SET_UNDER_TEST', 'VIEW_STOCK', 'INITIATE_RETEST'],
  QC_HEAD: ['GENERATE_AR_NUMBER', 'WITHDRAW_SAMPLE', 'APPROVE_MATERIAL', 'REJECT_MATERIAL', 'SET_RETEST_DATE', 'INITIATE_RETEST', 'APPROVE_GRADE_TRANSFER', 'VIEW_STOCK', 'VIEW_REPORTS'],
  QA_EXECUTIVE: ['INSPECT_FG', 'VIEW_STOCK'],
  QA_HEAD: ['INSPECT_FG', 'APPROVE_FG', 'REJECT_FG', 'VIEW_STOCK', 'VIEW_REPORTS'],
  PRODUCTION_USER: ['CREATE_FG_BATCH', 'GENERATE_SHIPPER_LABEL', 'VIEW_STOCK'],
  PURCHASE_USER: ['VIEW_STOCK', 'VIEW_REPORTS'],
};

export const hasPermission = (role: RoleName, permission: string): boolean => {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};
