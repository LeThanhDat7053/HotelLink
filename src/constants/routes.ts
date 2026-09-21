// Application routes
export const ROUTES = {
  HOME: '/',
  ABOUT: '/gioi-thieu',
  ROOMS: '/phong-nghi',
  DINING: '/am-thuc',
  RESTAURANT: '/nha-hang',
  LOBBY_BAR: '/lobby-bar',
  AMENITIES: '/tien-ich',
  POOL: '/ho-boi',
  GYM: '/phong-gym',
  SERVICES: '/dich-vu',
  MEETING_ROOM: '/phong-hop',
  SAUNA: '/phong-tam-hoi',
  OTHER_SERVICES: '/dich-vu-khac',
  POLICIES: '/chinh-sach',
  CONTACT: '/lien-he',
  GALLERY: '/thu-vien-anh',
  NEWS: '/tin-tuc-su-kien',
  OFFERS: '/uu-dai',
  BOOKING: '/dat-phong',
  VR360_SCENE_SYNC: '/vr360-scene-sync',
} as const;

/**
 * Helper function để tạo path với language prefix
 * @param path - Original path (ví dụ: /phong-nghi)
 * @param lang - Language code (ví dụ: en, vi, zh) - nếu là 'vi' thì không thêm prefix
 * @returns Path với language prefix (ví dụ: /en/phong-nghi) hoặc original path nếu là vi
 */
export const getLocalizedPath = (path: string, lang?: string): string => {
  if (!lang || lang === 'vi') {
    return path; // Default language không cần prefix
  }
  return `/${lang}${path}`;
};

/**
 * Danh sách tất cả locale codes hỗ trợ từ backend API
 * Lấy từ GET /api/v1/locales/
 * Note: Tất cả lowercase ngoại trừ zh-TW
 */
export const SUPPORTED_LOCALES = [
  'ar', 'de', 'en', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko',
  'ms', 'pt', 'ru', 'ta', 'th', 'tl', 'vi', 'yue', 'zh', 'zh-TW'
] as const;

export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

/**
 * Helper function để kiểm tra locale code có hợp lệ không
 * Case-insensitive check
 */
export const isValidLocale = (code: string): boolean => {
  const normalized = code.toLowerCase();
  return SUPPORTED_LOCALES.some(locale => locale.toLowerCase() === normalized);
};

/**
 * Helper function để normalize locale code về đúng format
 * VD: 'ZH-tw' -> 'zh-TW', 'YUE' -> 'yue'
 */
export const normalizeLocale = (code: string): string => {
  const lower = code.toLowerCase();
  // Tìm locale khớp (case-insensitive)
  const found = SUPPORTED_LOCALES.find(locale => locale.toLowerCase() === lower);
  return found || code;
};

/**
 * Helper function để extract language code từ pathname
 * @param pathname - Current pathname từ location
 * @returns Language code (en, vi, zh, ko, zh-TW...) hoặc 'vi' nếu không có prefix
 * 
 * Hỗ trợ:
 * - 2 ký tự: /en/, /vi/, /ko/, /ja/...
 * - 3 ký tự: /yue/
 * - Có dấu gạch: /zh-TW/
 */
export const extractLanguageFromPath = (pathname: string): string => {
  // Match locale codes: 2-3 chữ cái hoặc có dấu gạch (zh-TW)
  const langMatch = pathname.match(/^\/([a-zA-Z]{2,3}(?:-[a-zA-Z]{2})?)(?:\/|$)/);
  if (langMatch && isValidLocale(langMatch[1])) {
    return normalizeLocale(langMatch[1]); // Return normalized language code
  }
  return 'vi'; // Default to Vietnamese
};

/**
 * Helper function để extract clean path từ pathname (bỏ language prefix)
 * @param pathname - Current pathname từ location
 * @returns Clean path without language prefix (ví dụ: /phong-nghi)
 */
export const extractCleanPath = (pathname: string): string => {
  // Match locale codes: 2-3 chữ cái hoặc có dấu gạch (zh-TW)
  const langMatch = pathname.match(/^\/([a-zA-Z]{2,3}(?:-[a-zA-Z]{2})?)(?:\/(.*))?$/);
  if (langMatch && isValidLocale(langMatch[1])) {
    // Valid locale code - extract the clean path
    return langMatch[2] ? `/${langMatch[2]}` : '/';
  }
  return pathname;
};

// Navigation items
export interface NavItem {
  label: string;
  path: string;
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'GIỚI THIỆU', path: ROUTES.ABOUT },
  { label: 'PHÒNG NGHỈ', path: ROUTES.ROOMS },
  {
    label: 'ẨM THỰC',
    path: ROUTES.DINING,
    children: [
      { label: 'NHÀ HÀNG', path: ROUTES.RESTAURANT },
      { label: 'LOBBY BAR', path: ROUTES.LOBBY_BAR },
    ],
  },
  {
    label: 'TIỆN ÍCH',
    path: ROUTES.AMENITIES,
    children: [
      { label: 'HỒ BƠI', path: ROUTES.POOL },
      { label: 'PHÒNG GYM', path: ROUTES.GYM },
    ],
  },
  {
    label: 'DỊCH VỤ',
    path: ROUTES.SERVICES,
    children: [
      { label: 'PHÒNG HỌP', path: ROUTES.MEETING_ROOM },
      { label: 'PHÒNG TẮM HƠI', path: ROUTES.SAUNA },
      { label: 'DỊCH VỤ KHÁC', path: ROUTES.OTHER_SERVICES },
    ],
  },
  { label: 'CHÍNH SÁCH', path: ROUTES.POLICIES },
  { label: 'LIÊN HỆ', path: ROUTES.CONTACT },
];

export default ROUTES;
