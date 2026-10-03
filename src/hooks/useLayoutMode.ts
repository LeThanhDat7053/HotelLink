import { useSyncExternalStore } from 'react';
import { Grid } from 'antd';

const { useBreakpoint } = Grid;

/**
 * Điện thoại xoay ngang: rộng 740–930px (vượt mốc md 768px của antd nên bị coi là desktop)
 * nhưng chỉ cao 340–430px. Máy tính gần như không bao giờ có cửa sổ thấp hơn 500px.
 */
const COMPACT_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 500px)';

const subscribeViewport = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
  };
};

const getIsCompactLandscape = () =>
  typeof window !== 'undefined' && window.matchMedia(COMPACT_LANDSCAPE_QUERY).matches;

// innerHeight = vùng nhìn thấy thật (đã trừ thanh địa chỉ), khác 100vh trên Chrome/Samsung Internet
const getViewportHeight = () => (typeof window !== 'undefined' ? window.innerHeight : 800);

export const useLayoutMode = () => {
  const screens = useBreakpoint();
  const isCompactLandscape = useSyncExternalStore(subscribeViewport, getIsCompactLandscape, () => false);
  const viewportHeight = useSyncExternalStore(subscribeViewport, getViewportHeight, () => 800);

  return {
    screens,
    /** Bố cục desktop: menu tự mở, InfoBox đi cùng menu. Điện thoại xoay ngang KHÔNG tính. */
    isDesktop: Boolean(screens.md) && !isCompactLandscape,
    isCompactLandscape,
    viewportHeight,
  };
};
