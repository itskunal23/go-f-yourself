import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  base: '/spin-bottle/',
  build: {
    outDir: path.resolve(__dirname, '../../frontend/spin-bottle'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        embed: path.resolve(__dirname, 'src/embed.js'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        minifyInternalExports: false,
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Spin the Bottle',
        short_name: 'Spin Bottle',
        description: 'Premium Spin the Bottle party game',
        theme_color: '#0a0a12',
        background_color: '#0a0a12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/spin-bottle/',
        scope: '/spin-bottle/',
        icons: [
          { src: '/assets/app-icon.png', sizes: '192x192', type: 'image/png' },
          { src: '/assets/app-icon.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/spin-bottle/index.html',
      },
    }),
  ],
});
