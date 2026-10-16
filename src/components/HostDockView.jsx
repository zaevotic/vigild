import React, { useState, useEffect, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';

export const HostDockView = () => {
  const {
    alarms,
    activeAlarm,
    media,
    playlists,
    tasks,
    focusState,
    playbackState,
    system,
    isConnected,
    togglePlayPause,
    seekPlayback,
    toggleShuffle,
    toggleRepeat,
    playNextMedia,
    playPrevMedia,
    playMedia,
    toggleAlarm,
    toggleDeviceRole,
    toggleTask,
    startFocus,
    pauseFocus,
    resetFocus,
    skipFocus,
    setFocusMode,
    playPlaylist
  } = useDashboard();

  const [activePageIndex, setActivePageIndex] = useState(0);
  const [railExpanded, setRailExpanded] = useState(false);
  const [railHidden, setRailHidden] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [musicSubtab, setMusicSubtab] = useState('queue'); // 'queue' | 'playlists'
  const [playlistView, setPlaylistView] = useState('list'); // 'list' | 'grid'
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== 'undefined' ? !!(document.fullscreenElement || document.webkitFullscreenElement) : false
  );

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const toggleFullscreen = (e) => {
    e?.stopPropagation?.();
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  const pagerRef = useRef(null);
  const railRef = useRef(null);
  const pressTimerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const returnToHudTimerRef = useRef(null);

  // Live seconds ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Idle interaction monitor: tuck rail after 5s, return to HUD after 3m
  const resetIdleTimers = () => {
    setRailHidden(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (returnToHudTimerRef.current) clearTimeout(returnToHudTimerRef.current);

    idleTimerRef.current = setTimeout(() => {
      setRailHidden(true);
      setRailExpanded(false);
    }, 5000);

    returnToHudTimerRef.current = setTimeout(() => {
      if (pagerRef.current) {
        pagerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        setActivePageIndex(0);
      }
    }, 180000);
  };

  useEffect(() => {
    resetIdleTimers();
    const handleActivity = () => resetIdleTimers();
    window.addEventListener('pointerdown', handleActivity);
    window.addEventListener('pointermove', handleActivity);
    return () => {
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('pointermove', handleActivity);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (returnToHudTimerRef.current) clearTimeout(returnToHudTimerRef.current);
    };
  }, []);

  // Scroll to page index
  const goToPage = (index) => {
    if (pagerRef.current) {
      pagerRef.current.scrollTo({
        left: index * pagerRef.current.clientWidth,
        behavior: 'smooth'
      });
      setActivePageIndex(index);
    }
  };

  const handlePagerScroll = () => {
    if (!pagerRef.current) return;
    const width = pagerRef.current.clientWidth || 1;
    const index = Math.round(pagerRef.current.scrollLeft / width);
    if (index !== activePageIndex && index >= 0 && index <= 5) {
      setActivePageIndex(index);
    }
    resetIdleTimers();
  };

  // Long press on rail to toggle expanded label drawer
  const handleRailPointerDown = () => {
    pressTimerRef.current = setTimeout(() => {
      setRailExpanded(prev => !prev);
    }, 450);
  };

  const handleRailPointerUp = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  };

  // Formatted date and time strings
  const pad = (n) => String(n).padStart(2, '0');
  const hours = pad(currentTime.getHours());
  const minutes = pad(currentTime.getMinutes());
  const seconds = pad(currentTime.getSeconds());
  const dateFormatted = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  // Pomodoro state derived from the authoritative backend schema
  const FOCUS_DURATIONS = { focus: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 };
  const FOCUS_LABELS = { focus: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' };
  const fMode = focusState?.mode || 'focus';
  const fTotalSec = focusState?.totalDurationSec || FOCUS_DURATIONS[fMode] || FOCUS_DURATIONS.focus;
  const fRunning = focusState?.status === 'running';
  const fPaused = focusState?.status === 'paused';
  const fCycle = (focusState?.cycleCount || 0) % 4;
  const fSessionsToday = focusState?.sessionsToday || 0;
  const calculateFocusRemaining = () => {
    let elapsedMs = 0;
    if (fRunning && focusState.startTimestamp) {
      elapsedMs = Date.now() - focusState.startTimestamp - (focusState.pausedDurationMs || 0);
    } else if (fPaused && focusState.startTimestamp && focusState.pauseTimestamp) {
      elapsedMs = focusState.pauseTimestamp - focusState.startTimestamp - (focusState.pausedDurationMs || 0);
    }
    const totalSecs = Math.max(0, fTotalSec - Math.floor(Math.max(0, elapsedMs) / 1000));
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return {
      mins: m,
      secs: s,
      total: totalSecs,
      progress: fTotalSec > 0 ? Math.min(100, ((fTotalSec - totalSecs) / fTotalSec) * 100) : 0,
      formatted: `${pad(m)}:${pad(s)}`
    };
  };

  const focusTimer = calculateFocusRemaining();
  const focusTargetTask = (tasks || []).find(t => t.id === focusState?.currentTaskId);
  const focusTargetTitle = focusTargetTask?.title || focusTargetTask?.n || null;
  const focusStatusLabel = fRunning
    ? (fMode === 'focus' ? 'Focusing' : 'Resting')
    : fPaused ? 'Paused' : 'Ready';

  // Storage calculations from system status
  const storageTotalGB = system?.storage?.totalGB || system?.storage?.maxGB || 105.51;
  const storageUsedGB = system?.storage?.usedGB !== undefined ? system.storage.usedGB : 10.51;
  const storagePercent = system?.storage?.percentage !== undefined
    ? Math.round(system.storage.percentage)
    : (storageTotalGB > 0 ? Math.min(100, Math.round((storageUsedGB / storageTotalGB) * 100)) : 10);

  // Dynamic media type size breakdown
  const isAudio = (m) => {
    if (!m) return false;
    if (m.type === 'audio') return true;
    const name = (m.filename || m.originalname || m.name || m.path || '').toLowerCase();
    return /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(name);
  };
  const videoBytes = (media || []).filter(m => m.type === 'video' || /\.(mp4|mkv|webm|mov|avi)$/i.test(m.filename || m.name || m.path || '')).reduce((acc, m) => acc + (m.size || 0), 0);
  const audioBytes = (media || []).filter(isAudio).reduce((acc, m) => acc + (m.size || 0), 0);
  const imageBytes = (media || []).filter(m => m.type === 'image' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(m.filename || m.name || m.path || '')).reduce((acc, m) => acc + (m.size || 0), 0);
  const otherBytes = (media || []).filter(m => m.type !== 'video' && !isAudio(m) && m.type !== 'image').reduce((acc, m) => acc + (m.size || 0), 0);
  const totalMediaBytes = (videoBytes + audioBytes + imageBytes + otherBytes) || 1;
  const freeGB = Math.max(0, storageTotalGB - storageUsedGB);
  const largestFile = (media || []).reduce((best, m) => ((m.size || 0) > (best?.size || 0) ? m : best), null);
  const audioCount = (media || []).filter(isAudio).length;
  const fileCount = (media || []).length;
  const vaultGB = ((totalMediaBytes > 1 ? totalMediaBytes : 0) / (1024 ** 3));

  const fmtBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 MB';
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 ** 3)).toFixed(1)} GB`;
    return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
  };

  // Current playing track
  const currentSong = playbackState?.currentMedia;
  const isPlaying = playbackState?.isPlaying;
  const currentTimeSec = Math.floor(playbackState?.currentTime || 0);
  const durationSec = Math.floor(playbackState?.duration || currentSong?.duration || 180);
  const progressPercent = durationSec > 0 ? Math.min(100, (currentTimeSec / durationSec) * 100) : 0;

  const formatSec = (s) => {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${pad(m)}:${pad(rem)}`;
  };

  // Next upcoming enabled alarm
  const nextAlarm = alarms?.filter(a => a.enabled !== false)[0] || {
    time: '06:05',
    label: 'Morning Alarm',
    tone: 'Cyber Alarm'
  };

  // Active Queue
  const activeQueue = (playbackState?.shuffle && playbackState?.shuffledQueue?.length > 0)
    ? playbackState.shuffledQueue
    : (playbackState?.originalQueue?.length > 0 ? playbackState.originalQueue : media);

  const currentQueueIdx = activeQueue.findIndex(
    m => m.id === currentSong?.id || m.path === currentSong?.path
  );

  const audioTracks = (media || []).filter(isAudio);
  const allPlaylists = [
    { id: null, name: 'Local Library', tracks: audioTracks },
    ...(playlists || [])
  ];

  const activePlaylistName = playbackState?.activePlaylistId
    ? (playlists?.find(p => p.id === playbackState.activePlaylistId)?.name || 'Playlist')
    : 'Local Library';

  const playLocalLibrary = () => {
    if (audioTracks.length > 0) {
      playPlaylist({ id: null, name: 'Local Library', tracks: audioTracks });
    }
  };

  const getPlaylistVisuals = (name, index) => {
    const n = (name || '').toLowerCase();
    if (n.includes('library')) return { bg: 'linear-gradient(135deg, #27471d, #14240f)', dot: '#4caf50', icon: 'music' };
    if (n.includes('focus')) return { bg: 'linear-gradient(135deg, #1d2c47, #131926)', dot: '#7a3ee0', icon: 'circle' };
    if (n.includes('wake')) return { bg: 'linear-gradient(135deg, #47321d, #24190f)', dot: '#e0982f', icon: 'mountain' };
    const palettes = [
      { bg: 'linear-gradient(135deg, #1d2c47, #131926)', dot: '#7a3ee0', icon: 'circle' },
      { bg: 'linear-gradient(135deg, #47321d, #24190f)', dot: '#e0982f', icon: 'mountain' },
      { bg: 'linear-gradient(135deg, #3d1b24, #1f0d12)', dot: '#e53935', icon: 'circle' },
      { bg: 'linear-gradient(135deg, #1b383d, #0d1e21)', dot: '#00acc1', icon: 'circle' },
    ];
    return palettes[index % palettes.length];
  };

  const getSongThumb = (song, index) => {
    const thumbs = [
      { bg: 'linear-gradient(135deg, #2a183d, #170d24)', dot: '#8e44ad' },
      { bg: 'linear-gradient(135deg, #162a45, #0c1829)', dot: '#2980b9' },
      { bg: 'linear-gradient(135deg, #143834, #0b211e)', dot: '#16a085' },
      { bg: 'linear-gradient(135deg, #3d1e18, #24110d)', dot: '#d35400' },
    ];
    return thumbs[index % thumbs.length];
  };

  const currentSongVisuals = getSongThumb(currentSong, currentQueueIdx >= 0 ? currentQueueIdx : 0);
  const coverUrl = currentSong ? (currentSong.coverUrl || `/api/files/cover?path=${encodeURIComponent(currentSong.path || currentSong.filename || '')}`) : null;

  const lanIp = system?.network?.primaryIp;
  const lanPort = system?.network?.port || window.location.port || '3000';
  const displayHost = (lanIp && lanIp !== '127.0.0.1' && lanIp !== 'localhost')
    ? `${lanIp}:${lanPort}`
    : (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
      ? window.location.host
      : (lanIp ? `${lanIp}:${lanPort}` : window.location.host);

  return (
    <div className="host-dock-container" style={{
      width: '100vw',
      height: '100dvh',
      display: 'flex',
      backgroundColor: '#0a0707',
      color: '#e8dfd2',
      fontFamily: 'var(--sans)',
      overflow: 'hidden',
      userSelect: 'none',
      position: 'relative'
    }}>
      {/* ── LEFT NAVIGATION RAIL ────────────────────────────── */}
      <nav
        ref={railRef}
        className={`rail ${railExpanded ? 'expanded' : ''} ${railHidden ? 'hidden' : ''}`}
        aria-label="Pages"
        onPointerDown={handleRailPointerDown}
        onPointerUp={handleRailPointerUp}
        onPointerLeave={handleRailPointerUp}
        onPointerCancel={handleRailPointerUp}
      >
        <div className="mark" title="Vigilo">
          <i />
        </div>

        <button
          className={`tab ${activePageIndex === 0 ? 'on' : ''}`}
          onClick={() => goToPage(0)}
          title="HUD Overview"
        >
          <svg viewBox="0 0 24 24">
            <rect x="3" y="3" width="8" height="8" rx="2" />
            <rect x="13" y="3" width="8" height="5" rx="2" />
            <rect x="13" y="10" width="8" height="11" rx="2" />
            <rect x="3" y="13" width="8" height="8" rx="2" />
          </svg>
          <span>HUD</span>
        </button>

        <button
          className={`tab ${activePageIndex === 1 ? 'on' : ''}`}
          onClick={() => goToPage(1)}
          title="Drift Clock"
        >
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span>Clock</span>
        </button>

        <button
          className={`tab ${activePageIndex === 2 ? 'on' : ''}`}
          onClick={() => goToPage(2)}
          title="Music Station"
        >
          <svg viewBox="0 0 24 24">
            <path d="M9 18V5l11-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="17" cy="16" r="3" />
          </svg>
          <span>Music</span>
        </button>

        <button
          className={`tab ${activePageIndex === 3 ? 'on' : ''}`}
          onClick={() => goToPage(3)}
          title="Focus Objectives"
        >
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1" />
          </svg>
          <span>Focus</span>
        </button>

        <button
          className={`tab ${activePageIndex === 4 ? 'on' : ''}`}
          onClick={() => goToPage(4)}
          title="Alarms Center"
        >
          <svg viewBox="0 0 24 24">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10 21h4" />
          </svg>
          <span>Alarms</span>
        </button>

        <button
          className={`tab ${activePageIndex === 5 ? 'on' : ''}`}
          onClick={() => goToPage(5)}
          title="SD Storage"
        >
          <svg viewBox="0 0 24 24">
            <rect x="3" y="13" width="18" height="7" rx="2" />
            <path d="M5 13l2-8h10l2 8" />
            <circle cx="7" cy="16.5" r=".6" />
          </svg>
          <span>Storage</span>
        </button>

        <div className="spacer" />

        {/* Role Pill - Tap to toggle to Client Mode */}
        <div
          className="role"
          onClick={toggleDeviceRole}
          style={{ cursor: 'pointer' }}
          title="Desk Dock Mode: Authoritative player & alarm sirens. Tap to switch to Remote Client."
        >
          <b>HOST</b>
          <small>read-only dock</small>
        </div>
      </nav>

      {/* ── HORIZONTAL SCROLL-SNAP PAGER ────────────────────── */}
      <main
        ref={pagerRef}
        className="pager"
        id="pager"
        onScroll={handlePagerScroll}
      >
        {/* ── PAGE 0: HUD ────────────────────────────── */}
        <section className="page" id="hud">
          <div className="grid">
            {/* Clock Card */}
            <div className="card hot hud-clock">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`chip ${isConnected ? 'ok' : ''}`}>
                  {isConnected ? 'online' : 'connecting'}
                </span>
                <span className="chip mono" style={{ fontSize: '11px' }} title="Connect client browsers to this address">
                  http://{displayHost}
                </span>
                <button
                  className="chip"
                  onClick={toggleFullscreen}
                  title="Toggle Fullscreen Mode"
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: isFullscreen ? 'rgba(255,45,63,0.14)' : undefined,
                    borderColor: isFullscreen ? 'var(--red-d)' : undefined,
                    color: isFullscreen ? '#fff' : 'var(--dim)'
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: '13px', height: '13px', stroke: 'currentColor', fill: 'none', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                    {isFullscreen ? (
                      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                    ) : (
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    )}
                  </svg>
                  <span>{isFullscreen ? 'Exit' : 'Full'}</span>
                </button>
              </div>

              <div>
                <div className="big" data-clock>
                  {hours}:{minutes}
                  <small>:{seconds}</small>
                </div>
                <div className="date">{dateFormatted}</div>
              </div>

              <div className="alarm-row">
                <div>
                  <div className="muted" style={{ fontSize: '12px' }}>Next alarm</div>
                  <div style={{ fontWeight: 600, fontSize: '18px' }}>
                    {nextAlarm.label || 'Alarm'}
                  </div>
                </div>
                <div className="t">{nextAlarm.time}</div>
              </div>
            </div>

            {/* Now Playing Card */}
            <div
              className={`card ${isPlaying ? 'playing' : ''}`}
              id="hudNp"
              onClick={() => goToPage(2)}
              style={{ cursor: 'pointer' }}
            >
              <h2>Now playing</h2>
              <div className="np">
                <div className="hud-np-cover">
                  {coverUrl ? (
                    <div className="cover-art-box" style={{ background: currentSongVisuals.bg, position: 'relative' }}>
                      <img
                        src={coverUrl}
                        alt="Cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <i style={{ background: currentSongVisuals.dot, position: 'absolute' }} />
                    </div>
                  ) : (
                    <div className="cover-art-box" style={{ background: currentSongVisuals.bg }}>
                      <i style={{ background: currentSongVisuals.dot }} />
                    </div>
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <div className="hud-np-marquee-wrapper">
                    <div className={`hud-np-title ${isPlaying && (currentSong?.title || currentSong?.filename) ? 'marquee' : ''}`}>
                      <span>{currentSong?.title || currentSong?.filename || 'No track selected'}</span>
                      {isPlaying && (currentSong?.title || currentSong?.filename) && (
                        <span className="marquee-spacer">✦ {currentSong?.title || currentSong?.filename}</span>
                      )}
                    </div>
                  </div>
                  <div className="muted mono" style={{ fontSize: '13px', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentSong?.artist || activePlaylistName || (currentSong ? 'Now Playing' : 'Idle')}
                  </div>
                </div>
              </div>

              <div className="prog">
                <span>{formatSec(currentTimeSec)}</span>
                <div className="bar">
                  <div style={{ width: `${progressPercent}%` }} />
                </div>
                <span>{formatSec(durationSec)}</span>
              </div>
            </div>

            {/* Focus & Storage Summary Card */}
            <div className="card">
              <h2>Focus</h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontWeight: 600, fontSize: '17px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {focusTargetTitle || 'No active objective'}
                </div>
                <div className="mono" style={{ color: 'var(--amber)', fontSize: '26px', fontWeight: 700 }}>
                  {focusTimer.formatted}
                </div>
              </div>
              <div className="muted mono" style={{ fontSize: '12px', margin: '6px 0 14px' }}>
                {fSessionsToday} sessions today · cycle {fCycle + 1}/4 · {FOCUS_LABELS[fMode]}
              </div>

              <h2>Storage</h2>
              <div className="mono" style={{ fontSize: '13px', marginBottom: '6px' }}>
                {storageUsedGB} GB / {storageTotalGB} GB
              </div>
              <div className="bar">
                <div style={{ width: `${storagePercent}%` }} />
              </div>
            </div>
          </div>
        </section>

        {/* ── PAGE 1: AMBIENT DRIFT CLOCK ────────────────────── */}
        <section className="page" id="clock">
          <div className="grid">
            <div className="amb">
              <div className="big">
                {hours}:{minutes}
                <small>:{seconds}</small>
              </div>
              <div className="date">{dateFormatted}</div>
            </div>
          </div>
        </section>

        {/* ── PAGE 2: MUSIC ────────────────────────────── */}
        <section className="page" id="music">
          <div className="grid">
            {/* Left Card: Now Playing Hero */}
            <div className={`card hot ${isPlaying ? 'playing' : ''}`} id="musNp" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                {/* Active Playlist Selector Pill */}
                <button
                  className="mus-pl-pill"
                  onClick={() => setMusicSubtab('playlists')}
                  title="Switch or view playlists"
                >
                  <svg viewBox="0 0 24 24" style={{ width: '15px', height: '15px', flexShrink: 0 }}>
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                  </svg>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activePlaylistName}
                  </span>
                  <svg viewBox="0 0 24 24" style={{ width: '13px', height: '13px', flexShrink: 0 }}>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {/* Album Cover & Song Info */}
                <div className="mus-hero-row">
                  <div className="mus-hero-cover">
                    {coverUrl ? (
                      <div className="cover-art-box" style={{ background: currentSongVisuals.bg, position: 'relative' }}>
                        <img
                          src={coverUrl}
                          alt="Cover"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '20px' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <i style={{ background: currentSongVisuals.dot, position: 'absolute' }} />
                      </div>
                    ) : (
                      <div className="cover-art-box" style={{ background: currentSongVisuals.bg }}>
                        <i style={{ background: currentSongVisuals.dot }} />
                      </div>
                    )}
                  </div>
                  <div className="mus-hero-meta">
                    <div className="mus-hero-title">
                      {currentSong?.title || currentSong?.filename || 'No track selected'}
                    </div>
                    <div className="mus-hero-sub">
                      {currentSong?.artist || (currentSong?.duration ? formatSec(currentSong.duration) : 'Local Library')}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                {/* Progress Scrubber */}
                <div
                  className="prog"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                    seekPlayback(ratio * durationSec);
                  }}
                >
                  <span>{formatSec(currentTimeSec)}</span>
                  <div className="bar">
                    <div style={{ width: `${progressPercent}%` }} />
                  </div>
                  <span>{formatSec(durationSec)}</span>
                </div>

                {/* Playback Controls */}
                <div className="ctrls">
                  <button
                    className={`btn ${playbackState?.shuffle ? 'on' : ''}`}
                    onClick={toggleShuffle}
                    aria-label="Shuffle"
                    style={{
                      opacity: (!playbackState?.activePlaylistId && playbackState?.shuffle) ? 0.65 : 1
                    }}
                    title={!playbackState?.activePlaylistId ? 'Shuffle active in global music pool' : 'Shuffle playlist tracks'}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                    </svg>
                  </button>

                  <button className="btn" onClick={playPrevMedia} aria-label="Previous">
                    <svg viewBox="0 0 24 24">
                      <path d="M19 20 9 12l10-8zM5 19V5" />
                    </svg>
                  </button>

                  <button className="btn main" onClick={togglePlayPause} aria-label="Play or pause">
                    <svg viewBox="0 0 24 24" id="playIco">
                      {isPlaying ? (
                        <>
                          <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" stroke="none" />
                          <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" stroke="none" />
                        </>
                      ) : (
                        <polygon points="8,5 19,12 8,19" fill="currentColor" stroke="none" />
                      )}
                    </svg>
                  </button>

                  <button className="btn" onClick={() => playNextMedia(false)} aria-label="Next">
                    <svg viewBox="0 0 24 24">
                      <path d="m5 4 10 8-10 8zM19 5v14" />
                    </svg>
                  </button>

                  <button
                    className={`btn ${playbackState?.repeat !== 'off' ? 'on' : ''}`}
                    onClick={toggleRepeat}
                    aria-label="Repeat"
                    title={playbackState?.repeat !== 'off' ? 'Repeat ON: loops active queue' : 'Repeat OFF: rolls into global music library when queue ends'}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Card: Queue & Playlists */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Header with Subtabs & Status */}
              <div className="mus-right-head">
                <div className="subtabs-pills">
                  <button
                    className={`spill ${musicSubtab === 'queue' ? 'on' : ''}`}
                    onClick={() => setMusicSubtab('queue')}
                  >
                    Queue
                  </button>
                  <button
                    className={`spill ${musicSubtab === 'playlists' ? 'on' : ''}`}
                    onClick={() => setMusicSubtab('playlists')}
                  >
                    Playlists
                  </button>
                </div>

                <div className="mus-head-status">
                  <span className="status-text">
                    {activePlaylistName} · {playbackState?.shuffle ? 'shuffled' : 'in-order'}
                  </span>
                  {musicSubtab === 'playlists' && (
                    <button
                      className="ib"
                      onClick={() => setPlaylistView(prev => prev === 'list' ? 'grid' : 'list')}
                      aria-label="Toggle playlist view"
                      title={playlistView === 'list' ? 'Grid view' : 'List view'}
                    >
                      {playlistView === 'list' ? (
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <rect x="3" y="3" width="7" height="7" rx="1.5" />
                          <rect x="14" y="3" width="7" height="7" rx="1.5" />
                          <rect x="3" y="14" width="7" height="7" rx="1.5" />
                          <rect x="14" y="14" width="7" height="7" rx="1.5" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="8" y1="6" x2="21" y2="6" />
                          <line x1="8" y1="12" x2="21" y2="12" />
                          <line x1="8" y1="18" x2="21" y2="18" />
                          <line x1="3" y1="6" x2="3.01" y2="6" />
                          <line x1="3" y1="12" x2="3.01" y2="12" />
                          <line x1="3" y1="18" x2="3.01" y2="18" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Tab Content */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {musicSubtab === 'queue' ? (
                  /* QUEUE SUBTAB */
                  <div className="queue">
                    {activeQueue.length === 0 ? (
                      <div className="muted mono" style={{ fontSize: '13px', padding: '16px' }}>No songs in queue.</div>
                    ) : (
                      activeQueue.map((item, idx) => {
                        const isCur = idx === currentQueueIdx;
                        const isPast = currentQueueIdx >= 0 && idx < currentQueueIdx;
                        const diff = idx - currentQueueIdx;
                        const tag = isCur ? 'now' : (isPast ? 'prev' : `+${diff}`);
                        const songVis = getSongThumb(item, idx);

                        return (
                          <div
                            key={item.id || item.path || idx}
                            className={`q ${isCur ? 'cur' : ''} ${isPast ? 'past' : ''}`}
                            onClick={() => playMedia(item)}
                            style={{ cursor: 'pointer' }}
                          >
                            <em>{tag}</em>
                            <div className="q-thumb" style={{ background: songVis.bg }}>
                              <i style={{ background: songVis.dot }} />
                            </div>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: isCur ? 600 : 400 }}>
                              {item.title || item.filename || item.name}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : playlistView === 'list' ? (
                  /* PLAYLISTS LIST VIEW */
                  <div className="queue">
                    {allPlaylists.map((pl, idx) => {
                      const isCurPl = (!pl.id && !playbackState?.activePlaylistId) || (pl.id && playbackState?.activePlaylistId === pl.id);
                      const plVis = getPlaylistVisuals(pl.name, idx);

                      return (
                        <div
                          key={pl.id || 'local-lib'}
                          className={`q ${isCurPl ? 'cur' : ''}`}
                          onClick={() => {
                            if (pl.id) playPlaylist(pl);
                            else playLocalLibrary();
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="pl-thumb" style={{ background: plVis.bg }}>
                            {plVis.icon === 'music' ? (
                              <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px', color: plVis.dot }}>
                                <path d="M9 18V5l11-2v13" />
                                <circle cx="6" cy="18" r="3" fill="currentColor" />
                                <circle cx="17" cy="16" r="3" fill="currentColor" />
                              </svg>
                            ) : plVis.icon === 'mountain' ? (
                              <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px', color: plVis.dot }}>
                                <path d="m8 3 4 8 5-5 5 15H2L8 3z" fill="currentColor" />
                              </svg>
                            ) : (
                              <i style={{ background: plVis.dot }} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {pl.name}
                          </div>
                          <div className="mono muted" style={{ fontSize: '12px', flexShrink: 0 }}>
                            {isCurPl ? `playing · ${pl.tracks?.length || 0} songs` : `${pl.tracks?.length || 0} songs`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* PLAYLISTS GRID VIEW */
                  <div className="pl-grid">
                    {allPlaylists.map((pl, idx) => {
                      const isCurPl = (!pl.id && !playbackState?.activePlaylistId) || (pl.id && playbackState?.activePlaylistId === pl.id);
                      const plVis = getPlaylistVisuals(pl.name, idx);

                      return (
                        <div
                          key={pl.id || 'local-lib'}
                          className={`pl-card ${isCurPl ? 'cur' : ''}`}
                          onClick={() => {
                            if (pl.id) playPlaylist(pl);
                            else playLocalLibrary();
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="pl-card-cover" style={{ background: plVis.bg }}>
                            {isCurPl && <span className="pl-now-badge">now</span>}
                            {plVis.icon === 'music' ? (
                              <svg viewBox="0 0 24 24" style={{ width: '28px', height: '28px', color: plVis.dot }}>
                                <path d="M9 18V5l11-2v13" />
                                <circle cx="6" cy="18" r="3" fill="currentColor" />
                                <circle cx="17" cy="16" r="3" fill="currentColor" />
                              </svg>
                            ) : plVis.icon === 'mountain' ? (
                              <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px', color: plVis.dot }}>
                                <path d="m8 3 4 8 5-5 5 15H2L8 3z" fill="currentColor" />
                              </svg>
                            ) : (
                              <i style={{ background: plVis.dot }} />
                            )}
                          </div>
                          <div className="pl-card-title">{pl.name}</div>
                          <div className="pl-card-sub">{pl.tracks?.length || 0} songs</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── PAGE 3: FOCUS ────────────────────────────── */}
        <section className="page" id="focus">
          <div className="grid">
            <div className="fcol">
              <div className="card hot" style={{ flex: 1 }}>
                <div className="fhead">
                  <h2 style={{ margin: 0 }}>Focus timer</h2>
                  <div className="modes">
                    {['focus', 'shortBreak', 'longBreak'].map(m => (
                      <button
                        key={m}
                        className={`mode ${fMode === m ? 'on' : ''}`}
                        onClick={() => setFocusMode(m)}
                      >
                        {FOCUS_LABELS[m]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ftarget">
                  {focusTargetTitle || 'General Focus Session'}
                </div>

                <div className="timer">{focusTimer.formatted}</div>

                <div className="bar" style={{ marginBottom: '10px' }}>
                  <div style={{ width: `${focusTimer.progress}%` }} />
                </div>

                <div className="fstat">
                  <div className="dots" style={{ marginBottom: 0 }}>
                    {[0, 1, 2, 3].map(dotIndex => (
                      <i
                        key={dotIndex}
                        className={dotIndex < fCycle ? 'f' : (dotIndex === fCycle && fMode === 'focus' && (fRunning || fPaused) ? 'a' : '')}
                      />
                    ))}
                  </div>
                  <span className="muted mono" style={{ fontSize: '12px' }}>
                    {focusStatusLabel} · {fCycle + 1}/4 · {fSessionsToday} today
                  </span>
                </div>

                <div className="pomo-ctl">
                  <button className="pbtn" onClick={resetFocus}>Reset</button>
                  <button className="pbtn go" onClick={fRunning ? pauseFocus : startFocus}>
                    {fRunning ? 'Pause' : (fPaused ? 'Resume' : 'Start')}
                  </button>
                  <button className="pbtn" onClick={skipFocus}>Skip</button>
                </div>
              </div>

              {/* Music controls (buttons only) */}
              <div className={`card deck ${isPlaying ? 'playing' : ''}`}>
                <div className="deck-row" style={{ justifyContent: 'center', gap: '14px' }}>
                  <button
                    className={`btn ${playbackState?.shuffle ? 'on' : ''}`}
                    onClick={toggleShuffle}
                    aria-label="Shuffle"
                    style={{ opacity: (!playbackState?.activePlaylistId && playbackState?.shuffle) ? 0.65 : 1 }}
                  >
                    <svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
                  </button>
                  <button className="btn" onClick={playPrevMedia} aria-label="Previous">
                    <svg viewBox="0 0 24 24"><path d="M19 20 9 12l10-8zM5 19V5" /></svg>
                  </button>
                  <button className="btn main" onClick={togglePlayPause} aria-label="Play or pause music">
                    <svg viewBox="0 0 24 24">
                      {isPlaying ? (
                        <>
                          <rect x="6" y="5" width="4" height="14" rx="1.5" />
                          <rect x="14" y="5" width="4" height="14" rx="1.5" />
                        </>
                      ) : (
                        <polygon points="8,5 19,12 8,19" />
                      )}
                    </svg>
                  </button>
                  <button className="btn" onClick={() => playNextMedia(false)} aria-label="Next">
                    <svg viewBox="0 0 24 24"><path d="m5 4 10 8-10 8zM19 5v14" /></svg>
                  </button>
                  <button
                    className={`btn ${playbackState?.repeat !== 'off' ? 'on' : ''}`}
                    onClick={toggleRepeat}
                    aria-label="Repeat"
                  >
                    <svg viewBox="0 0 24 24"><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" /></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Task Objectives Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h2>Objectives · {tasks.filter(t => !t.completed).length} pending</h2>
              <div className="tasks" style={{ flex: 1, overflowY: 'auto' }}>
                {tasks.length === 0 ? (
                  <div className="muted mono" style={{ fontSize: '13px', padding: '12px' }}>
                    No tasks in queue.
                  </div>
                ) : (
                  tasks.map((task) => {
                    const isTarget = focusState?.currentTaskId === task.id;
                    return (
                      <div
                        key={task.id}
                        className={`task ${isTarget ? 'cur' : ''} ${task.completed ? 'done' : ''}`}
                        onClick={() => toggleTask(task.id)}
                        style={{ cursor: 'pointer' }}
                        role="checkbox"
                        aria-checked={!!task.completed}
                      >
                        <i className={`cb ${task.completed ? 'f' : ''}`} />
                        <span style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textDecoration: task.completed ? 'line-through' : 'none',
                          color: task.completed ? 'var(--dim)' : 'inherit'
                        }}>
                          {task.title || task.n}
                        </span>
                        {isTarget && (
                          <span className="tag" style={{ color: 'var(--amber)', fontSize: '11px', flexShrink: 0 }}>
                            ACTIVE TARGET
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── PAGE 4: ALARMS ────────────────────────────── */}
        <section className="page" id="alarms">
          <div className="grid">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '20px' }}>Alarms on dock</div>
              <span className="chip">{alarms.filter(a => a.enabled !== false).length} active</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
              {alarms.length === 0 ? (
                <div className="card muted mono" style={{ fontSize: '13px', padding: '16px' }}>
                  No alarms configured.
                </div>
              ) : (
                alarms.map(alarm => {
                  const daysActive = Array.isArray(alarm.days)
                    ? alarm.days
                    : (alarm.d || [1, 1, 1, 1, 1, 1, 1]);
                  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

                  return (
                    <div key={alarm.id} className="al">
                      <div className="t">{alarm.time || alarm.t}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '16px' }}>
                          {alarm.label || alarm.l || 'Alarm'}
                        </div>
                        <div className="days">
                          {dayNames.map((name, idx) => (
                            <i key={idx} className={daysActive[idx] ? '' : 'off'}>
                              {name}
                            </i>
                          ))}
                        </div>
                        <div className="muted mono" style={{ fontSize: '12px', marginTop: '6px' }}>
                          {alarm.tone || 'Default Tone'}
                        </div>
                      </div>

                      <div
                        className="toggle"
                        onClick={() => toggleAlarm(alarm.id)}
                        style={{
                          cursor: 'pointer',
                          background: alarm.enabled !== false ? 'var(--red-d)' : '#2a1a1a',
                          color: alarm.enabled !== false ? '#fff' : 'var(--dim)'
                        }}
                      >
                        {alarm.enabled !== false ? 'ON' : 'OFF'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* ── PAGE 5: STORAGE ────────────────────────────── */}
        <section className="page" id="storage">
          <div className="grid">
            <div className="card hot" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h2>{Math.round(storageTotalGB)} GB SD vault</h2>
              <div
                className="ring"
                style={{
                  background: `conic-gradient(var(--red) 0 ${storagePercent}%, #241616 0)`
                }}
              >
                <div>
                  <strong>{storagePercent}%</strong>
                  <small>{storageUsedGB} GB used</small>
                  <small>of {storageTotalGB} GB</small>
                </div>
              </div>
            </div>

            <div className="card">
              <h2>By type</h2>
              <div className="type">
                <span>Video</span>
                <div className="bar">
                  <div style={{ width: `${Math.round((videoBytes / totalMediaBytes) * 100)}%` }} />
                </div>
                <span>{fmtBytes(videoBytes)}</span>
              </div>
              <div className="type">
                <span>Audio</span>
                <div className="bar">
                  <div style={{ width: `${Math.round((audioBytes / totalMediaBytes) * 100)}%` }} />
                </div>
                <span>{fmtBytes(audioBytes)}</span>
              </div>
              <div className="type">
                <span>Images</span>
                <div className="bar">
                  <div style={{ width: `${Math.round((imageBytes / totalMediaBytes) * 100)}%` }} />
                </div>
                <span>{fmtBytes(imageBytes)}</span>
              </div>
              <div className="type">
                <span>Other</span>
                <div className="bar">
                  <div style={{ width: `${Math.round((otherBytes / totalMediaBytes) * 100)}%` }} />
                </div>
                <span>{fmtBytes(otherBytes)}</span>
              </div>
              <div className="insights">
                <div><small>Free space</small><b>{freeGB.toFixed(1)} GB</b></div>
                <div><small>Vault media</small><b>{vaultGB >= 1 ? `${vaultGB.toFixed(2)} GB` : fmtBytes(totalMediaBytes > 1 ? totalMediaBytes : 0)}</b></div>
                <div><small>Files / songs</small><b>{fileCount} / {audioCount}</b></div>
                <div><small>Largest file</small><b title={largestFile?.title || largestFile?.filename || largestFile?.name || ''}>{largestFile ? fmtBytes(largestFile.size) : '—'}</b></div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
