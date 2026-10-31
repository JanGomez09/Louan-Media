import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' permite servir el sitio desde GitHub Pages (https://usuario.github.io/repo/)
export default defineConfig({
  plugins: [react()],
  base: './',
});
