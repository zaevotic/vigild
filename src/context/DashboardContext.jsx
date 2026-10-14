import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const DashboardContext = createContext(null);

export const isMediaFile = (file) => {
  if (!file) return false;
  if (file.type === 'video' || file.type === 'audio') return true;
  const name = (file.filename || file.originalname || file.name || file.path || '').toLowerCase();
  return /\.(mp4|mkv|webm|mov|avi|mp3|wav|ogg|m4a|flac|aac)$/i.test(name);
};

export const isAudioFile = (file) => {
  if (!file) return false;
  if (file.type === 'audio') return true;
  const name = (file.filename || file.originalname || file.name || file.path || '').toLowerCase();
  return /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(name);
};

export const DashboardProvider = ({ children }) => {
  const [alarms, setAlarms] = useState([]);
  const [activeAlarm, setActiveAlarm] = useState(null);
  const [availableTones, setAvailableTones] = useState([]);
  const [media, setMedia] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [playbackState, setPlaybackState] = useState({
    currentMedia: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    shuffle: false,
    repeat: 'off', // 'off' | 'all' | 'one'
    activePlaylistId: null,
    originalQueue: [],
    shuffledQueue: [],
    queueIndex: 0
  });
  const [deviceRole, setDeviceRoleState] = useState(() => {
    try {
      const saved = localStorage.getItem('vigild_device_role');
      if (saved === 'dock' || saved === 'client') return saved;
      return 'dock';
    } catch (e) {
      return 'dock';
    }
  });

  const setDeviceRole = (role) => {
    if (role === 'dock' || role === 'client') {
      setDeviceRoleState(role);
      try {
        localStorage.setItem('vigild_device_role', role);
      } catch (e) {}
    }
  };

  const toggleDeviceRole = () => {
    const nextRole = deviceRole === 'dock' ? 'client' : 'dock';
    setDeviceRole(nextRole);
  };
  const [settings, setSettings] = useState({
    deviceName: 'Samsung M34 Desk Server',
    maxStorageGB: 128,
    activeDashboardMode: 'clock',
    volume: 80
  });
  const [system, setSystem] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef(null);

  // Fetch available tone audio files
  const fetchTones = async () => {
    try {
      const res = await fetch('/api/alarms/tones');
      const data = await res.json();
      if (Array.isArray(data)) setAvailableTones(data);
    } catch (e) {
      console.error('[DashboardContext] Error fetching tone files:', e);
    }
  };

  // Fetch initial REST data
  const refreshAllData = async () => {
    try {
      const [alarmsRes, filesRes, playlistsRes, tasksRes, sysRes] = await Promise.all([
        fetch('/api/alarms').then(r => r.json()).catch(() => ({})),
        fetch('/api/files').then(r => r.json()).catch(() => []),
        fetch('/api/playlists').then(r => r.json()).catch(() => []),
        fetch('/api/tasks').then(r => r.json()).catch(() => []),
        fetch('/api/system').then(r => r.json()).catch(() => null)
      ]);

      if (alarmsRes && alarmsRes.alarms) setAlarms(alarmsRes.alarms);
      if (alarmsRes && alarmsRes.activeAlarm !== undefined) setActiveAlarm(alarmsRes.activeAlarm);
      if (Array.isArray(filesRes)) setMedia(filesRes);
      if (Array.isArray(playlistsRes)) setPlaylists(playlistsRes);
      if (Array.isArray(tasksRes)) setTasks(tasksRes);
      if (sysRes) {
        setSystem(sysRes);
        if (sysRes.settings) setSettings(sysRes.settings);
      }
    } catch (err) {
      console.error('[DashboardContext] Error fetching REST data:', err);
    }
  };

  // WebSocket Auto-connect across local network
  useEffect(() => {
    refreshAllData();
    fetchTones();

    let reconnectTimer = null;

    const connectWS = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const { type, payload } = JSON.parse(event.data);

            switch (type) {
              case 'INITIAL_STATE':
                if (payload.alarms) setAlarms(payload.alarms);
                if (payload.activeAlarm !== undefined) setActiveAlarm(payload.activeAlarm);
                if (payload.media) setMedia(payload.media);
                if (payload.playlists) setPlaylists(payload.playlists);
                if (payload.tasks) setTasks(payload.tasks);
                if (payload.playbackState) setPlaybackState(prev => ({ ...prev, ...payload.playbackState }));
                if (payload.settings) setSettings(payload.settings);
                break;
              case 'ALARMS_UPDATED':
                if (payload.alarms) setAlarms(payload.alarms);
                if (payload.activeAlarm !== undefined) setActiveAlarm(payload.activeAlarm);
                break;
              case 'ALARM_TRIGGERED':
                setActiveAlarm(payload);
                break;
              case 'ALARM_DISMISSED':
              case 'ALARM_SNOOZED':
                setActiveAlarm(null);
                break;
              case 'MEDIA_UPDATED':
                setMedia(payload);
                break;
              case 'PLAYLISTS_UPDATED':
                setPlaylists(payload);
                break;
              case 'TASKS_UPDATED':
                setTasks(payload);
                break;
              case 'PLAYBACK_UPDATED':
                setPlaybackState(prev => ({ ...prev, ...payload }));
                break;
              case 'SETTINGS_UPDATED':
                setSettings(payload);
                break;
              default:
                break;
            }
          } catch (e) {
            console.error('[WS Parse Error]', e);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          reconnectTimer = setTimeout(connectWS, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        console.error('[WS Connection Error]', err);
        reconnectTimer = setTimeout(connectWS, 3000);
      }
    };

    connectWS();

    const sysInterval = setInterval(async () => {
      try {
        const sysRes = await fetch('/api/system').then(r => r.json());
        if (sysRes) setSystem(sysRes);
      } catch (e) {}
    }, 10000);

    return () => {
      clearInterval(sysInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Sync playback state change across network
  const sendPlaybackUpdate = (updateObj) => {
    const updated = { ...playbackState, ...updateObj };
    setPlaybackState(updated);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'PLAYBACK_UPDATE',
        payload: updateObj
      }));
    }
  };

  // Helper to shuffle array with Fisher-Yates algorithm
  const shuffleList = (list) => {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Helper to get active track queue (active playlist tracks, or general media stock)
  const getActiveQueue = (playlistId = undefined) => {
    const targetPlaylistId = playlistId !== undefined ? playlistId : playbackState.activePlaylistId;
    if (targetPlaylistId) {
      const activePl = playlists.find(p => p.id === targetPlaylistId);
      if (activePl && activePl.tracks && activePl.tracks.length > 0) {
        return activePl.tracks.filter(isMediaFile);
      }
    }
    // Global library: return all available music/audio tracks
    const audioFiles = (media || []).filter(isAudioFile);
    return audioFiles.length > 0 ? audioFiles : (media || []).filter(isMediaFile);
  };

  const playMedia = (mediaItem, playlistId = undefined) => {
    if (!mediaItem) {
      sendPlaybackUpdate({ currentMedia: null, isPlaying: false, currentTime: 0 });
      return;
    }
    if (!isMediaFile(mediaItem)) {
      console.warn('[Playback] Non-media file cannot be played:', mediaItem);
      return;
    }

    const fullQueue = getActiveQueue(playlistId);
    let originalQueue = fullQueue;
    if (!originalQueue.some(m => m.id === mediaItem.id || m.path === mediaItem.path)) {
      originalQueue = [mediaItem, ...originalQueue];
    }

    const isShuffle = playbackState.shuffle;
    let shuffledQueue = playbackState.shuffledQueue || [];
    let queueIndex = 0;

    if (isShuffle) {
      const remaining = originalQueue.filter(m => m.id !== mediaItem.id && m.path !== mediaItem.path);
      shuffledQueue = [mediaItem, ...shuffleList(remaining)];
      queueIndex = 0;
    } else {
      const idx = originalQueue.findIndex(m => m.id === mediaItem.id || m.path === mediaItem.path);
      queueIndex = idx >= 0 ? idx : 0;
    }

    sendPlaybackUpdate({
      currentMedia: mediaItem,
      isPlaying: true,
      currentTime: 0,
      activePlaylistId: playlistId !== undefined ? playlistId : playbackState.activePlaylistId,
      originalQueue,
      shuffledQueue,
      queueIndex
    });
  };

  const playPlaylist = (playlist, startIndex = 0) => {
    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;
    const validTracks = playlist.tracks.filter(isMediaFile);
    if (validTracks.length === 0) return;

    const startTrack = validTracks[startIndex] || validTracks[0];
    const isShuffle = playbackState.shuffle;
    let shuffledQueue = [];
    let queueIndex = 0;

    if (isShuffle) {
      const remaining = validTracks.filter(m => m.id !== startTrack.id && m.path !== startTrack.path);
      shuffledQueue = [startTrack, ...shuffleList(remaining)];
      queueIndex = 0;
    } else {
      queueIndex = startIndex >= 0 && startIndex < validTracks.length ? startIndex : 0;
    }

    sendPlaybackUpdate({
      currentMedia: startTrack,
      isPlaying: true,
      currentTime: 0,
      activePlaylistId: playlist.id,
      originalQueue: validTracks,
      shuffledQueue,
      queueIndex
    });
  };

  const togglePlayPause = () => {
    sendPlaybackUpdate({
      isPlaying: !playbackState.isPlaying
    });
  };

  const seekPlayback = (time) => {
    sendPlaybackUpdate({
      currentTime: time
    });
  };

  const toggleShuffle = () => {
    const nextShuffle = !playbackState.shuffle;
    const currentMedia = playbackState.currentMedia;
    const originalQueue = (playbackState.originalQueue && playbackState.originalQueue.length > 0)
      ? playbackState.originalQueue
      : getActiveQueue();

    if (nextShuffle) {
      let newShuffled = [];
      if (currentMedia) {
        const remaining = originalQueue.filter(m => m.id !== currentMedia.id && m.path !== currentMedia.path);
        newShuffled = [currentMedia, ...shuffleList(remaining)];
      } else {
        newShuffled = shuffleList(originalQueue);
      }
      sendPlaybackUpdate({
        shuffle: true,
        originalQueue,
        shuffledQueue: newShuffled,
        queueIndex: 0
      });
    } else {
      let origIdx = 0;
      if (currentMedia) {
        const idx = originalQueue.findIndex(m => m.id === currentMedia.id || m.path === currentMedia.path);
        if (idx >= 0) origIdx = idx;
      }
      sendPlaybackUpdate({
        shuffle: false,
        originalQueue,
        queueIndex: origIdx
      });
    }
  };

  const toggleRepeat = () => {
    const isCurrentlyOn = playbackState.repeat && playbackState.repeat !== 'off';
    const nextRepeat = isCurrentlyOn ? 'off' : 'all';
    sendPlaybackUpdate({ repeat: nextRepeat });
  };

  const playNextMedia = (isAutoEnd = false) => {
    // Handle repeat one
    if (isAutoEnd && playbackState.repeat === 'one' && playbackState.currentMedia) {
      sendPlaybackUpdate({
        currentTime: 0,
        isPlaying: true
      });
      return;
    }

    const isShuffle = playbackState.shuffle;
    const activeQueue = isShuffle
      ? (playbackState.shuffledQueue && playbackState.shuffledQueue.length > 0 ? playbackState.shuffledQueue : getActiveQueue())
      : (playbackState.originalQueue && playbackState.originalQueue.length > 0 ? playbackState.originalQueue : getActiveQueue());

    if (!activeQueue || activeQueue.length === 0) return;

    let currentIndex = playbackState.queueIndex !== undefined && playbackState.queueIndex !== null
      ? playbackState.queueIndex
      : activeQueue.findIndex(m => m.id === playbackState.currentMedia?.id || m.path === playbackState.currentMedia?.path);

    if (currentIndex < 0) currentIndex = 0;
    const nextIndex = currentIndex + 1;

    // Check if end of active queue is reached
    if (nextIndex >= activeQueue.length) {
      const isPlaylistActive = !!playbackState.activePlaylistId;
      const isRepeatOn = playbackState.repeat && playbackState.repeat !== 'off';

      if (isPlaylistActive && !isRepeatOn) {
        // PLAYLIST FINISHED & REPEAT IS OFF -> SWITCH TO GLOBAL MUSIC
        const globalMusic = (media || []).filter(isAudioFile);
        const targetGlobal = globalMusic.length > 0 ? globalMusic : (media || []).filter(isMediaFile);

        if (targetGlobal.length > 0) {
          let newShuffled = [];
          let startTrack = targetGlobal[0];

          if (isShuffle) {
            newShuffled = shuffleList(targetGlobal);
            startTrack = newShuffled[0];
          }

          sendPlaybackUpdate({
            activePlaylistId: null, // Switch to global library
            currentMedia: startTrack,
            isPlaying: true,
            currentTime: 0,
            originalQueue: targetGlobal,
            shuffledQueue: isShuffle ? newShuffled : [],
            queueIndex: 0
          });
          return;
        }
      }

      // If REPEAT is ON: loop the active queue
      if (isRepeatOn) {
        sendPlaybackUpdate({
          currentMedia: activeQueue[0],
          isPlaying: true,
          currentTime: 0,
          queueIndex: 0
        });
        return;
      }

      // If already in GLOBAL space and REPEAT is OFF:
      if (!isPlaylistActive && !isRepeatOn) {
        if (isAutoEnd) {
          if (isShuffle) {
            // Keep the ambient stream rolling in global space if shuffle is active
            const reShuffled = shuffleList(activeQueue);
            sendPlaybackUpdate({
              currentMedia: reShuffled[0],
              isPlaying: true,
              currentTime: 0,
              shuffledQueue: reShuffled,
              queueIndex: 0
            });
          } else {
            sendPlaybackUpdate({ isPlaying: false, currentTime: 0, queueIndex: 0 });
          }
        } else {
          sendPlaybackUpdate({
            currentMedia: activeQueue[0],
            isPlaying: true,
            currentTime: 0,
            queueIndex: 0
          });
        }
        return;
      }
    } else {
      sendPlaybackUpdate({
        currentMedia: activeQueue[nextIndex],
        isPlaying: true,
        currentTime: 0,
        queueIndex: nextIndex
      });
    }
  };

  const playPrevMedia = () => {
    // If track has been playing for more than 3 seconds, restart it
    if (playbackState.currentTime > 3) {
      sendPlaybackUpdate({
        currentTime: 0,
        isPlaying: true
      });
      return;
    }

    const isShuffle = playbackState.shuffle;
    const activeQueue = isShuffle
      ? (playbackState.shuffledQueue && playbackState.shuffledQueue.length > 0 ? playbackState.shuffledQueue : getActiveQueue())
      : (playbackState.originalQueue && playbackState.originalQueue.length > 0 ? playbackState.originalQueue : getActiveQueue());

    if (!activeQueue || activeQueue.length === 0) return;

    let currentIndex = playbackState.queueIndex !== undefined && playbackState.queueIndex !== null
      ? playbackState.queueIndex
      : activeQueue.findIndex(m => m.id === playbackState.currentMedia?.id || m.path === playbackState.currentMedia?.path);

    if (currentIndex <= 0) {
      const prevIndex = activeQueue.length - 1;
      sendPlaybackUpdate({
        currentMedia: activeQueue[prevIndex],
        isPlaying: true,
        currentTime: 0,
        queueIndex: prevIndex
      });
    } else {
      const prevIndex = currentIndex - 1;
      sendPlaybackUpdate({
        currentMedia: activeQueue[prevIndex],
        isPlaying: true,
        currentTime: 0,
        queueIndex: prevIndex
      });
    }
  };

  // Playlist management actions
  const createPlaylist = async (name) => {
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tracks: [] })
      });
      const data = await res.json();
      if (data.playlist) {
        setPlaylists(prev => [data.playlist, ...prev]);
      }
      return data;
    } catch (e) {
      console.error('[createPlaylist Error]', e);
    }
  };

  const updatePlaylistTracks = async (playlistId, updatedTracks) => {
    try {
      setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, tracks: updatedTracks } : p));
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: updatedTracks })
      });
      return res.json();
    } catch (e) {
      console.error('[updatePlaylistTracks Error]', e);
    }
  };

  const addTrackToPlaylist = async (playlistId, track) => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track })
      });
      const data = await res.json();
      if (data.playlist) {
        setPlaylists(prev => prev.map(p => p.id === playlistId ? data.playlist : p));
      }
      return data;
    } catch (e) {
      console.error('[addTrackToPlaylist Error]', e);
    }
  };

  const removeTrackFromPlaylist = async (playlistId, trackPathOrId) => {
    const targetPl = playlists.find(p => p.id === playlistId);
    if (!targetPl) return;

    const updatedTracks = (targetPl.tracks || []).filter(t => t.id !== trackPathOrId && t.path !== trackPathOrId);
    return updatePlaylistTracks(playlistId, updatedTracks);
  };

  const deletePlaylist = async (playlistId) => {
    try {
      setPlaylists(prev => prev.filter(p => p.id !== playlistId));
      if (playbackState.activePlaylistId === playlistId) {
        sendPlaybackUpdate({ activePlaylistId: null });
      }
      await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
    } catch (e) {
      console.error('[deletePlaylist Error]', e);
    }
  };

  // Task Actions
  const addTask = async (taskData) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      const data = await res.json();
      if (data.task) {
        setTasks(prev => {
          if (prev.some(t => t.id === data.task.id)) return prev;
          return [...prev, data.task];
        });
      }
      return data;
    } catch (err) {
      console.error('[addTask Error]', err);
    }
  };

  const updateTask = async (id, taskData) => {
    try {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...taskData } : t));
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      return res.json();
    } catch (err) {
      console.error('[updateTask Error]', err);
    }
  };

  const toggleTask = async (id) => {
    try {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
      const res = await fetch(`/api/tasks/${id}/toggle`, { method: 'PATCH' });
      return res.json();
    } catch (err) {
      console.error('[toggleTask Error]', err);
    }
  };

  const deleteTask = async (id) => {
    try {
      setTasks(prev => prev.filter(t => t.id !== id));
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      return res.json();
    } catch (err) {
      console.error('[deleteTask Error]', err);
    }
  };

  const clearCompletedTasks = async () => {
    try {
      setTasks(prev => prev.filter(t => !t.completed));
      const res = await fetch('/api/tasks/clear-completed', { method: 'POST' });
      return res.json();
    } catch (err) {
      console.error('[clearCompletedTasks Error]', err);
    }
  };

  // Alarm actions with direct state updates & fallback refresh
  const addAlarm = async (alarmData) => {
    try {
      const res = await fetch('/api/alarms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alarmData)
      });
      const data = await res.json();
      if (data.alarm) {
        setAlarms(prev => {
          const exists = prev.some(a => a.id === data.alarm.id);
          return exists ? prev : [...prev, data.alarm];
        });
      }
      refreshAllData();
      return data;
    } catch (err) {
      console.error('[addAlarm Error]', err);
    }
  };

  const updateAlarm = async (id, alarmData) => {
    try {
      setAlarms(prev => prev.map(a => a.id === id ? { ...a, ...alarmData } : a));
      const res = await fetch(`/api/alarms/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alarmData)
      });
      const data = await res.json();
      refreshAllData();
      return data;
    } catch (e) {
      console.error('[updateAlarm Error]', e);
    }
  };

  const toggleAlarm = async (id) => {
    try {
      setAlarms(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
      const res = await fetch(`/api/alarms/${id}/toggle`, { method: 'PATCH' });
      const data = await res.json();
      refreshAllData();
      return data;
    } catch (e) {
      console.error('[toggleAlarm Error]', e);
    }
  };

  const triggerAlarmTest = async (id) => {
    try {
      const res = await fetch(`/api/alarms/${id}/trigger`, { method: 'POST' });
      const data = await res.json();
      if (data.activeAlarm) setActiveAlarm(data.activeAlarm);
      return data;
    } catch (e) {
      const alarm = alarms.find(a => a.id === id);
      if (alarm) {
        setActiveAlarm({
          id: alarm.id,
          time: alarm.time,
          label: alarm.label,
          tone: alarm.tone || 'Default Cyber Alarm',
          toneUrl: alarm.toneUrl || '/uploads/tones/default_cyber_alarm.wav',
          triggeredAt: new Date().toISOString()
        });
      }
    }
  };

  const dismissAlarm = async () => {
    setActiveAlarm(null);
    try {
      await fetch('/api/alarms/dismiss', { method: 'POST' });
    } catch (e) {}
  };

  const snoozeAlarm = async () => {
    setActiveAlarm(null);
    try {
      await fetch('/api/alarms/snooze', { method: 'POST' });
    } catch (e) {}
  };

  const deleteAlarm = async (id) => {
    setAlarms(prev => prev.filter(a => a.id !== id));
    try {
      const res = await fetch(`/api/alarms/${id}`, { method: 'DELETE' });
      refreshAllData();
      return res.json();
    } catch (e) {}
  };

  const deleteMedia = async (id) => {
    const res = await fetch(`/api/files/${encodeURIComponent(id)}`, { method: 'DELETE' });
    refreshAllData();
    return res.json();
  };

  const updateSettings = async (newSettings) => {
    const res = await fetch('/api/system/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    });
    refreshAllData();
    return res.json();
  };

  return (
    <DashboardContext.Provider value={{
      alarms,
      activeAlarm,
      availableTones,
      media,
      playlists,
      tasks,
      playbackState,
      settings,
      system,
      isConnected,
      playMedia,
      playPlaylist,
      togglePlayPause,
      seekPlayback,
      toggleShuffle,
      toggleRepeat,
      playNextMedia,
      playPrevMedia,
      sendPlaybackUpdate,
      createPlaylist,
      updatePlaylistTracks,
      addTrackToPlaylist,
      removeTrackFromPlaylist,
      deletePlaylist,
      addTask,
      updateTask,
      toggleTask,
      deleteTask,
      clearCompletedTasks,
      addAlarm,
      updateAlarm,
      toggleAlarm,
      triggerAlarmTest,
      dismissAlarm,
      snoozeAlarm,
      deleteAlarm,
      deleteMedia,
      updateSettings,
      refreshAllData,
      fetchTones,
      deviceRole,
      setDeviceRole,
      toggleDeviceRole
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => useContext(DashboardContext);
