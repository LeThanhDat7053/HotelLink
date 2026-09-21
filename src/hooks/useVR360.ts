/**
 * VR360 Hooks - React hooks để quản lý VR360 data
 * 
 * Custom hooks này cung cấp:
 * - Loading/Error states
 * - Automatic refetching
 * - Cache management
 * - Easy-to-use interface cho components
 */

import { useState, useEffect, useCallback } from 'react';
import vr360Service from '../services/vr360Service';
import { settingsService } from '../services/settingsService';
import { appConfig } from '../config';
import type {
  VR360Link,
  VR360ListParams,
  VR360CategoryType,
} from '../types/api';
import type { VRHotelSettingsResponse } from '../types/settings';
import { browserJsonCache } from '../utils/browserJsonCache';

// ===== HOOK TYPES =====
interface UseVR360LinksResult {
  links: VR360Link[];
  loading: boolean;
  error: Error | null;
  total: number;
  hasMore: boolean;
  refetch: () => Promise<void>;
}

interface UseVR360DetailResult {
  link: VR360Link | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook để lấy danh sách VR360 links với filters
 * 
 * @example
 * // Component sử dụng
 * function RoomVRLinks({ roomId }) {
 *   const { links, loading, error, refetch } = useVR360Links({ roomId });
 * 
 *   if (loading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 * 
 *   return (
 *     <div>
 *       {links.map(link => (
 *         <VR360Viewer key={link.id} link={link} />
 *       ))}
 *     </div>
 *   );
 * }
 */
export const useVR360Links = (
  params?: VR360ListParams
): UseVR360LinksResult => {
  const [links, setLinks] = useState<VR360Link[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await vr360Service.getVR360Links(params);
      
      setLinks(response.data);
      setTotal(response.total);
      setHasMore(response.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch VR360 links'));
      console.error('Error fetching VR360 links:', err);
    } finally {
      setLoading(false);
    }
  }, [params?.category, params?.roomId, params?.facilityId, params?.isActive, params?.page, params?.limit]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  return {
    links,
    loading,
    error,
    total,
    hasMore,
    refetch: fetchLinks,
  };
};

/**
 * Hook để lấy VR360 links theo category
 * 
 * @example
 * function LobbyVRTour() {
 *   const { links, loading, error } = useVR360ByCategory('LOBBY');
 * 
 *   if (loading) return <Spinner />;
 *   if (error) return <Error />;
 * 
 *   return <VR360Gallery links={links} />;
 * }
 */
export const useVR360ByCategory = (
  category: VR360CategoryType
): UseVR360LinksResult => {
  const [links, setLinks] = useState<VR360Link[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await vr360Service.getVR360ByCategory(category);
      setLinks(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch VR360 links'));
      console.error('Error fetching VR360 by category:', err);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  return {
    links,
    loading,
    error,
    total: links.length,
    hasMore: false,
    refetch: fetchLinks,
  };
};

/**
 * Hook để lấy VR360 links của một room
 * 
 * @example
 * function RoomDetail({ roomId }) {
 *   const { links, loading } = useVR360ByRoom(roomId);
 * 
 *   return (
 *     <div>
 *       <h2>Room Virtual Tour</h2>
 *       {loading ? <Spinner /> : <VR360Carousel links={links} />}
 *     </div>
 *   );
 * }
 */
export const useVR360ByRoom = (roomId: string): UseVR360LinksResult => {
  const [links, setLinks] = useState<VR360Link[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLinks = useCallback(async () => {
    if (!roomId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const data = await vr360Service.getVR360ByRoom(roomId);
      setLinks(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch room VR360 links'));
      console.error('Error fetching VR360 by room:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  return {
    links,
    loading,
    error,
    total: links.length,
    hasMore: false,
    refetch: fetchLinks,
  };
};

/**
 * Hook để lấy VR360 links của một facility
 * 
 * @example
 * function PoolArea({ facilityId }) {
 *   const { links, loading } = useVR360ByFacility(facilityId);
 * 
 *   return (
 *     <VR360Modal 
 *       links={links}
 *       loading={loading}
 *     />
 *   );
 * }
 */
export const useVR360ByFacility = (facilityId: string): UseVR360LinksResult => {
  const [links, setLinks] = useState<VR360Link[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLinks = useCallback(async () => {
    if (!facilityId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const data = await vr360Service.getVR360ByFacility(facilityId);
      setLinks(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch facility VR360 links'));
      console.error('Error fetching VR360 by facility:', err);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  return {
    links,
    loading,
    error,
    total: links.length,
    hasMore: false,
    refetch: fetchLinks,
  };
};

/**
 * Hook để lấy chi tiết một VR360 link
 * 
 * @example
 * function VR360DetailPage({ id }) {
 *   const { link, loading, error } = useVR360Detail(id);
 * 
 *   if (loading) return <Spinner />;
 *   if (error) return <Error />;
 *   if (!link) return <NotFound />;
 * 
 *   return <VR360FullScreen link={link} />;
 * }
 */
export const useVR360Detail = (id: string): UseVR360DetailResult => {
  const [link, setLink] = useState<VR360Link | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const data = await vr360Service.getVR360Detail(id);
      setLink(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch VR360 detail'));
      console.error('Error fetching VR360 detail:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    link,
    loading,
    error,
    refetch: fetchDetail,
  };
};

/**
 * Hook để lấy VR Hotel Settings cho property
 * 
 * @param propertyId - ID của property
 * @returns { settings, loading, error, refetch }
 * 
 * OPTIMIZED: Thêm caching để không fetch lại mỗi lần navigate
 * 
 * @example
 * function RoomBackground({ propertyId }) {
 *   const { settings, loading, error } = useVrHotelSettings(propertyId);
 * 
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 * 
 *   const vr360Link = settings?.pages.rooms.vr360_link;
 *   return <VR360Viewer url={vr360Link} />;
 * }
 */

// Cache cho VR Hotel Settings - persist across component unmounts
const vrHotelSettingsCache = new Map<string, { data: VRHotelSettingsResponse; timestamp: number }>();
const CACHE_DURATION = appConfig.FRONTEND_CACHE_TTL_HOURS * 60 * 60 * 1000;

const getVrHotelSettingsCacheScope = (propertyId: number | null) =>
  `${appConfig.TENANT_CODE || 'default'}:${propertyId ?? appConfig.PROPERTY_ID ?? 'default'}`;

export const useVrHotelSettings = (propertyId: number | null) => {
  const cacheScope = getVrHotelSettingsCacheScope(propertyId);
  const [settings, setSettings] = useState<VRHotelSettingsResponse | null>(() => {
    // Initialize từ cache nếu có
    if (propertyId) {
      const cached = vrHotelSettingsCache.get(cacheScope);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!propertyId) {
      return;
    }

    const cacheKey = `vr_hotel_settings_hook:v2:${cacheScope}`;

    // Check cache first
    const cached = vrHotelSettingsCache.get(cacheScope);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setSettings(cached.data);
      setLoading(false);
    }

    const cachedJson = browserJsonCache.get<VRHotelSettingsResponse>(cacheKey);
    if (cachedJson) {
      setSettings(cachedJson);
      vrHotelSettingsCache.set(cacheScope, { data: cachedJson, timestamp: Date.now() });
      setLoading(false);
    }

    setLoading(true);
    setError(null);
    try {
      const data = await settingsService.getVRHotelSettings(propertyId);
      setSettings(data);
      
      // Cache kết quả
      vrHotelSettingsCache.set(cacheScope, { data, timestamp: Date.now() });
      browserJsonCache.set(cacheKey, data, CACHE_DURATION);
    } catch (err) {
      console.error('[useVrHotelSettings] Error:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [cacheScope, propertyId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
  };
};
