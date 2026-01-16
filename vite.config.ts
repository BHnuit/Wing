import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // WebDAV 代理配置（用于解决 CORS 问题）
          '/api/webdav': {
            target: 'https://dav.jianguoyun.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/webdav/, '/dav'),
            secure: true,
            // 支持所有 HTTP 方法（包括 WebDAV 特有的 MKCOL 等）
            configure: (proxy, options) => {
              proxy.on('proxyReq', (proxyReq, req, res) => {
                // 确保保留所有请求头
                if (req.headers.authorization) {
                  proxyReq.setHeader('Authorization', req.headers.authorization);
                }
              });
            }
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
