import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../config/api";
import { API_ENDPOINTS } from "../config/constants";

// Async thunks
export const createMaterial = createAsyncThunk(
  "materials/create",
  async (materialData, { rejectWithValue }) => {
    try {
      const response = await api.post(
        API_ENDPOINTS.MATERIALS.CREATE,
        materialData
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to create material"
      );
    }
  }
);

export const scanMaterial = createAsyncThunk(
  "materials/scan",
  async (qrCode, { rejectWithValue }) => {
    try {
      const response = await api.get(
        `${API_ENDPOINTS.MATERIALS.SCAN}/${qrCode}`
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to scan material"
      );
    }
  }
);

export const getMaterial = createAsyncThunk(
  "materials/get",
  async (materialId, { rejectWithValue }) => {
    try {
      const response = await api.get(
        `${API_ENDPOINTS.MATERIALS.GET}/${materialId}`
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to get material"
      );
    }
  }
);

export const moveToUnderTest = createAsyncThunk(
  "materials/sampling",
  async ({ materialId, comments }, { rejectWithValue }) => {
    try {
      const response = await api.post(
        `${API_ENDPOINTS.MATERIALS.SAMPLING}/${materialId}/sampling`,
        { comments }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to move to under test"
      );
    }
  }
);

export const approveMaterial = createAsyncThunk(
  "materials/approve",
  async ({ materialId, retestDate, comments }, { rejectWithValue }) => {
    try {
      const response = await api.post(
        `${API_ENDPOINTS.MATERIALS.APPROVE}/${materialId}/approve`,
        { retestDate, comments }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to approve material"
      );
    }
  }
);

export const rejectMaterial = createAsyncThunk(
  "materials/reject",
  async ({ materialId, rejectionReason, comments }, { rejectWithValue }) => {
    try {
      const response = await api.post(
        `${API_ENDPOINTS.MATERIALS.REJECT}/${materialId}/reject`,
        { rejectionReason, comments }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to reject material"
      );
    }
  }
);

export const updateRackNumber = createAsyncThunk(
  "materials/updateRack",
  async ({ materialId, rackNumber }, { rejectWithValue }) => {
    try {
      const response = await api.put(
        `${API_ENDPOINTS.MATERIALS.UPDATE_RACK}/${materialId}/rack`,
        { rackNumber }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to update rack number"
      );
    }
  }
);

export const dispenseMaterial = createAsyncThunk(
  "materials/dispense",
  async (
    {
      materialId,
      issuedQuantity,
      issuedToProductBatch,
      dispensingMethod,
      comments,
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await api.post(
        `${API_ENDPOINTS.MATERIALS.DISPENSE}/${materialId}/dispense`,
        { issuedQuantity, issuedToProductBatch, dispensingMethod, comments }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to dispense material"
      );
    }
  }
);

export const getMaterialHistory = createAsyncThunk(
  "materials/history",
  async (materialId, { rejectWithValue }) => {
    try {
      const response = await api.get(
        `${API_ENDPOINTS.MATERIALS.HISTORY}/${materialId}/history`
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to get history"
      );
    }
  }
);

// Initial state
const initialState = {
  currentMaterial: null,
  history: [],
  loading: false,
  error: null,
  canEdit: false,
};

// Material slice
const materialSlice = createSlice({
  name: "materials",
  initialState,
  reducers: {
    setCurrentMaterial: (state, action) => {
      state.currentMaterial = action.payload.material;
      state.history = action.payload.history || [];
      state.canEdit = action.payload.canEdit || false;
    },
    clearCurrentMaterial: (state) => {
      state.currentMaterial = null;
      state.history = [];
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Scan material
    builder
      .addCase(scanMaterial.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(scanMaterial.fulfilled, (state, action) => {
        state.loading = false;
        state.currentMaterial = action.payload.material;
        state.history = action.payload.history || [];
        state.canEdit = action.payload.canEdit || false;
        state.error = null;
      })
      .addCase(scanMaterial.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Get material
    builder.addCase(getMaterial.fulfilled, (state, action) => {
      state.currentMaterial = action.payload.material;
      state.history = action.payload.history || [];
      state.canEdit = action.payload.canEdit || false;
    });

    // Create material
    builder
      .addCase(createMaterial.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createMaterial.fulfilled, (state, action) => {
        state.loading = false;
        state.currentMaterial = action.payload.material;
        state.error = null;
      })
      .addCase(createMaterial.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Update operations
    builder
      .addCase(moveToUnderTest.fulfilled, (state, action) => {
        if (
          state.currentMaterial?.material_id ===
          action.payload.material.material_id
        ) {
          state.currentMaterial = action.payload.material;
        }
      })
      .addCase(approveMaterial.fulfilled, (state, action) => {
        if (
          state.currentMaterial?.material_id ===
          action.payload.material.material_id
        ) {
          state.currentMaterial = action.payload.material;
        }
      })
      .addCase(rejectMaterial.fulfilled, (state, action) => {
        if (
          state.currentMaterial?.material_id ===
          action.payload.material.material_id
        ) {
          state.currentMaterial = action.payload.material;
        }
      })
      .addCase(updateRackNumber.fulfilled, (state, action) => {
        if (
          state.currentMaterial?.material_id ===
          action.payload.material.material_id
        ) {
          state.currentMaterial = action.payload.material;
        }
      })
      .addCase(dispenseMaterial.fulfilled, (state, action) => {
        if (
          state.currentMaterial?.material_id ===
          action.payload.material.material_id
        ) {
          state.currentMaterial = action.payload.material;
        }
      })
      .addCase(getMaterialHistory.fulfilled, (state, action) => {
        state.history = action.payload.history || [];
      });
  },
});

export const { setCurrentMaterial, clearCurrentMaterial, clearError } = materialSlice.actions;
export default materialSlice.reducer;

