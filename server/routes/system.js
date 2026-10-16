import express from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

export function resolveStoragePath() {
  const settings = db.get('settings') || {};
  if (settings.storagePath && fs.existsSync(settings.storagePath)) {
    return settings.storagePath;
  }
  if (process.env.SD_CARD_PATH && fs.existsSync(process.env.SD_CARD_PATH)) {
    return process.env.SD_CARD_PATH;
  }

  // 1. Termux external-1 symlink (Points directly to MicroSD Card e.g. /storage/1B38-4253)
  try {
    const termuxExternal = path.join(os.homedir(), 'storage/external-1');
    if (fs.existsSync(termuxExternal)) {
      const realPath = fs.realpathSync(termuxExternal);
      if (fs.existsSync(realPath)) return realPath;
      return termuxExternal;
    }
  } catch (e) {}

  // 2. Scan /storage for external MicroSD Cards (e.g. /storage/1B38-4253)
  if (fs.existsSync('/storage')) {
    try {
      const dirs = fs.readdirSync('/storage');
      for (const d of dirs) {
        if (d !== 'emulated' && d !== 'self' && d !== 'knox' && !d.startsWith('.')) {
          const fullPath = path.join('/storage', d);
          try {
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
              return fullPath;
            }
          } catch (err) {}
        }
      }
    } catch (e) {}
  }

  // 3. Fallback to Android internal storage (/sdcard or /storage/emulated/0)
  const androidPaths = ['/sdcard', '/storage/emulated/0'];
  for (const p of androidPaths) {
    if (fs.existsSync(p)) return p;
  }

  // 4. Fallback to project uploads directory
  const fallbackPath = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(fallbackPath)) {
    fs.mkdirSync(fallbackPath, { recursive: true });
  }
  return fallbackPath;
}

function getLocalNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ name, address: iface.address });
      }
    }
  }

  // Prioritize active Wi-Fi / Ethernet interfaces and private IP ranges for local connections
  addresses.sort((a, b) => {
    const aWifi = /wlan|eth|en|wl|wifi/i.test(a.name);
    const bWifi = /wlan|eth|en|wl|wifi/i.test(b.name);
    if (aWifi && !bWifi) return -1;
    if (!aWifi && bWifi) return 1;

    const a192 = a.address.startsWith('192.168.');
    const b192 = b.address.startsWith('192.168.');
    if (a192 && !b192) return -1;
    if (!a192 && b192) return 1;

    const a10 = a.address.startsWith('10.');
    const b10 = b.address.startsWith('10.');
    if (a10 && !b10) return -1;
    if (!a10 && b10) return 1;

    const a172 = /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(a.address);
    const b172 = /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(b.address);
    if (a172 && !b172) return -1;
    if (!a172 && b172) return 1;

    return 0;
  });

  return addresses.length > 0 ? addresses : [{ name: 'loopback', address: '127.0.0.1' }];
}

export function getStorageStats() {
  const storagePath = resolveStoragePath();
  try {
    if (fs.statfsSync) {
      const stats = fs.statfsSync(storagePath);
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bavail * stats.bsize;
      const usedBytes = totalBytes - freeBytes;

      const usedGB = parseFloat((usedBytes / (1024 ** 3)).toFixed(2));
      const maxGB = parseFloat((totalBytes / (1024 ** 3)).toFixed(2));
      const percentage = totalBytes > 0 ? parseFloat(((usedBytes / totalBytes) * 100).toFixed(1)) : 0;

      return {
        storagePath,
        usedBytes,
        usedGB,
        maxGB: maxGB || 128,
        totalGB: maxGB || 128,
        percentage,
        isSdCard: true
      };
    }
  } catch (err) {
    console.error('[SYSTEM] Error reading statfs:', err.message);
  }

  // Fallback calculation by directory size
  try {
    const files = fs.readdirSync(storagePath);
    let usedBytes = 0;
    for (const file of files) {
      try {
        const stats = fs.statSync(path.join(storagePath, file));
        if (stats.isFile()) usedBytes += stats.size;
      } catch (e) {}
    }
    const maxGB = (db.get('settings') || {}).maxStorageGB || 128;
    const maxBytes = maxGB * 1024 * 1024 * 1024;
    const usedGB = parseFloat((usedBytes / (1024 ** 3)).toFixed(2));
    const percentage = parseFloat(((usedBytes / maxBytes) * 100).toFixed(1));

    return {
      storagePath,
      usedBytes,
      usedGB,
      maxGB,
      totalGB: maxGB,
      percentage,
      isSdCard: true
    };
  } catch (e) {
    return { storagePath, usedBytes: 0, usedGB: 0, maxGB: 128, totalGB: 128, percentage: 0, isSdCard: true };
  }
}

router.get('/', (req, res) => {
  const settings = db.get('settings') || {};
  const storage = getStorageStats();
  const networkIPs = getLocalNetworkIPs();
  const wssClients = req.app.get('wssClientCount') ? req.app.get('wssClientCount')() : 1;

  res.json({
    settings: {
      ...settings,
      storagePath: storage.storagePath
    },
    storage,
    network: {
      ips: networkIPs,
      primaryIp: networkIPs[0]?.address || '127.0.0.1',
      port: process.env.PORT || 3000
    },
    connectedClients: wssClients,
    systemInfo: {
      uptimeSeconds: Math.floor(os.uptime()),
      platform: os.platform(),
      hostname: os.hostname(),
      freememMB: Math.floor(os.freemem() / (1024 * 1024)),
      totalmemMB: Math.floor(os.totalmem() / (1024 * 1024))
    }
  });
});

router.put('/settings', (req, res) => {
  const settings = db.get('settings') || {};
  const updatedSettings = { ...settings, ...req.body };
  db.set('settings', updatedSettings);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('SETTINGS_UPDATED', updatedSettings);
  }

  res.json({ success: true, settings: updatedSettings });
});

export default router;
