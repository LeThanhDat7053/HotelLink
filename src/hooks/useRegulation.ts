/**
 * Regulation Hook - React hook cho regulation data fetching
 */

import { useState, useEffect } from 'react';
import { regulationService } from '../services/regulationService';
import type { RegulationUIData } from '../types/regulation';
import { appConfig } from '../config';
import { browserJsonCache } from '../utils/browserJsonCache';

const getRegulationCacheScope = (propertyId: number, locale: string, tenantCode: string) =>
  `${tenantCode || appConfig.TENANT_CODE || 'default'}:${propertyId}:${locale}`;

interface UseRegulationResult {
  content: RegulationUIData | null;
  vr360Link: string | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook để fetch regulation data
 */
export function useRegulation(
  propertyId: number,
  locale: string,
  tenantCode: string = appConfig.TENANT_CODE || appConfig.TENANT_ID || ''
): UseRegulationResult {
  const [content, setContent] = useState<RegulationUIData | null>(null);
  const [vr360Link, setVr360Link] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchRegulation = async () => {
      if (!propertyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const cacheKey = `regulation:v2:${getRegulationCacheScope(propertyId, locale, tenantCode)}`;
        const cached = browserJsonCache.get<RegulationUIData>(cacheKey);
        if (cached) {
          setContent(cached);
          setVr360Link(cached.vr360Link);
          setLoading(false);
        }
        
        const data = await regulationService.getRegulationForUI(propertyId, locale, tenantCode);
        
        if (isMounted) {
          setContent(data);
          setVr360Link(data.vr360Link);
          browserJsonCache.set(cacheKey, data, appConfig.FRONTEND_CACHE_TTL_HOURS * 60 * 60 * 1000);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Lỗi khi tải nội quy'));
          console.error('Error fetching regulation:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRegulation();

    return () => {
      isMounted = false;
    };
  }, [propertyId, locale, tenantCode]);

  return { content, vr360Link, loading, error };
}
