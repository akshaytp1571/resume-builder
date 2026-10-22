import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // The app ships as plain static files served from the domain root. Keep this
  // absolute so the asset URLs in dist/index.html work on any host or subpath.
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    // The single JS chunk is ~2.4 MB (docx + jspdf + lucide). Vite 8 uses
    // rolldown, where manualChunks takes a function and must return a chunk
    // name or undefined.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/react|react-dom|scheduler/.test(id)) return 'react-vendor';
          if (/docx|file-saver|html2pdf|jspdf/.test(id)) return 'doc-export';
          return undefined;
        },
      },
    },
  },
})
