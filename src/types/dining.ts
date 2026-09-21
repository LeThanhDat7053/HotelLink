/**
 * Dining Types - API Response và UI Data
 */

// ===== API RESPONSE TYPES =====

export interface DiningTranslations {
  locale: string;
  name: string;
  description: string;
}

export interface DiningMedia {
  media_id: number;
  is_vr360: boolean;
  is_primary: boolean;
  sort_order: number;
}

export interface DiningResponse {
  id: number;
  tenant_id: number;
  property_id: number;
  code: string;
  dining_type: string;
  vr_link: string | null;
  target_id: string | null;
  panorama_url: string | null;
  booking_url: string | null;
  operating_hours: string | null;
  status: string;
  display_order: number;
  translations: Record<string, DiningTranslations>;
  media: DiningMedia[];
  created_at: string;
  updated_at: string | null;
}

// ===== UI DATA TYPES =====

export interface DiningUIData {
  id: number;
  code: string;
  dining_type: string;
  status: string;
  
  // Localized fields
  name: string;
  description: string;
  
  // Operating hours
  operatingHours: string | null;
  
  // Media
  primaryImage: string | null; // URL from media service
  galleryImages: string[]; // URLs from media service
  
  // VR360
  vrLink: string | null;
  targetId: string | null;
  panoramaUrl: string | null;

  // Booking
  bookingUrl: string | null;
  
  // Meta
  display_order: number;
  created_at: string;
  updated_at: string | null;
}

// ===== API PARAMS =====

export interface GetDiningsParams {
  skip?: number;
  limit?: number;
  dining_type?: string;
}
