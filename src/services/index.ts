/**
 * Central export for all API services
 * 
 * Usage:
 *   import { propertyService, featureService, postService } from '@/services';
 */

export { propertyService } from './propertyService';
export { featureService } from './featureService';
export { postService } from './postService';
export { mediaService } from './mediaService';
export { analyticsService } from './analyticsService';
export { default as vr360Service } from './vr360Service';
export { introductionService } from './introductionService';
export { localeService } from './localeService';
export { default as userService } from './userService';
export { propertyPostService } from './propertyPostService';
export { roomService } from './roomService';
export { diningService } from './diningService';
export { facilityService } from './facilityService';
export { serviceService } from './serviceService';
export { policyService } from './policyService';
export { regulationService } from './regulationService';
export { contactService } from './contactService';
export { offerService } from './offerService';
export { settingsService } from './settingsService';
export { vr360SceneSyncService } from './vr360SceneSyncService';

// Re-export api instance for direct use if needed
export { default as api } from '../api';
