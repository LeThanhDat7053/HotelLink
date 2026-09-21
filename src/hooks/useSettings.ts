import { useState, useEffect, useCallback } from 'react';
import { settingsService } from '../services/settingsService';
import { appConfig } from '../config';
import type { VRHotelSettingsResponse } from '../types/settings';
import { browserJsonCache } from '../utils/browserJsonCache';

const CACHE_DURATION = appConfig.FRONTEND_CACHE_TTL_HOURS * 60 * 60 * 1000;
const SETTINGS_CACHE_SCOPE = `${appConfig.TENANT_CODE || 'default'}:${appConfig.PROPERTY_ID || 'default'}`;

const imageUrlToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

interface UseSettingsReturn {
  settings: VRHotelSettingsResponse | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useSettings = (): UseSettingsReturn => {
  const [settings, setSettings] = useState<VRHotelSettingsResponse | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const cacheKey = `vr_hotel_settings:v2:${SETTINGS_CACHE_SCOPE}`;

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const cachedPayload = browserJsonCache.get<{
        settings: VRHotelSettingsResponse;
        logoUrl: string | null;
        faviconUrl: string | null;
      }>(cacheKey);

      if (cachedPayload) {
        setSettings(cachedPayload.settings);
        setLogoUrl(cachedPayload.logoUrl);
        setFaviconUrl(cachedPayload.faviconUrl);
      }

      const settingsData = await settingsService.getVRHotelSettings(appConfig.PROPERTY_ID);
      setSettings(settingsData);

      let resolvedLogoUrl: string | null = null;
      if (settingsData.logo_media_id) {
        resolvedLogoUrl = await settingsService.getLogoUrl(settingsData.logo_media_id);
        if (resolvedLogoUrl) {
          try {
            resolvedLogoUrl = await imageUrlToBase64(resolvedLogoUrl);
          } catch {
            // Keep direct URL fallback.
          }
        }
        setLogoUrl(resolvedLogoUrl);
      } else {
        setLogoUrl(null);
      }

      let resolvedFaviconUrl: string | null = null;
      if (settingsData.favicon_media_id) {
        resolvedFaviconUrl = await settingsService.getLogoUrl(settingsData.favicon_media_id);
        if (resolvedFaviconUrl) {
          try {
            resolvedFaviconUrl = await imageUrlToBase64(resolvedFaviconUrl);
          } catch {
            // Keep direct URL fallback.
          }
        }
        setFaviconUrl(resolvedFaviconUrl);
      } else {
        setFaviconUrl(null);
      }

      browserJsonCache.set(
        cacheKey,
        {
          settings: settingsData,
          logoUrl: resolvedLogoUrl,
          faviconUrl: resolvedFaviconUrl,
        },
        CACHE_DURATION,
      );
    } catch (err) {
      console.error('Failed to fetch VR Hotel settings:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    logoUrl,
    faviconUrl,
    loading,
    error,
    refetch: fetchSettings,
  };
};

export const useLogo = () => {
  const cacheKey = `vr_hotel_logo_url:v2:${SETTINGS_CACHE_SCOPE}`;
  const [logoUrl, setLogoUrl] = useState<string | null>(() => browserJsonCache.get<string>(cacheKey));
  const [loading, setLoading] = useState(!logoUrl);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        setLoading(true);

        const { logoUrl: resolvedLogoUrl } = await settingsService.getSettingsWithLogoUrl();
        if (resolvedLogoUrl) {
          setLogoUrl(resolvedLogoUrl);
          browserJsonCache.set(cacheKey, resolvedLogoUrl, CACHE_DURATION);
        }
      } catch (err) {
        console.error('[useLogo] Failed to fetch logo:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogo();
  }, [cacheKey, logoUrl]);

  return { logoUrl, loading };
};
