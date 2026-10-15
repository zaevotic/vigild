import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DB_TMP_FILE = path.join(DATA_DIR, 'db.json.tmp');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const defaultData = {
  alarms: [
    {
      id: 'alarm_1',
      time: '06:05',
      label: 'Get up!!!',
      days: [1, 1, 1, 1, 1, 1, 1], // Mon-Sun
      enabled: true,
      tone: 'default',
      toneUrl: '/uploads/tones/default_cyber_alarm.wav',
      volume: 80,
      fadeIn: 1,
      snoozeMinutes: 5,
      ringDurationMinutes: 5
    }
  ],
  alarmOccurrences: [],
  media: [],
  playlists: [
    {
      id: 'pl_focus',
      name: 'Deep focus',
      tracks: [],
      createdAt: new Date().toISOString()
    },
    {
      id: 'pl_wakeup',
      name: 'Wake up',
      tracks: [],
      createdAt: new Date().toISOString()
    }
  ],
  tasks: [
    {
      id: 'task_1',
      title: 'Network Flow fundamentals',
      notes: 'Edmonds-Karp and Ford-Fulkerson algorithms',
      category: 'Work',
      priority: 2, // 0: Low, 1: Medium, 2: High, 3: Urgent
      dueDate: '',
      reminderLead: '1440', // 1 day before
      estimatedSessions: 2,
      completedSessions: 0,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortOrder: 0
    },
    {
      id: 'task_2',
      title: 'DP as a whole',
      notes: 'Memoization and state transitions',
      category: 'Work',
      priority: 1,
      dueDate: '',
      reminderLead: '1440',
      estimatedSessions: 3,
      completedSessions: 0,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortOrder: 1
    }
  ],
  focusState: {
    currentTaskId: 'task_1',
    status: 'idle', // 'idle' | 'running' | 'paused' | 'break'
    mode: 'focus', // 'focus' | 'shortBreak' | 'longBreak'
    startTimestamp: null,
    pauseTimestamp: null,
    pausedDurationMs: 0,
    totalDurationSec: 25 * 60,
    cycleCount: 0,
    sessionsToday: 0,
    history: []
  },
  playbackState: {
    currentMedia: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 60,
    shuffle: true,
    repeat: 'all', // 'off' | 'all' | 'one'
    activePlaylistId: null,
    originalQueue: [],
    shuffledQueue: [],
    queueIndex: 0
  },
  transfers: [], // Active and completed chunked transfers
  settings: {
    deviceName: 'Samsung M34 Desk Server',
    storagePath: path.join(__dirname, '../uploads'),
    maxStorageGB: 128,
    activeDashboardMode: 'clock',
    volume: 80
  },
  activeAlarm: null
};

class JSONDatabase {
  constructor() {
    this.idempotencyMap = new Map(); // requestId -> cached response
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        delete parsed.habits;

        // Merge defaults for missing schema fields
        const merged = {
          ...defaultData,
          ...parsed,
          focusState: { ...defaultData.focusState, ...(parsed.focusState || {}) },
          playbackState: { ...defaultData.playbackState, ...(parsed.playbackState || {}) },
          settings: { ...defaultData.settings, ...(parsed.settings || {}) }
        };

        // Migrate tasks to ensure all new fields exist
        if (Array.isArray(merged.tasks)) {
          merged.tasks = merged.tasks.map((t, idx) => ({
            id: t.id || 'task_' + Date.now() + '_' + idx,
            title: t.title || t.n || 'Untitled Task',
            notes: t.notes || t.description || '',
            category: t.category || t.cat || 'Work',
            priority: typeof t.priority === 'number' ? t.priority : (t.priority === 'high' ? 2 : t.priority === 'low' ? 0 : 1),
            dueDate: t.dueDate || t.due || '',
            reminderLead: t.reminderLead || t.rem || 'none',
            estimatedSessions: t.estimatedSessions || t.est || 1,
            completedSessions: t.completedSessions || 0,
            completed: !!t.completed,
            createdAt: t.createdAt || new Date().toISOString(),
            updatedAt: t.updatedAt || new Date().toISOString(),
            sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : idx
          }));
        }

        // Migrate alarms to ensure all fields exist
        if (Array.isArray(merged.alarms)) {
          merged.alarms = merged.alarms.map(a => ({
            id: a.id || 'alarm_' + Date.now(),
            time: a.time || a.t || '07:30',
            label: a.label || a.l || 'Alarm',
            enabled: a.enabled !== undefined ? !!a.enabled : (a.on !== undefined ? !!a.on : true),
            days: Array.isArray(a.days) && typeof a.days[0] === 'number'
              ? a.days
              : (Array.isArray(a.days)
                ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => a.days.includes(d) ? 1 : 0)
                : [1, 1, 1, 1, 1, 0, 0]),
            tone: a.tone || 'default',
            toneUrl: a.toneUrl || '/uploads/tones/default_cyber_alarm.wav',
            volume: typeof a.volume === 'number' ? a.volume : 80,
            fadeIn: a.fadeIn !== undefined ? a.fadeIn : 1,
            snoozeMinutes: a.snoozeMinutes !== undefined ? a.snoozeMinutes : 5,
            ringDurationMinutes: a.ringDurationMinutes !== undefined ? a.ringDurationMinutes : 5
          }));
        }

        return merged;
      }
    } catch (err) {
      console.error('[DB] Error loading database file, initializing defaults:', err.message);
    }
    this.save(defaultData);
    return defaultData;
  }

  // Resilient atomic write: writes to temporary file then renames
  save(newData) {
    if (newData) this.data = newData;
    try {
      const json = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(DB_TMP_FILE, json, 'utf-8');
      fs.renameSync(DB_TMP_FILE, DB_FILE);
    } catch (err) {
      console.error('[DB] Error saving database atomically:', err.message);
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
    return this.data[key];
  }

  // Idempotency: Check if client requestId was already executed
  checkIdempotency(requestId) {
    if (!requestId) return null;
    return this.idempotencyMap.get(requestId) || null;
  }

  setIdempotency(requestId, result) {
    if (!requestId) return;
    if (this.idempotencyMap.size > 1000) {
      const firstKey = this.idempotencyMap.keys().next().value;
      this.idempotencyMap.delete(firstKey);
    }
    this.idempotencyMap.set(requestId, result);
  }
}

export const db = new JSONDatabase();
