/**
 * Policy Hook - React hook cho policy data fetching
 */

import { useState, useEffect } from 'react';
import { policyService } from '../services/policyService';
import type { PolicyUIData } from '../types/policy';
import { appConfig } from '../config';
import { browserJsonCache } from '../utils/browserJsonCache';

const getPolicyCacheScope = (propertyId: number, locale: string, tenantCode: string) =>
  `${tenantCode || appConfig.TENANT_CODE || 'default'}:${propertyId}:${locale}`;

interface UsePolicyResult {
  content: PolicyUIData | null;
  vr360Link: string | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook để fetch policy data
 */
export function usePolicy(
  propertyId: number,
  locale: string,
  tenantCode: string = appConfig.TENANT_CODE || appConfig.TENANT_ID || ''
): UsePolicyResult {
  const [content, setContent] = useState<PolicyUIData | null>(null);
  const [vr360Link, setVr360Link] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchPolicy = async () => {
      if (!propertyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const cacheKey = `policy:v2:${getPolicyCacheScope(propertyId, locale, tenantCode)}`;
        const cached = browserJsonCache.get<PolicyUIData>(cacheKey);
        if (cached) {
          setContent(cached);
          setVr360Link(cached.vr360Link);
          setLoading(false);
        }
        
        const data = await policyService.getPolicyForUI(propertyId, locale, tenantCode);
        
        if (isMounted) {
          setContent(data);
          setVr360Link(data.vr360Link);
          browserJsonCache.set(cacheKey, data, appConfig.FRONTEND_CACHE_TTL_HOURS * 60 * 60 * 1000);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Lỗi khi tải chính sách'));
          console.error('Error fetching policy:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPolicy();

    return () => {
      isMounted = false;
    };
  }, [propertyId, locale, tenantCode]);

  return { content, vr360Link, loading, error };
}
