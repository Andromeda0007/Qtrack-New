import apiClient from './client';
import { User, Role } from '../types';

export const usersApi = {
  getUsers: async (): Promise<User[]> => {
    const res = await apiClient.get('/users/');
    return res.data;
  },

  createUser: async (data: {
    name: string;
    username: string;
    email: string;
    phone: number;
    role_id: number;
  }) => {
    const res = await apiClient.post('/users/', data);
    return res.data;
  },

  updateUserRole: async (user_id: number, role_id: number) => {
    const res = await apiClient.patch(`/users/${user_id}/role`, { role_id });
    return res.data;
  },

  deactivateUser: async (user_id: number) => {
    const res = await apiClient.patch(`/users/${user_id}/deactivate`);
    return res.data;
  },

  reactivateUser: async (user_id: number) => {
    const res = await apiClient.patch(`/users/${user_id}/reactivate`);
    return res.data;
  },

  getRoles: async (): Promise<Role[]> => {
    const res = await apiClient.get('/users/roles');
    return res.data;
  },

  getAuditLogs: async (params?: { action_type?: string; entity_type?: string; performed_by?: string; limit?: number }) => {
    const res = await apiClient.get('/audit/', { params });
    return res.data;
  },
};
