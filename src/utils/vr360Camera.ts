/**
 * Điều khiển góc nhìn (camera) của tour 3DVista chạy trong iframe cùng origin.
 *
 * Các bẫy đã đo được trên engine 3DVista (xem Module-Cai-Dat-Canh-VR360.md §11, §13):
 * - player.set('yaw'|'pitch') là "thuộc tính ma": get() trả lại đúng số vừa ghi trong khi
 *   camera thật chưa chắc đã quay. Cách đặt góc chắc chắn là ghi vào `initialPosition` của
 *   camera TRƯỚC khi engine vào cảnh.
 * - Nhiều cảnh có animation mở đầu (initialSequence / enterPointingToHorizon) ghi đè mọi
 *   lệnh đặt góc trong lúc chạy → phải tắt khi cảnh có góc đã lưu.
 * - Desktop và mobile là 2 bộ skin với 2 PanoramaPlayer khác id → tìm theo class, không
 *   ghi cứng id.
 * - window.tour có trước mainPlayList (~1s) → phải chờ playlist có items.
 * - Zoom thật là `hfov`, không phải `fov`.
 */

export interface ScenePose {
  yaw: number;
  pitch: number;
}

export interface SceneViewState extends ScenePose {
  hfov: number | null;
}

/** Cảnh cần áp góc: khớp theo id panorama trước, rồi tới nhãn (tên cảnh). */
export interface SceneRef {
  id?: string | null;
  name?: string | null;
}

export interface ScenePoseEntry extends SceneRef, ScenePose {}

interface TdvObject {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
}

interface TdvPlayer {
  getById?: (id: string) => TdvObject | null | undefined;
  getByClassName?: (className: string) => TdvObject[] | null | undefined;
}

interface TdvTour {
  player?: TdvPlayer;
  setMediaByIndex?: (index: number) => void;
  setMediaByName?: (name: string) => void;
}

type TourWindow = Window & { tour?: TdvTour };

const PANORAMA_PLAYER_FALLBACK_IDS = ['MainViewerPanoramaPlayer', 'MainViewer_mobilePanoramaPlayer'];

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const toNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export const getTourFromFrame = (iframe: HTMLIFrameElement | null | undefined): TdvTour | null => {
  try {
    return (iframe?.contentWindow as TourWindow | null)?.tour ?? null;
  } catch {
    return null;
  }
};

const getPlaylistItems = (tour: TdvTour): TdvObject[] => {
  const items = tour.player?.getById?.('mainPlayList')?.get('items');
  return Array.isArray(items) ? (items as TdvObject[]) : [];
};

/** Chờ mainPlayList có items — dấu hiệu duy nhất đáng tin là tour đã điều khiển được. */
export const waitForPlaylist = async (
  iframe: HTMLIFrameElement,
  timeoutMs = 30000,
): Promise<TdvTour | null> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const tour = getTourFromFrame(iframe);
    if (tour && getPlaylistItems(tour).length > 0) {
      return tour;
    }
    await sleep(150);
  }
  return null;
};

const getItemMedia = (item: TdvObject): TdvObject | null => {
  const media = item.get('media');
  return media && typeof (media as TdvObject).get === 'function' ? (media as TdvObject) : null;
};

const readMediaId = (media: TdvObject | null): string | null => {
  const id = media?.get('id');
  return typeof id === 'string' ? id : null;
};

// Nhãn rỗng trong ~1s đầu (tour chưa nạp xong locale) → coi như chưa có
const readMediaLabel = (media: TdvObject | null): string | null => {
  const label = media?.get('label');
  return typeof label === 'string' && label.trim() ? label.trim() : null;
};

const findPlaylistIndex = (tour: TdvTour, scene: SceneRef): number => {
  const items = getPlaylistItems(tour);
  if (scene.id) {
    const byId = items.findIndex((item) => readMediaId(getItemMedia(item)) === scene.id);
    if (byId !== -1) return byId;
  }
  if (scene.name) {
    const name = scene.name.trim();
    return items.findIndex((item) => readMediaLabel(getItemMedia(item)) === name);
  }
  return -1;
};

