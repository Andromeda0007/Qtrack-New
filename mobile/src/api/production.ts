import apiClient from './client';
import { FGBatch } from '../types';

export const productionApi = {
  createFGBatch: async (data: {
    product_name: string;
    batch_number: string;
    manufacture_date: string;
    expiry_date: string;
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
};
