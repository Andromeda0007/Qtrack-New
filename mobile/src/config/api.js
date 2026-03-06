import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// API Base URL
// Prefer EXPO_PUBLIC_API_BASE_URL so both Expo Go and APK use the same backend.
// Fallback uses production Render backend.
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://qtrack-backend.onrender.com/api";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - Add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage and redirect to login
      await AsyncStorage.removeItem("authToken");
      await AsyncStorage.removeItem("user");
    }
    return Promise.reject(error);
  }
);

export default api;
