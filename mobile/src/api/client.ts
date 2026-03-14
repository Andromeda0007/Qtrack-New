import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Change this to your backend IP when testing on a physical device
// Use your machine's local IP address e.g. http://192.168.1.x:8000
export const BASE_URL = "http://172.20.10.2:8000/api/v1";

console.log("API BASE_URL:", BASE_URL);

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Handle 401 — clear token and redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(["access_token", "user_data"]);
    }
    return Promise.reject(error);
  },
);

export default apiClient;

export const extractError = (error: any): string => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d: any) => d.msg).join(", ");
  return error?.message || "An unexpected error occurred";
};
