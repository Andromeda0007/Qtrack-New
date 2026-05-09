import apiClient from './client';

export const qaApi = {
  listFgBatches: async (status?: string, needsInspection?: boolean, hasInspection?: boolean): Promise<any[]> => {
    const params: any = {};
    if (status) params.status = status;
    if (needsInspection) params.needs_inspection = 'true';
    if (hasInspection) params.has_inspection = 'true';
    const res = await apiClient.get('/qa/fg-batches', { params });
    return res.data;
  },

  inspectFG: async (fg_batch_id: number, inspection_remarks?: string) => {
    const res = await apiClient.post('/qa/inspect', { fg_batch_id, inspection_remarks });
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
