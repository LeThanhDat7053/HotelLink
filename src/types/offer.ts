/**
 * Offer Types - API Response và UI Data
 */

// ===== API RESPONSE TYPES =====

export interface OfferTranslations {
  locale: string;
  title: string;
  description: string;
  terms_conditions: string;
}

export interface OfferResponse {
  id: number;
  tenant_id: number;
  property_id: number;
  code: string;
  discount_type: string; // 'percentage' | 'fixed'
  discount_value: number;
  valid_from: string; // ISO date string
  valid_to: string; // ISO date string
  min_nights: number;
  applicable_room_types: string[];
  status: string; // 'active' | 'inactive'
  vr_link: string | null;
  target_id: string | null;
  panorama_url: string | null;
  display_order: number;
  translations: Record<string, OfferTranslations>;
  created_at: string;
  updated_at: string | null;
}

// ===== UI DATA TYPES =====

export interface OfferUIData {
  id: number;
  code: string;
  status: string;
  
  // Discount info
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountDisplay: string; // Formatted: "99%" or "500,000 VND"
  
  // Date range
  validFrom: string;
  validTo: string;
  isExpired: boolean;
  isUpcoming: boolean;
  
  // Conditions
  minNights: number;
  applicableRoomTypes: string[];
  
  // Localized fields
  title: string;
  description: string;
  termsConditions: string;
  
  // VR360
  vrLink: string | null;
  targetId: string | null;
  panoramaUrl: string | null;

  // Meta
  displayOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

// ===== API PARAMS =====

export interface GetOffersParams {
  skip?: number;
  limit?: number;
  status?: string;
}
