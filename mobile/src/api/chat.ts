import apiClient, { BASE_URL } from './client';
import { ChatConversation, ChatMessage } from '../types';

const WS_URL = BASE_URL.replace('/api/v1', '').replace('http', 'ws');

export const chatApi = {
  getRooms: async (): Promise<ChatConversation[]> => {
    const res = await apiClient.get('/chat/rooms');
    return res.data;
  },

  startDM: async (userId: number): Promise<{ room_id: number }> => {
    const res = await apiClient.post('/chat/dm', { user_id: userId });
    return res.data;
  },

  createGroup: async (name: string, memberIds: number[], description?: string): Promise<{ room_id: number }> => {
    const res = await apiClient.post('/chat/group', { name, member_ids: memberIds, description: description ?? '' });
    return res.data;
  },

  getMessages: async (roomId: number, limit = 50, offset = 0): Promise<ChatMessage[]> => {
    const res = await apiClient.get(`/chat/rooms/${roomId}/messages`, { params: { limit, offset } });
    return res.data;
  },

  editMessage: async (messageId: number, content: string) => {
    const res = await apiClient.patch(`/chat/messages/${messageId}`, { content });
    return res.data;
  },

  deleteMessageForAll: async (messageId: number) => {
    const res = await apiClient.delete(`/chat/messages/${messageId}`);
    return res.data;
  },

  searchUsers: async (q = ''): Promise<{ id: number; name: string; username: string; role: string | null }[]> => {
    const res = await apiClient.get('/chat/users/search', { params: { q } });
    return res.data;
  },

  getContactProfile: async (userId: number): Promise<{
    id: number; name: string; username: string; email: string; phone: string; role_name: string;
  }> => {
    const res = await apiClient.get(`/chat/users/${userId}/profile`);
    return res.data;
  },

  getGroupInfo: async (roomId: number): Promise<{
    name: string; description: string; members: { id: number; name: string; username: string }[];
  }> => {
    const res = await apiClient.get(`/chat/rooms/${roomId}`);
    return res.data;
  },

  markRoomRead: async (roomId: number): Promise<{ marked: number }> => {
    const res = await apiClient.post(`/chat/rooms/${roomId}/read`);
    return res.data;
  },

  getUnreadTotal: async (): Promise<{ total: number }> => {
    const res = await apiClient.get('/chat/unread-total');
    return res.data;
  },
};

export const createChatWebSocket = (token: string): WebSocket => {
  return new WebSocket(`${WS_URL}/api/v1/chat/ws?token=${token}`);
};
