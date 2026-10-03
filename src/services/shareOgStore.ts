/**
 * Chia sẻ theo trang — data/share-og.json trên hosting khách sạn:
 *   - link ngắn https://<domain>/<SHORTLINK_PREFIX>/<urlSlug> cho từng vị trí menu
 *   - OG tuỳ chỉnh (tiêu đề / mô tả VI-EN / ảnh chụp từ góc mở trang)
 * index.php đọc CÙNG file để chèn OG phía server (server/_og.php) và mở đúng trang khi vào
 * bằng link ngắn. Khoá = đường dẫn trang (giống vr360-views.json).
 */
import { appConfig } from '../config';
import { EditorApiError, editorApi, fetchStaticJson } from './editorApi';
import { normalizeViewPath } from './vr360ViewStore';

export { EditorApiError };

/** Góc đã dùng để chụp ảnh chia sẻ — lưu kèm để biết ảnh còn khớp góc mở trang không */
export interface ShareImagePose {
  sceneId: string | null;
  sceneName: string;
  yaw: number;
  pitch: number;
}

/** Một bản tuỳ chỉnh. Field rỗng = theo mặc định; EN rỗng = dùng bản VI */
export interface ShareOgCustom {
  urlSlug: string;
  titleVi: string;
  descriptionVi: string;
  titleEn: string;
  descriptionEn: string;
  image: string;
  imagePose: ShareImagePose | null;
  updatedAt?: string;
}

export interface ShareOgFile {
  version: number;
  updatedAt: string | null;
  items: Record<string, ShareOgCustom>;
  /** urlSlug cũ → đường dẫn trang (link đã chia sẻ trước khi đổi vẫn mở được) */
  aliases: Record<string, string>;
}

export interface UploadedShareImage {
  image: string;
  width: number;
  height: number;
}

const FILE_URL = '/data/share-og.json';
const WRITE_URL = '/share-og.php';
const UPLOAD_URL = '/share-image.php';
const EMPTY_FILE: ShareOgFile = { version: 1, updatedAt: null, items: {}, aliases: {} };
export const SHARE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const text = (value: unknown) => (typeof value === 'string' ? value : '');

const sanitizePose = (value: unknown): ShareImagePose | null => {
  if (!value || typeof value !== 'object') return null;
  const pose = value as Partial<ShareImagePose>;
  return typeof pose.yaw === 'number' && typeof pose.pitch === 'number' && typeof pose.sceneName === 'string'
    ? { sceneId: typeof pose.sceneId === 'string' ? pose.sceneId : null, sceneName: pose.sceneName, yaw: pose.yaw, pitch: pose.pitch }
    : null;
};

const sanitizeFile = (data: unknown): ShareOgFile => {
  if (!data || typeof data !== 'object') return EMPTY_FILE;
  const raw = data as Partial<ShareOgFile>;
  const items: Record<string, ShareOgCustom> = {};
  Object.entries(raw.items ?? {}).forEach(([key, item]) => {
    if (!item || typeof item !== 'object') return;
    items[normalizeViewPath(key)] = {
      urlSlug: text(item.urlSlug),
      titleVi: text(item.titleVi),
      descriptionVi: text(item.descriptionVi),
      titleEn: text(item.titleEn),
      descriptionEn: text(item.descriptionEn),
      image: text(item.image),
      imagePose: sanitizePose(item.imagePose),
      updatedAt: text(item.updatedAt) || undefined,
    };
  });
  const aliases: Record<string, string> = {};
  Object.entries(raw.aliases && !Array.isArray(raw.aliases) ? raw.aliases : {}).forEach(([slug, path]) => {
    if (typeof path === 'string') aliases[slug] = normalizeViewPath(path);
  });
  return { version: raw.version ?? 1, updatedAt: raw.updatedAt ?? null, items, aliases };
};

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshot: ShareOgFile = EMPTY_FILE;
let loadPromise: Promise<ShareOgFile> | null = null;

const setSnapshot = (next: ShareOgFile) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};

/** "Phòng nghỉ › Deluxe Triple" → "phong-nghi-deluxe-triple" (bỏ dấu, đ→d) */
export const slugifyShareLink = (label: string): string =>
  label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

/** Đường dẫn link ngắn, vd "/canh/deluxe-triple" */
export const shortLinkPath = (urlSlug: string) => `/${appConfig.SHORTLINK_PREFIX}/${urlSlug}`;

/** urlSlug → trang thật (cả link cũ trong aliases); null = không có */
export const resolveShortLink = (file: ShareOgFile, slug: string): string | null => {
  const key = slug.toLowerCase();
  const found = Object.entries(file.items).find(([, item]) => item.urlSlug === key);
  return found ? found[0] : (file.aliases[key] ?? null);
};

export const shareOgStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot: () => snapshot,

  load(force = false): Promise<ShareOgFile> {
    if (loadPromise && !force) return loadPromise;
    loadPromise = fetchStaticJson(FILE_URL)
      .then((data) => {
        if (data !== undefined) setSnapshot(data === null ? EMPTY_FILE : sanitizeFile(data));
        return snapshot;
      })
      .catch(() => snapshot);
    return loadPromise;
  },

  async save(editorKey: string, pagePath: string, metadata: Omit<ShareOgCustom, 'updatedAt'>): Promise<void> {
    const payload = await editorApi.postJson(WRITE_URL, editorKey, {
      action: 'save',
      path: normalizeViewPath(pagePath),
      metadata,
    });
    setSnapshot(sanitizeFile(payload.data));
  },

  /** Xoá tuỳ chỉnh → trang quay về OG mặc định */
  async remove(editorKey: string, pagePath: string): Promise<void> {
    const payload = await editorApi.postJson(WRITE_URL, editorKey, { action: 'delete', path: normalizeViewPath(pagePath) });
    setSnapshot(sanitizeFile(payload.data));
  },

  /** Upload ảnh (jpg/png ≤ 3MB). Chỉ trả URL — chưa gắn vào OG cho tới khi bấm Lưu */
  async uploadImage(editorKey: string, pagePath: string, file: Blob, fileName: string): Promise<UploadedShareImage> {
    const form = new FormData();
    form.append('slug', normalizeViewPath(pagePath));
    form.append('file', file, fileName);
    const payload = await editorApi.postForm(UPLOAD_URL, editorKey, form);
    return { image: String(payload.image), width: Number(payload.width), height: Number(payload.height) };
  },
};
