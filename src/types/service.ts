/**
 * Service Types - API Response và UI Data
 */

// ===== API RESPONSE TYPES =====

export interface ServiceTranslations {
  locale: string;
  name: string;
  description: string | null;
}

export interface ServiceMedia {
  media_id: number;
  is_vr360: boolean;
  is_primary: boolean;
  sort_order: number;
}

export interface ServiceResponse {
  id: number;
  tenant_id: number;
  property_id: number;
  code: string;
  service_type: string;
  availability: string | null;
  price_info: string | null;
  vr_link: string | null;
  target_id: string | null;
  panorama_url: string | null;
  booking_url: string | null;
  status: string;
  display_order: number;
  translations: Record<string, ServiceTranslations>;
  media: ServiceMedia[];
  created_at: string;
  updated_at: string | null;
}

// ===== UI DATA TYPES =====

export interface ServiceUIData {
  id: number;
  code: string;
  service_type: string;
  status: string;
  
  // Localized fields
  name: string;
  description: string;
  
  // Service info
  availability: string | null;
  priceInfo: string | null;
  
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

export interface GetServicesParams {
  skip?: number;
  limit?: number;
  service_type?: string;
}
