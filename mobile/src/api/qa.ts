import apiClient from './client';

export const qaApi = {
  inspectFG: async (fg_batch_id: number, quantity_verified?: number, inspection_remarks?: string) => {
    const res = await apiClient.post('/qa/inspect', { fg_batch_id, quantity_verified, inspection_remarks });
    return res.data;
  },

  approveFG: async (fg_batch_id: number, remarks?: string) => {
    const res = await apiClient.post('/qa/approve', { fg_batch_id, remarks });
    return res.data;
  },

  rejectFG: async (fg_batch_id: number, remarks: string) => {
    const res = await apiClient.post('/qa/reject', { fg_batch_id, remarks });
    return res.data;
  },
};
