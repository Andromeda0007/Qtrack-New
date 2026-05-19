import apiClient from './client';

export interface FGBatchListItem {
  id: number;
  fgtn_no?: string;
  product_name: string;
  batch_number: string;
  pack_size?: string;
  unit_of_measure?: string;
  expiry_date: string;
  quantity: number;
  status: string;
  created_at: string;
}

export const finishedGoodsApi = {
  listByStatus: async (status: string): Promise<FGBatchListItem[]> => {
    const res = await apiClient.get('/finished-goods/batches', { params: { status } });
    return res.data;
  },

  receiveFG: async (fg_batch_id: number, location_id?: number) => {
    const res = await apiClient.post('/finished-goods/receive', { fg_batch_id, location_id });
    return res.data;
  },

  dispatchFG: async (data: {
    fg_batch_id: number;
    customer_name: string;
    quantity: number;
    dispatch_date?: string;
    invoice_number?: string;
    remarks?: string;
    carton_count?: number;
  }) => {
    const res = await apiClient.post('/finished-goods/dispatch', data);
    return res.data;
  },

  getFGInventory: async () => {
    const res = await apiClient.get('/finished-goods/inventory');
    return res.data;
  },
};
