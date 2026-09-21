/**
 * useIntroduction Hook - Fetch và quản lý state cho VR Hotel Introduction
 * 
 * Cung cấp:
 * - introduction: Data từ API
 * - loading: Trạng thái loading
 * - error: Error nếu có
 * - refetch: Function để fetch lại data
 * - getContentByLocale: Helper để lấy content theo ngôn ngữ
 * 
 * @example
 * const { introduction, loading, error, getContentByLocale } = useIntroduction(10);
 * const viContent = getContentByLocale('vi');
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { introductionService } from '../services/introductionService';
import type { VRHotelIntroductionResponse, IntroductionContent } from '../types/api';
import { browserJsonCache } from '../utils/browserJsonCache';
import { appConfig } from '../config';

const getIntroductionCacheScope = (propertyId: number | null) =>
  `${appConfig.TENANT_CODE || 'default'}:${propertyId ?? appConfig.PROPERTY_ID ?? 'default'}`;

interface UseIntroductionResult {
  introduction: VRHotelIntroductionResponse | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getContentByLocale: (locale: string) => IntroductionContent | null;
}

export const useIntroduction = (propertyId: number | null): UseIntroductionResult => {
  const [introduction, setIntroduction] = useState<VRHotelIntroductionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIntroduction = useCallback(async () => {
    // Skip API call if propertyId is not available yet
    if (!propertyId || propertyId <= 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const cacheKey = `introduction:v2:${getIntroductionCacheScope(propertyId)}`;
      const cached = browserJsonCache.get<VRHotelIntroductionResponse>(cacheKey);
      if (cached) {
        setIntroduction(cached);
        setLoading(false);
      }
      const data = await introductionService.getIntroduction(propertyId);
      setIntroduction(data);
      browserJsonCache.set(cacheKey, data, appConfig.FRONTEND_CACHE_TTL_HOURS * 60 * 60 * 1000);
    } catch (err) {
      console.error('[useIntroduction] Failed to fetch introduction:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch introduction'));
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchIntroduction();
  }, [fetchIntroduction]);

  /**
   * Lấy content theo locale (không fallback - chỉ trả về content cho locale chính xác)
   */
  const getContentByLocale = useCallback((locale: string): IntroductionContent | null => {
    if (!introduction?.content) return null;

    const content = introduction.content;
    
    // Chỉ trả về content nếu có dữ liệu cho locale chính xác
    if (content[locale]?.title || content[locale]?.shortDescription || content[locale]?.detailedContent) {
      return content[locale];
    }
    
    // Không có dữ liệu cho locale này -> trả về null
    return null;
  }, [introduction]);

  return {
    introduction,
    loading,
    error,
    refetch: fetchIntroduction,
    getContentByLocale,
  };
};

/**
 * Hook đơn giản hơn để chỉ lấy content theo một locale
 * 
 * @example
 * const { content, loading, error } = useIntroductionContent(10, 'vi');
 * console.log(content?.title);
 */
export const useIntroductionContent = (propertyId: number | null, locale: string = 'vi') => {
  const { introduction, loading, error, getContentByLocale, refetch } = useIntroduction(propertyId);
  
  const content = useMemo(() => {
    return getContentByLocale(locale);
  }, [getContentByLocale, locale]);

  return {
    content,
    vr360Link: introduction?.vr360Link || null,
    vrTitle: introduction?.vrTitle || null,
    isDisplaying: introduction?.isDisplaying ?? false,
    loading,
    error,
    refetch,
  };
};

export default useIntroduction;