const getCameraForIndex = (tour: TdvTour, index: number): TdvObject | null => {
  const item = getPlaylistItems(tour)[index];
  if (!item) return null;

  const camera = item.get('camera');
  if (camera && typeof (camera as TdvObject).get === 'function') {
    return camera as TdvObject;
  }

  const mediaId = readMediaId(getItemMedia(item));
  return mediaId ? tour.player?.getById?.(`${mediaId}_camera`) ?? null : null;
};

export const getPanoramaPlayer = (tour: TdvTour): (TdvObject & Record<string, unknown>) | null => {
  const byClass = tour.player?.getByClassName?.('PanoramaPlayer');
  if (Array.isArray(byClass) && byClass.length > 0) {
    return byClass[0] as TdvObject & Record<string, unknown>;
  }
  for (const id of PANORAMA_PLAYER_FALLBACK_IDS) {
    const player = tour.player?.getById?.(id);
    if (player) return player as TdvObject & Record<string, unknown>;
  }
  return null;
};

export interface CurrentScene {
  index: number;
  id: string | null;
  name: string | null;
}

export const getCurrentScene = (tour: TdvTour): CurrentScene | null => {
  const playlist = tour.player?.getById?.('mainPlayList');
  const index = toNumber(playlist?.get('selectedIndex'));
  if (index === null || index < 0) return null;

  const item = getPlaylistItems(tour)[index];
  const media = item ? getItemMedia(item) : null;
  return { index, id: readMediaId(media), name: readMediaLabel(media) };
};

export const isCurrentScene = (tour: TdvTour, scene: SceneRef): boolean => {
  const current = getCurrentScene(tour);
  if (!current) return false;
  if (scene.id && current.id === scene.id) return true;
  return Boolean(scene.name && current.name === scene.name.trim());
};

export const getSceneList = (tour: TdvTour): Array<{ index: number; id: string | null; name: string | null }> =>
  getPlaylistItems(tour).map((item, index) => {
    const media = getItemMedia(item);
    return { index, id: readMediaId(media), name: readMediaLabel(media) };
  });

// Góc gốc tác giả tour đặt — nhớ lại trước lần ghi đè đầu tiên để còn "về góc gốc".
const originalEntryPoses = new WeakMap<TdvObject, ScenePose>();

const readInitialPosition = (camera: TdvObject): TdvObject | null => {
  const position = camera.get('initialPosition');
  return position && typeof (position as TdvObject).set === 'function' ? (position as TdvObject) : null;
};

export const getOriginalEntryPose = (tour: TdvTour, scene: SceneRef): ScenePose | null => {
  const index = findPlaylistIndex(tour, scene);
  const camera = index === -1 ? null : getCameraForIndex(tour, index);
  if (!camera) return null;

  const remembered = originalEntryPoses.get(camera);
  if (remembered) return remembered;

  const position = readInitialPosition(camera);
  const yaw = toNumber(position?.get('yaw'));
  const pitch = toNumber(position?.get('pitch'));
  return yaw !== null && pitch !== null ? { yaw, pitch } : null;
};

/**
 * Ghi góc vào initialPosition của camera + tắt animation mở đầu. Mỗi lần engine vào cảnh
 * này (menu, hotspot trong tour, link share…) sẽ vào thẳng đúng góc.
 */
export const setEntryPose = (tour: TdvTour, scene: SceneRef, pose: ScenePose): boolean => {
  const index = findPlaylistIndex(tour, scene);
  const camera = index === -1 ? null : getCameraForIndex(tour, index);
  const position = camera ? readInitialPosition(camera) : null;
  if (!camera || !position) return false;

  if (!originalEntryPoses.has(camera)) {
    const yaw = toNumber(position.get('yaw'));
    const pitch = toNumber(position.get('pitch'));
    if (yaw !== null && pitch !== null) originalEntryPoses.set(camera, { yaw, pitch });
  }

  camera.set('initialSequence', null);
  camera.set('enterPointingToHorizon', false);
  position.set('yaw', pose.yaw);
  position.set('pitch', pose.pitch);
  return true;
};

/** Trả initialPosition về góc gốc tác giả tour đặt (chỉ khi cảnh từng bị setEntryPose ghi đè). */
export const restoreEntryPose = (tour: TdvTour, scene: SceneRef): void => {
  const index = findPlaylistIndex(tour, scene);
  const camera = index === -1 ? null : getCameraForIndex(tour, index);
  const original = camera ? originalEntryPoses.get(camera) : undefined;
  const position = camera ? readInitialPosition(camera) : null;
  if (!original || !position) return;

  position.set('yaw', original.yaw);
  position.set('pitch', original.pitch);
};

