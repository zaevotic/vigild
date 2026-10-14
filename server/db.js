import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultData = {
  alarms: [
    {
      id: 'alarm_1',
      time: '07:30',
      label: 'Morning Work Focus',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      enabled: true,
      tone: 'Default Cyber Alarm',
      toneUrl: '/uploads/tones/default_cyber_alarm.wav',
      snoozeMinutes: 5
    }
  ],
  media: [],
  playlists: [
    {
      id: 'pl_default',
      name: 'Cyber Stock Mix',
      tracks: [],
      createdAt: new Date().toISOString()
    }
  ],
  tasks: [
    {
      id: 'task_1',
      title: 'Initialize DashMob Workstation Hub',
      description: 'Setup desk dock screen & WiFi connection',
      completed: true,
      priority: 'high',
      category: 'SETUP',
      dueDate: '',
      createdAt: new Date().toISOString()
    },
    {
      id: 'task_2',
      title: 'Organize SD Card Storage Vault',
      description: 'Categorize media files into playlist folders',
      completed: false,
      priority: 'medium',
      category: 'MEDIA',
      dueDate: '',
      createdAt: new Date().toISOString()
    }
  ],
  playbackState: {
    currentMedia: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    shuffle: false,
    repeat: 'off',
    activePlaylistId: null,
    originalQueue: [],
    shuffledQueue: [],
    queueIndex: 0
  },
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
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        delete parsed.habits;
        return { ...defaultData, ...parsed };
      }
    } catch (err) {
      console.error('[DB] Error loading database file, initializing defaults:', err.message);
    }
    this.save(defaultData);
    return defaultData;
  }

  save(newData) {
    if (newData) this.data = newData;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Error saving database:', err.message);
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
}

export const db = new JSONDatabase();
