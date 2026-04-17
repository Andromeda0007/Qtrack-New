import apiClient from './client';
import { Material, MaterialBatchCounts, UnitOfMeasure } from '../types';

export interface CreateItemPayload {
  material_name: string;
  description?: string;
  unit_of_measure?: UnitOfMeasure;
}

export interface UpdateItemPayload {
  material_name?: string;
  description?: string;
  unit_of_measure?: UnitOfMeasure;
  is_active?: boolean;
}

export const materialsApi = {
  /** List items. By default active-only; Head can request ?include_inactive=true. */
  list: async (includeInactive = false): Promise<Material[]> => {
    const res = await apiClient.get('/materials/', {
      params: includeInactive ? { include_inactive: true } : undefined,
    });
    return res.data;
  },

  get: async (id: number): Promise<Material> => {
    const res = await apiClient.get(`/materials/${id}`);
    return res.data;
  },

  create: async (data: CreateItemPayload): Promise<Material> => {
    const res = await apiClient.post('/materials/', data);
    return res.data;
  },

  update: async (id: number, patch: UpdateItemPayload): Promise<Material> => {
    const res = await apiClient.patch(`/materials/${id}`, patch);
    return res.data;
  },

  /** How many active (non-rejected) batches reference this item.
   *  Used to show a deactivate-warning on Edit Item. */
  batchCounts: async (id: number): Promise<MaterialBatchCounts> => {
    const res = await apiClient.get(`/materials/${id}/batch-counts`);
    return res.data;
  },
};