export const primeEntryPoses = (tour: TdvTour, poses: ScenePoseEntry[]): void => {
  poses.forEach((entry) => {
    setEntryPose(tour, entry, entry);
  });
};

export const readViewState = (tour: TdvTour): SceneViewState | null => {
  const player = getPanoramaPlayer(tour);
  if (!player) return null;

  const yaw = toNumber(player.get('yaw'));
  const pitch = toNumber(player.get('pitch'));
  if (yaw === null || pitch === null) return null;

  return { yaw, pitch, hfov: toNumber(player.get('hfov')) };
};

const angleDelta = (a: number, b: number) => {
  const diff = Math.abs(((a - b) % 360) + 360) % 360;
  return Math.min(diff, 360 - diff);
};

/**
 * Quay camera của cảnh ĐANG hiển thị về đúng góc (dùng khi không thể "vào lại" cảnh:
 * setMediaByIndex tới chính cảnh đang đứng là no-op).
 * Vòng verify-retry: dừng khi 2 nhịp liên tiếp gần đích và đứng yên, sau ít nhất 1,2s,
 * trần 40 lần. Dừng ngay khi người xem tự kéo. Trả về hàm huỷ.
 */
export const applyLivePose = (iframe: HTMLIFrameElement, pose: ScenePose): (() => void) => {
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };

  let frameDocument: Document | null = null;
  try {
    frameDocument = iframe.contentWindow?.document ?? null;
  } catch {
    frameDocument = null;
  }
  const interactionEvents = ['pointerdown', 'touchstart', 'wheel', 'keydown'];
  interactionEvents.forEach((name) => frameDocument?.addEventListener(name, cancel, { once: true, passive: true }));

  const run = async () => {
    const startedAt = Date.now();
    let previous: SceneViewState | null = null;
    let stableTicks = 0;

    for (let attempt = 0; attempt < 40 && !cancelled; attempt += 1) {
      const tour = getTourFromFrame(iframe);
      const player = tour ? getPanoramaPlayer(tour) : null;
      if (!tour || !player) break;

      const current = readViewState(tour);
      const near = current !== null && angleDelta(current.yaw, pose.yaw) < 0.5 && Math.abs(current.pitch - pose.pitch) < 0.5;
      const still =
        current !== null &&
        previous !== null &&
        angleDelta(current.yaw, previous.yaw) < 0.05 &&
        Math.abs(current.pitch - previous.pitch) < 0.05;

      stableTicks = near && still ? stableTicks + 1 : 0;
      if (stableTicks >= 2 && Date.now() - startedAt >= 1200) break;

      if (!near) {
        const pauseCamera = player.pauseCamera;
        if (typeof pauseCamera === 'function') pauseCamera.call(player);
        player.set('yaw', pose.yaw);
        player.set('pitch', pose.pitch);
      }

      previous = current;
      await sleep(150);
    }

    interactionEvents.forEach((name) => frameDocument?.removeEventListener(name, cancel));
  };

  void run();
  return cancel;
};

/** Mở cảnh theo playlist index (setMediaByName nhận nhãn, không nhận id). */
export const navigateToScene = (tour: TdvTour, scene: SceneRef): boolean => {
  const index = findPlaylistIndex(tour, scene);
  if (index === -1) return false;
  if (typeof tour.setMediaByIndex === 'function') {
    tour.setMediaByIndex(index);
    return true;
  }
  if (scene.name && typeof tour.setMediaByName === 'function') {
    tour.setMediaByName(scene.name);
    return true;
  }
  return false;
};

export const waitForCurrentScene = async (
  iframe: HTMLIFrameElement,
  scene: SceneRef,
  timeoutMs = 15000,
): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const tour = getTourFromFrame(iframe);
    if (tour && isCurrentScene(tour, scene)) return true;
    await sleep(120);
  }
  return false;
};

export const findPoseForScene = (poses: ScenePoseEntry[], scene: SceneRef): ScenePoseEntry | null =>
  poses.find((entry) => scene.id && entry.id === scene.id) ??
  poses.find((entry) => scene.name && entry.name === scene.name) ??
  null;
