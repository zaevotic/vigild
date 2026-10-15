import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TONES_DIR = path.join(__dirname, '../../uploads/tones');
if (!fs.existsSync(TONES_DIR)) {
  fs.mkdirSync(TONES_DIR, { recursive: true });
}

// Generate default WAV tone if directory is empty
function ensureDefaultTone() {
  try {
    const files = fs.readdirSync(TONES_DIR).filter(f => /\.(wav|mp3|ogg|m4a)$/i.test(f));
    if (files.length === 0) {
      const defaultWavPath = path.join(TONES_DIR, 'default_cyber_alarm.wav');
      const sampleRate = 44100;
      const numChannels = 1;
      const bitsPerSample = 16;
      const durationSec = 3;
      const numSamples = sampleRate * durationSec;
      const blockAlign = numChannels * (bitsPerSample / 8);
      const byteRate = sampleRate * blockAlign;
      const dataSize = numSamples * blockAlign;
      const chunkSize = 36 + dataSize;

      const buffer = Buffer.alloc(44 + dataSize);
      buffer.write('RIFF', 0);
      buffer.writeUInt32LE(chunkSize, 4);
      buffer.write('WAVE', 8);
      buffer.write('fmt ', 12);
      buffer.writeUInt32LE(16, 16);
      buffer.writeUInt16LE(1, 20);
      buffer.writeUInt16LE(numChannels, 22);
      buffer.writeUInt32LE(sampleRate, 24);
      buffer.writeUInt32LE(byteRate, 28);
      buffer.writeUInt16LE(blockAlign, 32);
      buffer.writeUInt16LE(bitsPerSample, 34);
      buffer.write('data', 36);
      buffer.writeUInt32LE(dataSize, 40);

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const cycle = Math.floor(t * 4) % 2;
        const freq = cycle === 0 ? 880 : 1320;
        const sampleVal = Math.sin(2 * Math.PI * freq * t) * 0.4;
        const sample16 = Math.max(-32768, Math.min(32767, Math.floor(sampleVal * 32767)));
        buffer.writeInt16LE(sample16, 44 + i * 2);
      }
      fs.writeFileSync(defaultWavPath, buffer);
      console.log('[ALARM] Generated default_cyber_alarm.wav audio file');
    }
  } catch (err) {
    console.error('[ALARM] Error generating default tone:', err);
  }
}

ensureDefaultTone();

// Helper to resolve tone and safely fall back if referenced uploaded song was deleted
function resolveTone(toneKey) {
  if (!toneKey || toneKey === 'default') {
    return {
      tone: 'default',
      name: 'Default tone',
      url: '/uploads/tones/default_cyber_alarm.wav'
    };
  }

  // Check if toneKey matches an uploaded song by ID
  const mediaList = db.get('media') || [];
  const song = mediaList.find(m => m.id === toneKey || m.path === toneKey || m.filename === toneKey);
  if (song) {
    return {
      tone: song.id,
      name: song.title || song.originalname || song.filename,
      url: song.url || `/uploads/${song.path || song.filename}`
    };
  }

  // Fallback to default
  return {
    tone: 'default',
    name: 'Default tone',
    url: '/uploads/tones/default_cyber_alarm.wav'
  };
}

const router = express.Router();

// GET all alarms + active alarm
router.get('/', (req, res) => {
  res.json({
    alarms: db.get('alarms') || [],
    activeAlarm: db.get('activeAlarm')
  });
});

// GET list of available audio tones (built-in default + uploaded songs)
router.get('/tones', (req, res) => {
  ensureDefaultTone();
  const tones = [
    {
      id: 'default',
      name: 'Default tone',
      filename: 'default_cyber_alarm.wav',
      url: '/uploads/tones/default_cyber_alarm.wav',
      isBuiltIn: true
    }
  ];

  // Include user uploaded songs as alarm tones
  const mediaList = db.get('media') || [];
  mediaList
    .filter(m => m.type === 'audio' || /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(m.filename || ''))
    .forEach(m => {
      tones.push({
        id: m.id,
        name: m.title || m.originalname || m.filename,
        filename: m.filename,
        url: m.url || `/uploads/${m.path || m.filename}`,
        isBuiltIn: false
      });
    });

  res.json(tones);
});

// POST new alarm
router.post('/', (req, res) => {
  const {
    time,
    label,
    days,
    preset,
    tone = 'default',
    volume = 80,
    fadeIn = 1,
    snoozeMinutes = 5,
    ringDurationMinutes = 5
  } = req.body;

  let daysArr = [1, 1, 1, 1, 1, 0, 0];
  if (preset === 'wk') daysArr = [1, 1, 1, 1, 1, 0, 0];
  else if (preset === 'we') daysArr = [0, 0, 0, 0, 0, 1, 1];
  else if (preset === 'all') daysArr = [1, 1, 1, 1, 1, 1, 1];
  else if (preset === 'once') daysArr = [0, 0, 0, 0, 0, 0, 0];
  else if (Array.isArray(days)) daysArr = days;

  const resolved = resolveTone(tone);
  const alarms = db.get('alarms') || [];

  const newAlarm = {
    id: 'alarm_' + Date.now(),
    time: time || '07:30',
    label: (label || 'Alarm').trim(),
    days: daysArr,
    enabled: true,
    tone: resolved.tone,
    toneUrl: resolved.url,
    volume: typeof volume === 'number' ? volume : 80,
    fadeIn: fadeIn !== undefined ? fadeIn : 1,
    snoozeMinutes: typeof snoozeMinutes === 'number' ? snoozeMinutes : 5,
    ringDurationMinutes: typeof ringDurationMinutes === 'number' ? ringDurationMinutes : 5
  };

  alarms.push(newAlarm);
  alarms.sort((a, b) => a.time.localeCompare(b.time));
  db.set('alarms', alarms);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('ALARMS_UPDATED', { alarms, activeAlarm: db.get('activeAlarm') });
  }

  res.json({ success: true, alarm: newAlarm });
});

