import { useEffect, useMemo, useRef, useState } from 'react';
import { getVr360BasePathCandidates } from '../../utils/vr360SceneParser';

interface ThreeDVistaBackgroundProps {
  panoramaName?: string | null;
  onReadyChange?: (ready: boolean) => void;
  showNextPanoButton?: boolean;
  visible?: boolean;
}

const VIEWER_MARKERS = ['3dvista', 'script_general.js', 'script.js', 'tdvplayer.js', 'tour'];
const VIEWER_HTML_CANDIDATES = getVr360BasePathCandidates().map((basePath) => `${basePath}/index.htm`);

const canUseViewerHtml = async (viewerUrl: string): Promise<boolean> => {
  const response = await fetch(viewerUrl, { cache: 'no-store' });
  if (!response.ok) {
    return false;
  }

  const html = await response.text();
  const lower = html.toLowerCase();

  if (lower.includes('<div id="root"') || lower.includes('/@vite/client')) {
    return false;
  }

  return VIEWER_MARKERS.some((marker) => lower.includes(marker));
};

const isViewerReady = (iframe: HTMLIFrameElement): boolean => {
  const iframeWindow = iframe.contentWindow as
    | (Window & {
        tour?: {
          player?: { getById?: (id: string) => unknown };
        };
      })
    | null;
  const tour = iframeWindow?.tour;
  return !!(tour && tour.player?.getById?.('rootPlayer'));
};

const waitForViewerReady = async (iframe: HTMLIFrameElement): Promise<boolean> => {
  const deadline = Date.now() + 12000;

  while (Date.now() < deadline) {
    const iframeWindow = iframe.contentWindow as
      | (Window & {
          tour?: {
            setMediaByName?: (sceneName: string) => void;
            player?: {
              getById?: (id: string) => unknown;
            };
          };
          openPanoramaByName?: (sceneName: string) => void;
        })
      | null;

    const tour = iframeWindow?.tour;
    const rootPlayer = tour?.player?.getById?.('rootPlayer');
    if (tour && rootPlayer) {
      return true;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 200));
  }

  return false;
};

const openPanoramaByName = (iframe: HTMLIFrameElement, panoramaName: string): boolean => {
  const iframeWindow = iframe.contentWindow as
    | (Window & {
        setMediaByName?: (sceneName: string) => void;
        tour?: {
          setMediaByName?: (sceneName: string) => void;
          player?: {
            getById?: (id: string) => unknown;
          };
        };
        openPanoramaByName?: (sceneName: string) => void;
      })
    | null;

  if (!iframeWindow) {
    return false;
  }

  if (typeof iframeWindow.openPanoramaByName === "function") {
    iframeWindow.openPanoramaByName(panoramaName);
    return true;
  }

  if (typeof iframeWindow.setMediaByName === 'function') {
    iframeWindow.setMediaByName(panoramaName);
    return true;
  }

  if (typeof iframeWindow.tour?.setMediaByName === 'function') {
    iframeWindow.tour.setMediaByName(panoramaName);
    return true;
  }

  return false;
};

const syncNextPanoButtonVisibility = (
  iframe: HTMLIFrameElement | null,
  showNextPanoButton: boolean,
) => {
  const iframeWindow = iframe?.contentWindow;
  const iframeDocument = iframeWindow?.document;
  const nextButton = iframeDocument?.getElementById('openNextPanoButton') as HTMLElement | null;

  if (nextButton) {
    nextButton.style.display = showNextPanoButton ? 'block' : 'none';
  }
};

export const ThreeDVistaBackground = ({
  panoramaName,
  onReadyChange,
  showNextPanoButton = false,
  visible = true,
}: ThreeDVistaBackgroundProps) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hasOpenedSceneRef = useRef<string | null>(null);
  const viewerReadyRef = useRef<boolean>(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const resolveViewerUrl = async () => {
      for (const candidate of VIEWER_HTML_CANDIDATES) {
        try {
          if (await canUseViewerHtml(candidate)) {
            if (active) {
              setViewerUrl(candidate);
            }
            return;
          }
        } catch {
          continue;
        }
      }

      if (active) {
        setViewerUrl(null);
      }
    };

    resolveViewerUrl();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    hasOpenedSceneRef.current = null;
    viewerReadyRef.current = false;
  }, [viewerUrl]);

  useEffect(() => {
    syncNextPanoButtonVisibility(iframeRef.current, showNextPanoButton);
  }, [showNextPanoButton, viewerUrl, panoramaName]);

  useEffect(() => {
    let cancelled = false;

    const syncScene = async () => {
      if (!viewerUrl || !iframeRef.current) {
        onReadyChange?.(false);
        return;
      }

      // Nếu viewer đã ready từ trước, kiểm tra nhanh trước khi wait
      if (!viewerReadyRef.current && iframeRef.current) {
        viewerReadyRef.current = isViewerReady(iframeRef.current);
      }

      let ready = viewerReadyRef.current;
      if (!ready) {
        ready = await waitForViewerReady(iframeRef.current);
        if (cancelled) return;
        viewerReadyRef.current = ready;
      }

      onReadyChange?.(ready);
      syncNextPanoButtonVisibility(iframeRef.current, showNextPanoButton);
      if (!ready || !panoramaName || hasOpenedSceneRef.current === panoramaName) {
        return;
      }

      if (openPanoramaByName(iframeRef.current, panoramaName)) {
        hasOpenedSceneRef.current = panoramaName;
      }
    };

    syncScene();

    return () => {
      cancelled = true;
    };
  }, [viewerUrl, panoramaName, onReadyChange, showNextPanoButton]);

  const iframeStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      border: 0,
      zIndex: 0,
      display: visible ? 'block' : 'none',
    }),
    [visible],
  );

  if (!viewerUrl) {
    return null;
  }

  return (
    <iframe
      ref={iframeRef}
      key={viewerUrl}
      src={viewerUrl}
      style={iframeStyle}
      title="3DVista Local Viewer"
      allowFullScreen
      onLoad={() => {
        syncNextPanoButtonVisibility(iframeRef.current, showNextPanoButton);
      }}
    />
  );
};

export default ThreeDVistaBackground;
