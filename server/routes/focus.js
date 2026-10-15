import express from 'express';
import { db } from '../db.js';

const router = express.Router();

const TIMER_DURATIONS = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60
};

// Calculate authoritative derived remaining seconds from timestamps
export function getAuthoritativeFocusState() {
  const state = db.get('focusState') || {
    currentTaskId: null,
    status: 'idle',
    mode: 'focus',
    startTimestamp: null,
    pauseTimestamp: null,
    pausedDurationMs: 0,
    totalDurationSec: TIMER_DURATIONS.focus,
    cycleCount: 0,
    sessionsToday: 0,
    history: []
  };

  const totalSec = state.totalDurationSec || TIMER_DURATIONS[state.mode] || TIMER_DURATIONS.focus;

  if (state.status === 'running' && state.startTimestamp) {
    const now = Date.now();
    const elapsedMs = (now - state.startTimestamp) - (state.pausedDurationMs || 0);
    const remainingSec = Math.max(0, totalSec - Math.floor(elapsedMs / 1000));
    return { ...state, remainingSec, totalDurationSec: totalSec };
  } else if (state.status === 'paused' && state.startTimestamp && state.pauseTimestamp) {
    const elapsedMs = (state.pauseTimestamp - state.startTimestamp) - (state.pausedDurationMs || 0);
    const remainingSec = Math.max(0, totalSec - Math.floor(elapsedMs / 1000));
    return { ...state, remainingSec, totalDurationSec: totalSec };
  }

  return { ...state, remainingSec: totalSec, totalDurationSec: totalSec };
}

// GET /api/focus
router.get('/', (req, res) => {
  res.json(getAuthoritativeFocusState());
});

// POST /api/focus/start - Start or resume session
router.post('/start', (req, res) => {
  const { taskId, mode } = req.body;
  const current = getAuthoritativeFocusState();
  const targetMode = mode || current.mode || 'focus';
  const totalSec = TIMER_DURATIONS[targetMode] || TIMER_DURATIONS.focus;

  let updatedState = { ...current };

  if (current.status === 'paused' && current.pauseTimestamp) {
    // Resume from paused
    const pauseLength = Date.now() - current.pauseTimestamp;
    updatedState.pausedDurationMs = (current.pausedDurationMs || 0) + pauseLength;
    updatedState.pauseTimestamp = null;
    updatedState.status = 'running';
  } else {
    // Brand new session
    updatedState.status = 'running';
    updatedState.mode = targetMode;
    updatedState.totalDurationSec = totalSec;
    updatedState.startTimestamp = Date.now();
    updatedState.pauseTimestamp = null;
    updatedState.pausedDurationMs = 0;
  }

  if (taskId !== undefined) {
    updatedState.currentTaskId = taskId;
  }

  db.set('focusState', updatedState);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('FOCUS_UPDATED', getAuthoritativeFocusState());
  }

  res.json({ success: true, focusState: getAuthoritativeFocusState() });
});

// POST /api/focus/pause - Pause running session
router.post('/pause', (req, res) => {
  const current = getAuthoritativeFocusState();
  if (current.status !== 'running') {
    return res.json({ success: true, focusState: current });
  }

  const updatedState = {
    ...current,
    status: 'paused',
    pauseTimestamp: Date.now()
  };

  db.set('focusState', updatedState);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('FOCUS_UPDATED', getAuthoritativeFocusState());
  }

  res.json({ success: true, focusState: getAuthoritativeFocusState() });
});

// POST /api/focus/reset - Reset current timer
router.post('/reset', (req, res) => {
  const current = getAuthoritativeFocusState();
  const totalSec = TIMER_DURATIONS[current.mode] || TIMER_DURATIONS.focus;

  const updatedState = {
    ...current,
    status: 'idle',
    startTimestamp: null,
    pauseTimestamp: null,
    pausedDurationMs: 0,
    totalDurationSec: totalSec
  };

  db.set('focusState', updatedState);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('FOCUS_UPDATED', getAuthoritativeFocusState());
  }

  res.json({ success: true, focusState: getAuthoritativeFocusState() });
});

// POST /api/focus/skip - Advance to next break or focus block
router.post('/skip', (req, res) => {
  const current = getAuthoritativeFocusState();
  let nextMode = 'focus';
  let nextCycle = current.cycleCount || 0;

  if (current.mode === 'focus') {
    nextCycle = (nextCycle + 1) % 4;
    nextMode = nextCycle === 0 ? 'longBreak' : 'shortBreak';
  } else {
    nextMode = 'focus';
  }

  const totalSec = TIMER_DURATIONS[nextMode] || TIMER_DURATIONS.focus;
  const updatedState = {
    ...current,
    status: 'idle',
    mode: nextMode,
    cycleCount: nextCycle,
    startTimestamp: null,
    pauseTimestamp: null,
    pausedDurationMs: 0,
    totalDurationSec: totalSec
  };

  db.set('focusState', updatedState);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('FOCUS_UPDATED', getAuthoritativeFocusState());
  }

  res.json({ success: true, focusState: getAuthoritativeFocusState() });
});

// POST /api/focus/mode - Switch phase (focus / shortBreak / longBreak), resets timer
router.post('/mode', (req, res) => {
  const { mode } = req.body;
  if (!TIMER_DURATIONS[mode]) {
    return res.status(400).json({ error: 'Invalid mode' });
  }
  const current = getAuthoritativeFocusState();
  const updatedState = {
    ...current,
    status: 'idle',
    mode,
    startTimestamp: null,
    pauseTimestamp: null,
    pausedDurationMs: 0,
    totalDurationSec: TIMER_DURATIONS[mode]
  };

  db.set('focusState', updatedState);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('FOCUS_UPDATED', getAuthoritativeFocusState());
  }

  res.json({ success: true, focusState: getAuthoritativeFocusState() });
});

// POST /api/focus/target - Lock on a specific target task
router.post('/target', (req, res) => {
  const { taskId } = req.body;
  const current = getAuthoritativeFocusState();
  const updatedState = {
    ...current,
    currentTaskId: taskId || null
  };

  db.set('focusState', updatedState);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('FOCUS_UPDATED', getAuthoritativeFocusState());
  }

  res.json({ success: true, focusState: getAuthoritativeFocusState() });
});

export default router;
