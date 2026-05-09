import apiClient from './client';
import { FGBatch } from '../types';

export const productionApi = {
  createFGBatch: async (data: {
    fgtn_no?: string;
    product_name: string;
    batch_number: string;
    manufacture_date: string;
    expiry_date: string;
    pack_size?: string;
    unit_of_measure?: string;
    net_weight?: number;
    gross_weight?: number;
    quantity: number;
    carton_count?: number;
    remarks?: string;
  }) => {
    const res = await apiClient.post('/production/fg-batch', data);
    return res.data;
  },

  listFGBatches: async (status?: string): Promise<FGBatch[]> => {
    const params: any = {};
    if (status) params.status = status;
    const res = await apiClient.get('/production/fg-batch', { params });
    return res.data;
  },

  getFGBatch: async (id: number): Promise<any> => {
    const res = await apiClient.get(`/production/fg-batch/${id}`);
    return res.data;
  },

  getFGBatchStats: async (): Promise<{
    qa_pending: number; qa_needs_inspection: number; qa_awaiting_decision: number;
    qa_approved: number; qa_rejected: number;
    warehouse_received: number; dispatched: number;
  }> => {
    const res = await apiClient.get('/production/fg-batch/stats');
    return res.data;
  },
};
