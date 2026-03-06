import apiClient from './client';
import { ChatRoom, Message } from '../types';

export const chatApi = {
  getRooms: async (): Promise<ChatRoom[]> => {
    const res = await apiClient.get('/chat/rooms');
    return res.data;
  },

  createRoom: async (name: string, room_type: string, description?: string) => {
    const res = await apiClient.post('/chat/rooms', { name, room_type, description });
    return res.data;
  },

  addMember: async (room_id: number, user_id: number) => {
    const res = await apiClient.post(`/chat/rooms/${room_id}/members`, { user_id });
    return res.data;
  },

  getMessages: async (room_id: number, limit = 50, offset = 0): Promise<Message[]> => {
    const res = await apiClient.get(`/chat/rooms/${room_id}/messages`, { params: { limit, offset } });
    return res.data;
  },

  sendMessage: async (room_id: number, message_text?: string, media_url?: string): Promise<Message> => {
    const res = await apiClient.post(`/chat/rooms/${room_id}/messages`, { message_text, media_url });
    return res.data;
  },

  deleteMessage: async (message_id: number) => {
    const res = await apiClient.delete(`/chat/messages/${message_id}`);
    return res.data;
  },
};
