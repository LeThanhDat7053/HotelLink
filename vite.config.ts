import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const serveStaticDirectory = (requestPath: string, directoryPath: string) => ({
  name: `serve-${requestPath}`,
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use(requestPath, (req, res, next) => {
      const rawRelativePath = req.url?.replace(requestPath, '') || '';
      const relativePath = rawRelativePath.split('?')[0].split('#')[0];
      const absolutePath = path.resolve(directoryPath, `.${relativePath}`);
      const absoluteDirectoryPath = path.resolve(directoryPath);

      if (!absolutePath.startsWith(absoluteDirectoryPath) || !fs.existsSync(absolutePath)) {
        next();
        return;
      }

      res.statusCode = 200;
      res.end(fs.readFileSync(absolutePath));
    });
  },
});

const serveStaticAssetFile = (requestPath: string, assetPath: string) => ({
  name: `serve-${requestPath}`,
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use(requestPath, (_req, res, next) => {
      if (!fs.existsSync(assetPath)) {
        next();
        return;
      }

      res.statusCode = 200;
      res.end(fs.readFileSync(assetPath));
    });
  },
});

/**
 * DEV ONLY — giả lập server/vr360-views.php + file tĩnh /data/vr360-views.json, vì Vite không
 * chạy PHP. Dữ liệu dev nằm ở .dev-data/vr360-views.json (gitignore). Production luôn là PHP;
 * giữ quy tắc kiểm tra ở đây khớp với vr360-views.php.
 */
const vr360ViewsDevApi = (editorPassword: string) => ({
  name: 'vr360-views-dev-api',
  configureServer(server: import('vite').ViteDevServer) {
    const dataFile = path.resolve(__dirname, '.dev-data/vr360-views.json');
    const emptyStore = () => ({ version: 1, updatedAt: null as string | null, views: {} as Record<string, unknown> });
    const readStore = () => {
      try {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        return data && typeof data.views === 'object' && data.views ? data : emptyStore();
      } catch {
        return emptyStore();
      }
    };
    const writeStore = (store: ReturnType<typeof emptyStore>) => {
      store.updatedAt = new Date().toISOString();
      fs.mkdirSync(path.dirname(dataFile), { recursive: true });
      fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
      return store;
    };
    const normalizePath = (value: unknown) => {
      if (typeof value !== 'string') return null;
      let p = value.trim().toLowerCase();
      if (p !== '/') p = p.replace(/\/+$/, '');
      return /^\/(?:[a-z0-9_-]+(?:\/[a-z0-9_-]+)*)?$/.test(p) && p.length <= 200 ? p : null;
    };
    const send = (res: import('node:http').ServerResponse, status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };

    server.middlewares.use((req, res, next) => {
      const url = (req.url || '').split('?')[0];

      if (url === '/data/vr360-views.json') {
        if (!fs.existsSync(dataFile)) return send(res, 404, { error: 'not_found' });
        return send(res, 200, readStore());
      }
      if (url !== '/vr360-views.php') return next();

      if (req.method === 'GET') return send(res, 200, readStore());
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method_not_allowed' });
      if (!editorPassword) {
        return send(res, 403, { ok: false, error: 'editor_disabled', message: 'Chưa đặt VR360_EDITOR_PASSWORD' });
      }
      if (req.headers['x-vr360-editor-key'] !== editorPassword) {
        return send(res, 401, { ok: false, error: 'unauthorized', message: 'Sai mật khẩu' });
      }

      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(raw || '{}');
        } catch {
          return send(res, 400, { ok: false, error: 'bad_json' });
        }

        if (input.action === 'verify') return send(res, 200, { ok: true });

        const pagePath = normalizePath(input.path);
        if (!pagePath) return send(res, 422, { ok: false, error: 'invalid', message: 'Đường dẫn không hợp lệ' });
        const store = readStore();

        if (input.action === 'delete') {
          delete store.views[pagePath];
          return send(res, 200, { ok: true, data: writeStore(store) });
        }
        if (input.action === 'save') {
          const view = (input.view || {}) as Record<string, unknown>;
          const yaw = Number(view.yaw);
          const pitch = Number(view.pitch);
          const hfov = view.hfov === null || view.hfov === undefined ? null : Number(view.hfov);
          const sceneName = typeof view.sceneName === 'string' ? view.sceneName.trim() : '';
          const valid =
            sceneName && Number.isFinite(yaw) && Math.abs(yaw) <= 360 && Number.isFinite(pitch) && Math.abs(pitch) <= 90;
          if (!valid) return send(res, 422, { ok: false, error: 'invalid', message: 'Dữ liệu không hợp lệ' });

          const round = (n: number) => Math.round(n * 100) / 100;
          store.views[pagePath] = {
            label: typeof view.label === 'string' ? view.label.slice(0, 255) : '',
            sceneId: typeof view.sceneId === 'string' && view.sceneId ? view.sceneId : null,
            sceneName,
            yaw: round(yaw),
            pitch: round(pitch),
            hfov: hfov !== null && Number.isFinite(hfov) ? round(hfov) : null,
            updatedAt: new Date().toISOString(),
          };
          return send(res, 200, { ok: true, data: writeStore(store) });
        }
        return send(res, 400, { ok: false, error: 'unknown_action' });
      });
    });
  },
});

