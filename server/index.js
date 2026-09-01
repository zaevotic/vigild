import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { db } from './db.js';
import filesRouter from './routes/files.js';
import alarmsRouter from './routes/alarms.js';
import systemRouter, { resolveStoragePath } from './routes/system.js';
import playbackRouter from './routes/playback.js';
import playlistsRouter from './routes/playlists.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Dynamic SD Card / Uploads static folder serving
app.use('/uploads', (req, res, next) => {
  const targetDir = resolveStoragePath();
  express.static(targetDir)(req, res, next);
});

// Tones folder
const TONES_DIR = path.join(__dirname, '../uploads/tones');
if (!fs.existsSync(TONES_DIR)) {
  fs.mkdirSync(TONES_DIR, { recursive: true });
}
app.use('/uploads/tones', express.static(TONES_DIR));

// Handle HTTP upgrade requests for WebSocket on /ws
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// WebSocket broadcast helper
function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload, timestamp: Date.now() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

app.set('wssBroadcast', broadcast);
app.set('wssClientCount', () => wss.clients.size);

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('[WSS] Client connected across network! Total active clients:', wss.clients.size);

  ws.send(JSON.stringify({
    type: 'INITIAL_STATE',
    payload: {
      alarms: db.get('alarms') || [],
      activeAlarm: db.get('activeAlarm'),
      media: db.get('media') || [],
      playlists: db.get('playlists') || [],
      playbackState: db.get('playbackState') || { currentMedia: null, isPlaying: false, currentTime: 0, duration: 0 },
      settings: db.get('settings') || {}
    }
  }));

  ws.on('message', (messageRaw) => {
    try {
      const { type, payload } = JSON.parse(messageRaw.toString());

      if (type === 'PLAYBACK_UPDATE') {
        const currentPlayback = db.get('playbackState') || {};
        const newPlayback = { ...currentPlayback, ...payload };
        db.set('playbackState', newPlayback);
        broadcast('PLAYBACK_UPDATED', newPlayback);
      } else if (type === 'REMOTE_COMMAND') {
        if (payload.action === 'CHANGE_MODE') {
          const settings = db.get('settings') || {};
          settings.activeDashboardMode = payload.mode;
          db.set('settings', settings);
          broadcast('SETTINGS_UPDATED', settings);
        }
      }
    } catch (e) {
      console.error('[WSS] Error parsing message:', e);
    }
  });

  ws.on('close', () => {
    console.log('[WSS] Client disconnected. Total active clients:', wss.clients.size);
  });
});

// API Routes
app.use('/api/files', filesRouter);
app.use('/api/alarms', alarmsRouter);
app.use('/api/system', systemRouter);
app.use('/api/playback', playbackRouter);
app.use('/api/playlists', playlistsRouter);

// Background alarm trigger loop (checks every 10 seconds)
let lastTriggeredMinute = '';
setInterval(() => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${hours}:${minutes}`;

  if (currentTime === lastTriggeredMinute) return;

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentDay = daysOfWeek[now.getDay()];

  const alarms = db.get('alarms') || [];
  const activeAlarm = db.get('activeAlarm');

  if (activeAlarm) return;

  const matchingAlarm = alarms.find(a => {
    if (!a.enabled) return false;
    if (a.time !== currentTime) return false;
    if (a.days && a.days.length > 0 && !a.days.includes(currentDay)) return false;
    return true;
  });

  if (matchingAlarm) {
    lastTriggeredMinute = currentTime;
    const triggered = {
      id: matchingAlarm.id,
      time: matchingAlarm.time,
      label: matchingAlarm.label,
      tone: matchingAlarm.tone || 'Default Cyber Alarm',
      toneUrl: matchingAlarm.toneUrl || '/uploads/tones/default_cyber_alarm.wav',
      triggeredAt: new Date().toISOString()
    };
    db.set('activeAlarm', triggered);
    console.log(`[ALARM] Triggering scheduled alarm across network: ${matchingAlarm.label} (${matchingAlarm.time})`);
    broadcast('ALARM_TRIGGERED', triggered);
  }
}, 10000);

// Integrate Frontend (Vite Dev Middleware or Static Production Bundle)
const DIST_DIR = path.join(__dirname, '../dist');
const isProduction = process.env.NODE_ENV === 'production' || fs.existsSync(DIST_DIR);

if (isProduction && fs.existsSync(DIST_DIR)) {
  console.log('[Server] Serving production frontend build from dist/');
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  console.log('[Server] Integrating Vite development middleware on port', PORT);
  try {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } catch (err) {
    console.error('[Server Error] Could not load Vite dev middleware:', err);
  }
}

function startServer(portToTry) {
  server.listen(portToTry, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(` vigild Full-Stack Server Running on http://0.0.0.0:${portToTry}`);
    console.log(` SD Card / Storage folder: ${resolveStoragePath()}`);
    console.log(` Tones folder: ${TONES_DIR}`);
    console.log(`====================================================`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[Server] Port ${portToTry} in use, trying port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('[Server Error]', err);
    }
  });
}

startServer(PORT);
