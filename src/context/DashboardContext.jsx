import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const DashboardContext = createContext(null);

export const isMediaFile = (file) => {
  if (!file) return false;
  if (file.type === 'video' || file.type === 'audio') return true;
  const name = (file.filename || file.originalname || file.name || file.path || '').toLowerCase();
  return /\.(mp4|mkv|webm|mov|avi|mp3|wav|ogg|m4a|flac|aac)$/i.test(name);
};

export const DashboardProvider = ({ children }) => {
  const [alarms, setAlarms] = useState([]);
  const [activeAlarm, setActiveAlarm] = useState(null);
  const [availableTones, setAvailableTones] = useState([]);
  const [media, setMedia] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [playbackState, setPlaybackState] = useState({
    currentMedia: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    shuffle: false,
    repeat: 'off', // 'off' | 'all' | 'one'
    activePlaylistId: null
  });
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
      const [alarmsRes, filesRes, playlistsRes, sysRes] = await Promise.all([
        fetch('/api/alarms').then(r => r.json()).catch(() => ({})),
        fetch('/api/files').then(r => r.json()).catch(() => []),
        fetch('/api/playlists').then(r => r.json()).catch(() => []),
        fetch('/api/system').then(r => r.json()).catch(() => null)
      ]);

      if (alarmsRes && alarmsRes.alarms) setAlarms(alarmsRes.alarms);
      if (alarmsRes && alarmsRes.activeAlarm !== undefined) setActiveAlarm(alarmsRes.activeAlarm);
      if (Array.isArray(filesRes)) setMedia(filesRes);
      if (Array.isArray(playlistsRes)) setPlaylists(playlistsRes);
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

  // Helper to get active track queue (active playlist tracks, or general media stock)
  const getActiveQueue = () => {
    if (playbackState.activePlaylistId) {
      const activePl = playlists.find(p => p.id === playbackState.activePlaylistId);
      if (activePl && activePl.tracks && activePl.tracks.length > 0) {
        return activePl.tracks.filter(isMediaFile);
      }
    }
    return (media || []).filter(isMediaFile);
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
    sendPlaybackUpdate({
      currentMedia: mediaItem,
      isPlaying: true,
      currentTime: 0,
      activePlaylistId: playlistId !== undefined ? playlistId : playbackState.activePlaylistId
    });
  };

  const playPlaylist = (playlist, startIndex = 0) => {
    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;
    const validTracks = playlist.tracks.filter(isMediaFile);
    if (validTracks.length === 0) return;

    const startTrack = validTracks[startIndex] || validTracks[0];
    sendPlaybackUpdate({
      currentMedia: startTrack,
      isPlaying: true,
      currentTime: 0,
      activePlaylistId: playlist.id
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
    const newShuffle = !playbackState.shuffle;
    sendPlaybackUpdate({ shuffle: newShuffle });
  };

  const toggleRepeat = () => {
    const modes = ['off', 'all', 'one'];
    const currIdx = modes.indexOf(playbackState.repeat);
    const nextMode = modes[(currIdx + 1) % modes.length];
    sendPlaybackUpdate({ repeat: nextMode });
  };

  const playNextMedia = (isAutoEnd = false) => {
    const queue = getActiveQueue();
    if (queue.length === 0) return;

    // Handle repeat one
    if (isAutoEnd && playbackState.repeat === 'one' && playbackState.currentMedia) {
      sendPlaybackUpdate({
        currentTime: 0,
        isPlaying: true
      });
      return;
    }

    // Handle shuffle
    if (playbackState.shuffle) {
      const candidates = queue.length > 1 
        ? queue.filter(m => (m.id !== playbackState.currentMedia?.id && m.path !== playbackState.currentMedia?.path))
        : queue;
      const randomItem = candidates[Math.floor(Math.random() * candidates.length)];
      playMedia(randomItem);
      return;
    }

    // Sequential playback
    const currentIndex = queue.findIndex(m => m.id === playbackState.currentMedia?.id || m.path === playbackState.currentMedia?.path);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= queue.length) {
      if (playbackState.repeat === 'all') {
        playMedia(queue[0]);
      } else if (isAutoEnd) {
        sendPlaybackUpdate({ isPlaying: false, currentTime: 0 });
      } else {
        playMedia(queue[0]);
      }
    } else {
      playMedia(queue[nextIndex]);
    }
  };

  const playPrevMedia = () => {
    const queue = getActiveQueue();
    if (queue.length === 0) return;

    if (playbackState.shuffle) {
      const candidates = queue.length > 1 
        ? queue.filter(m => (m.id !== playbackState.currentMedia?.id && m.path !== playbackState.currentMedia?.path))
        : queue;
      const randomItem = candidates[Math.floor(Math.random() * candidates.length)];
      playMedia(randomItem);
      return;
    }

    const currentIndex = queue.findIndex(m => m.id === playbackState.currentMedia?.id || m.path === playbackState.currentMedia?.path);
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    playMedia(queue[prevIndex]);
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
      fetchTones
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => useContext(DashboardContext);
