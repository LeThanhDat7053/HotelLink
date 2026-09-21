/**
 * Facility Service - API calls và data transformation
 */

import api from '../api';
import type { FacilityResponse, FacilityUIData, GetFacilitiesParams } from '../types/facility';
import { mediaService } from './mediaService';

/**
 * Transform facility API response thành UI data
 */
export function transformFacilityForUI(
  facility: FacilityResponse,
  locale: string
): FacilityUIData {
  // Lấy translation theo locale, không fallback
  const translation = facility.translations[locale];
  
  // Lấy primary image (is_primary: true)
  const primaryMedia = facility.media.find(m => m.is_primary);
  const primaryImage = primaryMedia 
    ? mediaService.getMediaViewUrl(primaryMedia.media_id)
    : null;
  
  // Lấy gallery images (tất cả media không phải primary, sắp xếp theo sort_order)
  const galleryMediaItems = facility.media
    .filter(m => !m.is_primary)
    .sort((a, b) => a.sort_order - b.sort_order);
  
  const galleryImages = galleryMediaItems.map(m => 
    mediaService.getMediaViewUrl(m.media_id)
  );

  return {
    id: facility.id,
    code: facility.code,
    facility_type: facility.facility_type,
    operatingHours: facility.operating_hours,
    status: facility.status,
    
    // Localized
    name: translation?.name || '',
    description: translation?.description || '',
    
    // Media
    primaryImage,
    galleryImages,
    
    // VR360
    vrLink: facility.vr_link,
    targetId: facility.target_id || null,
    panoramaUrl: facility.panorama_url || null,

    // Meta
    display_order: facility.display_order,
    created_at: facility.created_at,
    updated_at: facility.updated_at,
  };
}

/**
 * Lấy danh sách facilities từ API
 */
export async function getFacilities(
  propertyId: number,
  params?: GetFacilitiesParams
): Promise<FacilityResponse[]> {
  const response = await api.get<FacilityResponse[]>('/vr-hotel/facilities', {
    params: {
      skip: params?.skip || 0,
      limit: params?.limit || 100,
      facility_type: params?.facility_type,
    },
    headers: {
      'x-property-id': propertyId,
    },
  });
  
  return response.data;
}

/**
 * Lấy facility với UI data đã transform (sorted by display_order)
 * Chỉ trả về facilities có translation cho locale hiện tại
 */
export function getFacilitiesForUI(
  propertyId: number,
  locale: string,
  params?: GetFacilitiesParams
): Promise<FacilityUIData[]> {
  return getFacilities(propertyId, params).then(facilities => {
    // Transform từng facility thành UI data
    const uiData = facilities.map(facility => transformFacilityForUI(facility, locale));
    
    // Filter: Chỉ giữ lại items có translation cho locale (name không rỗng)
    const filtered = uiData.filter(item => item.name.trim() !== '');
    
    // Sort theo display_order
    return filtered.sort((a, b) => a.display_order - b.display_order);
  });
}

/**
 * Lấy facility theo code
 */
export function getFacilityByCode(
  propertyId: number,
  code: string,
  locale: string
): Promise<FacilityUIData | null> {
  return getFacilities(propertyId).then(facilities => {
    const facility = facilities.find(f => f.code?.toLowerCase() === code.toLowerCase());
    if (!facility) return null;
    return transformFacilityForUI(facility, locale);
  });
}

export const facilityService = {
  getFacilities,
  getFacilitiesForUI,
  getFacilityByCode,
  transformFacilityForUI,
};
