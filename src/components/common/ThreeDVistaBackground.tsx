import type { MutableRefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getVr360BasePathCandidates } from '../../utils/vr360SceneParser';
import {
  applyLivePose,
  findPoseForScene,
  getTourFromFrame,
  isCurrentScene,
  primeEntryPoses,
  restoreEntryPose,
  waitForCurrentScene,
  waitForPlaylist,
  type ScenePoseEntry,
} from '../../utils/vr360Camera';

interface ThreeDVistaBackgroundProps {
  panoramaName?: string | null;
  onReadyChange?: (ready: boolean) => void;
  showNextPanoButton?: boolean;
  visible?: boolean;
  /** Góc mở đầu admin đã lưu cho từng cảnh */
  scenePoses?: ScenePoseEntry[];
  /** Cho component cha đọc được tour (vd nút Share lấy cảnh đang xem) */
  frameRef?: MutableRefObject<HTMLIFrameElement | null>;
  /**
   * Báo có tìm thấy bộ tour (assets/vr-data/index.htm) trên hosting hay không.
   * false → cha phải dùng nền dự phòng, nếu không màn loading sẽ chờ viewer mãi.
   */
  onAvailabilityChange?: (available: boolean) => void;
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
  scenePoses,
  frameRef,
  onAvailabilityChange,
}: ThreeDVistaBackgroundProps) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hasOpenedSceneRef = useRef<string | null>(null);
  const viewerReadyRef = useRef<boolean>(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const scenePosesRef = useRef<ScenePoseEntry[]>([]);
  const scenePosesKey = useMemo(() => JSON.stringify(scenePoses ?? []), [scenePoses]);
  const appliedPoseKeyRef = useRef<string | null>(null);
  // Góc đã ghi vào tour ở lần áp trước — cảnh nào không còn trong danh sách thì trả về góc gốc
  const primedPosesRef = useRef<ScenePoseEntry[]>([]);

  const onAvailabilityChangeRef = useRef(onAvailabilityChange);
  useEffect(() => {
    onAvailabilityChangeRef.current = onAvailabilityChange;
  }, [onAvailabilityChange]);

  useEffect(() => {
    let active = true;

    const resolveViewerUrl = async () => {
      for (const candidate of VIEWER_HTML_CANDIDATES) {
        try {
          if (await canUseViewerHtml(candidate)) {
            if (active) {
              setViewerUrl(candidate);
              onAvailabilityChangeRef.current?.(true);
            }
            return;
          }
        } catch {
          continue;
        }
      }

      if (active) {
        setViewerUrl(null);
        onAvailabilityChangeRef.current?.(false);
      }
    };

    resolveViewerUrl();

    return () => {
      active = false;
    };
  }, []);

  // Khai báo trước các effect dùng scenePosesRef để luôn đọc được bản mới nhất
  useEffect(() => {
    scenePosesRef.current = scenePoses ?? [];
  }, [scenePoses]);

  useEffect(() => {
    hasOpenedSceneRef.current = null;
    viewerReadyRef.current = false;
    appliedPoseKeyRef.current = null;
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
      setViewerReady(ready);
      syncNextPanoButtonVisibility(iframeRef.current, showNextPanoButton);
      if (!ready || !panoramaName || hasOpenedSceneRef.current === panoramaName) {
        return;
      }

      const iframe = iframeRef.current;
      hasOpenedSceneRef.current = panoramaName;

      // Chờ mainPlayList: tour có rootPlayer trước playlist ~1s; chuyển cảnh trong khoảng đó làm
      // tdvplayer lỗi nội bộ và BỎ QUA lệnh (hay gặp khi vào bằng link chia sẻ ngắn /canh/…).
      const tour = await waitForPlaylist(iframe, 30000);
      if (cancelled) return;

      // Ghi góc đã lưu vào camera TRƯỚC khi chuyển cảnh để engine vào thẳng đúng góc.
      if (tour) {
        primeEntryPoses(tour, scenePosesRef.current);
      }

      // Kiểm tra đã thật sự tới cảnh; chưa tới thì thử lại (chuỗi khởi động của tour có thể ghi đè)
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = getTourFromFrame(iframe);
        if (current && isCurrentScene(current, { name: panoramaName })) return;
        if (!openPanoramaByName(iframe, panoramaName)) break;
        if (await waitForCurrentScene(iframe, { name: panoramaName }, 5000)) return;
        if (cancelled) return;
      }

      // Không tới được (vd tên cảnh không có trong tour) → lần đổi trang sau được thử lại
      if (hasOpenedSceneRef.current === panoramaName) {
        hasOpenedSceneRef.current = null;
      }
    };

    syncScene();

    return () => {
      cancelled = true;
    };
  }, [viewerUrl, panoramaName, onReadyChange, showNextPanoButton]);

  // Áp góc admin đã lưu: ghi vào mọi cảnh (để cả hotspot trong tour cũng vào đúng góc),
  // rồi chỉnh lại cảnh đang đứng — cảnh này có thể đã vào trước khi góc kịp ghi.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!viewerReady || !iframe) {
      return;
    }

    let cancelled = false;
    let cancelLivePose: (() => void) | null = null;

    const applyPoses = async () => {
      const tour = await waitForPlaylist(iframe);
      if (!tour || cancelled) return;

      const poses = scenePosesRef.current;
      primedPosesRef.current
        .filter((previous) => !poses.some((pose) => pose.name === previous.name))
        .forEach((dropped) => restoreEntryPose(tour, dropped));
      primeEntryPoses(tour, poses);
      primedPosesRef.current = poses;

      const pose = panoramaName ? findPoseForScene(poses, { name: panoramaName }) : null;
      if (!pose) return;

      const poseKey = `${panoramaName}|${pose.yaw}|${pose.pitch}`;
      if (appliedPoseKeyRef.current === poseKey) return;

      const arrived = await waitForCurrentScene(iframe, { id: pose.id, name: panoramaName });
      if (!arrived || cancelled) return;

      appliedPoseKeyRef.current = poseKey;
      cancelLivePose = applyLivePose(iframe, pose);
    };

    applyPoses();

    return () => {
      cancelled = true;
      cancelLivePose?.();
    };
  }, [viewerReady, panoramaName, scenePosesKey]);

  const iframeStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
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
      ref={(element) => {
        iframeRef.current = element;
        if (frameRef) {
          frameRef.current = element;
        }
      }}
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
