/**
 * Facility Types - API Response và UI Data
 */

// ===== API RESPONSE TYPES =====

export interface FacilityTranslations {
  locale: string;
  name: string;
  description: string | null;
}

export interface FacilityMedia {
  media_id: number;
  is_vr360: boolean;
  is_primary: boolean;
  sort_order: number;
}

export interface FacilityResponse {
  id: number;
  tenant_id: number;
  property_id: number;
  code: string;
  facility_type: string;
  operating_hours: string | null;
  vr_link: string | null;
  target_id: string | null;
  panorama_url: string | null;
  status: string;
  display_order: number;
  translations: Record<string, FacilityTranslations>;
  media: FacilityMedia[];
  created_at: string;
  updated_at: string | null;
}

// ===== UI DATA TYPES =====

export interface FacilityUIData {
  id: number;
  code: string;
  facility_type: string;
  operatingHours: string | null;
  status: string;
  
  // Localized fields
  name: string;
  description: string;
  
  // Media
  primaryImage: string | null; // URL from media service
  galleryImages: string[]; // URLs from media service
  
  // VR360
  vrLink: string | null;
  targetId: string | null;
  panoramaUrl: string | null;

  // Meta
  display_order: number;
  created_at: string;
  updated_at: string | null;
}

// ===== API PARAMS =====

export interface GetFacilitiesParams {
  skip?: number;
  limit?: number;
  facility_type?: string;
}
