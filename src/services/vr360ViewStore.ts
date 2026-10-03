/**
 * Kho góc nhìn VR360 theo vị trí menu (data/vr360-views.json trên hosting khách sạn).
 *
 * - ĐỌC: file tĩnh /data/vr360-views.json — không đi qua backend travel.link360.vn,
 *   nên backend sập website vẫn có góc. Bản đọc được gần nhất còn được giữ trong
 *   browserJsonCache để lần sau hiện ngay, trước khi file tải xong.
 * - GHI: POST /vr360-views.php (mật khẩu VR360_EDITOR_PASSWORD trong config.php) —
 *   chỉ trang /vr360-scene-sync dùng.
 * - Mọi nơi dùng chung 1 kho (useSyncExternalStore): lưu xong là App cập nhật ngay;
 *   tab khác cùng trình duyệt nhận qua BroadcastChannel.
 */
import type { Vr360PageView, Vr360ViewsFile } from '../types/vr360Views';
import { browserJsonCache } from '../utils/browserJsonCache';
import { EditorApiError, editorApi, fetchStaticJson } from './editorApi';

const VIEWS_URL = '/data/vr360-views.json';
const WRITE_URL = '/vr360-views.php';
const CACHE_KEY = 'vr360_views:v1';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CHANNEL_NAME = 'hotellink-vr360-views';

const EMPTY_FILE: Vr360ViewsFile = { version: 1, updatedAt: null, views: {} };

/** "/Phong-Nghi/Deluxe/" → "/phong-nghi/deluxe" — PHẢI khớp vr360_normalize_path() bên PHP */
export const normalizeViewPath = (pagePath: string): string => {
  const trimmed = pagePath.trim().toLowerCase();
  return trimmed === '/' ? '/' : trimmed.replace(/\/+$/, '') || '/';
};

const sanitizeFile = (data: unknown): Vr360ViewsFile => {
  if (!data || typeof data !== 'object') return EMPTY_FILE;
  const raw = data as Partial<Vr360ViewsFile>;
  const views: Record<string, Vr360PageView> = {};

  Object.entries(raw.views ?? {}).forEach(([key, view]) => {
    if (
      view &&
      typeof view.sceneName === 'string' &&
      typeof view.yaw === 'number' &&
      typeof view.pitch === 'number'
    ) {
      views[normalizeViewPath(key)] = view;
    }
  });

  return { version: raw.version ?? 1, updatedAt: raw.updatedAt ?? null, views };
};

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshot: Vr360ViewsFile = sanitizeFile(browserJsonCache.get<Vr360ViewsFile>(CACHE_KEY));
let loadPromise: Promise<Vr360ViewsFile> | null = null;

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

const setSnapshot = (next: Vr360ViewsFile, broadcast: boolean) => {
  snapshot = next;
  browserJsonCache.set(CACHE_KEY, next, CACHE_TTL_MS);
  if (broadcast) channel?.postMessage(next);
  listeners.forEach((listener) => listener());
};

channel?.addEventListener('message', (event: MessageEvent) => {
  setSnapshot(sanitizeFile(event.data), false);
});

// Giữ tên cũ cho chỗ đang import; lỗi thật nằm ở editorApi (dùng chung với OG chia sẻ)
export { EditorApiError as Vr360ViewStoreError };

const postWrite = async (editorKey: string, body: Record<string, unknown>): Promise<Vr360ViewsFile | null> => {
  const payload = await editorApi.postJson(WRITE_URL, editorKey, body);
  return payload.data ? sanitizeFile(payload.data) : null;
};

export const vr360ViewStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot: () => snapshot,

  /** Tải file JSON (1 lần cho mỗi lần mở trang, gọi lại với force=true để làm mới) */
  load(force = false): Promise<Vr360ViewsFile> {
    if (loadPromise && !force) return loadPromise;

    // null = chưa lưu góc nào (404 / app shell HTML) → rỗng; undefined = lỗi hosting → giữ bản đang có
    loadPromise = fetchStaticJson(VIEWS_URL)
      .then((data) => {
        if (data !== undefined) setSnapshot(data === null ? EMPTY_FILE : sanitizeFile(data), false);
        return snapshot;
      })
      .catch(() => snapshot); // lỗi mạng / hosting → giữ bản cache gần nhất

    return loadPromise;
  },

  getView(pagePath: string): Vr360PageView | null {
    return snapshot.views[normalizeViewPath(pagePath)] ?? null;
  },

  async verifyKey(editorKey: string): Promise<void> {
    await postWrite(editorKey, { action: 'verify' });
  },

  async saveView(editorKey: string, pagePath: string, view: Omit<Vr360PageView, 'updatedAt'>): Promise<void> {
    const data = await postWrite(editorKey, { action: 'save', path: normalizeViewPath(pagePath), view });
    if (data) setSnapshot(data, true);
  },

  async deleteView(editorKey: string, pagePath: string): Promise<void> {
    const data = await postWrite(editorKey, { action: 'delete', path: normalizeViewPath(pagePath) });
    if (data) setSnapshot(data, true);
  },
};
