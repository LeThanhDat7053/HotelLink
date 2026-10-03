import type { CSSProperties, FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
} from '@ant-design/icons';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { getMenuTranslations } from '../../constants/translations';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { ShareSceneButton } from './ShareSceneButton';

type FullscreenCapableElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FullscreenCapableDocument = Document & { webkitExitFullscreen?: () => Promise<void> | void };

/**
 * Phóng to = đưa CẢ TRANG lên toàn màn hình, không phải riêng iframe tour. Nhờ vậy menu,
 * InfoBox và footer (nằm ở document cha) vẫn hiện đầy đủ khi phóng to.
 * Lưu ý: double-click trong tour là cơ chế riêng của 3DVista — nó đưa #viewer BÊN TRONG
 * iframe lên toàn màn hình nên giao diện web bị che; đó là hành vi sẵn có của bản xuất.
 */
const canUseFullscreen = (): boolean => {
  if (typeof document === 'undefined' || !document.fullscreenEnabled) return false;
  const root = document.documentElement as FullscreenCapableElement;
  return typeof root.requestFullscreen === 'function' || typeof root.webkitRequestFullscreen === 'function';
};

interface ViewerControlsProps {
  getCurrentSceneName: () => string | null;
  pageSceneName: string | null;
  /** Link ngắn của trang (/canh/<slug>) nếu admin đã đặt — nút Chia sẻ ưu tiên dùng */
  pageShareUrl: string | null;
  /** Ẩn menu / InfoBox / footer để xem trọn tour */
  isImmersive: boolean;
  onImmersiveChange: (immersive: boolean) => void;
}

export const ViewerControls: FC<ViewerControlsProps> = memo(
  ({ getCurrentSceneName, pageSceneName, pageShareUrl, isImmersive, onImmersiveChange }) => {
    const { screens, isCompactLandscape } = useLayoutMode();
    const { locale } = useLanguage();
    const { primaryColor } = useTheme();
    const t = useMemo(() => getMenuTranslations(locale), [locale]);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [fullscreenSupported] = useState(canUseFullscreen);

    // Esc, nút back của điện thoại, hoặc fullscreen riêng của 3DVista đều đổi trạng thái này
    useEffect(() => {
      const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
      document.addEventListener('fullscreenchange', sync);
      document.addEventListener('webkitfullscreenchange', sync);
      return () => {
        document.removeEventListener('fullscreenchange', sync);
        document.removeEventListener('webkitfullscreenchange', sync);
      };
    }, []);

    const handleFullscreen = useCallback(async () => {
      const doc = document as FullscreenCapableDocument;
      try {
        if (doc.fullscreenElement) {
          await (typeof doc.exitFullscreen === 'function' ? doc.exitFullscreen() : doc.webkitExitFullscreen?.());
          return;
        }
        const root = document.documentElement as FullscreenCapableElement;
        await (typeof root.requestFullscreen === 'function'
          ? root.requestFullscreen()
          : root.webkitRequestFullscreen?.());
      } catch {
        // Trình duyệt từ chối (thường do không phải cử chỉ người dùng) — giữ nguyên màn hình
      }
    }, []);

    const handleToggleInterface = useCallback(() => {
      onImmersiveChange(!isImmersive);
    }, [isImmersive, onImmersiveChange]);

    const size = isCompactLandscape ? 30 : screens.md ? 38 : 34;
    const buttonStyle: CSSProperties = {
      width: size,
      height: size,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.68)',
      backdropFilter: 'blur(2px)',
      WebkitBackdropFilter: 'blur(2px)',
      color: primaryColor,
      border: 'none',
      borderRadius: 12,
      fontSize: isCompactLandscape ? 15 : screens.md ? 18 : 16,
      cursor: 'pointer',
    };

    const interfaceLabel = isImmersive ? t.showInterface : t.hideInterface;

    return (
      <div
        style={{
          position: 'fixed',
          right: screens.md && !isCompactLandscape ? 15 : 10,
          // Dọc (dưới md): BottomBar trải gần hết chiều ngang → đặt cụm nút lên trên nó.
          // Xoay ngang: BottomBar chỉ chiếm nửa trái → cụm nút nằm cùng hàng.
          // Đã ẩn giao diện: không còn BottomBar → sát đáy.
          bottom: isCompactLandscape || isImmersive ? 8 : screens.md ? 15 : 52,
          zIndex: 2001,
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={handleToggleInterface}
          aria-label={interfaceLabel}
          title={interfaceLabel}
          aria-pressed={isImmersive}
          style={buttonStyle}
        >
          {isImmersive ? <EyeInvisibleOutlined /> : <EyeOutlined />}
        </button>

        {fullscreenSupported && (
          <button
            type="button"
            onClick={handleFullscreen}
            aria-label={t.viewFullscreen}
            title={t.viewFullscreen}
            aria-pressed={isFullscreen}
            style={buttonStyle}
          >
            {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          </button>
        )}

        <ShareSceneButton
          getCurrentSceneName={getCurrentSceneName}
          pageSceneName={pageSceneName}
          pageShareUrl={pageShareUrl}
          style={buttonStyle}
        />
      </div>
    );
  },
);

ViewerControls.displayName = 'ViewerControls';
