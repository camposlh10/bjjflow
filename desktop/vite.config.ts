import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    proxy: {
      // Spring Boot backend (bjj-flow-backend) runs on 8090 in dev
      // (see server.port in the backend's application.yml)
      '/api': { target: 'http://localhost:8090', changeOrigin: true },
    },
  },
});
