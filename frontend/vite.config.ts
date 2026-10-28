import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@marking': fileURLToPath(new URL('./src/marking', import.meta.url)) } },
  optimizeDeps: { include: ['@tanstack/react-query', 'axios', 'i18next', 'react-i18next', 'sonner', 'zod', 'zustand', 'lucide-react', 'radix-ui', '@hookform/resolvers/zod', 'react-day-picker', 'class-variance-authority', 'clsx', 'tailwind-merge'] },
  server: { port: 5173, strictPort: true, proxy: { '/api': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:5180', changeOrigin: false } } },
  build: { sourcemap: false, chunkSizeWarningLimit: 800 },
});
