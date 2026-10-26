/**
 * Express application setup.
 * This file creates the app, adds middleware, and connects the routes.
 * (server.js is the file that actually starts listening on a port.)
 */
const path = require('path');
const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const areasRoutes = require('./routes/areas.routes');
const configRoutes = require('./routes/config.routes');
const photoRoutes = require('./routes/photo.routes');
const residentRoutes = require('./routes/resident.routes');
const teamRoutes = require('./routes/team.routes');
const adminRoutes = require('./routes/admin.routes');
const reportRoutes = require('./routes/report.routes');
const notificationRoutes = require('./routes/notification.routes');
const profileRoutes = require('./routes/profile.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const alertRoutes = require('./routes/alert.routes');
const hotspotRoutes = require('./routes/hotspot.routes');
const chatRoutes = require('./routes/chat.routes');
const chatbotRoutes = require('./routes/chatbot.routes');
const liveChatRoutes = require('./routes/liveChat.routes');
const publicRoutes = require('./routes/public.routes');
const staffRoutes = require('./routes/staff.routes');
const { requireAuth, requireRole, ALL_ROLES } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// On hosting (e.g. Render) the app runs behind a proxy that handles HTTPS.
app.set('trust proxy', 1);

// Allow the React client (a different port) to call this API.
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));

// Read JSON request bodies. The size limit blocks very large payloads.
app.use(express.json({ limit: '100kb' }));

// ----- Public routes -----
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/areas', areasRoutes);
app.use('/api/config', configRoutes);
app.use('/api/public', publicRoutes);

// ----- Protected route groups -----
// Every route added later under these prefixes is protected automatically:
// no token -> 401, wrong role -> 403.

app.use('/api/resident', requireAuth, requireRole('resident'), residentRoutes);
app.use('/api/team', requireAuth, requireRole('response_team'), teamRoutes);
app.use('/api/admin', requireAuth, requireRole('lgu'), adminRoutes);
app.use('/api/staff', requireAuth, requireRole('response_team', 'lgu'), staffRoutes);

// Shared by several roles: login required here, each route checks its own role.
app.use('/api/reports', requireAuth, reportRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);
app.use('/api/profile', requireAuth, requireRole(...ALL_ROLES), profileRoutes);
app.use('/api/photos', requireAuth, requireRole(...ALL_ROLES), photoRoutes);
app.use('/api/dashboard', requireAuth, requireRole('response_team', 'lgu'), dashboardRoutes);
app.use('/api/alerts', requireAuth, requireRole('response_team', 'lgu'), alertRoutes);
app.use('/api/hotspots', requireAuth, requireRole('response_team', 'lgu'), hotspotRoutes);
app.use('/api/chat', requireAuth, requireRole(...ALL_ROLES), chatRoutes);
app.use('/api/chatbot', requireAuth, requireRole('resident'), chatbotRoutes);
app.use('/api/livechat', requireAuth, liveChatRoutes);

// ----- The website itself (hosting: one service for website + API) -----
// In production (NODE_ENV=production), or with SERVE_CLIENT=true, the built
// React app (client/dist, made by "npm run build") is served from the same
// address as the API, so the browser needs no CORS and Socket.IO connects to
// the same server. In development the Vite dev server does this instead.
if (process.env.NODE_ENV === 'production' || process.env.SERVE_CLIENT === 'true') {
  const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
  // Hashed files (assets/index-ab12.js) never change: cache them for a year.
  app.use('/assets', express.static(path.join(CLIENT_DIST, 'assets'), { immutable: true, maxAge: '1y' }));
  // A missing asset (e.g. an old file after a new deploy) is a real 404, not the HTML page.
  app.use('/assets', (req, res) => res.status(404).end());
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
  // Any other page address (/home, /admin/reports/5 ...) gets index.html; React shows the page.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return next();
    res.set('Cache-Control', 'no-cache');
    return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// ----- Error handling (must be added after all routes) -----
app.use(notFound);
app.use(errorHandler);

module.exports = app;
