/**
 * Room API Types
 * Endpoint: GET /api/v1/vr-hotel/rooms
 * 
 * Auto-generated from backend API schema
 */

// ============= ROOM TYPES =============

/**
 * Room media item (hình ảnh/video của phòng)
 */
export interface RoomMedia {
  media_id: number;
  is_vr360: boolean;
  is_primary: boolean; // true = ảnh đại diện, false = ảnh chi tiết
  sort_order: number;
}

/**
 * Room translation (dữ liệu đa ngôn ngữ)
 */
export interface RoomTranslation {
  locale: string; // 'vi', 'en', 'yue', etc.
  name: string; // Tên phòng
  description: string; // Mô tả phòng
  amenities_text: string | null; // Text tiện nghi (nếu có)
}

/**
 * Room translations object (key = locale code)
 */
export type RoomTranslations = {
  [locale: string]: RoomTranslation;
};

/**
 * Room attributes (metadata JSON)
 */
export interface RoomAttributes {
  vr_link?: string; // Link VR360
  [key: string]: any; // Cho phép thêm các attributes khác
}

/**
 * Room response từ API
 */
export interface RoomResponse {
  id: number;
  tenant_id: number;
  property_id: number;
  room_code: string; // Mã phòng (A01, B02, etc.)
  room_type: string; // Loại phòng (standard, deluxe, suite, etc.)
  floor: number | null;
  bed_type: string | null;
  capacity: number; // Sức chứa (số người)
  size_sqm: number; // Diện tích (m²)
  price_per_night: number; // Giá phòng/đêm
  vr_link: string | null;
  target_id: string | null;
  panorama_url: string | null;
  booking_url: string | null;
  status: string; // available, occupied, maintenance, etc.
  amenities_json: string[]; // Danh sách tiện nghi
  attributes_json: RoomAttributes; // Metadata (có vr_link nhưng BỎ QUA)
  display_order: number;
  translations: RoomTranslations; // Dữ liệu đa ngôn ngữ
  media: RoomMedia[]; // Danh sách media
  created_at: string;
  updated_at: string | null;
}

// ============= REQUEST PARAMS =============

/**
 * Query params cho GET /api/v1/vr-hotel/rooms
 */
export interface GetRoomsParams {
  skip?: number; // Offset (default: 0, min: 0)
  limit?: number; // Limit (default: 100, max: 500, min: 1)
  room_type?: string | null; // Filter by room type
  status?: string | null; // Filter by status
}

/**
 * Headers cho API request
 */
export interface RoomRequestHeaders {
  'x-property-id': number; // Required: Property ID
  'Authorization': string; // Required: Bearer token
}

// ============= HELPER TYPES =============

/**
 * Room data đã được xử lý cho UI (với locale cụ thể)
 */
export interface RoomUIData {
  id: number;
  code: string;
  type: string;
  name: string; // Từ translations[locale]
  description: string; // Từ translations[locale]
  price: number;
  capacity: number;
  size: number;
  floor: number | null;
  bedType: string | null;
  status: string;
  amenities: string[];
  vrLink: string | null;
  targetId: string | null;
  panoramaUrl: string | null;
  bookingUrl: string | null;
  primaryImage: string | null; // URL ảnh đại diện (is_primary=true)
  galleryImages: string[]; // URLs ảnh chi tiết (is_primary=false)
  displayOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

/**
 * Validation Error Response (422)
 */
export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface ValidationErrorResponse {
  detail: ValidationError[];
}
