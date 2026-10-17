import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDashboard, isAudioFile, isMediaFile } from '../context/DashboardContext';

/* ==========================================================================
   ICON ASSETS (EXACT PATH DEFINITIONS FROM VISION PROTOTYPE)
   ========================================================================== */
const I = {
  tasks: '<path d="m9 11 3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
  alarm: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4"/>',
  files: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z"/>',
  next: '<path d="m5 4 10 8-10 8zM19 5v14"/>',
  prev: '<path d="M19 20 9 12l10-8zM5 19V5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chk: '<path d="m5 12 5 5 9-10"/>',
  fold: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  more: '<path d="m9 18 6-6-6-6"/>',
  l: '<path d="m9 6 6 6-6 6"/>',
  d: '<path d="m6 9 6 6 6-6"/>',
  tr: '<path d="m18 15-6-6-6 6"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
  vol: '<path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  dl: '<path d="M12 3v12M6 11l6 6 6-6M4 21h16"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  dots: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  compress: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>',
  drag: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>'
};

const Icon = ({ name, size, style, className }) => {
  const s = size ? { width: `${size}px`, height: `${size}px`, ...style } : style;
  return (
    <svg
      viewBox="0 0 24 24"
      style={s}
      className={className}
      dangerouslySetInnerHTML={{ __html: I[name] || '' }}
    />
  );
};

/* ==========================================================================
   CONSTANTS & COLOR UTILITIES
   ========================================================================== */
const TABS = [
  ['tasks', 'Tasks'],
  ['alarm', 'Alarms'],
  ['files', 'Files'],
  ['music', 'Music']
];

const PRI = [
  ['0', 'Low'],
  ['1', 'Medium'],
  ['2', 'High'],
  ['3', 'Urgent']
];

const CATS = ['Work', 'Study', 'Personal', 'Other'];
const REM = [
  ['none', 'None'],
  ['0', 'At deadline'],
  ['60', '1 hour before'],
  ['1440', '1 day before'],
  ['4320', '3 days before']
];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DOCK_STATES = ['full', 'peek', 'hidden'];

const hue = (t) => {
  let h = 0;
  for (const c of String(t || '')) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

const cvs = (o, name) => {
  const c = o?.coverUrl || o?.cv;
  if (c) return { backgroundImage: `url('${c}')`, backgroundSize: 'cover', backgroundPosition: 'center' };
  const h = hue(name || o?.name || o?.title || 'item');
  return { background: `linear-gradient(145deg, hsl(${h} 50% 26%), hsl(${(h + 50) % 360} 55% 12%))` };
};

const pickImg = (cb) => {
  const f = document.createElement('input');
  f.type = 'file';
  f.accept = 'image/*';
  f.onchange = () => {
    const file = f.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const n = 320;
        const c = document.createElement('canvas');
        c.width = c.height = n;
        const m = Math.min(im.width, im.height);
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, n, n);
          cb(c.toDataURL('image/jpeg', 0.82));
        }
      };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  };
  f.click();
};

const formatSeconds = (s) => {
  const sec = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

const formatDueTime = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const getDueInfo = (d) => {
  if (!d) return null;
  const h = (new Date(d) - Date.now()) / 36e5;
  if (h < 0) return ['overdue', 'late'];
  if (h < 24) return ['in ' + Math.max(1, Math.round(h)) + 'h', 'soon'];
  return ['in ' + Math.round(h / 24) + 'd', ''];
};

const dayTxt = (d) => {
  if (!d || !Array.isArray(d)) return 'Once';
  const s = d.join('');
  if (s === '1111111') return 'Every day';
  if (s === '1111100') return 'Weekdays';
  if (s === '0000011') return 'Weekends';
  if (s === '0000000') return 'Once';
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].filter((_, k) => d[k]).join(' ');
};

/* ==========================================================================
   MAIN COMPONENT: ClientControllerView
   ========================================================================== */
