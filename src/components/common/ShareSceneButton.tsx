import type { CSSProperties, FC } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { message } from 'antd';
import { ShareAltOutlined } from '@ant-design/icons';
import { useLanguage } from '../../context/LanguageContext';
import { getMenuTranslations } from '../../constants/translations';
import { useLayoutMode } from '../../hooks/useLayoutMode';

interface ShareSceneButtonProps {
  /** Cảnh khách đang đứng trong tour (có thể đã đi sang cảnh khác bằng hotspot) */
  getCurrentSceneName: () => string | null;
  /** Cảnh mặc định của trang hiện tại (không cần ghi vào link) */
  pageSceneName: string | null;
  /**
   * Link ngắn của trang (https://<domain>/canh/<slug>) — ảnh preview là ảnh chụp từ góc mở trang
   * và mở ra đúng góc đó. Chỉ dùng khi khách vẫn đang ở cảnh của trang.
   */
  pageShareUrl: string | null;
  /** Kiểu nút — do ViewerControls quyết định để các nút trong cụm giống nhau */
  style: CSSProperties;
}

/**
 * Link share chỉ ghi CẢNH, không ghi góc: góc luôn lấy từ góc admin lưu mới nhất,
 * nên admin đổi góc thì link đã share trước đó cũng mở ra góc mới.
 */
const buildShareUrl = (currentSceneName: string | null, pageSceneName: string | null): string => {
  const url = new URL(window.location.href);
  url.hash = '';

  if (url.searchParams.get('viewer') === 'vr360') {
    // Trang xem tour độc lập: cảnh luôn nằm trên link
    if (currentSceneName) url.searchParams.set('scene', currentSceneName);
  } else if (currentSceneName && currentSceneName !== pageSceneName) {
    url.searchParams.set('scene', currentSceneName);
  } else {
    url.searchParams.delete('scene');
  }

  return url.toString();
};

export const ShareSceneButton: FC<ShareSceneButtonProps> = memo(({ getCurrentSceneName, pageSceneName, pageShareUrl, style }) => {
  const { screens, isCompactLandscape } = useLayoutMode();
  const { locale } = useLanguage();
  const t = useMemo(() => getMenuTranslations(locale), [locale]);

  const handleShare = useCallback(async () => {
    const currentSceneName = getCurrentSceneName() || pageSceneName;
    const onPageScene = !currentSceneName || currentSceneName === pageSceneName;
    const shareUrl = pageShareUrl && onPageScene ? pageShareUrl : buildShareUrl(currentSceneName, pageSceneName);

    // Điện thoại: bảng chia sẻ của hệ điều hành (Zalo, Messenger…)
    if (typeof navigator.share === 'function' && (!screens.md || isCompactLandscape)) {
      try {
        await navigator.share({ title: document.title, url: shareUrl });
        return;
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      message.success(t.linkCopied);
    } catch {
      window.prompt(t.share, shareUrl);
    }
  }, [getCurrentSceneName, isCompactLandscape, pageSceneName, pageShareUrl, screens.md, t.linkCopied, t.share]);

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={t.share}
      title={t.share}
      style={style}
    >
      <ShareAltOutlined />
    </button>
  );
});

ShareSceneButton.displayName = 'ShareSceneButton';
