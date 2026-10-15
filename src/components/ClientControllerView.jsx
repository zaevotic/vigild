import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDashboard, isAudioFile, isMediaFile } from '../context/DashboardContext';

export const ClientControllerView = () => {
  const {
    alarms,
    activeAlarm,
    availableTones,
    media,
    playlists,
    tasks,
    focusState,
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
    updatePlaylistTracks,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    deletePlaylist,
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    reorderTasks,
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
    deviceRole,
    toggleDeviceRole
  } = useDashboard();

  // Navigation & Layout states
  const [activeTab, setActiveTab] = useState(0); // 0: Tasks, 1: Alarms, 2: Files, 3: Music
  const [isFullWorkspace, setIsFullWorkspace] = useState(false);
  const [dockState, setDockState] = useState('full'); // 'full' | 'peek' | 'hidden'
  const [currentTime, setCurrentTime] = useState(new Date());

  // Tasks Tab states
  const [taskFilter, setTaskFilter] = useState('pending'); // 'pending' | 'all' | 'done'
  const [taskSort, setTaskSort] = useState('manual'); // 'manual' | 'due' | 'pri'

  // Files Tab states
  const [filePath, setFilePath] = useState([]);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all'); // 'all' | 'v' | 'a' | 'i'
  const [isGridView, setIsGridView] = useState(false);
  const [isSelectingFiles, setIsSelectingFiles] = useState(false);
  const [selectedFileNames, setSelectedFileNames] = useState(new Set());

  // Music Tab states
  const [musicSubtab, setMusicSubtab] = useState('queue'); // 'queue' | 'library' | 'lists'
  const [activePlaylistDetailId, setActivePlaylistDetailId] = useState(null);

  // Modal Sheet State
  const [activeSheet, setActiveSheet] = useState(null); // { type, title, data }
  const [toastMessage, setToastMessage] = useState(null);

  // Hidden File Inputs for Chunked Uploads
  const generalFileInputRef = useRef(null);
  const audioFileInputRef = useRef(null);
  const pagerRef = useRef(null);
  const toastTimerRef = useRef(null);

  // Live seconds ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2200);
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

  // Cycle dock state: full -> peek -> hidden -> full
  const cycleDock = () => {
    if (dockState === 'full') setDockState('peek');
    else if (dockState === 'peek') setDockState('hidden');
    else setDockState('full');
  };

  // Scroll to tab
  const switchTab = (tabIdx) => {
    setActiveTab(tabIdx);
    if (pagerRef.current) {
      pagerRef.current.scrollTo({
        left: tabIdx * pagerRef.current.clientWidth,
        behavior: 'smooth'
      });
    }
  };

  // Double tap to maximize
  const [lastTabClick, setLastTabClick] = useState({ idx: -1, time: 0 });
  const handleTabButtonClick = (idx) => {
    const now = Date.now();
    if (lastTabClick.idx === idx && now - lastTabClick.time < 350) {
      // Double tap -> open full workspace
      setIsFullWorkspace(true);
      setDockState('peek');
      switchTab(idx);
      return;
    }
    setLastTabClick({ idx, time: now });
    switchTab(idx);
  };

  // Current playing song info
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

  // Storage data
  const storageTotalGB = system?.storage?.totalGB || 105.51;
  const storageUsedGB = system?.storage?.usedGB || 10.51;
  const storagePercent = Math.min(100, Math.round((storageUsedGB / storageTotalGB) * 100));

  // Active audio songs for tone selection and music tab
  const audioSongs = useMemo(() => {
    return (media || []).filter(isAudioFile);
  }, [media]);

  // Active queue calculation
  const activeQueue = (playbackState?.shuffle && playbackState?.shuffledQueue?.length > 0)
    ? playbackState.shuffledQueue
    : (playbackState?.originalQueue?.length > 0 ? playbackState.originalQueue : audioSongs);

  const currentQueueIdx = activeQueue.findIndex(
    m => m.id === currentSong?.id || m.path === currentSong?.path
  );

  // Active uploads calculation
  const activeUploadsCount = (transfers || []).filter(t => t.done < t.total).length;

  /* ==========================================================================
     TASKS LOGIC & FILTERING
     ========================================================================== */
  const filteredTasks = useMemo(() => {
    let list = [...(tasks || [])];
    if (taskFilter === 'pending') list = list.filter(t => !t.completed);
    else if (taskFilter === 'done') list = list.filter(t => t.completed);

    if (taskSort === 'due') {
      list.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    } else if (taskSort === 'pri') {
      list.sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1));
    }
    return list;
  }, [tasks, taskFilter, taskSort]);

  const pendingTasksCount = (tasks || []).filter(t => !t.completed).length;
  const completedTasksCount = (tasks || []).length - pendingTasksCount;

  const formatDue = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const hoursDiff = (d - Date.now()) / (3600 * 1000);
    if (hoursDiff < 0) return { text: 'overdue', cls: 'late' };
    if (hoursDiff < 24) return { text: `in ${Math.max(1, Math.round(hoursDiff))}h`, cls: 'soon' };
    return { text: `in ${Math.round(hoursDiff / 24)}d`, cls: '' };
  };

  /* ==========================================================================
     FILES LOGIC & STRUCTURE
     ========================================================================== */
  const isInsideMusicLibrary = filePath.length > 0 && filePath[0] === 'Music library';

  // Build virtual folder hierarchy from media stock
  const currentFolderFiles = useMemo(() => {
    if (isInsideMusicLibrary) {
      return audioSongs.map(s => ({
        id: s.id,
        name: s.title || s.filename || s.name,
        type: 'audio',
        sizeFormatted: s.size ? `${(s.size / (1024 * 1024)).toFixed(1)} MB` : '4.5 MB',
        date: 'Recent',
        isLocked: true,
        raw: s
      }));
    }

    if (filePath.length === 0) {
      // Root Directory: Show standard system folders + root files
      const items = [
        { id: 'dir-music', name: 'Music library', type: 'dir', isLocked: true, count: `${audioSongs.length} songs` },
        { id: 'dir-video', name: 'Videos', type: 'dir', isLocked: false, count: `${media.filter(m => m.type === 'video').length} items` },
        { id: 'dir-img', name: 'Images', type: 'dir', isLocked: false, count: `${media.filter(m => m.type === 'image').length} items` }
      ];

      // Add non-sorted root files
      media.forEach(m => {
        if (!m.path || !m.path.includes('/')) {
          items.push({
            id: m.id || m.path,
            name: m.filename || m.name,
            type: m.type || (isAudioFile(m) ? 'audio' : isMediaFile(m) ? 'video' : 'file'),
            sizeFormatted: m.size ? `${(m.size / (1024 * 1024)).toFixed(1)} MB` : '1.2 MB',
            date: 'Recent',
            raw: m
          });
        }
      });
      return items;
    }

    // Inside a subfolder (e.g., 'Videos', 'Images')
    const currentSubdir = filePath[0];
    let matchedType = 'file';
    if (currentSubdir === 'Videos') matchedType = 'video';
    if (currentSubdir === 'Images') matchedType = 'image';

    return (media || [])
      .filter(m => m.type === matchedType || (m.path && m.path.startsWith(currentSubdir)))
      .map(m => ({
        id: m.id || m.path,
        name: m.filename || m.name,
        type: m.type || matchedType,
        sizeFormatted: m.size ? `${(m.size / (1024 * 1024)).toFixed(1)} MB` : '12.4 MB',
        date: 'Recent',
        raw: m
      }));
  }, [media, audioSongs, filePath, isInsideMusicLibrary]);

  const displayedFiles = useMemo(() => {
    let list = currentFolderFiles;
    if (fileTypeFilter !== 'all') {
      const typeMap = { v: 'video', a: 'audio', i: 'image' };
      list = list.filter(f => f.type === 'dir' || f.type === typeMap[fileTypeFilter]);
    }
    if (fileSearchQuery.trim()) {
      const q = fileSearchQuery.toLowerCase();
      list = list.filter(f => f.name.toLowerCase().includes(q));
    }
    return list;
  }, [currentFolderFiles, fileTypeFilter, fileSearchQuery]);

  const toggleSelectFile = (name) => {
    setSelectedFileNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleDownloadSelected = () => {
    const selected = [...selectedFileNames];
    if (selected.length === 0) return;
    selected.forEach(fileName => {
      const file = currentFolderFiles.find(f => f.name === fileName);
      if (file && file.raw) {
        const link = document.createElement('a');
        link.href = `/api/files/download?path=${encodeURIComponent(file.raw.path || file.raw.filename)}`;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
    showToast(`Downloading ${selected.length} file(s)`);
    setIsSelectingFiles(false);
    setSelectedFileNames(new Set());
  };

  const handleDeleteSelected = () => {
    const count = selectedFileNames.size;
    if (count === 0) return;
    openConfirmSheet(
      `Delete ${count} item${count > 1 ? 's' : ''}?`,
      `The selected files will be permanently deleted from the dock's SD card.`,
      async () => {
        for (const fileName of selectedFileNames) {
          const file = currentFolderFiles.find(f => f.name === fileName);
          if (file && file.raw) {
            await deleteMedia(file.raw.id || file.raw.path);
          }
        }
        showToast(`Deleted ${count} item(s)`);
        setIsSelectingFiles(false);
        setSelectedFileNames(new Set());
      }
    );
  };

  /* ==========================================================================
     TRANSFER UPLOAD HANDLERS
     ========================================================================== */
  const handleFileUpload = (e, targetFolder = '') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      startChunkedUpload(files[i], targetFolder);
    }
    e.target.value = '';
    showToast(`Started upload of ${files.length} file(s)`);
    openTransferTray();
  };

  /* ==========================================================================
     MODAL SHEET OPENERS
     ========================================================================== */
  const openTaskSheet = (taskToEdit = null) => {
    setActiveSheet({
      type: 'task',
      title: taskToEdit ? 'Edit task' : 'New task',
      data: taskToEdit || {
        title: '',
        notes: '',
        priority: 1,
        category: 'Work',
        dueDate: '',
        reminderLead: 'none',
        estimatedSessions: 1,
        completed: false
      }
    });
  };

  const openAlarmSheet = (alarmToEdit = null) => {
    setActiveSheet({
      type: 'alarm',
      title: alarmToEdit ? 'Edit alarm' : 'New alarm',
      data: alarmToEdit || {
        time: '07:30',
        label: '',
        enabled: true,
        days: [1, 1, 1, 1, 1, 0, 0],
        tone: 'default',
        volume: 75,
        fadeIn: true,
        snoozeMinutes: 10,
        ringDurationMinutes: 5
      }
    });
  };

  const openSongEditSheet = (song) => {
    setActiveSheet({
      type: 'song_edit',
      title: 'Edit song details',
      data: {
        path: song.path || song.filename,
        title: song.title || song.filename,
        artist: song.artist || 'Unknown Artist'
      }
    });
  };

  const openNewPlaylistSheet = (preSelectedSong = null) => {
    setActiveSheet({
      type: 'new_playlist',
      title: 'New playlist',
      data: {
        name: '',
        selectedSongIds: preSelectedSong ? [preSelectedSong.id] : []
      }
    });
  };

  const openAddToPlaylistSheet = (song) => {
    setActiveSheet({
      type: 'add_to_playlist',
      title: 'Add to playlist',
      data: { song }
    });
  };

  const openFileMenuSheet = (file) => {
    setActiveSheet({
      type: 'file_menu',
      title: file.name,
      data: file
    });
  };

  const openTransferTray = () => {
    setActiveSheet({
      type: 'transfers',
      title: 'Transfers',
      data: null
    });
  };

  const openConfirmSheet = (title, message, onConfirm) => {
    setActiveSheet({
      type: 'confirm',
      title,
      data: { message, onConfirm }
    });
  };

  const closeSheet = () => setActiveSheet(null);

  return (
    <div className={`client-app-container ${isFullWorkspace ? 'full' : ''}`} style={{
      width: '100vw',
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg)',
      color: 'var(--ink)',
      fontFamily: 'var(--sans)',
      overflow: 'hidden',
      userSelect: 'none',
      position: 'relative'
    }}>
      {/* ── HIDDEN UPLOAD INPUTS ────────────────────────────── */}
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

      {/* ── COLLAPSIBLE DOCK DRAWER / SIDEBAR ────────────────── */}
      <aside id="dock" data-s={dockState} aria-label="Dock status">
        <button className="grab" id="grab" onClick={cycleDock} aria-label="Collapse or expand status">
          <i />
        </button>

        {/* FULL DOCK DRAWER */}
        <div className="dfull">
          <div className="dhead">
            <div>
              <div className="clock" data-clk>
                {hours}:{minutes}
                <small>:{seconds}</small>
              </div>
              <div className="ddate">{dateFormatted}</div>
            </div>
            <div className="dstat">
              <span className={`chip ${isConnected ? 'ok' : ''}`}>
                {isConnected ? 'dock connected' : 'connecting'}
              </span>
              <span className="chip">Samsung M34 · Dock</span>
            </div>
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

          {/* Mini Player */}
          <div className="mini">
            <button className="ib p" onClick={togglePlayPause} aria-label="Play or pause">
              <svg viewBox="0 0 24 24">
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
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="t2">
                {currentSong?.title || currentSong?.filename || 'Idle'}
              </div>
              <div className="mono dim" style={{ fontSize: '11px', marginTop: '3px' }}>
                {isPlaying ? 'playing on dock' : 'dock paused'}
              </div>
            </div>
            <button className="ib" onClick={() => playNextMedia(false)} aria-label="Next">
              <svg viewBox="0 0 24 24">
                <path d="m5 4 10 8-10 8zM19 5v14" />
              </svg>
            </button>
          </div>

          {/* Transfer Pill Button */}
          <button className="pill" id="pill1" onClick={openTransferTray}>
            <svg viewBox="0 0 24 24">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            <span>
              {activeUploadsCount > 0 ? `${activeUploadsCount} uploading` : 'no transfers'}
            </span>
          </button>
        </div>

        {/* PEEK DOCK DRAWER */}
        <div className="dpeek">
          <span className="tt">{hours}:{minutes}</span>
          <button className="ib p" onClick={togglePlayPause} aria-label="Play or pause">
            <svg viewBox="0 0 24 24">
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
          <span className="grow">
            {currentSong?.title || currentSong?.filename || 'No media playing'}
          </span>
          <button className="chip who" id="pill2" onClick={openTransferTray}>
            <span>{activeUploadsCount}</span> ⇅
          </button>
        </div>
      </aside>

      {/* ── WORKSPACE ────────────────────────────────────────── */}
      <main id="work">
        {/* Top Header */}
        <header className="top">
          <div className="seg" id="seg">
            <button
              className={activeTab === 0 ? 'on' : ''}
              onClick={() => handleTabButtonClick(0)}
            >
              <svg viewBox="0 0 24 24">
                <path d="m5 12 5 5 9-10" />
              </svg>
              <span>Tasks</span>
            </button>
            <button
              className={activeTab === 1 ? 'on' : ''}
              onClick={() => handleTabButtonClick(1)}
            >
              <svg viewBox="0 0 24 24">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10 21h4" />
              </svg>
              <span>Alarms</span>
            </button>
            <button
              className={activeTab === 2 ? 'on' : ''}
              onClick={() => handleTabButtonClick(2)}
            >
              <svg viewBox="0 0 24 24">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              <span>Files</span>
            </button>
            <button
              className={activeTab === 3 ? 'on' : ''}
              onClick={() => handleTabButtonClick(3)}
            >
              <svg viewBox="0 0 24 24">
                <path d="M9 18V5l11-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="17" cy="16" r="3" />
              </svg>
              <span>Music</span>
            </button>
          </div>

          <button
            className="back"
            id="back"
            onClick={() => {
              setIsFullWorkspace(false);
              setDockState('full');
            }}
          >
            <svg viewBox="0 0 24 24">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back
          </button>

          <div
            className="title"
            id="ptitle"
            onDoubleClick={() => {
              setIsFullWorkspace(false);
              setDockState('full');
            }}
          >
            {['Tasks', 'Alarms', 'Files', 'Music'][activeTab]}
          </div>

          <span
            className="chip who"
            onClick={toggleDeviceRole}
            style={{ cursor: 'pointer' }}
            title="Remote Controller Client: Click to toggle to Dock Station."
          >
            client
          </span>
        </header>

        {/* Horizontal Pager for the 4 Tabs */}
        <div
          ref={pagerRef}
          id="pager"
          onScroll={() => {
            if (!pagerRef.current) return;
            const w = pagerRef.current.clientWidth || 1;
            const i = Math.round(pagerRef.current.scrollLeft / w);
            if (i !== activeTab && i >= 0 && i <= 3) {
              setActiveTab(i);
            }
          }}
        >
          {/* ── TAB 0: TASKS ────────────────────────────────────── */}
          <section className="pg" id="p0">
            <div className="chips" style={{ alignItems: 'center' }}>
              <button
                className={`fc ${taskFilter === 'pending' ? 'on' : ''}`}
                onClick={() => setTaskFilter('pending')}
              >
                Pending
              </button>
              <button
                className={`fc ${taskFilter === 'all' ? 'on' : ''}`}
                onClick={() => setTaskFilter('all')}
              >
                All
              </button>
              <button
                className={`fc ${taskFilter === 'done' ? 'on' : ''}`}
                onClick={() => setTaskFilter('done')}
              >
                Done
              </button>
              <span style={{ flex: 1 }} />
              <button
                className="btn2"
                onClick={() => {
                  const nextSort = taskSort === 'manual' ? 'due' : taskSort === 'due' ? 'pri' : 'manual';
                  setTaskSort(nextSort);
                }}
              >
                <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                </svg>
                {taskSort === 'due' ? 'By deadline' : taskSort === 'pri' ? 'By priority' : 'Manual'}
              </button>
            </div>

            <h3>{pendingTasksCount} pending · {completedTasksCount} done</h3>

            {filteredTasks.length === 0 ? (
              <div className="hostnote">No tasks here. Tap '+ Add task' to create one.</div>
            ) : (
              filteredTasks.map((task) => {
                const due = !task.completed && formatDue(task.dueDate);
                const priLabels = ['Low', 'Medium', 'High', 'Urgent'];
                const priIndex = task.priority ?? 1;

                return (
                  <div
                    key={task.id}
                    className={`row ${task.completed ? 'done' : ''}`}
                    onClick={() => openTaskSheet(task)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span
                      className={`cb ${task.completed ? 'on' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTask(task.id);
                      }}
                    >
                      {task.completed && (
                        <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px' }}>
                          <path d="m5 12 5 5 9-10" />
                        </svg>
                      )}
                    </span>

                    <div className="main">
                      <div className="name">{task.title || task.n}</div>
                      <div className="sub">
                        {task.category || 'Work'} · {task.estimatedSessions || 1} session{(task.estimatedSessions || 1) > 1 ? 's' : ''}
                        {task.dueDate ? ` · ${new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
                        {task.dueDate && task.reminderLead && task.reminderLead !== 'none' ? ' · reminder set' : ''}
                      </div>
                    </div>

                    {due && (
                      <span className={`tag ${due.cls}`}>{due.text}</span>
                    )}

                    <span className={`tag p${priIndex}`}>
                      {priLabels[priIndex]}
                    </span>

                    <button
                      className="ib"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocusTarget(task.id, task.title || task.n, 25);
                        showToast('Focus target sent to dock');
                      }}
                      title="Send to dock focus session"
                      aria-label="Send to dock focus"
                    >
                      <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px' }}>
                        <path d="m18 15-6-6-6 6" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}

          </section>

          {/* ── TAB 1: ALARMS ────────────────────────────────────── */}
          <section className="pg" id="p1">
            <h3>Alarms on dock</h3>
            {alarms.length === 0 ? (
              <div className="hostnote">No alarms set on dock. Tap '+ Add alarm' below.</div>
            ) : (
              alarms.map((alarm) => {
                const days = Array.isArray(alarm.days)
                  ? alarm.days
                  : (alarm.d || [1, 1, 1, 1, 1, 1, 1]);
                const dayChars = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
                const daysStr = days.join('');
                const repeatLabel = daysStr === '1111111'
                  ? 'Every day'
                  : daysStr === '1111100'
                  ? 'Weekdays'
                  : daysStr === '0000011'
                  ? 'Weekends'
                  : daysStr === '0000000'
                  ? 'Once'
                  : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].filter((_, k) => days[k]).join(' ');

                return (
                  <div
                    key={alarm.id}
                    className="row"
                    onClick={() => openAlarmSheet(alarm)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="main">
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
                        <span className="t">{alarm.time || alarm.t}</span>
                        <span className="name">{alarm.label || alarm.l || 'Alarm'}</span>
                      </div>
                      <div className="days">
                        {dayChars.map((ch, idx) => (
                          <i key={idx} className={days[idx] ? '' : 'off'}>
                            {ch}
                          </i>
                        ))}
                      </div>
                      <div className="sub">
                        {repeatLabel} · {alarm.tone || 'Default Tone'}
                        {alarm.snoozeMinutes ? ` · snooze ${alarm.snoozeMinutes}m` : ''}
                      </div>
                    </div>

                    <button
                      className="ib"
                      onClick={(e) => {
                        e.stopPropagation();
                        testAlarmTone(alarm.toneUrl, alarm.volume || 80);
                        showToast(`Playing "${alarm.tone || 'Alarm'}" on dock`);
                      }}
                      title="Test alarm siren on dock"
                      aria-label="Test on dock"
                    >
                      <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                        <path d="M7 4v16l13-8z" />
                      </svg>
                    </button>

                    <span
                      className={`sw ${alarm.enabled !== false ? 'on' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAlarm(alarm.id);
                      }}
                    />
                  </div>
                );
              })
            )}

          </section>

          {/* ── TAB 2: FILES ────────────────────────────────────── */}
          <section className="pg" id="p2">
            <div className="tb">
              <label className="search">
                <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px' }}>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  id="fq"
                  placeholder="Search files"
                  value={fileSearchQuery}
                  onChange={(e) => setFileSearchQuery(e.target.value)}
                />
              </label>

              <button
                className="ib"
                onClick={() => setIsGridView(prev => !prev)}
                aria-label="Switch view"
              >
                <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px' }}>
                  {isGridView ? (
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                  ) : (
                    <>
                      <rect x="3" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" />
                      <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    </>
                  )}
                </svg>
              </button>

              <button
                className={`btn2 ${isSelectingFiles ? 'on' : ''}`}
                onClick={() => {
                  setIsSelectingFiles(prev => !prev);
                  setSelectedFileNames(new Set());
                }}
              >
                {isSelectingFiles ? 'Done' : 'Select'}
              </button>
            </div>

            {/* Storage Card at Root */}
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

            {/* Breadcrumb Navigation */}
            <div className="crumb" style={{ margin: '4px 2px 10px' }}>
              <button onClick={() => setFilePath([])}>
                {filePath.length === 0 ? <b>SD vault</b> : 'SD vault'}
              </button>
              {filePath.map((folderName, idx) => (
                <React.Fragment key={idx}>
                  <span>/</span>
                  <button onClick={() => setFilePath(filePath.slice(0, idx + 1))}>
                    {idx === filePath.length - 1 ? <b>{folderName}</b> : folderName}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Category Filter Chips */}
            <div className="chips">
              {[
                ['all', 'All'],
                ['v', 'Video'],
                ['a', 'Audio'],
                ['i', 'Images']
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`fc ${fileTypeFilter === key ? 'on' : ''}`}
                  onClick={() => setFileTypeFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Music Library Lock Notice */}
            {isInsideMusicLibrary && (
              <div className="lockb">
                <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px' }}>
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                <div>Read-only here. Add or remove songs from Music.</div>
                <button
                  className="btn2"
                  onClick={() => {
                    setMusicSubtab('library');
                    switchTab(3);
                  }}
                >
                  Open Music
                </button>
              </div>
            )}

            {/* File List / Grid View */}
            <div id="flist">
              {displayedFiles.length === 0 ? (
                <div className="hostnote">Nothing here.</div>
              ) : isGridView ? (
                <div className="gridv">
                  {displayedFiles.map((file) => {
                    const isSelected = selectedFileNames.has(file.name);
                    return (
                      <div
                        key={file.id}
                        className={`tile ${isSelected ? 'sel' : ''}`}
                        onClick={() => {
                          if (file.type === 'dir') {
                            setFilePath([...filePath, file.name]);
                            setSelectedFileNames(new Set());
                          } else if (isSelectingFiles) {
                            toggleSelectFile(file.name);
                          } else {
                            openFileMenuSheet(file);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className={`ft ${file.type === 'dir' ? 'd' : file.type === 'video' ? 'v' : file.type === 'audio' ? 'a' : 'i'}`}>
                          <svg viewBox="0 0 24 24" style={{ width: '28px', height: '28px' }}>
                            {file.type === 'dir' ? (
                              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            ) : file.type === 'video' ? (
                              <>
                                <rect x="3" y="5" width="18" height="14" rx="2" />
                                <path d="m10 9 5 3-5 3z" />
                              </>
                            ) : file.type === 'audio' ? (
                              <>
                                <path d="M9 18V5l11-2v13" />
                                <circle cx="6" cy="18" r="3" />
                                <circle cx="17" cy="16" r="3" />
                              </>
                            ) : (
                              <>
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="9" cy="9" r="2" />
                                <path d="m21 15-5-5L5 21" />
                              </>
                            )}
                          </svg>
                        </div>

                        <div className="name">{file.name}</div>
                        <div className="sub">{file.count || file.sizeFormatted}</div>
                        {file.isLocked && (
                          <span className="lk">
                            <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px' }}>
                              <rect x="4" y="11" width="16" height="10" rx="2" />
                              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                            </svg>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  {displayedFiles.map((file) => {
                    const isSelected = selectedFileNames.has(file.name);
                    return (
                      <div
                        key={file.id}
                        className={`row ${isSelected ? 'sel' : ''}`}
                        onClick={() => {
                          if (file.type === 'dir') {
                            setFilePath([...filePath, file.name]);
                            setSelectedFileNames(new Set());
                          } else if (isSelectingFiles) {
                            toggleSelectFile(file.name);
                          } else {
                            openFileMenuSheet(file);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {isSelectingFiles && file.type !== 'dir' && (
                          <span className={`cb ${isSelected ? 'on' : ''}`}>
                            {isSelected && (
                              <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px' }}>
                                <path d="m5 12 5 5 9-10" />
                              </svg>
                            )}
                          </span>
                        )}

                        <span className={`ft ${file.type === 'dir' ? 'd' : file.type === 'video' ? 'v' : file.type === 'audio' ? 'a' : 'i'}`}>
                          <svg viewBox="0 0 24 24">
                            {file.type === 'dir' ? (
                              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            ) : file.type === 'video' ? (
                              <>
                                <rect x="3" y="5" width="18" height="14" rx="2" />
                                <path d="m10 9 5 3-5 3z" />
                              </>
                            ) : file.type === 'audio' ? (
                              <>
                                <path d="M9 18V5l11-2v13" />
                                <circle cx="6" cy="18" r="3" />
                                <circle cx="17" cy="16" r="3" />
                              </>
                            ) : (
                              <>
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="9" cy="9" r="2" />
                                <path d="m21 15-5-5L5 21" />
                              </>
                            )}
                          </svg>
                        </span>

                        <div className="main">
                          <div className="name">{file.name}</div>
                          <div className="sub">{file.count || `${file.sizeFormatted} · ${file.date}`}</div>
                        </div>

                        {file.isLocked && file.type === 'dir' && (
                          <span className="tag">managed in music</span>
                        )}

                        {file.type === 'dir' ? (
                          <svg viewBox="0 0 24 24">
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        ) : (
                          <button
                            className="ib"
                            onClick={(e) => {
                              e.stopPropagation();
                              openFileMenuSheet(file);
                            }}
                            aria-label="More"
                          >
                            <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px' }}>
                              <circle cx="5" cy="12" r="1.2" />
                              <circle cx="12" cy="12" r="1.2" />
                              <circle cx="19" cy="12" r="1.2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* ── TAB 3: MUSIC ────────────────────────────────────── */}
          <section className="pg" id="p3">
            <div className="mus">
              {/* Player Hero Card */}
              <div className={`hero ${isPlaying ? 'playing' : ''}`}>
                <div className="art">
                  <div className="vin">
                    <i />
                  </div>
                </div>

                <div className="mtt">
                  {currentSong?.title || currentSong?.filename || 'No track selected'}
                </div>
                <div className="mta">
                  {currentSong?.artist || 'Unknown Artist'}
                </div>

                {/* Scrubber Bar */}
                <div
                  className="scr"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    seekPlayback(ratio * durationSec);
                  }}
                >
                  <i id="mfill" style={{ width: `${progressPercent}%` }} />
                  <b id="mknob" style={{ left: `${progressPercent}%` }} />
                </div>

                <div className="tm">
                  <span id="mcur">{formatSec(currentTimeSec)}</span>
                  <span>{formatSec(durationSec)}</span>
                </div>

                {/* Remote Music Controls */}
                <div className="ctl">
                  <button
                    className={playbackState?.shuffle ? 'on' : ''}
                    onClick={toggleShuffle}
                    aria-label="Shuffle"
                    title="Toggle Shuffle"
                  >
                    <svg viewBox="0 0 24 24" style={{ width: '22px', height: '22px' }}>
                      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                    </svg>
                  </button>

                  <button onClick={playPrevMedia} aria-label="Previous">
                    <svg viewBox="0 0 24 24" style={{ width: '26px', height: '26px' }}>
                      <path d="M19 20 9 12l10-8zM5 19V5" />
                    </svg>
                  </button>

                  <button className="big" onClick={togglePlayPause} aria-label="Play or pause">
                    <svg viewBox="0 0 24 24" style={{ width: '30px', height: '30px' }}>
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

                  <button onClick={() => playNextMedia(false)} aria-label="Next">
                    <svg viewBox="0 0 24 24" style={{ width: '26px', height: '26px' }}>
                      <path d="m5 4 10 8-10 8zM19 5v14" />
                    </svg>
                  </button>

                  <button
                    className={playbackState?.repeat !== 'off' ? 'on' : ''}
                    onClick={toggleRepeat}
                    aria-label="Repeat"
                    title="Toggle Repeat"
                  >
                    <svg viewBox="0 0 24 24" style={{ width: '22px', height: '22px' }}>
                      <path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Music Subtabs: Queue / Library / Playlists */}
              <div className="mlist">
                <div className="subtabs">
                  {[
                    ['queue', 'Queue'],
                    ['library', 'Library'],
                    ['lists', 'Playlists']
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={`fc ${musicSubtab === key ? 'on' : ''}`}
                      onClick={() => {
                        setMusicSubtab(key);
                        setActivePlaylistDetailId(null);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div id="mbody">
                  {/* QUEUE SUBTAB */}
                  {musicSubtab === 'queue' && (
                    <div>
                      <div className="act">
                        <div className="l dim mono">
                          {playbackState?.shuffle ? 'Shuffled' : 'In order'} · saved on dock
                        </div>
                      </div>

                      {activeQueue.length === 0 ? (
                        <div className="hostnote">Queue is empty.</div>
                      ) : (
                        activeQueue.map((item, idx) => {
                          const isCur = idx === currentQueueIdx;
                          const isPast = currentQueueIdx >= 0 && idx < currentQueueIdx;
                          const diff = idx - currentQueueIdx;
                          const tag = isCur ? 'now' : (isPast ? 'prev' : `+${diff}`);

                          return (
                            <div
                              key={item.id || item.path || idx}
                              className={`row ${isCur ? 'cur' : ''} ${isPast ? 'past' : ''}`}
                              onClick={() => playMedia(item)}
                              style={{ cursor: 'pointer' }}
                            >
                              <span className="stile">
                                {isCur && isPlaying ? (
                                  <span className="eq">
                                    <i /><i /><i />
                                  </span>
                                ) : (
                                  <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px' }}>
                                    <path d="M9 18V5l11-2v13" />
                                    <circle cx="6" cy="18" r="3" />
                                    <circle cx="17" cy="16" r="3" />
                                  </svg>
                                )}
                              </span>

                              <div className="main">
                                <div className="name">{item.title || item.filename}</div>
                                <div className="sub">{item.artist || 'Unknown'} · {formatSec(item.duration || 180)}</div>
                              </div>

                              <span className="tag">{tag}</span>

                              <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px', color: 'var(--dim)' }}>
                                <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />
                              </svg>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* LIBRARY SUBTAB */}
                  {musicSubtab === 'library' && (
                    <div>
                      <div className="act">
                        <div className="l dim mono">{audioSongs.length} songs</div>
                        <button
                          className="btn2"
                          onClick={() => {
                            if (audioFileInputRef.current) audioFileInputRef.current.click();
                          }}
                        >
                          <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                          Add songs
                        </button>
                      </div>

                      {audioSongs.length === 0 ? (
                        <div className="hostnote">No songs yet. Tap 'Add songs' to upload.</div>
                      ) : (
                        audioSongs.map((song) => {
                          const isCur = song.id === currentSong?.id || song.path === currentSong?.path;
                          return (
                            <div
                              key={song.id || song.path}
                              className={`row ${isCur ? 'cur' : ''}`}
                              onClick={() => playMedia(song)}
                              style={{ cursor: 'pointer' }}
                            >
                              <span className="stile">
                                {isCur && isPlaying ? (
                                  <span className="eq">
                                    <i /><i /><i />
                                  </span>
                                ) : (
                                  <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px' }}>
                                    <path d="M9 18V5l11-2v13" />
                                    <circle cx="6" cy="18" r="3" />
                                    <circle cx="17" cy="16" r="3" />
                                  </svg>
                                )}
                              </span>

                              <div className="main">
                                <div className="name">{song.title || song.filename}</div>
                                <div className="sub">{song.artist || 'Unknown'} · {formatSec(song.duration || 180)}</div>
                              </div>

                              <button
                                className="ib"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveSheet({
                                    type: 'song_menu',
                                    title: song.title || song.filename,
                                    data: song
                                  });
                                }}
                                aria-label="More"
                              >
                                <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px' }}>
                                  <circle cx="5" cy="12" r="1.2" />
                                  <circle cx="12" cy="12" r="1.2" />
                                  <circle cx="19" cy="12" r="1.2" />
                                </svg>
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* PLAYLISTS SUBTAB */}
                  {musicSubtab === 'lists' && (
                    <div>
                      {activePlaylistDetailId ? (
                        // Playlist Detail View
                        (() => {
                          const pl = (playlists || []).find(p => p.id === activePlaylistDetailId);
                          if (!pl) return <div className="hostnote">Playlist not found.</div>;
                          const tracks = pl.tracks || [];

                          return (
                            <div>
                              <div className="act">
                                <button className="btn2" onClick={() => setActivePlaylistDetailId(null)}>
                                  ← Playlists
                                </button>
                                <span style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    className="btn2"
                                    onClick={() => {
                                      if (tracks.length > 0) {
                                        playPlaylist(pl);
                                        showToast(`Playing "${pl.name}" on dock`);
                                      } else {
                                        showToast('Playlist is empty');
                                      }
                                    }}
                                  >
                                    <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                                      <path d="M7 4v16l13-8z" />
                                    </svg>
                                    Play
                                  </button>
                                  <button
                                    className="btn2 dng"
                                    onClick={() => {
                                      openConfirmSheet(
                                        `Delete playlist "${pl.name}"?`,
                                        'The songs will stay safely in your library.',
                                        () => {
                                          deletePlaylist(pl.id);
                                          setActivePlaylistDetailId(null);
                                          showToast('Playlist deleted');
                                        }
                                      );
                                    }}
                                    aria-label="Delete playlist"
                                  >
                                    <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                                    </svg>
                                  </button>
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 2px 12px' }}>
                                <span style={{ fontWeight: 700, fontSize: '18px', flex: 1 }}>{pl.name}</span>
                              </div>

                              {tracks.length === 0 ? (
                                <div className="hostnote">Empty. In Library, tap ⋯ on a song and choose Add to playlist.</div>
                              ) : (
                                tracks.map((track, k) => (
                                  <div
                                    key={track.id || track.path || k}
                                    className="row"
                                    onClick={() => playMedia(track, pl.id)}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <span className="stile">
                                      <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px' }}>
                                        <path d="M9 18V5l11-2v13" />
                                        <circle cx="6" cy="18" r="3" />
                                        <circle cx="17" cy="16" r="3" />
                                      </svg>
                                    </span>
                                    <div className="main">
                                      <div className="name">{track.title || track.filename}</div>
                                      <div className="sub">{track.artist || 'Unknown'}</div>
                                    </div>
                                    <button
                                      className="ib"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeTrackFromPlaylist(pl.id, track.id || track.path);
                                        showToast('Removed from playlist');
                                      }}
                                      title="Remove from playlist"
                                    >
                                      <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                                        <path d="M18 6 6 18M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        // Playlists List View
                        <div>
                          <div className="act">
                            <div className="l dim mono">{(playlists || []).length} playlists</div>
                            <button className="btn2" onClick={() => openNewPlaylistSheet()}>
                              <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                                <path d="M12 5v14M5 12h14" />
                              </svg>
                              New playlist
                            </button>
                          </div>

                          {(playlists || []).length === 0 ? (
                            <div className="hostnote">No playlists yet. Create one to group songs.</div>
                          ) : (
                            playlists.map((pl) => (
                              <div
                                key={pl.id}
                                className="row"
                                onClick={() => setActivePlaylistDetailId(pl.id)}
                                style={{ cursor: 'pointer' }}
                              >
                                <span className="stile">
                                  <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px' }}>
                                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                                  </svg>
                                </span>
                                <div className="main">
                                  <div className="name">{pl.name}</div>
                                  <div className="sub">{(pl.tracks || []).length} song{(pl.tracks || []).length === 1 ? '' : 's'}</div>
                                </div>
                                <svg viewBox="0 0 24 24">
                                  <path d="m9 18 6-6-6-6" />
                                </svg>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Multi-Select Floating Bar */}
        {isSelectingFiles && activeTab === 2 && (
          <div id="selbar" style={{ display: 'flex' }}>
            <span className="mono" style={{ fontSize: '13px' }}>
              {selectedFileNames.size} selected
            </span>
            <span style={{ flex: 1 }} />
            <button className="btn2" onClick={handleDownloadSelected}>
              <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                <path d="M12 3v12M6 11l6 6 6-6M4 21h16" />
              </svg>
              Download
            </button>
            {!isInsideMusicLibrary && (
              <button className="btn2 dng" onClick={handleDeleteSelected}>
                <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                </svg>
                Delete
              </button>
            )}
          </div>
        )}

        {/* Floating Contextual FAB Button */}
        {(!isSelectingFiles && !isInsideMusicLibrary) && (
          <button
            id="fab"
            onClick={() => {
              if (activeTab === 0) openTaskSheet();
              else if (activeTab === 1) openAlarmSheet();
              else if (activeTab === 2) {
                if (generalFileInputRef.current) generalFileInputRef.current.click();
              } else if (activeTab === 3) {
                if (audioFileInputRef.current) audioFileInputRef.current.click();
              }
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
              {activeTab > 1 ? (
                <path d="M12 19V5M5 12l7-7 7 7" />
              ) : (
                <path d="M12 5v14M5 12h14" />
              )}
            </svg>
            <span>
              {['Add task', 'Add alarm', 'Upload', 'Add songs'][activeTab]}
            </span>
          </button>
        )}
      </main>

      {/* ── REVEAL BUTTON (WHEN DOCK IS HIDDEN) ───────────────── */}
      <button
        id="reveal"
        className={dockState === 'hidden' ? 'show' : ''}
        onClick={() => setDockState('peek')}
        aria-label="Show status"
      >
        <svg viewBox="0 0 24 24" id="revIco">
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>

      {/* ── MODAL SHEET / SCRIM ─────────────────────────────── */}
      <div
        className={`scrim ${activeSheet ? 'show' : ''}`}
        id="scrim"
        onClick={(e) => {
          if (e.target.id === 'scrim') closeSheet();
        }}
      >
        {activeSheet && (
          <div className="sheet" id="sheet">
            <h4>
              <span>{activeSheet.title}</span>
              <button className="ib" onClick={closeSheet} aria-label="Close">
                <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px' }}>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </h4>

            {/* TASK EDIT / CREATE SHEET */}
            {activeSheet.type === 'task' && (
              <TaskSheetForm
                task={activeSheet.data}
                onSave={(updated) => {
                  if (activeSheet.data.id) {
                    updateTask(activeSheet.data.id, updated);
                    showToast('Task updated');
                  } else {
                    addTask(updated);
                    showToast('Task added');
                  }
                  closeSheet();
                }}
                onDelete={() => {
                  if (activeSheet.data.id) {
                    deleteTask(activeSheet.data.id);
                    showToast('Task deleted');
                  }
                  closeSheet();
                }}
              />
            )}

            {/* ALARM EDIT / CREATE SHEET */}
            {activeSheet.type === 'alarm' && (
              <AlarmSheetForm
                alarm={activeSheet.data}
                availableSongs={audioSongs}
                onTestTone={(toneUrl, vol) => {
                  testAlarmTone(toneUrl, vol);
                  showToast('Playing tone on dock');
                }}
                onSave={(updated) => {
                  if (activeSheet.data.id) {
                    updateAlarm(activeSheet.data.id, updated);
                    showToast('Alarm updated');
                  } else {
                    addAlarm(updated);
                    showToast('Alarm created');
                  }
                  closeSheet();
                }}
                onDelete={() => {
                  if (activeSheet.data.id) {
                    deleteAlarm(activeSheet.data.id);
                    showToast('Alarm deleted');
                  }
                  closeSheet();
                }}
              />
            )}

            {/* SONG EDIT SHEET */}
            {activeSheet.type === 'song_edit' && (
              <SongEditForm
                song={activeSheet.data}
                onSave={(path, title, artist) => {
                  updateSongMetadata(path, title, artist);
                  showToast('Song metadata updated');
                  closeSheet();
                }}
              />
            )}

            {/* SONG CONTEXT MENU SHEET */}
            {activeSheet.type === 'song_menu' && (
              <div>
                <div
                  className="mrow"
                  onClick={() => {
                    closeSheet();
                    openSongEditSheet(activeSheet.data);
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
                    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                  Edit details
                </div>

                <div
                  className="mrow"
                  onClick={() => {
                    closeSheet();
                    showToast('Queued next');
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
                    <path d="m5 4 10 8-10 8zM19 5v14" />
                  </svg>
                  Play next
                </div>

                <div
                  className="mrow"
                  onClick={() => {
                    closeSheet();
                    openAddToPlaylistSheet(activeSheet.data);
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                  </svg>
                  Add to playlist
                </div>

                <div
                  className="mrow dng"
                  onClick={() => {
                    const song = activeSheet.data;
                    closeSheet();
                    openConfirmSheet(
                      `Delete "${song.title || song.filename}"?`,
                      'Deleting also permanently removes the file from the SD card.',
                      () => {
                        deleteMedia(song.id || song.path);
                        showToast('Song removed from library');
                      }
                    );
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                  </svg>
                  Delete from library
                </div>

              </div>
            )}

            {/* ADD TO PLAYLIST SHEET */}
            {activeSheet.type === 'add_to_playlist' && (
              <div>
                {(playlists || []).map((pl) => (
                  <div
                    key={pl.id}
                    className="mrow"
                    onClick={() => {
                      addTrackToPlaylist(pl.id, activeSheet.data.song);
                      showToast(`Added to ${pl.name}`);
                      closeSheet();
                    }}
                  >
                    <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
                      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                    </svg>
                    <span>{pl.name}</span>
                    <span className="dim mono" style={{ marginLeft: 'auto', fontSize: '12px' }}>
                      {(pl.tracks || []).some(t => t.id === activeSheet.data.song.id) ? 'already added' : `${(pl.tracks || []).length} songs`}
                    </span>
                  </div>
                ))}

                <div
                  className="mrow"
                  onClick={() => {
                    closeSheet();
                    openNewPlaylistSheet(activeSheet.data.song);
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New playlist
                </div>
              </div>
            )}

            {/* NEW PLAYLIST SHEET */}
            {activeSheet.type === 'new_playlist' && (
              <NewPlaylistForm
                availableSongs={audioSongs}
                preSelectedSongIds={activeSheet.data.selectedSongIds}
                onCreate={(name, songIds) => {
                  createPlaylist(name).then((res) => {
                    if (res?.playlist && songIds.length > 0) {
                      const selectedSongs = audioSongs.filter(s => songIds.includes(s.id));
                      updatePlaylistTracks(res.playlist.id, selectedSongs);
                    }
                  });
                  showToast('Playlist created');
                  closeSheet();
                }}
              />
            )}

            {/* FILE CONTEXT MENU SHEET */}
            {activeSheet.type === 'file_menu' && (
              <div>
                <div
                  className="mrow"
                  onClick={() => {
                    const f = activeSheet.data;
                    const link = document.createElement('a');
                    link.href = `/api/files/download?path=${encodeURIComponent(f.raw?.path || f.raw?.filename || f.name)}`;
                    link.download = f.name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showToast('Download started');
                    closeSheet();
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
                    <path d="M12 3v12M6 11l6 6 6-6M4 21h16" />
                  </svg>
                  Download
                </div>

                {isAudioFile(activeSheet.data.raw) && (
                  <div
                    className="mrow"
                    onClick={() => {
                      setMusicSubtab('library');
                      switchTab(3);
                      closeSheet();
                    }}
                  >
                    <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
                      <path d="M9 18V5l11-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="17" cy="16" r="3" />
                    </svg>
                    Show in Music
                  </div>
                )}

                <div
                  className="mrow dng"
                  onClick={() => {
                    const file = activeSheet.data;
                    closeSheet();
                    openConfirmSheet(
                      `Delete "${file.name}"?`,
                      `The file will be permanently removed from the dock's SD card.`,
                      () => {
                        deleteMedia(file.raw?.id || file.raw?.path);
                        showToast(`Deleted ${file.name}`);
                      }
                    );
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                  </svg>
                  Delete
                </div>
              </div>
            )}

            {/* TRANSFERS TRAY MODAL */}
            {activeSheet.type === 'transfers' && (
              <div>
                {(transfers || []).length === 0 ? (
                  <div className="dim" style={{ padding: '16px 0', textAlign: 'center' }}>
                    No active or recent transfers.
                  </div>
                ) : (
                  transfers.map((tr) => (
                    <div key={tr.id} className="tr">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                        <b style={{ fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tr.name}
                        </b>
                        <button
                          className="btn2"
                          onClick={() => toggleTransferPause(tr.id)}
                        >
                          {tr.done >= tr.total ? 'done' : tr.paused ? 'Resume' : 'Pause'}
                        </button>
                      </div>

                      {/* 24-piece matrix visualizer */}
                      <div className="grid">
                        {Array.from({ length: tr.total || 24 }, (_, k) => (
                          <i
                            key={k}
                            className={k < tr.done ? 'f' : ''}
                          />
                        ))}
                      </div>

                      <div className="mono dim" style={{ fontSize: '12px' }}>
                        {tr.done}/{tr.total} chunks ({tr.percent || 0}%) · resumes where it stopped if connection drops
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* CONFIRMATION SHEET */}
            {activeSheet.type === 'confirm' && (
              <div>
                <div className="dim" style={{ marginBottom: '16px', lineHeight: 1.5 }}>
                  {activeSheet.data.message}
                </div>
                <button
                  className="go dngb"
                  onClick={() => {
                    activeSheet.data.onConfirm();
                    closeSheet();
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── TOAST NOTIFICATION ───────────────────────────────── */}
      {toastMessage && (
        <div id="toast" style={{
          position: 'fixed',
          left: '50%',
          top: '14px',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          background: '#241709',
          color: 'var(--acc)',
          border: '1px solid #4a3414',
          padding: '10px 16px',
          borderRadius: '12px',
          font: '13px var(--mono)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
        }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
};

/* ── HELPER MODAL FORM COMPONENTS ──────────────────────────── */

// 1. Task Edit / Create Form
const TaskSheetForm = ({ task, onSave, onDelete }) => {
  const [title, setTitle] = useState(task.title || task.n || '');
  const [notes, setNotes] = useState(task.notes || '');
  const [priority, setPriority] = useState(task.priority ?? 1);
  const [category, setCategory] = useState(task.category || 'Work');
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [reminderLead, setReminderLead] = useState(task.reminderLead || 'none');
  const [estimatedSessions, setEstimatedSessions] = useState(task.estimatedSessions || 1);

  const PRI = [
    [0, 'Low'],
    [1, 'Medium'],
    [2, 'High'],
    [3, 'Urgent']
  ];
  const CATS = ['Work', 'Study', 'Personal', 'Other'];
  const REM = [
    ['none', 'None'],
    ['0', 'At deadline'],
    ['60', '1 hour before'],
    ['1440', '1 day before'],
    ['4320', '3 days before']
  ];

  return (
    <div>
      <input
        className="fld"
        placeholder="What needs doing?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
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
        {PRI.map(([val, label]) => (
          <button
            key={val}
            className={`fc ${priority === val ? 'on' : ''}`}
            onClick={() => setPriority(val)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flab">Category</div>
      <div className="chips">
        {CATS.map((cat) => (
          <button
            key={cat}
            className={`fc ${category === cat ? 'on' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flab">Deadline</div>
      <input
        className="fld"
        type="datetime-local"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />

      <div className="flab">Remind me on the dock</div>
      <div className="chips">
        {REM.map(([val, label]) => (
          <button
            key={val}
            className={`fc ${reminderLead === val ? 'on' : ''}`}
            onClick={() => setReminderLead(val)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flab">Focus sessions needed</div>
      <div className="chips">
        {[1, 2, 3, 4, 6, 8].map((n) => (
          <button
            key={n}
            className={`fc ${estimatedSessions === n ? 'on' : ''}`}
            onClick={() => setEstimatedSessions(n)}
          >
            {n}
          </button>
        ))}
      </div>

      <button
        className="go"
        style={{ marginTop: '18px' }}
        onClick={() => {
          onSave({
            title: title.trim() || 'Untitled task',
            notes,
            priority,
            category,
            dueDate,
            reminderLead,
            estimatedSessions,
            completed: task.completed || false
          });
        }}
      >
        {task.id ? 'Save changes' : 'Add task'}
      </button>

      {task.id && (
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

// 2. Alarm Edit / Create Form
const AlarmSheetForm = ({ alarm, availableSongs, onTestTone, onSave, onDelete }) => {
  const [time, setTime] = useState(alarm.time || alarm.t || '07:30');
  const [label, setLabel] = useState(alarm.label || alarm.l || '');
  const [days, setDays] = useState(Array.isArray(alarm.days) ? alarm.days : (alarm.d || [1, 1, 1, 1, 1, 0, 0]));
  const [tone, setTone] = useState(alarm.tone || 'default');
  const [volume, setVolume] = useState(alarm.volume || 75);
  const [fadeIn, setFadeIn] = useState(alarm.fadeIn !== false);
  const [snoozeMinutes, setSnoozeMinutes] = useState(alarm.snoozeMinutes || 10);
  const [ringDurationMinutes, setRingDurationMinutes] = useState(alarm.ringDurationMinutes || 5);

  const setPreset = (preset) => {
    if (preset === 'wk') setDays([1, 1, 1, 1, 1, 0, 0]);
    else if (preset === 'we') setDays([0, 0, 0, 0, 0, 1, 1]);
    else if (preset === 'all') setDays([1, 1, 1, 1, 1, 1, 1]);
    else if (preset === 'once') setDays([0, 0, 0, 0, 0, 0, 0]);
  };

  const toggleDay = (idx) => {
    const updated = [...days];
    updated[idx] = updated[idx] ? 0 : 1;
    setDays(updated);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          className="fld"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          style={{ width: '150px' }}
        />
        <input
          className="fld"
          placeholder="Label, e.g. Morning Alarm"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      <div className="flab">Repeat</div>
      <div className="chips">
        <button className="fc" onClick={() => setPreset('wk')}>Weekdays</button>
        <button className="fc" onClick={() => setPreset('we')}>Weekends</button>
        <button className="fc" onClick={() => setPreset('all')}>Every day</button>
        <button className="fc" onClick={() => setPreset('once')}>Once</button>
      </div>

      <div className="dayrow">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, idx) => (
          <button
            key={idx}
            className={`dchip ${days[idx] ? 'on' : ''}`}
            onClick={() => toggleDay(idx)}
          >
            {dayName}
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
            <option value="default">Default Cyber Alarm</option>
          </optgroup>
          {availableSongs.length > 0 && (
            <optgroup label="From your music">
              {availableSongs.map((s) => (
                <option key={s.id || s.path} value={s.id || s.path}>
                  {s.title || s.filename}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <button
          className="btn2"
          style={{ height: '48px' }}
          onClick={() => {
            const selectedSong = availableSongs.find(s => s.id === tone || s.path === tone);
            const toneUrl = selectedSong ? (selectedSong.url || `/api/files/download?path=${encodeURIComponent(selectedSong.path)}`) : '/uploads/tones/default_cyber_alarm.wav';
            onTestTone(toneUrl, volume);
          }}
        >
          <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
            <path d="M7 4v16l13-8z" />
          </svg>
          Test
        </button>
      </div>

      <div className="flab">
        <span>Volume</span>
        <span className="mono">{volume}%</span>
      </div>
      <input
        type="range"
        min="10"
        max="100"
        value={volume}
        onChange={(e) => setVolume(+e.target.value)}
        style={{ width: '100%', accentColor: 'var(--acc)', height: '28px' }}
      />

      <div className="flab">Fade in</div>
      <div className="chips">
        <button className={`fc ${fadeIn ? 'on' : ''}`} onClick={() => setFadeIn(true)}>On</button>
        <button className={`fc ${!fadeIn ? 'on' : ''}`} onClick={() => setFadeIn(false)}>Off</button>
      </div>

      <div className="flab">Snooze</div>
      <div className="chips">
        {[0, 5, 10, 15].map((m) => (
          <button
            key={m}
            className={`fc ${snoozeMinutes === m ? 'on' : ''}`}
            onClick={() => setSnoozeMinutes(m)}
          >
            {m ? `${m} min` : 'Off'}
          </button>
        ))}
      </div>

      <div className="flab">Ring for</div>
      <div className="chips">
        {[1, 5, 10].map((m) => (
          <button
            key={m}
            className={`fc ${ringDurationMinutes === m ? 'on' : ''}`}
            onClick={() => setRingDurationMinutes(m)}
          >
            {m} min
          </button>
        ))}
      </div>

      <button
        className="go"
        style={{ marginTop: '18px' }}
        onClick={() => {
          const selectedSong = availableSongs.find(s => s.id === tone || s.path === tone);
          onSave({
            time: time || '07:30',
            label: label.trim() || 'Alarm',
            enabled: alarm.enabled !== false,
            days,
            tone: selectedSong ? (selectedSong.title || selectedSong.filename) : 'Default Cyber Alarm',
            toneUrl: selectedSong ? (selectedSong.url || `/api/files/download?path=${encodeURIComponent(selectedSong.path)}`) : '/uploads/tones/default_cyber_alarm.wav',
            volume,
            fadeIn,
            snoozeMinutes,
            ringDurationMinutes
          });
        }}
      >
        {alarm.id ? 'Save changes' : 'Save alarm'}
      </button>

      {alarm.id && (
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

// 3. Song Details Edit Form
const SongEditForm = ({ song, onSave }) => {
  const [title, setTitle] = useState(song.title || '');
  const [artist, setArtist] = useState(song.artist || '');

  return (
    <div>
      <input
        className="fld"
        placeholder="Song Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="fld"
        placeholder="Artist"
        value={artist}
        onChange={(e) => setArtist(e.target.value)}
      />
      <button
        className="go"
        onClick={() => onSave(song.path, title.trim() || song.title, artist.trim())}
      >
        Save changes
      </button>
    </div>
  );
};

// 4. New Playlist Form with Multi-Song Picker
const NewPlaylistForm = ({ availableSongs, preSelectedSongIds = [], onCreate }) => {
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set(preSelectedSongIds));

  const toggleSong = (id) => {
    setSelectedIds(prev => {
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
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="dim" style={{ fontSize: '13px', margin: '4px 2px 6px' }}>
        Pick songs (optional)
      </div>

      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {availableSongs.map((s) => {
          const isChecked = selectedIds.has(s.id);
          return (
            <label key={s.id || s.path} className="mrow" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleSong(s.id)}
                style={{ width: '20px', height: '20px', accentColor: 'var(--acc)' }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.title || s.filename}
              </span>
            </label>
          );
        })}
      </div>

      <button
        className="go"
        style={{ marginTop: '14px' }}
        onClick={() => onCreate(name.trim() || 'New Playlist', [...selectedIds])}
      >
        Create playlist
      </button>
    </div>
  );
};