/**
 * DEV ONLY — giả lập server/share-og.php, server/share-image.php, file /data/share-og.json và
 * thư mục /share-images/ (Vite không chạy PHP). Dữ liệu dev ở .dev-data/. Production luôn là PHP;
 * giữ quy tắc kiểm tra khớp share-og.php / share-image.php. SSR thẻ OG (index.php) chỉ có ở hosting.
 */
const shareOgDevApi = (editorPassword: string) => ({
  name: 'share-og-dev-api',
  configureServer(server: import('vite').ViteDevServer) {
    const dataDir = path.resolve(__dirname, '.dev-data');
    const dataFile = path.join(dataDir, 'share-og.json');
    const imageDir = path.join(dataDir, 'share-images');
    type Item = Record<string, unknown> & { urlSlug?: string };
    type Store = { version: number; updatedAt: string | null; items: Record<string, Item>; aliases: Record<string, string> };
    const readStore = (): Store => {
      try {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        if (!data || typeof data.items !== 'object' || !data.items) throw new Error('empty');
        return { ...data, aliases: data.aliases && !Array.isArray(data.aliases) ? data.aliases : {} };
      } catch {
        return { version: 1, updatedAt: null, items: {}, aliases: {} };
      }
    };
    const writeStore = (store: Store) => {
      store.updatedAt = new Date().toISOString();
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
      return store;
    };
    const normalizePath = (value: unknown) => {
      if (typeof value !== 'string') return null;
      let p = value.trim().toLowerCase();
      if (p !== '/') p = p.replace(/\/+$/, '');
      return /^\/(?:[a-z0-9_-]+(?:\/[a-z0-9_-]+)*)?$/.test(p) && p.length <= 200 ? p : null;
    };
    const text = (value: unknown, max: number) =>
      [...(typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')].slice(0, max).join('');
    const send = (res: import('node:http').ServerResponse, status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };
    const readBody = (req: import('node:http').IncomingMessage) =>
      new Promise<Buffer>((resolve) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
      });
    const authorized = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => {
      if (!editorPassword) {
        send(res, 403, { ok: false, error: 'editor_disabled', message: 'Chưa đặt VR360_EDITOR_PASSWORD' });
        return false;
      }
      if (req.headers['x-vr360-editor-key'] !== editorPassword) {
        send(res, 401, { ok: false, error: 'unauthorized', message: 'Sai mật khẩu' });
        return false;
      }
      return true;
    };
    /** Kích thước ảnh từ header JPEG/PNG (như getimagesize) */
    const imageInfo = (buf: Buffer): { ext: 'jpg' | 'png'; width: number; height: number } | null => {
      if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
        return { ext: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
      }
      if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
        let i = 2;
        while (i + 9 < buf.length) {
          if (buf[i] !== 0xff) return null;
          const marker = buf[i + 1];
          const length = buf.readUInt16BE(i + 2);
          if (marker >= 0xc0 && marker <= 0xc3) {
            return { ext: 'jpg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
          }
          i += 2 + length;
        }
      }
      return null;
    };
    /** multipart/form-data tối giản: { fields, file } */
    const parseMultipart = (body: Buffer, contentType: string) => {
      const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
      const fields: Record<string, string> = {};
      let file: Buffer | null = null;
      if (!boundary) return { fields, file };
      const delimiter = Buffer.from(`--${boundary[1] || boundary[2]}`);
      let start = body.indexOf(delimiter);
      while (start !== -1) {
        const next = body.indexOf(delimiter, start + delimiter.length);
        if (next === -1) break;
        const part = body.subarray(start + delimiter.length + 2, next - 2);
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          const headers = part.subarray(0, headerEnd).toString();
          const content = part.subarray(headerEnd + 4);
          const name = /name="([^"]+)"/.exec(headers)?.[1];
          if (name === 'file' && /filename=/.test(headers)) file = content;
          else if (name) fields[name] = content.toString();
        }
        start = next;
      }
      return { fields, file };
    };

    server.middlewares.use(async (req, res, next) => {
      const url = (req.url || '').split('?')[0];

      if (url === '/data/share-og.json') {
        if (!fs.existsSync(dataFile)) return send(res, 404, { error: 'not_found' });
        return send(res, 200, readStore());
      }
      if (url.startsWith('/share-images/')) {
        const file = path.join(imageDir, path.basename(url));
        if (!fs.existsSync(file)) return next();
        res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : 'image/jpeg');
        return res.end(fs.readFileSync(file));
      }

      if (url === '/share-og.php') {
        if (req.method === 'GET') return send(res, 200, readStore());
        if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method_not_allowed' });
        if (!authorized(req, res)) return;
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse((await readBody(req)).toString() || '{}');
        } catch {
          return send(res, 400, { ok: false, error: 'bad_json' });
        }
        const pagePath = normalizePath(input.path);
        if (!pagePath) return send(res, 422, { ok: false, error: 'invalid_path', message: 'Đường dẫn trang không hợp lệ' });
        const store = readStore();
        if (input.action === 'delete') {
          const slug = store.items[pagePath]?.urlSlug;
          if (slug) store.aliases[slug] = pagePath; // link đã chia sẻ vẫn mở được trang
          delete store.items[pagePath];
          return send(res, 200, { ok: true, data: writeStore(store) });
        }
        if (input.action === 'save') {
          const m = (input.metadata || {}) as Record<string, unknown>;
          const pose = (m.imagePose || null) as Record<string, unknown> | null;
          const item = {
            urlSlug: text(m.urlSlug, 120).toLowerCase(),
            titleVi: text(m.titleVi, 255),
            descriptionVi: text(m.descriptionVi, 1000),
            titleEn: text(m.titleEn, 255),
            descriptionEn: text(m.descriptionEn, 1000),
            image: text(m.image, 1000),
            imagePose:
              pose && typeof pose.yaw === 'number' && typeof pose.pitch === 'number' && typeof pose.sceneName === 'string'
                ? { sceneId: pose.sceneId ?? null, sceneName: pose.sceneName, yaw: pose.yaw, pitch: pose.pitch }
                : null,
            updatedAt: new Date().toISOString(),
          };
          const slugOk = !item.urlSlug || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.urlSlug);
          if (!item.titleVi || !item.descriptionVi || (item.image && !/^(https?:\/\/|\/)/i.test(item.image)) || !slugOk) {
            return send(res, 422, {
              ok: false,
              error: 'invalid_metadata',
              message: 'Cần tiêu đề và mô tả tiếng Việt; ảnh phải là http(s)://… hoặc /…; link chỉ gồm a–z, 0–9, gạch ngang',
            });
          }
          // Link ngắn: duy nhất toàn site (kể cả link cũ của trang khác); đổi link → link cũ vào aliases
          const previous = store.items[pagePath]?.urlSlug || '';
          const slug = item.urlSlug || previous || pagePath.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trang-chu';
          const takenBy = Object.entries(store.items).find(([path, other]) => path !== pagePath && other.urlSlug === slug)?.[0];
          const aliasOf = store.aliases[slug] && store.aliases[slug] !== pagePath ? store.aliases[slug] : null;
          if (takenBy || aliasOf) {
            return send(res, 422, { ok: false, error: 'slug_taken', message: `Link “${slug}” đang thuộc trang ${takenBy || aliasOf}` });
          }
          if (previous && previous !== slug) store.aliases[previous] = pagePath;
          delete store.aliases[slug];
          store.items[pagePath] = { ...item, urlSlug: slug };
          return send(res, 200, { ok: true, data: writeStore(store) });
        }
        return send(res, 400, { ok: false, error: 'unknown_action' });
      }

      if (url === '/share-image.php') {
        if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method_not_allowed' });
        if (!authorized(req, res)) return;
        const { fields, file } = parseMultipart(await readBody(req), String(req.headers['content-type'] || ''));
        if (!file) return send(res, 422, { ok: false, error: 'invalid_file', message: 'Không nhận được file ảnh' });
        if (file.length > 3 * 1024 * 1024) return send(res, 422, { ok: false, error: 'invalid_file', message: 'Ảnh vượt quá 3MB' });
        const info = imageInfo(file);
        if (!info) return send(res, 422, { ok: false, error: 'invalid_file', message: 'Chỉ nhận ảnh JPG hoặc PNG' });
        if (!info.width || !info.height) {
          return send(res, 422, { ok: false, error: 'invalid_image', message: 'Không đọc được kích thước ảnh' });
        }
        const slug = (fields.slug || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'home';
        const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
        const name = `${slug}-${stamp}-${Math.random().toString(16).slice(2, 8)}.${info.ext}`;
        fs.mkdirSync(imageDir, { recursive: true });
        fs.writeFileSync(path.join(imageDir, name), file);
        return send(res, 200, { ok: true, image: `/share-images/${name}`, width: info.width, height: info.height });
      }

      return next();
    });
  },
});

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Mật khẩu dev: VR360_EDITOR_PASSWORD trong .env (không có thì dùng "dev")
    vr360ViewsDevApi(loadEnv(mode, __dirname, '').VR360_EDITOR_PASSWORD || 'dev'),
    shareOgDevApi(loadEnv(mode, __dirname, '').VR360_EDITOR_PASSWORD || 'dev'),
    serveStaticDirectory('/assets/vr-data', path.resolve(__dirname, 'dist/assets/vr-data')),
    serveStaticAssetFile('/assets/js/panorama.js', path.resolve(__dirname, 'dist/assets/js/panorama.js')),
  ],
  build: {
    emptyOutDir: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Trang chọn góc VR360 cho dashboard nhúng — entry riêng, không kéo theo React
      input: {
        main: path.resolve(__dirname, 'index.html'),
        vr360AnglePicker: path.resolve(__dirname, 'vr360-angle-picker.html'),
      },
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'antd-vendor': ['antd', '@ant-design/icons'],
          'axios-vendor': ['axios'],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    minify: 'esbuild',
  },
  server: {
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api/v1': {
        target: 'https://travel.link360.vn',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
}));
