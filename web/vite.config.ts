import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // bind 0.0.0.0 — เครื่องอื่นใน LAN เข้าได้ผ่าน <ip>:5173
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000', // proxy รันฝั่งเครื่องนี้ → backend :3000 ของเครื่องนี้
    },
  },
});
