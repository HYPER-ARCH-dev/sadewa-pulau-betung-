import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,jpg}'],
          maximumFileSizeToCacheInBytes: 5000000,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'openfreemap-vector-tiles',
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 60 * 60 * 24 * 14, // 14 Days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'osm-fallback-tiles',
                expiration: {
                  maxEntries: 250,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 Days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            }
          ]
        },
        manifest: {
          id: '/',
          name: 'SADEWA - Portal Desa Pulau Betung',
          short_name: 'SADEWA',
          description: 'Sistem Informasi dan Layanan Administrasi Digital Desa Pulau Betung',
          theme_color: '#047857',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-ui': ['lucide-react', 'motion'],
            'vendor-map': ['leaflet', 'maplibre-gl', '@maplibre/maplibre-gl-leaflet'],
            'vendor-charts': ['recharts'],
            'vendor-pdf': ['jspdf', 'jspdf-autotable', 'html2canvas-pro']
          }
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
      watch: null,
    },
  };
});