export const ClientControllerView = () => {
  const {
    alarms,
    availableTones,
    media,
    playlists,
    tasks,
    transfers,
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
    playPlaylist,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    addAlarm,
    updateAlarm,
    toggleAlarm,
    testAlarmTone,
    deleteAlarm,
    deleteMedia,
    updateSongMetadata,
    setFocusTarget,
    startChunkedUpload,
    toggleTransferPause,
    toggleDeviceRole
  } = useDashboard();

  // Navigation & Layout
  const [activeTab, setActiveTab] = useState(0);
  const [isFullWorkspace, setIsFullWorkspace] = useState(false);
  const [dockState, setDockState] = useState('full');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Tasks Filter & Sort
  const [taskFilter, setTaskFilter] = useState('pending'); // 'pending' | 'all' | 'done'
  const [taskSort, setTaskSort] = useState('manual'); // 'manual' | 'due' | 'pri'

  // Files Tab State
  const [filePath, setFilePath] = useState([]);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [isGridView, setIsGridView] = useState(false);
  const [isSelectingFiles, setIsSelectingFiles] = useState(false);
  const [selectedFileNames, setSelectedFileNames] = useState(new Set());

  // Music Tab State
  const [musicSubtab, setMusicSubtab] = useState('queue'); // 'queue' | 'library' | 'lists'
  const [activePlaylistIndex, setActivePlaylistIndex] = useState(null);
  const [playlistView, setPlaylistView] = useState('list'); // 'list' | 'grid'

  // Toast & Modal Sheets
  const [toastMessage, setToastMessage] = useState(null);
  const [activeSheet, setActiveSheet] = useState(null); // { type, title, data }
  const toastTimerRef = useRef(null);
  const pagerRef = useRef(null);
  const generalFileInputRef = useRef(null);
  const audioFileInputRef = useRef(null);

  // Orientation
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(orientation: landscape)').matches : false
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const mq = window.matchMedia('(orientation: landscape)');
    const handler = (e) => setIsLandscape(e.matches);
    mq.addEventListener('change', handler);
    return () => {
      clearInterval(timer);
      mq.removeEventListener('change', handler);
    };
  }, []);

  // Fullscreen support for client
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

  const toggleFullscreen = () => {
    const docEl = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
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

  const showToast = (msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 1800);
  };

  const pad = (n) => String(n).padStart(2, '0');
  const hours = pad(currentTime.getHours());
  const minutes = pad(currentTime.getMinutes());
  const seconds = pad(currentTime.getSeconds());
  const dateFormatted = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  // Dock cycle: full -> peek -> hidden -> full
  const cycleDock = () => {
    const idx = DOCK_STATES.indexOf(dockState);
    setDockState(DOCK_STATES[(idx + 1) % 3]);
  };

  const isNavigatingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  // Switch Pager Tab
  const goToTab = (i) => {
    const pager = pagerRef.current;
    if (!pager) return;

    setActiveTab(i);
    isNavigatingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

    pager.style.scrollSnapType = 'none';
    pager.scrollTo({
      left: i * pager.clientWidth,
      behavior: 'smooth'
    });

    const restoreSnap = () => {
      if (pagerRef.current) {
        pagerRef.current.style.scrollSnapType = '';
      }
      isNavigatingRef.current = false;
    };

    if ('onscrollend' in window) {
      pager.addEventListener('scrollend', restoreSnap, { once: true });
    }
    scrollTimeoutRef.current = setTimeout(restoreSnap, 500);
  };

  // Double tap tab to maximize / minimize full workspace
  const lastTapRef = useRef({ time: 0, index: -1 });
  const handleTabClick = (i) => {
    const now = Date.now();
    if (lastTapRef.current.index === i && now - lastTapRef.current.time < 350) {
      lastTapRef.current = { time: 0, index: -1 };
      setIsFullWorkspace(true);
      setDockState('peek');
      goToTab(i);
      return;
    }
    lastTapRef.current = { time: now, index: i };
    goToTab(i);
  };

  const exitFullWorkspace = () => {
    setIsFullWorkspace(false);
    setDockState('full');
  };

  // Dock Swipe gestures
  const dockTouchRef = useRef({ sx: 0, sy: 0 });
  const onDockTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      dockTouchRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY };
    }
  };
  const onDockTouchEnd = (e) => {
    if (!e.changedTouches || !e.changedTouches[0]) return;
    const dx = e.changedTouches[0].clientX - dockTouchRef.current.sx;
    const dy = e.changedTouches[0].clientY - dockTouchRef.current.sy;
    const delta = isLandscape ? -dx : dy;
    if (Math.abs(isLandscape ? dx : dy) < 45) return;
    if (delta > 0) {
      setDockState(dockState === 'full' ? 'peek' : 'hidden');
    } else {
      setDockState(dockState === 'hidden' ? 'peek' : 'full');
    }
  };

  // Playing Track Info
  const currentSong = playbackState?.currentMedia;
  const currentSongTitle = currentSong?.title || currentSong?.name || currentSong?.filename || 'No track playing';
  const currentArtist = currentSong?.artist || 'Unknown artist';
  const isPlaying = !!playbackState?.isPlaying;
  const currentPosition = Math.floor(playbackState?.currentTime || 0);
  const songDuration = Math.floor(playbackState?.duration || currentSong?.duration || 180);
  const progressPercent = songDuration > 0 ? Math.min(100, (currentPosition / songDuration) * 100) : 0;

  // Storage calculation
  const storageTotalGB = (system?.storage?.totalGB || 105.51).toFixed(2);
  const storageUsedGB = (system?.storage?.usedGB || 10.51).toFixed(2);
  const storagePercent = Math.min(100, Math.round((storageUsedGB / storageTotalGB) * 100));

  // Audio Library list
  const audioSongs = useMemo(() => {
    return (media || []).filter(isAudioFile);
  }, [media]);

  // Active Queue
  const queueTracks = useMemo(() => {
    if (playbackState?.shuffle && playbackState?.shuffledQueue?.length > 0) {
      return playbackState.shuffledQueue;
    }
    if (playbackState?.originalQueue?.length > 0) {
      return playbackState.originalQueue;
    }
    return audioSongs;
  }, [playbackState, audioSongs]);

  const activeQueueIndex = queueTracks.findIndex(
    (m) => m.id === currentSong?.id || m.path === currentSong?.path
  );

  // Transfers
  const activeTransfersCount = (transfers || []).filter((t) => t.done < t.total).length;

  /* ==========================================================================
     TASKS TAB LOGIC
     ========================================================================== */
  const processedTasks = useMemo(() => {
    let list = (tasks || []).map((t, i) => ({ ...t, originalIndex: i }));
    if (taskFilter === 'pending') list = list.filter((t) => !t.completed);
    else if (taskFilter === 'done') list = list.filter((t) => t.completed);

    if (taskSort === 'due') {
      list.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    } else if (taskSort === 'pri') {
      list.sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1));
    }
    return list;
  }, [tasks, taskFilter, taskSort]);

  const pendingTasksCount = (tasks || []).filter((t) => !t.completed).length;
  const completedTasksCount = (tasks || []).length - pendingTasksCount;

  const cycleTaskSort = () => {
    setTaskSort((prev) => (prev === 'manual' ? 'due' : prev === 'due' ? 'pri' : 'manual'));
  };

  /* ==========================================================================
     FILES TAB LOGIC
     ========================================================================== */
  const isInsideMusicLibrary = filePath.length > 0 && filePath[0] === 'Music library';

  const currentFolderItems = useMemo(() => {
    if (isInsideMusicLibrary) {
      return audioSongs.map((s) => ({
        id: s.id,
        n: (s.title || s.name || s.filename || 'track') + '.mp3',
        m: s.size ? `${(s.size / (1024 * 1024)).toFixed(1)} MB` : '4.8 MB',
        dt: 'Sep 08',
        k: 'a',
        lock: 1,
        raw: s
      }));
    }

    if (filePath.length === 0) {
      const folders = [
        { id: 'f-music', n: 'Music library', k: 'd', lock: 1, count: `${audioSongs.length} songs` },
        { id: 'f-video', n: 'Videos', k: 'd', lock: 0, count: `${media.filter((m) => m.type === 'video').length} items` },
        { id: 'f-image', n: 'Images', k: 'd', lock: 0, count: `${media.filter((m) => m.type === 'image').length} items` }
      ];
      const rootFiles = (media || [])
        .filter((m) => !m.path || !m.path.includes('/'))
        .map((m) => {
          const isA = isAudioFile(m);
          const isV = m.type === 'video' || /\.(mp4|mkv|webm|mov)$/i.test(m.filename || m.name || '');
          const isI = m.type === 'image' || /\.(jpg|jpeg|png|webp|gif)$/i.test(m.filename || m.name || '');
          const k = isA ? 'a' : isV ? 'v' : isI ? 'i' : 'f';
          return {
            id: m.id || m.path,
            n: m.filename || m.name,
            m: m.size ? `${(m.size / (1024 * 1024)).toFixed(1)} MB` : '1.2 MB',
            dt: 'Sep 08',
            k,
            raw: m
          };
        });
      return [...folders, ...rootFiles];
    }

    const currentSub = filePath[0];
    let matchedType = 'file';
    if (currentSub === 'Videos') matchedType = 'video';
    if (currentSub === 'Images') matchedType = 'image';

    return (media || [])
      .filter((m) => m.type === matchedType || (m.path && m.path.startsWith(currentSub)))
      .map((m) => ({
        id: m.id || m.path,
        n: m.filename || m.name,
        m: m.size ? `${(m.size / (1024 * 1024)).toFixed(1)} MB` : '12.4 MB',
        dt: 'Sep 08',
        k: matchedType === 'video' ? 'v' : matchedType === 'image' ? 'i' : 'f',
        raw: m
      }));
  }, [filePath, isInsideMusicLibrary, audioSongs, media]);

  const filteredFolderItems = useMemo(() => {
    let list = currentFolderItems;
    if (fileTypeFilter !== 'all') {
      list = list.filter((x) => x.k === 'd' || x.k === fileTypeFilter);
    }
    if (fileSearchQuery.trim()) {
      const q = fileSearchQuery.toLowerCase();
      list = list.filter((x) => x.n.toLowerCase().includes(q));
    }
    return list;
  }, [currentFolderItems, fileTypeFilter, fileSearchQuery]);

  const toggleSelectFileName = (name) => {
    setSelectedFileNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleDownloadSelected = () => {
    selectedFileNames.forEach((name) => {
      const item = currentFolderItems.find((f) => f.n === name);
      if (item?.raw) {
        const link = document.createElement('a');
        link.href = `/api/files/download?path=${encodeURIComponent(item.raw.path || item.raw.filename)}`;
        link.download = item.n;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
    showToast('Download started');
    setIsSelectingFiles(false);
    setSelectedFileNames(new Set());
  };

  const handleDeleteSelected = () => {
    const names = [...selectedFileNames];
    names.forEach((name) => {
      const item = currentFolderItems.find((f) => f.n === name);
      if (item?.raw) deleteMedia(item.raw.path || item.raw.id || item.raw.filename);
    });
    showToast(`Deleted ${names.length} item(s)`);
    setIsSelectingFiles(false);
    setSelectedFileNames(new Set());
  };

  const handleFileUpload = (e, destFolder = '') => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach((file) => startChunkedUpload(file, destFolder));
    showToast(`Uploading ${files.length} file(s)`);
    e.target.value = '';
    openTransfersSheet();
  };

  /* ==========================================================================
     MODAL SHEETS CONTROLLER
     ========================================================================== */
  const openSheet = (title, renderContent) => {
    setActiveSheet({ title, renderContent });
  };
  const closeSheet = () => setActiveSheet(null);

  const openTransfersSheet = () => {
    openSheet('Transfers', () => (
      <div>
        {(transfers || []).length === 0 ? (
          <div className="dim">No transfers.</div>
        ) : (
          (transfers || []).map((t, i) => (
            <div className="tr" key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <b style={{ fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.name}
                </b>
                <button
                  className="btn2"
                  onClick={() => toggleTransferPause(i)}
                >
                  {t.done >= t.total ? 'done' : t.paused ? 'Resume' : 'Pause'}
                </button>
              </div>
              <div className="grid">
                {Array.from({ length: Math.min(24, t.total || 24) }, (_, k) => (
                  <i key={k} className={k < Math.round(((t.done || 0) / (t.total || 1)) * 24) ? 'f' : ''} />
                ))}
              </div>
              <div className="mono dim" style={{ fontSize: '12px' }}>
                {t.done}/{t.total} chunks · resumes where it stopped if the connection drops
              </div>
            </div>
          ))
        )}
      </div>
    ));
  };

  const openTaskForm = (task = null) => {
    const isNew = !task;
    let n = task?.title || '';
    let notes = task?.notes || '';
    let cat = task?.category || 'Work';
    let pri = task?.priority ?? 1;
    let due = task?.dueDate ? task.dueDate.substring(0, 16) : '';
    let rem = task?.reminder || 'none';
    let est = task?.estimatedSessions || 1;

    openSheet(isNew ? 'New task' : 'Edit task', () => (
      <TaskFormContent
        initial={{ n, notes, cat, pri, due, rem, est }}
        isNew={isNew}
        onSave={(data) => {
          if (isNew) {
            addTask({
              title: data.n.trim() || 'Untitled task',
              notes: data.notes,
              category: data.cat,
              priority: data.pri,
              dueDate: data.due,
              reminder: data.rem,
              estimatedSessions: data.est
            });
            showToast('Task created');
          } else {
            updateTask(task.id, {
              title: data.n.trim() || task.title,
              notes: data.notes,
              category: data.cat,
              priority: data.pri,
              dueDate: data.due,
              reminder: data.rem,
              estimatedSessions: data.est
            });
            showToast('Task updated');
          }
          closeSheet();
        }}
        onDelete={() => {
          closeSheet();
          confirmSheet('Delete task?', `Delete "${task.title}"?`, () => deleteTask(task.id));
        }}
      />
    ));
  };

  const openAlarmForm = (alarm = null) => {
    const isNew = !alarm;
    openSheet(isNew ? 'New alarm' : 'Edit alarm', () => (
      <AlarmFormContent
        alarm={alarm}
        isNew={isNew}
        audioSongs={audioSongs}
        availableTones={availableTones}
        onTest={(tone) => {
          testAlarmTone(tone);
          showToast('Playing tone on dock');
        }}
        onSave={(data) => {
          if (isNew) {
            addAlarm({
              time: data.t,
              label: data.l.trim() || 'Alarm',
              enabled: true,
              days: data.d,
              toneId: data.tone,
              volume: data.vol,
              fadeIn: data.fade === 1,
              snoozeMinutes: data.snz,
              ringDurationMinutes: data.dur
            });
            showToast('Alarm created');
          } else {
            updateAlarm(alarm.id, {
              time: data.t,
              label: data.l.trim() || alarm.label,
              days: data.d,
              toneId: data.tone,
              volume: data.vol,
              fadeIn: data.fade === 1,
              snoozeMinutes: data.snz,
              ringDurationMinutes: data.dur
            });
            showToast('Alarm updated');
          }
          closeSheet();
        }}
        onDelete={() => {
          closeSheet();
          confirmSheet('Delete alarm?', `Delete the "${alarm.label}" alarm?`, () => deleteAlarm(alarm.id));
        }}
      />
    ));
  };

  const confirmSheet = (title, message, onConfirm) => {
    openSheet(title, () => (
      <div>
        <div className="dim" style={{ marginBottom: '16px', lineHeight: '1.5' }}>
          {message}
        </div>
        <button
          className="go dngb"
          onClick={() => {
            onConfirm();
            closeSheet();
          }}
        >
          Delete
        </button>
      </div>
    ));
  };

  const openFileMenu = (item) => {
    const isLk = item.lock || isInsideMusicLibrary;
    openSheet(item.n, () => (
      <div>
        <div
          className="mrow"
          onClick={() => {
            closeSheet();
            if (item.raw) {
              const link = document.createElement('a');
              link.href = `/api/files/download?path=${encodeURIComponent(item.raw.path || item.raw.filename)}`;
              link.download = item.n;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              showToast('Download started');
            }
          }}
        >
          <Icon name="dl" size={20} /> Download
        </div>

        {isLk ? (
          <>
            <div
              className="mrow"
              onClick={() => {
                closeSheet();
                setMusicSubtab('library');
                goToTab(3);
              }}
            >
              <Icon name="music" size={20} /> Show in Music
            </div>
            <div className="hostnote" style={{ marginTop: '10px' }}>
              Songs can only be added or removed from Music.
            </div>
          </>
        ) : (
          <>
            <div
              className="mrow"
              onClick={() => {
                closeSheet();
                openRenameSheet(item);
              }}
            >
              <Icon name="edit" size={20} /> Rename
            </div>
            <div
              className="mrow dng"
              onClick={() => {
                closeSheet();
                confirmSheet('Delete file?', `"${item.n}" will be removed from the dock's SD card. This can't be undone.`, () => {
                  if (item.raw) deleteMedia(item.raw.path || item.raw.id || item.raw.filename);
                  showToast('Deleted');
                });
              }}
            >
              <Icon name="trash" size={20} /> Delete
            </div>
          </>
        )}
      </div>
    ));
  };

  const openRenameSheet = (item) => {
    openSheet('Rename', () => {
      let v = item.n;
      return (
        <div>
          <input
            className="fld"
            defaultValue={v}
            onChange={(e) => (v = e.target.value)}
            placeholder="New name"
            autoFocus
          />
          <button
            className="go"
            onClick={() => {
              const trimmed = v.trim();
              if (trimmed && item.raw) {
                updateSongMetadata(item.raw.path || item.raw.id || item.raw.filename, {
                  title: trimmed
                });
                showToast('Renamed');
              }
              closeSheet();
            }}
          >
            Save
          </button>
        </div>
      );
    });
  };

  const openSongMenu = (song) => {
    openSheet(song.title || song.filename || 'Song', () => (
      <div>
        <div
          className="mrow"
          onClick={() => {
            closeSheet();
            openSongEditSheet(song);
          }}
        >
          <Icon name="edit" size={20} /> Edit details
        </div>
        <div
          className="mrow"
          onClick={() => {
            closeSheet();
            playMedia(song);
            showToast('Queued');
          }}
        >
          <Icon name="next" size={20} /> Play next
        </div>
        <div
          className="mrow"
          onClick={() => {
            closeSheet();
            openAddToPlaylistSheet(song);
          }}
        >
          <Icon name="list" size={20} /> Add to playlist
        </div>
        <div
          className="mrow dng"
          onClick={() => {
            closeSheet();
            confirmSheet(
              'Delete song?',
              `"${song.title || song.filename}" will be removed from the library and SD card.`,
              () => {
                deleteMedia(song.path || song.id || song.filename);
                showToast('Removed from library');
              }
            );
          }}
        >
          <Icon name="trash" size={20} /> Delete from library
        </div>
      </div>
    ));
  };

  const openSongEditSheet = (song) => {
    openSheet('Edit song', () => {
      let t = song.title || song.filename || '';
      let a = song.artist || '';
      let cv = song.coverUrl || song.cv || null;
      return (
        <SongEditContent
          initial={{ t, a, cv }}
          onSave={(data) => {
            updateSongMetadata(song.path || song.id || song.filename, {
              title: data.t,
              artist: data.a,
              coverUrl: data.cv
            });
            showToast('Song updated');
            closeSheet();
          }}
        />
      );
    });
  };

  const openNewPlaylistSheet = (initialSong = null) => {
    openSheet('New playlist', () => {
      let n = '';
      let cv = null;
      let selected = new Set(initialSong ? [initialSong.id || initialSong.path] : []);

      return (
        <NewPlaylistContent
          songs={audioSongs}
          initialName={n}
          initialCover={cv}
          initialSelected={selected}
          onSave={(name, cover, trackIds) => {
            createPlaylist({
              name: name.trim() || `Playlist ${(playlists || []).length + 1}`,
              coverUrl: cover,
              trackIds: [...trackIds]
            });
            showToast('Playlist created');
            closeSheet();
          }}
        />
      );
    });
  };

  const openAddToPlaylistSheet = (song) => {
    openSheet('Add to playlist', () => (
      <div>
        {(playlists || []).map((p, k) => {
          const has = (p.tracks || p.trackIds || []).includes(song.id || song.path);
          return (
            <div
              className="mrow"
              key={p.id || k}
              onClick={() => {
                if (!has) {
                  const updated = [...(p.tracks || p.trackIds || []), song.id || song.path];
                  updatePlaylist(p.id, { trackIds: updated });
                  showToast(`Added to ${p.name}`);
                }
                closeSheet();
              }}
            >
              <Icon name="list" size={20} />
              <span>{p.name}</span>
              <span className="dim mono" style={{ marginLeft: 'auto', fontSize: '12px' }}>
                {has ? 'added' : `${(p.tracks || p.trackIds || []).length} songs`}
              </span>
            </div>
          );
        })}
        <div
          className="mrow"
          onClick={() => {
            closeSheet();
            openNewPlaylistSheet(song);
          }}
        >
          <Icon name="plus" size={20} />
          <span>New playlist</span>
        </div>
      </div>
    ));
  };

  // Scrubber seeking on Music Player
  const onScrubberClick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    seekPlayback(pct * songDuration);
  };

  // Tone name resolver
  const getToneName = (toneId) => {
    if (!toneId || toneId === 'default') return 'Default tone';
    const s = audioSongs.find((x) => x.id === toneId || x.filename === toneId);
    return s?.title || s?.filename || 'Default tone';
  };

  return (
    <div id="app" className={isFullWorkspace ? 'full' : ''}>
      {/* Hidden file pickers for direct chunked upload */}
      <input
        ref={generalFileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFileUpload(e, filePath.join('/'))}
      />
      <input
        ref={audioFileInputRef}
        type="file"
        multiple
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFileUpload(e, 'Music library')}
      />

      {/* ── DOCK SIDEBAR / DRAWER ─────────────────────────────── */}
      <aside
        id="dock"
        data-s={dockState}
        aria-label="Dock status"
        onTouchStart={onDockTouchStart}
        onTouchEnd={onDockTouchEnd}
      >
        <button className="grab" id="grab" onClick={cycleDock} aria-label="Collapse or expand status">
          <i />
        </button>

        {/* FULL DOCK DRAWER */}
        <div className="dfull">
          <div className="dhead">
            <div className="dleft">
              <div className="clock" data-clk>
                {hours}:{minutes}
                <small>:{seconds}</small>
              </div>
              <div className="ddate">{dateFormatted}</div>
              <div className="dstat">
                <span className={`chip ${isConnected ? 'ok' : ''}`}>
                  {isConnected ? 'dock connected' : 'connecting'}
                </span>
                <span className="chip">
                  {system?.battery?.level ? `${system.battery.level}% · ` : ''}
                  {system?.deviceName || 'Samsung M34 · Dock'}
                </span>
              </div>
            </div>

            <button className="tbtn" id="pill1" onClick={openTransfersSheet} aria-label="Transfers">
              <Icon name="up" size={22} />
              <span className="tn">{activeTransfersCount}</span>
              <span className="tl">{activeTransfersCount ? 'uploading' : 'transfers'}</span>
            </button>
          </div>

          <div className="dcard">
            <div className="lab">
              <span>SD storage</span>
              <span>{storageUsedGB} / {storageTotalGB} GB</span>
            </div>
            <div className="bar">
              <i style={{ width: `${storagePercent}%` }} />
            </div>
          </div>

          <div className="mini">
            <button className="ib p" onClick={togglePlayPause} aria-label="Play or pause">
              <Icon name={isPlaying ? 'pause' : 'play'} size={18} />
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="t2">{currentSongTitle}</div>
              <div className="mono dim" style={{ fontSize: '11px', marginTop: '3px' }}>
                {isPlaying ? 'playing on dock' : 'dock paused'}
              </div>
            </div>
            <button className="ib" onClick={playNextMedia} aria-label="Next">
              <Icon name="next" size={16} />
            </button>
          </div>
        </div>

        {/* PEEK DOCK DRAWER */}
        <div className="dpeek">
          <span className="tt">{hours}:{minutes}</span>
          <button className="ib p" onClick={togglePlayPause} aria-label="Play or pause">
            <Icon name={isPlaying ? 'pause' : 'play'} size={18} />
          </button>
          <span className="grow">{currentSongTitle}</span>
          <button className="chip who" id="pill2" onClick={openTransfersSheet}>
            <span>{activeTransfersCount}</span> ⇅
          </button>
        </div>
      </aside>

      {/* ── WORKSPACE ─────────────────────────────────────────── */}
      <main id="work">
        <header className="top">
          <div className="seg" id="seg">
            {TABS.map((t, i) => (
              <button
                key={t[0]}
                className={activeTab === i ? 'on' : ''}
                onClick={() => handleTabClick(i)}
              >
                <Icon name={t[0]} />
                <span>{t[1]}</span>
              </button>
            ))}
          </div>

          <button className="back" id="back" onClick={exitFullWorkspace}>
            <Icon name="l" size={18} />
            <span>Back</span>
          </button>

          <div className="title" id="ptitle" onDoubleClick={exitFullWorkspace}>
            {TABS[activeTab][1]}
          </div>

          <button
            className="chip"
            onClick={toggleFullscreen}
            style={{
              cursor: 'pointer',
              padding: '4px 7px',
              color: isFullscreen ? 'var(--acc)' : 'var(--dim)',
              borderColor: isFullscreen ? '#4a3414' : 'var(--line)',
              opacity: 0.7,
              transition: 'opacity .2s, color .2s, border-color .2s'
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            <Icon name={isFullscreen ? 'compress' : 'expand'} size={13} />
          </button>

          <span
            className="chip who"
            onClick={toggleDeviceRole}
            style={{ cursor: 'pointer' }}
            title="Toggle to Dock Station Mode"
          >
            client
          </span>
        </header>

        {/* Horizontal Pager for 4 Modules */}
        <div
          ref={pagerRef}
          id="pager"
          onScroll={() => {
            if (!pagerRef.current || isNavigatingRef.current) return;
            const w = pagerRef.current.clientWidth || 1;
            const i = Math.round(pagerRef.current.scrollLeft / w);
            if (i !== activeTab && i >= 0 && i <= 3) setActiveTab(i);
          }}
        >
          {/* ── TAB 0: TASKS ─────────────────────────────────── */}
          <section className="pg" id="p0">
            <div className="chips" style={{ alignItems: 'center' }}>
              {['pending', 'all', 'done'].map((k) => (
                <button
                  key={k}
                  className={`fc ${taskFilter === k ? 'on' : ''}`}
                  onClick={() => setTaskFilter(k)}
                >
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </button>
              ))}
              <span style={{ flex: 1 }} />
              <button className="btn2" onClick={cycleTaskSort}>
                <Icon name="list" size={16} />
                <span>{{ manual: 'Manual', due: 'By deadline', pri: 'By priority' }[taskSort]}</span>
              </button>
            </div>

            <h3>{pendingTasksCount} pending · {completedTasksCount} done</h3>

            {processedTasks.length === 0 ? (
              <div className="hostnote">No tasks here.</div>
            ) : (
              processedTasks.map((t) => {
                const dueInfo = !t.completed && getDueInfo(t.dueDate);
                const priorityLabel = PRI[t.priority ?? 1]?.[1] || 'Medium';

                return (
                  <div
                    key={t.id}
                    className={`row ${t.completed ? 'done' : ''}`}
                    onClick={(e) => {
                      if (e.target.closest('.cb')) {
                        toggleTask(t.id);
                      } else if (!e.target.closest('[data-focus]')) {
                        openTaskForm(t);
                      }
                    }}
                  >
                    <span className={`cb ${t.completed ? 'on' : ''}`}>
                      {t.completed && <Icon name="chk" size={14} />}
                    </span>

                    <div className="main">
                      <div className="name">{t.title}</div>
                      <div className="sub">
                        {t.category || 'Work'} · {t.estimatedSessions || 1} session{(t.estimatedSessions || 1) > 1 ? 's' : ''}
                        {t.dueDate ? ` · ${formatDueTime(t.dueDate)}` : ''}
                        {t.dueDate && t.reminder && t.reminder !== 'none' ? ' · reminder set' : ''}
                      </div>
                    </div>

                    {dueInfo && <span className={`tag ${dueInfo[1]}`}>{dueInfo[0]}</span>}
                    <span className={`tag p${t.priority ?? 1}`}>{priorityLabel}</span>

                    <button
                      className="ib"
                      data-focus="1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocusTarget(t.id, t.title);
                        showToast('Focus target sent to dock');
                      }}
                      aria-label="Send to dock focus"
                    >
                      <Icon name="tr" size={18} />
                    </button>
                  </div>
                );
              })
            )}

            <div className="hostnote">
              Tap a task to edit it, tap the box to complete it. The dock will use deadlines and reminders to warn you in advance.
            </div>
          </section>

          {/* ── TAB 1: ALARMS ────────────────────────────────── */}
          <section className="pg" id="p1">
            <h3>Alarms on dock</h3>

            {(alarms || []).length === 0 ? (
              <div className="hostnote">No alarms configured.</div>
            ) : (
              (alarms || []).map((a) => (
                <div
                  key={a.id}
                  className="row"
                  onClick={(e) => {
                    if (e.target.closest('.sw')) {
                      toggleAlarm(a.id);
                    } else if (!e.target.closest('[data-test]')) {
                      openAlarmForm(a);
                    }
                  }}
                >
                  <div className="main">
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
                      <span className="t">{a.time}</span>
                      <span className="name">{a.label || 'Alarm'}</span>
                    </div>
                    <div className="days">
                      {DAYS.map((x, k) => (
                        <i key={k} className={a.days?.[k] ? '' : 'off'}>
                          {x}
                        </i>
                      ))}
                    </div>
                    <div className="sub">
                      {dayTxt(a.days)} · {getToneName(a.toneId || a.tone)}
                      {a.snoozeMinutes ? ` · snooze ${a.snoozeMinutes}m` : ''}
                    </div>
                  </div>

                  <button
                    className="ib"
                    data-test="1"
                    onClick={(e) => {
                      e.stopPropagation();
                      testAlarmTone(a.toneId || a.tone);
                      showToast('Test tone playing on dock');
                    }}
                    aria-label="Test on dock"
                  >
                    <Icon name="play" size={16} />
                  </button>

                  <span className={`sw ${a.enabled ? 'on' : ''}`} />
                </div>
              ))
            )}

            <div className="hostnote">
              Tap an alarm to edit it. Alarms only ring on the dock, and "test" plays the tone there.
            </div>
          </section>

          {/* ── TAB 2: FILES ─────────────────────────────────── */}
          <section className="pg" id="p2">
            <div className="tb">
              <label className="search">
                <Icon name="search" size={18} />
                <input
                  id="fq"
                  placeholder="Search files"
                  value={fileSearchQuery}
                  onChange={(e) => setFileSearchQuery(e.target.value)}
                />
              </label>

              <button
                className="ib"
                onClick={() => setIsGridView(!isGridView)}
                aria-label="Switch view"
              >
                <Icon name={isGridView ? 'list' : 'grid'} size={18} />
              </button>

              <button
                className={`btn2 ${isSelectingFiles ? 'on' : ''}`}
                onClick={() => {
                  setIsSelectingFiles(!isSelectingFiles);
                  setSelectedFileNames(new Set());
                }}
              >
                {isSelectingFiles ? 'Done' : 'Select'}
              </button>
            </div>

            {filePath.length === 0 && (
              <div className="dcard">
                <div className="lab">
                  <span>SD vault</span>
                  <span>{storageUsedGB} of {storageTotalGB} GB</span>
                </div>
                <div className="bar">
                  <i style={{ width: `${storagePercent}%` }} />
                </div>
              </div>
            )}

            <div className="crumb" style={{ margin: '4px 2px 10px' }}>
              <button onClick={() => setFilePath([])}>
                {filePath.length === 0 ? <b>SD vault</b> : 'SD vault'}
              </button>
              {filePath.map((p, i) => (
                <React.Fragment key={i}>
                  <span>/</span>
                  <button onClick={() => setFilePath(filePath.slice(0, i + 1))}>
                    {i === filePath.length - 1 ? <b>{p}</b> : p}
                  </button>
                </React.Fragment>
              ))}
            </div>

            <div className="chips">
              {[
                ['all', 'All'],
                ['v', 'Video'],
                ['a', 'Audio'],
                ['i', 'Images']
              ].map((c) => (
                <button
                  key={c[0]}
                  className={`fc ${fileTypeFilter === c[0] ? 'on' : ''}`}
                  onClick={() => setFileTypeFilter(c[0])}
                >
                  {c[1]}
                </button>
              ))}
            </div>

            {isInsideMusicLibrary && (
              <div className="lockb">
                <Icon name="lock" size={18} />
                <div>Read-only here. Add or remove songs from Music.</div>
                <button
                  className="btn2"
                  onClick={() => {
                    setMusicSubtab('library');
                    goToTab(3);
                  }}
                >
                  Open Music
                </button>
              </div>
            )}

            <div id="flist">
              {filteredFolderItems.length === 0 ? (
                <div className="hostnote">Nothing here.</div>
              ) : isGridView ? (
                <div className="gridv">
                  {filteredFolderItems.map((f, i) => {
                    const isSelected = selectedFileNames.has(f.n);
                    return (
                      <div
                        key={f.id || i}
                        className={`tile ${isSelected ? 'sel' : ''}`}
                        onClick={() => {
                          if (f.k === 'd') {
                            setFilePath([...filePath, f.n]);
                            setFileTypeFilter('all');
                            setFileSearchQuery('');
                            setSelectedFileNames(new Set());
                          } else if (isSelectingFiles) {
                            toggleSelectFileName(f.n);
                          } else {
                            openFileMenu(f);
                          }
                        }}
                      >
                        <div className={`ft ${f.k}`}>
                          <Icon name={f.k === 'd' ? 'fold' : f.k === 'v' ? 'video' : f.k === 'a' ? 'music' : f.k === 'i' ? 'image' : 'file'} size={28} />
                        </div>
                        <div className="name">{f.n}</div>
                        <div className="sub">{f.k === 'd' ? f.count : `${f.m} · ${f.dt}`}</div>
                        {(isInsideMusicLibrary || f.lock) && (
                          <span className="lk">
                            <Icon name="lock" size={14} />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                filteredFolderItems.map((f, i) => {
                  const isSelected = selectedFileNames.has(f.n);
                  return (
                    <div
                      key={f.id || i}
                      className={`row ${isSelected ? 'sel' : ''}`}
                      onClick={() => {
                        if (f.k === 'd') {
                          setFilePath([...filePath, f.n]);
                          setFileTypeFilter('all');
                          setFileSearchQuery('');
                          setSelectedFileNames(new Set());
                        } else if (isSelectingFiles) {
                          toggleSelectFileName(f.n);
                        } else {
                          openFileMenu(f);
                        }
                      }}
                    >
                      {isSelectingFiles && f.k !== 'd' && (
                        <span className={`cb ${isSelected ? 'on' : ''}`}>
                          {isSelected && <Icon name="chk" size={14} />}
                        </span>
                      )}

                      <span className={`ft ${f.k}`}>
                        <Icon name={f.k === 'd' ? 'fold' : f.k === 'v' ? 'video' : f.k === 'a' ? 'music' : f.k === 'i' ? 'image' : 'file'} />
                      </span>

                      <div className="main">
                        <div className="name">{f.n}</div>
                        <div className="sub">{f.k === 'd' ? f.count : `${f.m} · ${f.dt}`}</div>
                      </div>

                      {f.lock && f.k === 'd' ? (
                        <span className="tag">managed in music</span>
                      ) : null}

                      {f.lock && f.k === 'd' ? (
                        <Icon name="more" />
                      ) : (
                        <button
                          className="ib"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFileMenu(f);
                          }}
                          aria-label="More"
                        >
                          <Icon name="dots" size={18} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* ── TAB 3: MUSIC ─────────────────────────────────── */}
          <section className="pg" id="p3">
            <div className="mus">
              {/* Hero Now Playing Player */}
              <div className={`hero ${isPlaying ? 'playing' : ''}`}>
                <div
                  className="art"
                  style={currentSong?.coverUrl || currentSong?.cv ? cvs(currentSong, currentSongTitle) : {}}
                >
                  {currentSong?.coverUrl || currentSong?.cv ? null : (
                    <div className="vin">
                      <i />
                    </div>
                  )}
                </div>

                <div className="mtt">{currentSongTitle}</div>
                <div className="mta">{currentArtist}</div>

                <div className="scr" onClick={onScrubberClick}>
                  <i id="mfill" style={{ width: `${progressPercent}%` }} />
                  <b id="mknob" style={{ left: `${progressPercent}%` }} />
                </div>

                <div className="tm">
                  <span id="mcur">{formatSeconds(currentPosition)}</span>
                  <span>{formatSeconds(songDuration)}</span>
                </div>

                <div className="ctl">
                  <button
                    className={playbackState?.shuffle ? 'on' : ''}
                    onClick={toggleShuffle}
                    aria-label="Shuffle"
                  >
                    <Icon name="shuffle" size={22} />
                  </button>

                  <button onClick={playPrevMedia} aria-label="Previous">
                    <Icon name="prev" size={26} />
                  </button>

                  <button className="big" onClick={togglePlayPause} aria-label="Play or pause">
                    <Icon name={isPlaying ? 'pause' : 'play'} size={30} />
                  </button>

                  <button onClick={playNextMedia} aria-label="Next">
                    <Icon name="next" size={26} />
                  </button>

                  <button
                    className={playbackState?.repeat && playbackState?.repeat !== 'off' ? 'on' : ''}
                    onClick={toggleRepeat}
                    aria-label="Repeat"
                  >
                    <Icon name="repeat" size={22} />
                  </button>
                </div>
              </div>

              {/* Music Modules: Queue / Library / Playlists */}
              <div className="mlist">
                <div className="subtabs">
                  {[
                    ['queue', 'Queue'],
                    ['library', 'Library'],
                    ['lists', 'Playlists']
                  ].map((c) => (
                    <button
                      key={c[0]}
                      className={`fc ${musicSubtab === c[0] ? 'on' : ''}`}
                      onClick={() => {
                        setMusicSubtab(c[0]);
                        setActivePlaylistIndex(null);
                      }}
                    >
                      {c[1]}
                    </button>
                  ))}
                </div>

                <div id="mbody">
                  {/* QUEUE SUBTAB */}
                  {musicSubtab === 'queue' && (
                    <>
                      <div className="act">
                        <div className="l dim mono">
                          {playbackState?.shuffle ? 'Shuffled' : 'In order'} · saved on dock
                        </div>
                      </div>

                      {queueTracks.length === 0 ? (
                        <div className="hostnote">Queue is empty.</div>
                      ) : (
                        queueTracks.map((song, k) => {
                          const isCur = k === activeQueueIndex;
                          const isPast = activeQueueIndex >= 0 && k < activeQueueIndex;
                          const tag = isCur ? 'now' : isPast ? 'prev' : `+${k - activeQueueIndex}`;

                          return (
                            <div
                              key={song.id || k}
                              className={`row ${isCur ? 'cur' : ''} ${isPast ? 'past' : ''}`}
                              onClick={() => playMedia(song)}
                            >
                              <span className="stile" style={cvs(song, song.title || song.filename)}>
                                {isCur && isPlaying ? (
                                  <span className="eq">
                                    <i />
                                    <i />
                                    <i />
                                  </span>
                                ) : song.coverUrl || song.cv ? null : (
                                  <Icon name="music" size={18} />
                                )}
                              </span>

                              <div className="main">
                                <div className="name">{song.title || song.filename}</div>
                                <div className="sub">{song.artist || 'Artist'} · {formatSeconds(song.duration || 180)}</div>
                              </div>

                              <span className="tag">{tag}</span>
                              <Icon name="drag" size={18} />
                            </div>
                          );
                        })
                      )}
                    </>
                  )}

                  {/* LIBRARY SUBTAB */}
                  {musicSubtab === 'library' && (
                    <>
                      <div className="act">
                        <div className="l dim mono">{audioSongs.length} songs</div>
                        <button
                          className="btn2"
                          onClick={() => audioFileInputRef.current?.click()}
                        >
                          <Icon name="plus" size={16} />
                          <span>Add songs</span>
                        </button>
                      </div>

                      {audioSongs.length === 0 ? (
                        <div className="hostnote">No songs in library. Upload MP3s or audio files to start.</div>
                      ) : (
                        audioSongs.map((song, i) => {
                          const isCur = song.id === currentSong?.id || song.path === currentSong?.path;

                          return (
                            <div
                              key={song.id || i}
                              className={`row ${isCur ? 'cur' : ''}`}
                              onClick={() => playMedia(song)}
                            >
                              <span className="stile" style={cvs(song, song.title || song.filename)}>
                                {isCur && isPlaying ? (
                                  <span className="eq">
                                    <i />
                                    <i />
                                    <i />
                                  </span>
                                ) : song.coverUrl || song.cv ? null : (
                                  <Icon name="music" size={18} />
                                )}
                              </span>

                              <div className="main">
                                <div className="name">{song.title || song.filename}</div>
                                <div className="sub">{song.artist || 'Unknown artist'} · {formatSeconds(song.duration || 180)}</div>
                              </div>

                              <button
                                className="ib"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSongMenu(song);
                                }}
                                aria-label="More"
                              >
                                <Icon name="dots" size={18} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </>
                  )}

                  {/* PLAYLISTS SUBTAB */}
                  {musicSubtab === 'lists' && (
                    activePlaylistIndex !== null && playlists[activePlaylistIndex] ? (
                      // Single Playlist Detail View
                      (() => {
                        const pl = playlists[activePlaylistIndex];
                        const plSongIds = pl.tracks || pl.trackIds || [];
                        const plSongs = audioSongs.filter((s) => plSongIds.includes(s.id || s.path));

                        return (
                          <>
                            <div className="act">
                              <button className="btn2" onClick={() => setActivePlaylistIndex(null)}>
                                ← Playlists
                              </button>
                              <span style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  className="btn2"
                                  onClick={() => {
                                    if (plSongs.length) {
                                      playPlaylist(pl.id);
                                      showToast('Playing playlist on dock');
                                    } else {
                                      showToast('Playlist is empty');
                                    }
                                  }}
                                >
                                  <Icon name="play" size={16} /> Play
                                </button>
                                <button
                                  className="btn2 dng"
                                  onClick={() => {
                                    confirmSheet('Delete playlist?', `Delete playlist "${pl.name}"? The songs stay in your library.`, () => {
                                      deletePlaylist(pl.id);
                                      setActivePlaylistIndex(null);
                                      showToast('Playlist deleted');
                                    });
                                  }}
                                  aria-label="Delete playlist"
                                >
                                  <Icon name="trash" size={16} />
                                </button>
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2px 2px 12px' }}>
                              <span className="stile" style={cvs(pl, pl.name)}>
                                {pl.coverUrl || pl.cv ? null : <Icon name="list" size={18} />}
                              </span>
                              <span style={{ fontWeight: 700, fontSize: '18px', flex: 1 }}>{pl.name}</span>
                              <button
                                className="ib"
                                onClick={() => {
                                  openSheet('Edit playlist', () => (
                                    <PlaylistEditContent
                                      playlist={pl}
                                      onSave={(data) => {
                                        updatePlaylist(pl.id, {
                                          name: data.n,
                                          coverUrl: data.cv
                                        });
                                        showToast('Playlist updated');
                                        closeSheet();
                                      }}
                                    />
                                  ));
                                }}
                                aria-label="Rename playlist"
                              >
                                <Icon name="edit" size={18} />
                              </button>
                            </div>

                            {plSongs.length === 0 ? (
                              <div className="hostnote">Empty. In Library, tap ⋯ on a song and choose Add to playlist.</div>
                            ) : (
                              plSongs.map((song, i) => (
                                <div
                                  key={song.id || i}
                                  className="row"
                                  onClick={() => playMedia(song)}
                                >
                                  <span className="stile" style={cvs(song, song.title || song.filename)}>
                                    {song.coverUrl || song.cv ? null : <Icon name="music" size={18} />}
                                  </span>
                                  <div className="main">
                                    <div className="name">{song.title || song.filename}</div>
                                    <div className="sub">{song.artist || 'Unknown artist'} · {formatSeconds(song.duration || 180)}</div>
                                  </div>
                                </div>
                              ))
                            )}
                          </>
                        );
                      })()
                    ) : (
                      // Playlists Overview List
                      <>
                        <div className="act">
                          <div className="l dim mono">
                            {(playlists || []).length} playlist{(playlists || []).length === 1 ? '' : 's'}
                          </div>
                          <span style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="ib"
                              onClick={() => setPlaylistView(playlistView === 'grid' ? 'list' : 'grid')}
                              style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--panel)', border: '1px solid var(--line)' }}
                              aria-label="Switch view"
                            >
                              <Icon name={playlistView === 'grid' ? 'list' : 'grid'} size={16} />
                            </button>
                            <button className="btn2" onClick={() => openNewPlaylistSheet()}>
                              <Icon name="plus" size={16} />
                              <span>New playlist</span>
                            </button>
                          </span>
                        </div>

                        {(playlists || []).length === 0 ? (
                          <div className="hostnote">No playlists yet. Create one to group songs.</div>
                        ) : playlistView === 'grid' ? (
                          <div className="gridv">
                            {(playlists || []).map((p, i) => (
                              <div
                                key={p.id || i}
                                className="tile"
                                onClick={() => setActivePlaylistIndex(i)}
                              >
                                <div className="ft" style={{ ...cvs(p, p.name), height: '112px' }}>
                                  {p.coverUrl || p.cv ? null : <Icon name="list" size={30} />}
                                </div>
                                <div className="name">{p.name}</div>
                                <div className="sub">
                                  {(p.tracks || p.trackIds || []).length} song{(p.tracks || p.trackIds || []).length === 1 ? '' : 's'}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          (playlists || []).map((p, i) => (
                            <div
                              key={p.id || i}
                              className="row"
                              onClick={() => setActivePlaylistIndex(i)}
                            >
                              <span className="stile" style={cvs(p, p.name)}>
                                {p.coverUrl || p.cv ? null : <Icon name="list" size={18} />}
                              </span>
                              <div className="main">
                                <div className="name">{p.name}</div>
                                <div className="sub">
                                  {(p.tracks || p.trackIds || []).length} song{(p.tracks || p.trackIds || []).length === 1 ? '' : 's'}
                                </div>
                              </div>
                              <Icon name="more" />
                            </div>
                          ))
                        )}
                      </>
                    )
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── SELECTION TOOLBAR BAR ────────────────────────────── */}
        <div
          id="selbar"
          style={{ display: isSelectingFiles && activeTab === 2 ? 'flex' : 'none' }}
        >
          <span className="mono" style={{ fontSize: '13px' }}>
            {selectedFileNames.size} selected
          </span>
          <span style={{ flex: 1 }} />
          <button className="btn2" onClick={handleDownloadSelected}>
            <Icon name="dl" size={16} />
            <span>Download</span>
          </button>
          {!isInsideMusicLibrary && (
            <button className="btn2 dng" onClick={handleDeleteSelected}>
              <Icon name="trash" size={16} />
              <span>Delete</span>
            </button>
          )}
        </div>

        {/* ── CONTEXTUAL FAB BUTTON ────────────────────────────── */}
        <button
          id="fab"
          style={{
            display: activeTab === 2 && (isSelectingFiles || isInsideMusicLibrary) ? 'none' : 'flex'
          }}
          onClick={() => {
            if (activeTab === 0) openTaskForm();
            else if (activeTab === 1) openAlarmForm();
            else if (activeTab === 2) generalFileInputRef.current?.click();
            else if (activeTab === 3) audioFileInputRef.current?.click();
          }}
        >
          <Icon name={activeTab > 1 ? 'up' : 'plus'} size={20} />
          <span>{['Add task', 'Add alarm', 'Upload', 'Add songs'][activeTab]}</span>
        </button>
      </main>

      {/* ── REVEAL SIDEBAR TAB (when dock is hidden) ─────────── */}
      <button
        id="reveal"
        className={dockState === 'hidden' ? 'show' : ''}
        onClick={() => setDockState('peek')}
        aria-label="Show status"
      >
        <Icon name={isLandscape ? 'l' : 'tr'} />
      </button>

      {/* ── MODAL SHEET CONTAINER ────────────────────────────── */}
      <div
        className={`scrim ${activeSheet ? 'show' : ''}`}
        id="scrim"
        onClick={(e) => {
          if (e.target.id === 'scrim') closeSheet();
        }}
      >
        <div className="sheet" id="sheet">
          {activeSheet && (
            <>
              <h4>
                <span>{activeSheet.title}</span>
                <button className="ib" onClick={closeSheet} aria-label="Close">
                  <Icon name="x" size={18} />
                </button>
              </h4>
              {activeSheet.renderContent && activeSheet.renderContent()}
            </>
          )}
        </div>
      </div>

      {/* ── FLOATING TOAST NOTIFICATION ───────────────────────── */}
      {toastMessage && <div id="toast">{toastMessage}</div>}
    </div>
  );
};

/* ==========================================================================
   FORM COMPONENTS (PORTED DIRECTLY FROM VISION PROTOTYPE)
   ========================================================================== */

const TaskFormContent = ({ initial, isNew, onSave, onDelete }) => {
  const [n, setN] = useState(initial.n);
  const [notes, setNotes] = useState(initial.notes);
  const [cat, setCat] = useState(initial.cat);
  const [pri, setPri] = useState(initial.pri);
  const [due, setDue] = useState(initial.due);
  const [rem, setRem] = useState(initial.rem);
  const [est, setEst] = useState(initial.est);

  return (
    <div>
      <input
        className="fld"
        placeholder="What needs doing?"
        value={n}
        onChange={(e) => setN(e.target.value)}
        autoFocus
      />
      <textarea
        className="fld"
        placeholder="Notes (optional)"
        style={{ height: '80px', paddingTop: '12px', resize: 'none' }}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="flab">Priority</div>
      <div className="chips">
        {PRI.map((p) => (
          <button
            key={p[0]}
            type="button"
            className={`fc ${String(pri) === p[0] ? 'on' : ''}`}
            onClick={() => setPri(+p[0])}
          >
            {p[1]}
          </button>
        ))}
      </div>

      <div className="flab">Category</div>
      <div className="chips">
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            className={`fc ${cat === c ? 'on' : ''}`}
            onClick={() => setCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flab">Deadline</div>
      <input
        className="fld"
        type="datetime-local"
        value={due}
        onChange={(e) => setDue(e.target.value)}
      />

      <div className="flab">Remind me on the dock</div>
      <div className="chips">
        {REM.map((r) => (
          <button
            key={r[0]}
            type="button"
            className={`fc ${rem === r[0] ? 'on' : ''}`}
            onClick={() => setRem(r[0])}
          >
            {r[1]}
          </button>
        ))}
      </div>

      <div className="flab">Focus sessions needed</div>
      <div className="chips">
        {[1, 2, 3, 4, 6, 8].map((s) => (
          <button
            key={s}
            type="button"
            className={`fc ${est === s ? 'on' : ''}`}
            onClick={() => setEst(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <button
        className="go"
        style={{ marginTop: '18px' }}
        onClick={() => onSave({ n, notes, cat, pri, due, rem, est })}
      >
        {isNew ? 'Add task' : 'Save changes'}
      </button>

      {!isNew && (
        <button
          className="go dngb"
          style={{ marginTop: '8px' }}
          onClick={onDelete}
        >
          Delete task
        </button>
      )}
    </div>
  );
};

const AlarmFormContent = ({ alarm, isNew, audioSongs, availableTones, onTest, onSave, onDelete }) => {
  const [t, setT] = useState(alarm?.time || '07:30');
  const [l, setL] = useState(alarm?.label || '');
  const [d, setD] = useState(alarm?.days || [1, 1, 1, 1, 1, 0, 0]);
  const [tone, setTone] = useState(alarm?.toneId || alarm?.tone || 'default');
  const [vol, setVol] = useState(alarm?.volume ?? 70);
  const [fade, setFade] = useState(alarm?.fadeIn ? 1 : 0);
  const [snz, setSnz] = useState(alarm?.snoozeMinutes ?? 10);
  const [dur, setDur] = useState(alarm?.ringDurationMinutes ?? 5);

  const setPreset = (preset) => {
    const presets = {
      wk: [1, 1, 1, 1, 1, 0, 0],
      we: [0, 0, 0, 0, 0, 1, 1],
      all: [1, 1, 1, 1, 1, 1, 1],
      once: [0, 0, 0, 0, 0, 0, 0]
    };
    if (presets[preset]) setD(presets[preset]);
  };

  const toggleDay = (idx) => {
    setD((prev) => {
      const next = [...prev];
      next[idx] = next[idx] ? 0 : 1;
      return next;
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          className="fld"
          type="time"
          value={t}
          onChange={(e) => setT(e.target.value)}
          style={{ width: '150px' }}
        />
        <input
          className="fld"
          placeholder="Label, e.g. Work focus"
          value={l}
          onChange={(e) => setL(e.target.value)}
        />
      </div>

      <div className="flab">Repeat</div>
      <div className="chips">
        <button type="button" className="fc" onClick={() => setPreset('wk')}>Weekdays</button>
        <button type="button" className="fc" onClick={() => setPreset('we')}>Weekends</button>
        <button type="button" className="fc" onClick={() => setPreset('all')}>Every day</button>
        <button type="button" className="fc" onClick={() => setPreset('once')}>Once</button>
      </div>

      <div className="dayrow">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x, k) => (
          <button
            key={k}
            type="button"
            className={`dchip ${d[k] ? 'on' : ''}`}
            onClick={() => toggleDay(k)}
          >
            {x}
          </button>
        ))}
      </div>

      <div className="flab">Alarm tone</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <select
          className="fld"
          style={{ flex: 1, margin: 0 }}
          value={tone}
          onChange={(e) => setTone(e.target.value)}
        >
          <optgroup label="Built in">
            <option value="default">Default tone</option>
            {(availableTones || []).map((t) => (
              <option key={t.filename || t.id} value={t.filename || t.id}>
                {t.name || t.filename}
              </option>
            ))}
          </optgroup>
          {audioSongs.length > 0 && (
            <optgroup label="From your music">
              {audioSongs.map((s) => (
                <option key={s.id || s.path} value={s.id || s.path}>
                  {s.title || s.filename}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          className="btn2"
          style={{ height: '48px' }}
          onClick={() => onTest(tone)}
        >
          <Icon name="play" size={16} /> Test
        </button>
      </div>

      <div className="flab">
        <span>Volume</span>
        <span className="mono">{vol}%</span>
      </div>
      <input
        type="range"
        min="10"
        max="100"
        value={vol}
        onChange={(e) => setVol(+e.target.value)}
        style={{ width: '100%', accentColor: 'var(--acc)', height: '28px' }}
      />

      <div className="flab">Fade in</div>
      <div className="chips">
        <button
          type="button"
          className={`fc ${fade === 1 ? 'on' : ''}`}
          onClick={() => setFade(1)}
        >
          On
        </button>
        <button
          type="button"
          className={`fc ${fade === 0 ? 'on' : ''}`}
          onClick={() => setFade(0)}
        >
          Off
        </button>
      </div>

      <div className="flab">Snooze</div>
      <div className="chips">
        {[
          [0, 'Off'],
          [5, '5 min'],
          [10, '10 min'],
          [15, '15 min']
        ].map((s) => (
          <button
            key={s[0]}
            type="button"
            className={`fc ${snz === s[0] ? 'on' : ''}`}
            onClick={() => setSnz(s[0])}
          >
            {s[1]}
          </button>
        ))}
      </div>

      <div className="flab">Ring for</div>
      <div className="chips">
        {[
          [1, '1 min'],
          [5, '5 min'],
          [10, '10 min']
        ].map((r) => (
          <button
            key={r[0]}
            type="button"
            className={`fc ${dur === r[0] ? 'on' : ''}`}
            onClick={() => setDur(r[0])}
          >
            {r[1]}
          </button>
        ))}
      </div>

      <button
        className="go"
        style={{ marginTop: '18px' }}
        onClick={() => onSave({ t, l, d, tone, vol, fade, snz, dur })}
      >
        {isNew ? 'Save alarm' : 'Save changes'}
      </button>

      {!isNew && (
        <button
          className="go dngb"
          style={{ marginTop: '8px' }}
          onClick={onDelete}
        >
          Delete alarm
        </button>
      )}
    </div>
  );
};

const SongEditContent = ({ initial, onSave }) => {
  const [t, setT] = useState(initial.t);
  const [a, setA] = useState(initial.a);
  const [cv, setCv] = useState(initial.cv);

  return (
    <div>
      <input
        className="fld"
        value={t}
        onChange={(e) => setT(e.target.value)}
        placeholder="Title"
      />
      <input
        className="fld"
        value={a}
        onChange={(e) => setA(e.target.value)}
        placeholder="Artist"
      />

      <div className="flab">Cover image (optional)</div>
      <div className="cvedit">
        <div className="cvprev" style={cvs({ cv }, t)} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            className="btn2"
            onClick={() => pickImg((data) => setCv(data))}
          >
            <Icon name="image" size={16} /> Choose image
          </button>
          <button
            type="button"
            className="btn2"
            onClick={() => setCv(null)}
          >
            Use default
          </button>
        </div>
      </div>

      <button
        className="go"
        style={{ marginTop: '16px' }}
        onClick={() => onSave({ t: t.trim() || initial.t, a: a.trim(), cv })}
      >
        Save changes
      </button>
    </div>
  );
};

const PlaylistEditContent = ({ playlist, onSave }) => {
  const [n, setN] = useState(playlist.name);
  const [cv, setCv] = useState(playlist.coverUrl || playlist.cv || null);

  return (
    <div>
      <input
        className="fld"
        value={n}
        onChange={(e) => setN(e.target.value)}
        placeholder="Playlist name"
      />

      <div className="flab">Cover image</div>
      <div className="cvedit">
        <div className="cvprev" style={cvs({ cv }, n)} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            className="btn2"
            onClick={() => pickImg((data) => setCv(data))}
          >
            <Icon name="image" size={16} /> Choose image
          </button>
          <button
            type="button"
            className="btn2"
            onClick={() => setCv(null)}
          >
            Use default
          </button>
        </div>
      </div>

      <button
        className="go"
        style={{ marginTop: '16px' }}
        onClick={() => onSave({ n: n.trim() || playlist.name, cv })}
      >
        Save changes
      </button>
    </div>
  );
};

const NewPlaylistContent = ({ songs, initialName, initialCover, initialSelected, onSave }) => {
  const [n, setN] = useState(initialName);
  const [cv, setCv] = useState(initialCover);
  const [selected, setSelected] = useState(new Set(initialSelected));

  const toggleSong = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <input
        className="fld"
        placeholder="Playlist name"
        value={n}
        onChange={(e) => setN(e.target.value)}
        autoFocus
      />

      <div className="flab">Cover image (optional)</div>
      <div className="cvedit">
        <div className="cvprev" style={cvs({ cv }, n || 'New playlist')} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            className="btn2"
            onClick={() => pickImg((data) => setCv(data))}
          >
            <Icon name="image" size={16} /> Choose image
          </button>
          <button
            type="button"
            className="btn2"
            onClick={() => setCv(null)}
          >
            Use default
          </button>
        </div>
      </div>

      <div className="flab" style={{ marginTop: '14px' }}>Pick songs (optional)</div>
      <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
        {songs.map((s, i) => {
          const id = s.id || s.path;
          const isChecked = selected.has(id);
          return (
            <label
              key={id || i}
              className="mrow"
              style={{ cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleSong(id)}
                style={{ width: '20px', height: '20px', accentColor: 'var(--acc)' }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: '10px' }}>
                {s.title || s.filename}
              </span>
            </label>
          );
        })}
      </div>

      <button
        className="go"
        style={{ marginTop: '14px' }}
        onClick={() => onSave(n, cv, selected)}
      >
        Create playlist
      </button>
    </div>
  );
};
