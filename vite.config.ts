import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function resolveLoopbackHost(hostname: string) {
  return hostname === 'localhost' ? '127.0.0.1' : hostname;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = env.VITE_API_URL || 'http://127.0.0.1:3000/api';
  const apiProxyUrl = new URL(apiBaseUrl);
  apiProxyUrl.hostname = resolveLoopbackHost(apiProxyUrl.hostname);
  const apiProxyTarget = apiProxyUrl.origin;

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
      modulePreload: {
        resolveDependencies(_filename, deps, context) {
          if (context.hostType !== 'html') return deps;
          return deps.filter(
            (dep) =>
              !dep.includes('charts-') &&
              !dep.includes('motion-') &&
              !dep.includes('exceljs-') &&
              !dep.includes('scheduleMatrixExport-'),
          );
        },
      },
      rollupOptions: {
        output: {
          onlyExplicitManualChunks: true,
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('exceljs')) return 'exceljs';
              if (id.includes('recharts')) return 'charts';
              if (id.includes('lucide-react')) return 'icons';
            }
          }
        },
      },
    },
  };
});
