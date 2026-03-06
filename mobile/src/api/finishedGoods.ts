import apiClient from './client';

export const finishedGoodsApi = {
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
  }) => {
    const res = await apiClient.post('/finished-goods/dispatch', data);
    return res.data;
  },

  getFGInventory: async () => {
    const res = await apiClient.get('/finished-goods/inventory');
    return res.data;
  },
};
