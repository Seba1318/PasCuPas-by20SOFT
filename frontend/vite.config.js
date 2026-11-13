import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cu VITE_API_URL=/api, Vite trimite cererile mai departe la FastAPI: frontendul și API-ul sunt
// pe același domeniu, deci un singur tunel HTTPS ajunge pentru testul pe telefon și nu e nevoie
// de CORS. Host-ul și antetele X-Forwarded-* rămân cele originale, așa că linkurile spre poze
// (/media/...) ies cu adresa tunelului.
const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000';
const proxy = {
  '/api': { target: API_TARGET, rewrite: (path) => path.replace(/^\/api/, '') },
  '/media': { target: API_TARGET },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
  build: {
    rollupOptions: {
      output: {
        // Bibliotecile stau în fișiere separate: se schimbă rar, deci rămân în cache între versiuni.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          leaflet: ['leaflet', 'react-leaflet', 'leaflet.markercluster'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
