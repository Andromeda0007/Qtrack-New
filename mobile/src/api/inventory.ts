import apiClient from './client';
import { Batch, Material, Supplier, StockMovement } from '../types';

export const inventoryApi = {
  // Create product card
  createProduct: async (data: {
    item_code: string;
    item_name: string;
    grn_number: string;
    batch_number: string;
    total_quantity: number;
    container_quantity: number;
    pack_type: string;
    supplier_name: string;
    manufacturer_name: string;
    date_of_receipt: string;
    manufacture_date: string;
    expiry_date: string;
  }) => {
    const res = await apiClient.post('/inventory/product', data);
    return res.data;
  },

  // Batches
  getBatches: async (status?: string, material_id?: number): Promise<Batch[]> => {
    const params: any = {};
    if (status) params.status = status;
    if (material_id) params.material_id = material_id;
    const res = await apiClient.get('/inventory/batches', { params });
    return res.data;
  },

  getBatchById: async (id: number): Promise<any> => {
    const res = await apiClient.get(`/inventory/batches/${id}`);
    return res.data;
  },

  scanQR: async (qrData: string): Promise<any> => {
    const res = await apiClient.get(`/inventory/scan/${encodeURIComponent(qrData)}`);
    return res.data;
  },

  // Stock operations
  issueStock: async (batch_id: number, quantity: number, remarks?: string) => {
    const res = await apiClient.post('/inventory/issue-stock', { batch_id, quantity, remarks });
    return res.data;
  },

  adjustStock: async (batch_id: number, quantity: number, reason: string) => {
    const res = await apiClient.post('/inventory/adjust-stock', { batch_id, quantity, reason });
    return res.data;
  },

  getStockReport: async (): Promise<any[]> => {
    const res = await apiClient.get('/inventory/stock-report');
    return res.data;
  },

  getBatchMovements: async (batch_id: number): Promise<StockMovement[]> => {
    const res = await apiClient.get(`/inventory/batches/${batch_id}/movements`);
    return res.data;
  },

  // Materials
  getMaterials: async (): Promise<Material[]> => {
    const res = await apiClient.get('/materials/');
    return res.data;
  },

  // Suppliers
  getSuppliers: async (): Promise<Supplier[]> => {
    const res = await apiClient.get('/suppliers/');
    return res.data;
  },
};
