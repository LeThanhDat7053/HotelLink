/**
 * Theme Context
 * Quản lý theme colors từ API (primary_color từ vr-hotel/settings)
 * Cung cấp colors cho toàn bộ app
 */

import { createContext, useContext, type ReactNode } from 'react';
import { usePropertyContext } from './PropertyContext';
import { useVrHotelSettings } from '../hooks/useVR360';
import { mediaService } from '../services/mediaService';
import type { SEOData } from '../types/settings';

interface ThemeContextType {
  primaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  seo: SEOData | null;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { property } = usePropertyContext();
  const { settings, loading } = useVrHotelSettings(property?.id || null);

  const value: ThemeContextType = {
    primaryColor: settings?.primary_color || '#ecc56d', // Lấy từ VR Hotel Settings API
    logoUrl: settings?.logo_media_id ? mediaService.getMediaViewUrl(settings.logo_media_id) : null,
    faviconUrl: settings?.favicon_media_id ? mediaService.getMediaViewUrl(settings.favicon_media_id) : null,
    seo: settings?.seo || null,
    loading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook để lấy theme colors, logo, favicon và SEO data từ API
 * @returns { primaryColor, logoUrl, faviconUrl, seo }
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
