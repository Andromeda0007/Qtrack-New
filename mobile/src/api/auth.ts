import apiClient from './client';
import { LoginResponse, UserProfile } from '../types';

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const res = await apiClient.post('/auth/login', { username, password });
    return res.data;
  },

  getMe: async (token?: string): Promise<UserProfile> => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await apiClient.get('/auth/me', { headers });
    return res.data;
  },

  changePassword: async (old_password: string, new_password: string): Promise<void> => {
    await apiClient.post('/auth/change-password', { old_password, new_password });
  },

  forgotPassword: async (email: string): Promise<string> => {
    const res = await apiClient.post('/auth/forgot-password', { email });
    return res.data.message;
  },

  resetPassword: async (token: string, new_password: string): Promise<string> => {
    const res = await apiClient.post('/auth/reset-password', { token, new_password });
    return res.data.message;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },
};
