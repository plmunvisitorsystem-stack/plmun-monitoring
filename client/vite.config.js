import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite settings for the React client.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Any request starting with /api is forwarded to the Express server,
    // so the client can call fetch('/api/...') without writing the full URL.
    // /socket.io is the real-time chat connection (ws: true = WebSocket).
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
});
