/**
 * ===== CẤU HÌNH ỨNG DỤNG =====
 * File này cung cấp config thống nhất cho toàn bộ frontend.
 * 
 * Ưu tiên:
 * 1. window.__API_CONFIG__ - từ server config.php (production)
 * 2. import.meta.env - từ .env file (development)
 * 
 * Khi deploy production: chỉnh server/config.php → ảnh hưởng toàn bộ app
 * Khi dev local: chỉnh .env file
 */

declare global {
  interface Window {
    __SERVER_TOKEN__?: string;
    __INITIAL_DATA__?: any & {
      _config?: {
        api_base: string;
        tenant: string;
        tenant_id?: string;
        property_id: string;
        vr360_cdn?: string;
        site_url?: string;
        app_name?: string;
      };
    };
  }
}

/**
 * App Configuration Object
 * Đọc từ window.__API_CONFIG__ (server inject) hoặc .env (local dev)
 */
/**
 * App Configuration Object
 * Ưu tiên: window.__INITIAL_DATA__._config (từ server) > .env (dev local)
 * Config được ẩn trong __INITIAL_DATA__ thay vì exposed riêng
 */
const serverConfig = typeof window !== 'undefined' ? window.__INITIAL_DATA__?._config : undefined;

const validUrl = (value: string | undefined): string => {
  if (!value) return "";
  try {
    const u = new URL(value);
    return u.hostname ? value : "";
  } catch {
    return "";
  }
};

export const appConfig = {
  // API Settings
  API_BASE_URL: serverConfig?.api_base || import.meta.env.VITE_API_BASE_URL || "",
  
  // Credentials - CHỈ dùng cho dev local (production dùng server token)
  API_USERNAME: import.meta.env.VITE_API_USERNAME || "",
  API_PASSWORD: import.meta.env.VITE_API_PASSWORD || "",
  
  // Tenant & Property
  TENANT_CODE: serverConfig?.tenant || import.meta.env.VITE_TENANT_CODE || "",
  TENANT_ID: serverConfig?.tenant_id || import.meta.env.VITE_TENANT_ID || "",
  PROPERTY_ID: serverConfig?.property_id || import.meta.env.VITE_PROPERTY_ID || "",
  
  // Additional Config
  VR360_CDN_URL: serverConfig?.vr360_cdn || import.meta.env.VITE_VR360_CDN_URL || "https://travel.link360.vn",
  PANORAMA_URL_DOMAIN: validUrl(serverConfig?.site_url) || import.meta.env.VITE_PANORAMA_URL_DOMAIN || "",
  VR360_SCENE_SYNC_ENDPOINT: import.meta.env.VITE_VR360_SCENE_SYNC_ENDPOINT || "",
  FRONTEND_CACHE_TTL_HOURS: Number(import.meta.env.VITE_FRONTEND_CACHE_TTL_HOURS || '12'),
  SITE_BASE_URL: validUrl(serverConfig?.site_url) || import.meta.env.VITE_SITE_BASE_URL || "",
  APP_NAME: serverConfig?.app_name || import.meta.env.VITE_APP_NAME || "",
  
  // Legacy support
  LOGO_MEDIA_ID: import.meta.env.VITE_LOGO_MEDIA_ID || "",
};

/**
 * Helper: Lấy server token (nếu có inject từ index.php)
 */
export const getServerToken = (): string | undefined => {
  return window.__SERVER_TOKEN__;
};

/**
 * Helper: Lấy initial data (nếu có inject từ index.php)
 */
export const getInitialData = (): any | undefined => {
  return window.__INITIAL_DATA__;
};

/**
 * Helper: Build media URL
 */
export const getMediaUrl = (mediaId: number | string): string => {
  return `${appConfig.API_BASE_URL}/media/${mediaId}/view`;
};

/**
 * Helper: Check xem có đang chạy với server injection không
 */
export const isServerConfigMode = (): boolean => {
  return !!window.__SERVER_TOKEN__;
};

export default appConfig;
