import { ROUTES, isValidLocale } from '../constants/routes';

/**
 * Các segment path top-level đã biết (phong-nghi, am-thuc, ...). Dùng để phân biệt
 * slug của sale với route bình thường.
 */
const KNOWN_ROUTE_SEGMENTS = new Set(
  Object.values(ROUTES)
    .map((route) => route.replace(/^\//, ''))
    .filter(Boolean),
);

/**
 * Đọc slug của sale từ segment path đầu tiên.
 * VD: /coraltest/phong-nghi/DLX-DBL3 → "coraltest"
 *
 * Trả về null nếu segment đầu là:
 * - locale (vd /en/...)
 * - một route đã biết (vd /phong-nghi)
 * - rỗng (trang chủ)
 *
 * Slug này được dùng làm basename cho Router, nên mọi điều hướng nội bộ
 * tự động giữ prefix /coraltest mà không cần sửa từng link.
 */
export const getSaleSlugFromUrl = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      return null;
    }

    const first = decodeURIComponent(segments[0]).trim();
    if (!first || isValidLocale(first) || KNOWN_ROUTE_SEGMENTS.has(first)) {
      return null;
    }

    return first;
  } catch {
    return null;
  }
};
