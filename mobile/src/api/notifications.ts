import apiClient from './client';
import { Notification } from '../types';

export const notificationsApi = {
  getNotifications: async (unread_only = false): Promise<Notification[]> => {
    const res = await apiClient.get('/notifications/', { params: { unread_only } });
    return res.data;
  },

  markRead: async (id: number): Promise<void> => {
    await apiClient.patch(`/notifications/${id}/read`);
  },

  markAllRead: async (): Promise<void> => {
    await apiClient.patch('/notifications/mark-all-read');
  },
};
