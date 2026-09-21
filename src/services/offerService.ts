/**
 * Offer Service - API calls và data transformation
 */

import api from '../api';
import type { OfferResponse, OfferUIData, GetOffersParams } from '../types/offer';

/**
 * Format discount value for display
 */
function formatDiscount(type: string, value: number): string {
  if (type === 'percentage') {
    return `${value}%`;
  }
  // Fixed amount - format as VND
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Check if offer is expired
 */
function isOfferExpired(validTo: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(validTo);
  return endDate < today;
}

/**
 * Check if offer is upcoming (not started yet)
 */
function isOfferUpcoming(validFrom: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(validFrom);
  return startDate > today;
}

/**
 * Transform offer API response thành UI data
 */
export function transformOfferForUI(
  offer: OfferResponse,
  locale: string
): OfferUIData {
  // Lấy translation theo locale, không fallback
  const translation = offer.translations[locale];

  return {
    id: offer.id,
    code: offer.code,
    status: offer.status,
    
    // Discount info
    discountType: offer.discount_type as 'percentage' | 'fixed',
    discountValue: offer.discount_value,
    discountDisplay: formatDiscount(offer.discount_type, offer.discount_value),
    
    // Date range
    validFrom: offer.valid_from,
    validTo: offer.valid_to,
    isExpired: isOfferExpired(offer.valid_to),
    isUpcoming: isOfferUpcoming(offer.valid_from),
    
    // Conditions
    minNights: offer.min_nights,
    applicableRoomTypes: offer.applicable_room_types,
    
    // Localized
    title: translation?.title || '',
    description: translation?.description || '',
    termsConditions: translation?.terms_conditions || '',
    
    // VR360
    vrLink: offer.vr_link,
    targetId: offer.target_id || null,
    panoramaUrl: offer.panorama_url || null,

    // Meta
    displayOrder: offer.display_order,
    createdAt: offer.created_at,
    updatedAt: offer.updated_at,
  };
}

/**
 * Lấy danh sách offers từ API
 */
export async function getOffers(
  propertyId: number,
  params?: GetOffersParams
): Promise<OfferResponse[]> {
  const response = await api.get<OfferResponse[]>('/vr-hotel/offers', {
    params: {
      skip: params?.skip || 0,
      limit: params?.limit || 100,
      status: params?.status,
    },
    headers: {
      'x-property-id': propertyId,
    },
  });
  
  return response.data;
}

/**
 * Lấy offers với UI data đã transform (sorted by display_order)
 * Chỉ trả về offers có status = 'active', chưa hết hạn, và có translation cho locale
 */
export async function getOffersForUI(
  propertyId: number,
  locale: string,
  params?: GetOffersParams
): Promise<OfferUIData[]> {
  const offers = await getOffers(propertyId, { ...params, status: 'active' });
  
  return offers
    .map(offer => transformOfferForUI(offer, locale))
    .filter(offer => !offer.isExpired && offer.title.trim() !== '') // Filter expired + no translation
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Lấy offer theo code
 */
export async function getOfferByCode(
  propertyId: number,
  code: string,
  locale: string
): Promise<OfferUIData | null> {
  const offers = await getOffers(propertyId, { status: 'active' });
  const offer = offers.find(o => o.code === code);
  
  if (!offer) return null;
  
  return transformOfferForUI(offer, locale);
}

// Export as service object
export const offerService = {
  getOffers,
  getOffersForUI,
  getOfferByCode,
  transformOfferForUI,
};

export default offerService;
