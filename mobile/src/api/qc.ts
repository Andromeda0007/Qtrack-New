import apiClient from './client';

export const qcApi = {
  addARNumber: async (batch_id: number, ar_number: string, sample_quantity?: number) => {
    const res = await apiClient.post('/qc/ar-number', { batch_id, ar_number, sample_quantity });
    return res.data;
  },

  withdrawSample: async (batch_id: number, sample_quantity: number, remarks?: string) => {
    const res = await apiClient.post('/qc/withdraw-sample', { batch_id, sample_quantity, remarks });
    return res.data;
  },

  approveMaterial: async (batch_id: number, retest_date: string, remarks?: string) => {
    const res = await apiClient.post('/qc/approve', { batch_id, retest_date, remarks });
    return res.data;
  },

  rejectMaterial: async (batch_id: number, remarks: string) => {
    const res = await apiClient.post('/qc/reject', { batch_id, remarks });
    return res.data;
  },

  initiateRetest: async (batch_id: number, remarks?: string) => {
    const res = await apiClient.post('/qc/initiate-retest', { batch_id, remarks });
    return res.data;
  },

  completeRetest: async (batch_id: number, approved: boolean, retest_date?: string, remarks?: string) => {
    const res = await apiClient.post('/qc/complete-retest', { batch_id, approved, retest_date, remarks });
    return res.data;
  },

  requestGradeTransfer: async (batch_id: number, new_material_id: number, reason: string) => {
    const res = await apiClient.post('/qc/grade-transfer/request', { batch_id, new_material_id, reason });
    return res.data;
  },

  approveGradeTransfer: async (transfer_id: number, remarks?: string) => {
    const res = await apiClient.post('/qc/grade-transfer/approve', { transfer_id, remarks });
    return res.data;
  },

  getPendingGradeTransfers: async () => {
    const res = await apiClient.get('/qc/grade-transfer/pending');
    return res.data;
  },
};
