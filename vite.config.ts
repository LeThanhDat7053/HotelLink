import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
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

export default defineConfig({
  plugins: [
    react(),
    serveStaticDirectory('/assets/vr-data', path.resolve(__dirname, 'dist/assets/vr-data')),
    serveStaticAssetFile('/assets/js/panorama.js', path.resolve(__dirname, 'dist/assets/js/panorama.js')),
  ],
  build: {
    emptyOutDir: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
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
});
