import apiClient from './client';
import { Batch, Material, Supplier, StockMovement, UnitOfMeasure } from '../types';

export interface CreateGRNPayload {
  material_id: number;
  batch_number: string;
  supplier_name: string;
  manufacturer_name: string;
  date_of_receipt: string;
  manufacture_date: string;
  expiry_date: string;
  pack_type: string;
  unit_of_measure: UnitOfMeasure;
  container_count: number;
  container_quantity: number;
  total_quantity: number;
}

export const inventoryApi = {
  // Create a GRN (per Warehouse Phase 1.A).
  // URL still points at /inventory/product to preserve backend compat.
  createGRN: async (data: CreateGRNPayload) => {
    const res = await apiClient.post('/inventory/product', data);
    return res.data;
  },

  // Legacy alias so in-flight callers keep working during the rollout.
  createProduct: async (data: CreateGRNPayload) => {
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

  getBatchesByStatuses: async (statuses: string[]): Promise<Batch[]> => {
    const params: any = { statuses: statuses.join(',') };
    const res = await apiClient.get('/inventory/batches', { params });
    return res.data;
  },

  downloadContainerLabelsPdf: async (batchId: number): Promise<string> => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const FileSystem = require('expo-file-system/legacy');
    const { BASE_URL } = require('./client');
    const token = await AsyncStorage.getItem('access_token');
    const url = `${BASE_URL}/inventory/batches/${batchId}/container-labels`;
    const target = `${FileSystem.cacheDirectory}container-labels-${batchId}.pdf`;
    const dl = await FileSystem.downloadAsync(url, target, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return dl.uri;
  },

  markLabelsPrinted: async (batchId: number): Promise<void> => {
    await apiClient.post(`/inventory/batches/${batchId}/mark-labels-printed`);
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
  issueStock: async (
    batch_id: number,
    quantity: number,
    remarks?: string,
    opts?: { issued_to_product_name?: string; issued_to_batch_ref?: string },
  ) => {
    const res = await apiClient.post('/inventory/issue-stock', {
      batch_id,
      quantity,
      remarks,
      issued_to_product_name: opts?.issued_to_product_name,
      issued_to_batch_ref: opts?.issued_to_batch_ref,
    });
    return res.data;
  },

  updateBatchRack: async (batch_id: number, rack_number: string) => {
    const res = await apiClient.patch(`/inventory/batches/${batch_id}/rack`, { rack_number });
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
