/**
 * Trang chọn góc VR360 — dashboard backend (khác domain) nhúng trang này bằng iframe.
 *
 * Trang chạy CÙNG domain với tour (assets/vr-data) nên đọc được camera, rồi gửi góc lên
 * dashboard bằng postMessage. Trang không lưu gì và không giữ secret nào; việc lưu là của
 * dashboard. Giao thức: docs/VR360_SCENE_ANGLE_BACKEND_SPEC.md §5.
 */
import {
  applyLivePose,
  getCurrentScene,
  getOriginalEntryPose,
  getSceneList,
  getTourFromFrame,
  isCurrentScene,
  navigateToScene,
  readViewState,
  setEntryPose,
  waitForCurrentScene,
  waitForPlaylist,
  type SceneRef,
  type ScenePose,
  type SceneViewState,
} from '../utils/vr360Camera';
import { getVr360BasePathCandidates } from '../utils/vr360SceneParser';

const NS = 'hotellink.vr360';
const PROTOCOL_VERSION = 1;

const DEFAULT_ALLOWED_ORIGINS = 'https://travel.link360.vn';
const allowedOrigins = new Set(
  [
    window.location.origin,
    ...String(import.meta.env.VITE_VR360_PICKER_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS).split(','),
  ]
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
);

type IncomingMessage =
  | { ns: typeof NS; type: 'hello'; requestId?: string }
  | { ns: typeof NS; type: 'open'; requestId?: string; scene: SceneRef; pose?: ScenePose | null }
  | { ns: typeof NS; type: 'get-pose'; requestId?: string }
  | { ns: typeof NS; type: 'set-pose'; requestId?: string; pose: ScenePose };

const frame = document.getElementById('tour') as HTMLIFrameElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const hud = document.getElementById('hud') as HTMLDivElement;
const hudScene = document.getElementById('hud-scene') as HTMLSelectElement;
const hudPose = document.getElementById('hud-pose') as HTMLElement;
const hudCopy = document.getElementById('hud-copy') as HTMLButtonElement;

const isEmbedded = window.parent !== window;
const searchParams = new URLSearchParams(window.location.search);
const showHud = searchParams.get('hud') === '1' || (!isEmbedded && searchParams.get('hud') !== '0');

let parentOrigin: string | null = null;
let lastInteractionAt = 0;
let lastProgrammaticAt = 0;
let cancelLivePose: (() => void) | null = null;

const round = (value: number | null) => (value === null ? null : Math.round(value * 100) / 100);

const post = (message: Record<string, unknown>) => {
  if (!isEmbedded) return;
  const payload = { ns: NS, version: PROTOCOL_VERSION, ...message };
  // Chưa biết origin trang cha → gửi tới từng origin được phép; trình duyệt chỉ giao cho origin khớp
  const targets = parentOrigin ? [parentOrigin] : [...allowedOrigins];
  targets.forEach((origin) => window.parent.postMessage(payload, origin));
};

const setStatus = (text: string | null) => {
  statusEl.textContent = text ?? '';
  statusEl.style.display = text ? 'flex' : 'none';
};

const resolveTourUrl = async (): Promise<string | null> => {
  for (const basePath of getVr360BasePathCandidates()) {
    const url = `${basePath}/index.htm`;
    try {
      const response = await fetch(url, { cache: 'no-store' });
      const html = response.ok ? (await response.text()).toLowerCase() : '';
      if (html.includes('tdvplayer.js') || html.includes('script.js')) return url;
    } catch {
      continue;
    }
  }
  return null;
};

const currentSceneRef = () => {
  const tour = getTourFromFrame(frame);
  const current = tour ? getCurrentScene(tour) : null;
  return current ? { id: current.id, name: current.name } : null;
};

const posePayload = (view: SceneViewState | null) => ({
  scene: currentSceneRef(),
  yaw: round(view?.yaw ?? null),
  pitch: round(view?.pitch ?? null),
  hfov: round(view?.hfov ?? null),
});

const renderHud = (view: SceneViewState | null) => {
  if (!showHud) return;
  const p = posePayload(view);
  hudPose.textContent = `yaw ${p.yaw ?? '–'} · pitch ${p.pitch ?? '–'} · hfov ${p.hfov ?? '–'}`;
  const currentId = p.scene?.id;
  if (currentId && hudScene.value !== currentId) hudScene.value = currentId;
};

const openScene = async (scene: SceneRef, pose: ScenePose | null | undefined): Promise<boolean> => {
  const tour = getTourFromFrame(frame);
  if (!tour) return false;

  cancelLivePose?.();
  lastProgrammaticAt = Date.now();

  // Không truyền góc → xem góc gốc của tour (để admin canh từ đầu)
  const targetPose = pose ?? getOriginalEntryPose(tour, scene);
  if (targetPose) setEntryPose(tour, scene, targetPose);

  if (!isCurrentScene(tour, scene) && !navigateToScene(tour, scene)) return false;

  const arrived = await waitForCurrentScene(frame, scene);
  if (arrived && targetPose) {
    lastProgrammaticAt = Date.now();
    cancelLivePose = applyLivePose(frame, targetPose);
  }
  return arrived;
};

