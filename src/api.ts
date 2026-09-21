import axios from "axios";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { appConfig } from "./config";

// API Configuration - Sử dụng config thống nhất
const API_BASE_URL = appConfig.API_BASE_URL;
const API_USERNAME = appConfig.API_USERNAME;
const API_PASSWORD = appConfig.API_PASSWORD;
const TENANT_HEADER_VALUE = appConfig.TENANT_CODE || appConfig.TENANT_ID;
const PROPERTY_ID = appConfig.PROPERTY_ID;
const isBrowser = typeof window !== 'undefined';
const isLocalDevHost =
  isBrowser &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);
const RUNTIME_API_BASE_URL = isLocalDevHost ? '/api/v1' : API_BASE_URL;

// Mở rộng kiểu config để có thể đánh dấu request đã được thử lại
interface AuthRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let currentAuthToken: string | undefined = undefined;
let isRefreshing = false;
let failedQueue: {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  originalConfig: any;
}[] = [];

// ===== AXIOS INSTANCE =====
// Note: baseURL sẽ được set động trong request interceptor
const api: AxiosInstance = axios.create({
  timeout: 15000,
});

// ===== DETECT ENVIRONMENT =====
// Kiểm tra xem đang chạy production (có api-proxy.php) hay dev local
const isProduction = typeof window !== 'undefined' && window.__SERVER_TOKEN__;

// ===== LOGIN & LẤY TOKEN =====
// PRODUCTION: Gọi api-proxy.php để lấy token (server-side login)
// DEV LOCAL: Login trực tiếp bằng credentials từ .env
const loginAndGetToken = async (): Promise<string> => {
  // PRODUCTION MODE: Dùng api-proxy.php
  if (isProduction || !isLocalDevHost) {
    console.log("[AUTH] Getting token from api-proxy.php (production mode)");
    
    try {
      // Gọi api-proxy.php để lấy token (server sẽ login bằng config.php)
      const response = await axios.post('/api-proxy.php?action=get-token');
      
      if (response.data.success && response.data.access_token) {
        console.log(`[AUTH] Token obtained from ${response.data.source}`);
        return response.data.access_token;
      } else {
        throw new Error('Failed to get token from api-proxy');
      }
    } catch (error) {
      console.error("[AUTH FAILED] Cannot get token from api-proxy:", error);
      throw error;
    }
  }

  // DEV LOCAL MODE: Login trực tiếp bằng credentials
  if (!API_USERNAME || !API_PASSWORD || !API_BASE_URL || !TENANT_HEADER_VALUE) {
    throw new Error("Missing API credentials or Tenant Code");
  }

  console.log("[AUTH] Logging in with credentials (dev mode)");
  const formData = new URLSearchParams();
  formData.append("username", API_USERNAME);
  formData.append("password", API_PASSWORD);

  try {
    const response = await axios.post(
      `${RUNTIME_API_BASE_URL}/auth/login`,
      formData.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "x-tenant-code": TENANT_HEADER_VALUE,
        },
      }
    );

    const newToken = response.data.access_token;
    return newToken;
  } catch (error) {
    console.error("[AUTH FAILED] Không thể đăng nhập và lấy token:", error);
    throw error;
  }
};

// ===== XỬ LÝ HÀNG ĐỢI VÀ ENSURE TOKEN (Giữ nguyên logic) =====
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      // Khi có token mới, resolve với token
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const ensureToken = async (): Promise<string> => {
  if (currentAuthToken) return currentAuthToken;

  if (isRefreshing) {
    // Chặn request và thêm vào hàng đợi
    return new Promise((resolve, reject) => {
      failedQueue.push({
        resolve,
        reject,
        originalConfig: null,
      });
    });
  }

  isRefreshing = true;
  try {
    const newToken = await loginAndGetToken();
    currentAuthToken = newToken;
    processQueue(null, newToken);
    return newToken;
  } catch (err) {
    processQueue(err, null);
    throw err;
  } finally {
    isRefreshing = false;
  }
};

// ===== REQUEST INTERCEPTOR (Đã sửa để chỉ sử dụng token) =====
api.interceptors.request.use(async (config) => {
  // Set baseURL động từ env
  config.baseURL = RUNTIME_API_BASE_URL;
  
  if (TENANT_HEADER_VALUE) {
    config.headers["x-tenant-code"] = TENANT_HEADER_VALUE;
  }

  if (PROPERTY_ID) {
    config.headers["x-property-id"] = PROPERTY_ID;
  }

  // Chặn và chờ lấy token
  const token = await ensureToken();
  config.headers.Authorization = `Bearer ${token}`;


  return config;
});

// ===== RESPONSE INTERCEPTOR (Giữ nguyên logic retry token) =====
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AuthRequestConfig;
    const status = error.response?.status;
    const errorDetail = error.response?.data?.detail;

    // Điều kiện retry: 401 HOẶC (403 thiếu token) VÀ chưa retry
    const shouldRetry =
      (status === 401 ||
        (status === 403 &&
          errorDetail === "Could not validate credentials - no token")) &&
      originalRequest &&
      !originalRequest._retry;

    if (shouldRetry) {
      originalRequest._retry = true;
      currentAuthToken = undefined; // xóa token cũ

      // Đẩy request gốc vào hàng đợi và chờ token mới
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (newToken: string) => {
            // Khi có token mới, thiết lập header và gửi lại request
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(originalRequest));
          },
          reject,
          originalConfig: originalRequest,
        });
        // Kích hoạt tiến trình lấy token
        ensureToken().catch(() => { });
      });
    }
    return Promise.reject(error);
  }
);

export default api;