// PUT update alarm
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const alarms = db.get('alarms') || [];
  const index = alarms.findIndex(a => a.id === id);

  if (index === -1) return res.status(404).json({ error: 'Alarm not found' });

  const {
    time,
    label,
    days,
    preset,
    tone,
    volume,
    fadeIn,
    snoozeMinutes,
    ringDurationMinutes,
    enabled
  } = req.body;

  if (time !== undefined) alarms[index].time = time;
  if (label !== undefined) alarms[index].label = label.trim();
  if (enabled !== undefined) alarms[index].enabled = !!enabled;
  if (volume !== undefined) alarms[index].volume = volume;
  if (fadeIn !== undefined) alarms[index].fadeIn = fadeIn;
  if (snoozeMinutes !== undefined) alarms[index].snoozeMinutes = snoozeMinutes;
  if (ringDurationMinutes !== undefined) alarms[index].ringDurationMinutes = ringDurationMinutes;

  if (preset) {
    if (preset === 'wk') alarms[index].days = [1, 1, 1, 1, 1, 0, 0];
    else if (preset === 'we') alarms[index].days = [0, 0, 0, 0, 0, 1, 1];
    else if (preset === 'all') alarms[index].days = [1, 1, 1, 1, 1, 1, 1];
    else if (preset === 'once') alarms[index].days = [0, 0, 0, 0, 0, 0, 0];
  } else if (Array.isArray(days)) {
    alarms[index].days = days;
  }

  if (tone !== undefined) {
    const resolved = resolveTone(tone);
    alarms[index].tone = resolved.tone;
    alarms[index].toneUrl = resolved.url;
  }

  alarms.sort((a, b) => a.time.localeCompare(b.time));
  db.set('alarms', alarms);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('ALARMS_UPDATED', { alarms, activeAlarm: db.get('activeAlarm') });
  }

  res.json({ success: true, alarm: alarms[index] });
});

// PATCH toggle alarm enabled status
router.patch('/:id/toggle', (req, res) => {
  const { id } = req.params;
  const alarms = db.get('alarms') || [];
  const index = alarms.findIndex(a => a.id === id);

  if (index === -1) return res.status(404).json({ error: 'Alarm not found' });

  alarms[index].enabled = !alarms[index].enabled;
  db.set('alarms', alarms);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('ALARMS_UPDATED', { alarms, activeAlarm: db.get('activeAlarm') });
  }

  res.json({ success: true, alarm: alarms[index] });
});

// POST test alarm tone on the dock
router.post('/test', (req, res) => {
  const { tone, toneUrl } = req.body;
  const resolved = resolveTone(tone);
  const testAlarm = {
    id: 'test_alarm_' + Date.now(),
    time: 'TEST',
    label: 'Test Tone',
    tone: resolved.tone,
    toneUrl: toneUrl || resolved.url,
    volume: 80,
    isTest: true,
    triggeredAt: new Date().toISOString()
  };

  db.set('activeAlarm', testAlarm);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('ALARM_TRIGGERED', testAlarm);
  }

  res.json({ success: true, activeAlarm: testAlarm });
});

// Trigger alarm (scheduled match or manual trigger)
router.post('/:id/trigger', (req, res) => {
  const { id } = req.params;
  const alarms = db.get('alarms') || [];
  const alarm = alarms.find(a => a.id === id);

  if (!alarm) return res.status(404).json({ error: 'Alarm not found' });

  const resolved = resolveTone(alarm.tone);
  const activeAlarm = {
    id: alarm.id,
    time: alarm.time,
    label: alarm.label,
    tone: resolved.tone,
    toneUrl: resolved.url,
    volume: alarm.volume || 80,
    fadeIn: alarm.fadeIn || 1,
    triggeredAt: new Date().toISOString()
  };

  db.set('activeAlarm', activeAlarm);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('ALARM_TRIGGERED', activeAlarm);
  }

  res.json({ success: true, activeAlarm });
});

router.post('/dismiss', (req, res) => {
  db.set('activeAlarm', null);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('ALARM_DISMISSED', null);
  }

  res.json({ success: true });
});

router.post('/snooze', (req, res) => {
  const active = db.get('activeAlarm');
  const snoozeMins = active?.snoozeMinutes || 5;
  db.set('activeAlarm', null);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('ALARM_SNOOZED', { active, snoozeTimeMinutes: snoozeMins });
  }

  res.json({ success: true, snoozeTimeMinutes: snoozeMins });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  let alarms = db.get('alarms') || [];
  alarms = alarms.filter(a => a.id !== id);
  db.set('alarms', alarms);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('ALARMS_UPDATED', { alarms, activeAlarm: db.get('activeAlarm') });
  }

  res.json({ success: true, id });
});

export default router;