const handleMessage = async (event: MessageEvent) => {
  const origin = event.origin.replace(/\/+$/, '');
  if (event.source !== window.parent || !allowedOrigins.has(origin)) return;

  const data = event.data as IncomingMessage | null;
  if (!data || data.ns !== NS) return;
  parentOrigin = origin;

  const tour = getTourFromFrame(frame);
  const requestId = data.requestId;

  switch (data.type) {
    case 'hello':
      if (tour) sendReady();
      return;
    case 'open': {
      const ok = await openScene(data.scene ?? {}, data.pose);
      post({ type: 'opened', requestId, ok, scene: currentSceneRef() });
      if (!ok) post({ type: 'error', requestId, message: 'Không tìm thấy cảnh trong tour' });
      return;
    }
    case 'get-pose':
      post({ type: 'pose', requestId, userInitiated: false, ...posePayload(tour ? readViewState(tour) : null) });
      return;
    case 'set-pose': {
      const current = currentSceneRef();
      if (!tour || !current || !data.pose) return;
      cancelLivePose?.();
      lastProgrammaticAt = Date.now();
      setEntryPose(tour, current, data.pose);
      cancelLivePose = applyLivePose(frame, data.pose);
      return;
    }
    default:
      return;
  }
};

const sendReady = () => {
  const tour = getTourFromFrame(frame);
  if (!tour) return;
  post({
    type: 'ready',
    scenes: getSceneList(tour).map((scene) => ({
      ...scene,
      defaultPose: getOriginalEntryPose(tour, scene),
    })),
    current: currentSceneRef(),
  });
};

/** Báo góc mỗi khi camera đổi rồi đứng yên (~0,5s) — tránh chốt số giữa lúc đang quay. */
const watchPose = () => {
  let lastSent: SceneViewState | null = null;
  let previous: SceneViewState | null = null;
  let stableTicks = 0;

  window.setInterval(() => {
    const tour = getTourFromFrame(frame);
    const view = tour ? readViewState(tour) : null;
    renderHud(view);
    if (!view) return;

    const moved = (a: SceneViewState | null, b: SceneViewState) =>
      !a || Math.abs(a.yaw - b.yaw) > 0.05 || Math.abs(a.pitch - b.pitch) > 0.05 || (a.hfov ?? 0) !== (b.hfov ?? 0);

    stableTicks = moved(previous, view) ? 0 : stableTicks + 1;
    previous = view;

    if (stableTicks >= 3 && moved(lastSent, view)) {
      lastSent = view;
      post({ type: 'pose', userInitiated: lastInteractionAt > lastProgrammaticAt, ...posePayload(view) });
    }
  }, 150);
};

const trackInteraction = () => {
  try {
    const frameDocument = frame.contentWindow?.document;
    ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach((name) =>
      frameDocument?.addEventListener(name, () => (lastInteractionAt = Date.now()), { passive: true }),
    );
  } catch {
    // Không đọc được document của tour (khác origin) → userInitiated luôn false
  }
};

const setupHud = () => {
  if (!showHud) return;
  const tour = getTourFromFrame(frame);
  if (!tour) return;

  hud.classList.add('visible');
  getSceneList(tour).forEach((scene) => {
    const option = document.createElement('option');
    option.value = scene.id ?? String(scene.index);
    option.textContent = scene.name ?? scene.id ?? `#${scene.index}`;
    hudScene.appendChild(option);
  });
  hudScene.addEventListener('change', () => {
    const scene = getSceneList(tour).find((item) => (item.id ?? String(item.index)) === hudScene.value);
    if (scene) void openScene(scene, null);
  });
  hudCopy.addEventListener('click', () => {
    const text = JSON.stringify(posePayload(readViewState(tour)));
    navigator.clipboard?.writeText(text).catch(() => window.prompt('JSON', text));
  });
};

const boot = async () => {
  window.addEventListener('message', (event) => {
    void handleMessage(event);
  });

  const tourUrl = await resolveTourUrl();
  if (!tourUrl) {
    setStatus('Không tìm thấy tour VR360 (assets/vr-data/index.htm)');
    post({ type: 'error', message: 'Tour VR360 not found' });
    return;
  }

  frame.src = tourUrl;
  await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));

  // Máy yếu / GPU giả lập: tour có thể mất >30s mới khởi động xong — đã đo 13s trong headless
  const tour = await waitForPlaylist(frame, 90000);
  if (!tour) {
    setStatus('Tour VR360 không khởi động được');
    post({ type: 'error', message: 'Tour VR360 failed to start' });
    return;
  }

  // Nhãn cảnh đến từ locale, nạp sau playlist một chút — chờ để danh sách gửi đi có tên
  for (let attempt = 0; attempt < 50 && !getSceneList(tour).some((scene) => scene.name); attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  setStatus(null);
  trackInteraction();
  setupHud();
  watchPose();
  sendReady();
};

void boot();
