import React, { useState, useRef, useMemo } from 'react';
import { useDashboard, isMediaFile } from '../context/DashboardContext';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Plus, Music, Film, Trash2, ListMusic, Upload, ChevronUp, ChevronDown, Check, X, FolderPlus, Disc, ArrowUpDown, Layers } from 'lucide-react';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const TrackThumbnail = ({ track, isPlaying = false, size = 20 }) => {
  const [error, setError] = useState(false);
  const coverUrl = track.coverUrl || `/api/files/cover?path=${encodeURIComponent(track.path || track.filename || '')}`;

  if (error || !coverUrl) {
    return track.type === 'video' ? (
      <Film size={size * 0.7} style={{ color: 'var(--red-ember)', flexShrink: 0 }} />
    ) : (
      <Music size={size * 0.7} style={{ color: 'var(--amber)', flexShrink: 0 }} />
    );
  }

  return (
    <img 
      src={coverUrl} 
      alt=""
      onError={() => setError(true)}
      style={{ 
        width: `${size}px`, 
        height: `${size}px`, 
        borderRadius: '3px', 
        objectFit: 'cover',
        flexShrink: 0,
        border: '1px solid var(--border)'
      }} 
    />
  );
};

export const PlaylistStock = () => {
  const {
    media,
    playlists,
    playbackState,
    playMedia,
    playPlaylist,
    togglePlayPause,
    seekPlayback,
    toggleShuffle,
    toggleRepeat,
    playNextMedia,
    playPrevMedia,
    createPlaylist,
    updatePlaylistTracks,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    deletePlaylist,
    refreshAllData
  } = useDashboard();

  const { currentMedia, isPlaying, currentTime, duration, shuffle, repeat, activePlaylistId } = playbackState;

  const [rightTab, setRightTab] = useState('all'); // 'all' (universal music) | 'playlists' (lists)
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('all'); // 'all' (Universal library) or playlist.id
  const [sortBy, setSortBy] = useState('custom'); // 'custom' | 'date_desc' | 'date_asc' | 'title_asc'
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [hoverTargetTrack, setHoverTargetTrack] = useState(null); // Track for hovering "Add to Playlist" window
  const [modalNewPlaylistName, setModalNewPlaylistName] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fileInputRef = useRef(null);

  const validStockMedia = (media || []).filter(isMediaFile);

  // Check if viewing universal 'all' songs or a specific playlist
  const isViewingAll = selectedPlaylistId === 'all';
  const currentSelectedPlaylist = isViewingAll ? null : (playlists.find(p => p.id === selectedPlaylistId) || playlists[0]);
  const activePlaylist = playlists.find(p => p.id === activePlaylistId);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleCreatePlaylist = async (name) => {
    if (!name.trim()) return;
    const res = await createPlaylist(name.trim());
    if (res && res.playlist) {
      setSelectedPlaylistId(res.playlist.id);
      showToast(`Created playlist "${res.playlist.name}"`);
    }
    setNewPlaylistName('');
    setShowCreateModal(false);
  };

  const handleMoveTrack = (playlistId, index, direction) => {
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl || !pl.tracks) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= pl.tracks.length) return;

    const newTracks = [...pl.tracks];
    const [moved] = newTracks.splice(index, 1);
    newTracks.splice(newIndex, 0, moved);

    updatePlaylistTracks(playlistId, newTracks);
  };

  const handleAddTrackToSpecificPlaylist = async (playlistId, track) => {
    const targetPl = playlists.find(p => p.id === playlistId);
    const alreadyExists = (targetPl?.tracks || []).some(t => t.id === track.id || t.path === track.path);

    if (alreadyExists) {
      await removeTrackFromPlaylist(playlistId, track.id || track.path);
      showToast(`Removed from ${targetPl?.name}`);
    } else {
      await addTrackToPlaylist(playlistId, track);
      showToast(`Added to ${targetPl?.name}`);
    }
  };

  const handleCreateAndAdd = async (track) => {
    if (!modalNewPlaylistName.trim()) return;
    const res = await createPlaylist(modalNewPlaylistName.trim());
    if (res && res.playlist) {
      await addTrackToPlaylist(res.playlist.id, track);
      setSelectedPlaylistId(res.playlist.id);
      showToast(`Created "${res.playlist.name}" and added song`);
    }
    setModalNewPlaylistName('');
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('mediaFiles', files[i]);
    }

    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      await refreshAllData();
      showToast(`Offloaded ${data.count || files.length} track(s) to universal library`);
    } catch (err) {
      console.error('[Upload Error]', err);
      showToast('Upload failed');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Sort tracks of currently selected view (Universal All Tracks or Playlist)
  const displayedTracks = useMemo(() => {
    let rawList = [];
    if (isViewingAll) {
      rawList = [...validStockMedia];
    } else if (currentSelectedPlaylist && currentSelectedPlaylist.tracks) {
      rawList = [...currentSelectedPlaylist.tracks];
    }

    if (sortBy === 'date_desc') {
      return rawList.sort((a, b) => new Date(b.uploadDate || 0) - new Date(a.uploadDate || 0));
    }
    if (sortBy === 'date_asc') {
      return rawList.sort((a, b) => new Date(a.uploadDate || 0) - new Date(b.uploadDate || 0));
    }
    if (sortBy === 'title_asc') {
      return rawList.sort((a, b) => (a.title || a.originalname || a.name || '').localeCompare(b.title || b.originalname || b.name || ''));
    }
    return rawList; // 'custom' preserved order
  }, [isViewingAll, currentSelectedPlaylist, validStockMedia, sortBy]);

  const handlePlayAll = () => {
    if (displayedTracks.length === 0) return;
    if (isViewingAll) {
      playMedia(displayedTracks[0], null); // Universal queue
    } else if (currentSelectedPlaylist) {
      playPlaylist(currentSelectedPlaylist, 0); // Playlist queue
    }
  };

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '8px', overflow: 'hidden', padding: '2px 0' }}>
      
      {/* LEFT COLUMN: UNIVERSAL / PLAYLIST SONG VIEWER & DECK */}
      <div className="panel-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '8px 10px' }}>
        
        {/* Row 1: Source Selector (Universal All Tracks vs Custom Playlists) & Action */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexShrink: 0, gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, flex: 1 }}>
            <Music size={14} style={{ color: 'var(--red-ember)', flexShrink: 0 }} />
            <select
              value={selectedPlaylistId}
              onChange={(e) => setSelectedPlaylistId(e.target.value)}
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border2)',
                color: 'var(--text)',
                fontFamily: 'var(--mono)',
                fontSize: '0.75rem',
                fontWeight: '700',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                flex: 1,
                minWidth: 0
              }}
            >
              <option value="all">ALL SONGS ({validStockMedia.length})</option>
              {playlists.map(pl => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} ({(pl.tracks || []).length})
                </option>
              ))}
            </select>

            {/* Indicator */}
            {isViewingAll && !activePlaylistId && isPlaying && (
              <span className="badge badge-ember font-mono" style={{ fontSize: '0.55rem', padding: '1px 3px', flexShrink: 0 }}>
                PLAYING ALL
              </span>
            )}
            {!isViewingAll && activePlaylistId === currentSelectedPlaylist?.id && isPlaying && (
              <span className="badge badge-amber font-mono" style={{ fontSize: '0.55rem', padding: '1px 3px', flexShrink: 0 }}>
                PLAYING
              </span>
            )}
          </div>

          {displayedTracks.length > 0 && (
            <button 
              onClick={handlePlayAll}
              className="btn-primary"
              style={{ padding: '2px 6px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}
            >
              <Play size={9} /> PLAY ALL
            </button>
          )}
        </div>

        {/* Row 2: Deck Controls Bar with Album Art */}
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', marginBottom: '6px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '6px' }}>
            {/* Album Cover Thumbnail */}
            {currentMedia && (
              <TrackThumbnail track={currentMedia} isPlaying={isPlaying} size={26} />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentMedia ? (currentMedia.title || currentMedia.originalname || currentMedia.filename) : 'No track playing'}
              </span>
            </div>
            <span style={{ fontSize: '0.6rem', fontFamily: 'var(--mono)', color: 'var(--text2)', flexShrink: 0 }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Scrub bar */}
          <input 
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime || 0}
            onChange={(e) => seekPlayback(parseFloat(e.target.value))}
            style={{ width: '100%', height: '3px', accentColor: 'var(--red-ember)', cursor: 'pointer', marginBottom: '4px' }}
          />

          {/* Transport buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <button 
              onClick={toggleShuffle} 
              title={shuffle ? 'Shuffle ON' : 'Shuffle OFF'}
              style={{ 
                padding: '2px 5px', 
                background: shuffle ? 'var(--red-mute)' : 'transparent', 
                border: `1px solid ${shuffle ? 'var(--red-ember)' : 'transparent'}`,
                borderRadius: 'var(--radius-sm)',
                color: shuffle ? 'var(--red-ember)' : 'var(--text3)' 
              }}
            >
              <Shuffle size={10} />
            </button>

            <button onClick={playPrevMedia} style={{ background: 'transparent', border: 'none', color: 'var(--text)', padding: '2px' }}>
              <SkipBack size={13} />
            </button>

            <button onClick={togglePlayPause} className="btn-primary" style={{ padding: '4px 12px', borderRadius: '12px' }}>
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            </button>

            <button onClick={() => playNextMedia(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', padding: '2px' }}>
              <SkipForward size={13} />
            </button>

            <button 
              onClick={toggleRepeat} 
              title={`Repeat: ${repeat.toUpperCase()}`}
              style={{ 
                padding: '2px 5px', 
                background: repeat !== 'off' ? 'var(--amber-warm-dim)' : 'transparent', 
                border: `1px solid ${repeat !== 'off' ? 'var(--amber-dim)' : 'transparent'}`,
                borderRadius: 'var(--radius-sm)',
                color: repeat !== 'off' ? 'var(--amber)' : 'var(--text3)' 
              }}
            >
              {repeat === 'one' ? <Repeat1 size={10} /> : <Repeat size={10} />}
            </button>
          </div>
        </div>

        {/* Row 3: Sort Options and Subheader */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.65rem', fontFamily: 'var(--mono)', color: 'var(--text2)', textTransform: 'uppercase' }}>
            {isViewingAll ? 'ALL TRACKS (UNIVERSAL)' : (currentSelectedPlaylist?.name || 'PLAYLIST')} ({displayedTracks.length})
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1px 4px' }}>
            <ArrowUpDown size={9} style={{ color: 'var(--text3)' }} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: '0.62rem', cursor: 'pointer', outline: 'none' }}
              title="Sort track ordering"
            >
              <option value="custom">Custom / Default</option>
              <option value="date_desc">Date Added (New)</option>
              <option value="date_asc">Date Added (Old)</option>
              <option value="title_asc">Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Scrollable Song List */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {displayedTracks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 8px', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: '0.7rem', margin: 'auto 0' }}>
              {isViewingAll ? (
                <>No songs in universal library.<br />Offload audio/video files on the right to start!</>
              ) : (
                <>No tracks in this playlist yet.<br />Click <strong>[+ ADD]</strong> on any song in ALL to add it here!</>
              )}
            </div>
          ) : (
            displayedTracks.map((track, idx) => {
              const isCurrent = playbackState.currentMedia?.path === track.path || playbackState.currentMedia?.id === track.id;

              return (
                <div 
                  key={track.id || track.path || idx}
                  style={{
                    background: isCurrent ? 'var(--red-mute)' : 'var(--bg)',
                    border: `1px solid ${isCurrent ? 'var(--red-ember)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '4px'
                  }}
                >
                  {/* Track Thumbnail, Number, Title & Play on click */}
                  <div 
                    onClick={() => playMedia(track, isViewingAll ? null : currentSelectedPlaylist?.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, minWidth: 0, cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '0.62rem', fontFamily: 'var(--mono)', color: isCurrent ? 'var(--red-ember)' : 'var(--text3)', fontWeight: '700', width: '14px', flexShrink: 0 }}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    
                    <TrackThumbnail track={track} isPlaying={isCurrent && isPlaying} size={20} />

                    <span style={{ fontSize: '0.72rem', color: isCurrent ? 'var(--red-ember)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isCurrent ? '700' : 'normal' }}>
                      {track.title || track.originalname || track.name || track.filename}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1px', flexShrink: 0 }}>
                    {!isViewingAll && sortBy === 'custom' && (
                      <>
                        <button 
                          onClick={() => handleMoveTrack(currentSelectedPlaylist.id, idx, -1)}
                          disabled={idx === 0}
                          style={{ padding: '1px 2px', background: 'transparent', border: 'none', color: idx === 0 ? 'var(--text3)' : 'var(--text2)', cursor: idx === 0 ? 'default' : 'pointer' }}
                          title="Move Track Up"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button 
                          onClick={() => handleMoveTrack(currentSelectedPlaylist.id, idx, 1)}
                          disabled={idx === displayedTracks.length - 1}
                          style={{ padding: '1px 2px', background: 'transparent', border: 'none', color: idx === displayedTracks.length - 1 ? 'var(--text3)' : 'var(--text2)', cursor: idx === displayedTracks.length - 1 ? 'default' : 'pointer' }}
                          title="Move Track Down"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </>
                    )}

                    <button 
                      onClick={() => setHoverTargetTrack(track)}
                      style={{ padding: '1px 2px', background: 'transparent', border: 'none', color: 'var(--amber)' }}
                      title="Add to playlist..."
                    >
                      <Layers size={11} />
                    </button>

                    {!isViewingAll && (
                      <button 
                        onClick={() => removeTrackFromPlaylist(currentSelectedPlaylist.id, track.id || track.path)}
                        style={{ padding: '1px 2px', background: 'transparent', border: 'none', color: 'var(--text3)' }}
                        title="Remove from this playlist"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: UNIVERSAL 'ALL' MUSIC & PLAYLISTS MANAGER */}
      <div className="panel-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '8px 10px' }}>
        
        {/* Top Tab Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexShrink: 0, gap: '4px' }}>
          <div style={{ display: 'flex', gap: '2px', background: 'var(--bg)', border: '1px solid var(--border)', padding: '1px', borderRadius: 'var(--radius-sm)' }}>
            <button 
              onClick={() => setRightTab('all')} 
              className={rightTab === 'all' ? 'btn-primary' : ''}
              style={{ padding: '2px 6px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <Music size={10} /> ALL ({validStockMedia.length})
            </button>
            <button 
              onClick={() => setRightTab('playlists')} 
              className={rightTab === 'playlists' ? 'btn-primary' : ''}
              style={{ padding: '2px 6px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <ListMusic size={10} /> LISTS ({playlists.length})
            </button>
          </div>

          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
            style={{ padding: '2px 6px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}
          >
            <FolderPlus size={10} /> + NEW
          </button>
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div style={{ background: 'var(--amber-warm-dim)', border: '1px solid var(--amber-dim)', color: 'var(--amber)', padding: '3px 6px', borderRadius: 'var(--radius-sm)', fontSize: '0.65rem', marginBottom: '4px', textAlign: 'center', fontFamily: 'var(--mono)' }}>
            <Check size={10} style={{ display: 'inline', marginRight: '3px' }} /> {toastMessage}
          </div>
        )}

        {/* TAB 1: ALL SONGS */}
        {rightTab === 'all' ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {validStockMedia.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 8px', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: '0.7rem' }}>
                  No songs in library.<br />Offload audio/video files below to populate universal music!
                </div>
              ) : (
                validStockMedia.map(item => {
                  const isCurrent = playbackState.currentMedia?.path === item.path || playbackState.currentMedia?.id === item.id;

                  return (
                    <div 
                      key={item.id || item.path}
                      style={{
                        background: isCurrent ? 'var(--red-mute)' : 'var(--bg)',
                        border: `1px solid ${isCurrent ? 'var(--red-ember)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '4px'
                      }}
                    >
                      {/* Play directly on click from ALL tab with thumbnail */}
                      <div 
                        onClick={() => playMedia(item, null)}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, minWidth: 0, cursor: 'pointer' }}
                        title="Click to play this track"
                      >
                        <TrackThumbnail track={item} isPlaying={isCurrent && isPlaying} size={20} />

                        <span style={{ fontSize: '0.72rem', color: isCurrent ? 'var(--red-ember)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isCurrent ? '700' : 'normal' }}>
                          {item.originalname || item.filename || item.name}
                        </span>
                      </div>

                      {/* Add button to put into any playlist */}
                      <button 
                        onClick={() => setHoverTargetTrack(item)}
                        className="btn-amber"
                        style={{ padding: '2px 6px', fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}
                        title="Add this song to a playlist"
                      >
                        <Plus size={10} /> ADD
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Offload Zone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '1px dashed var(--border2)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 8px',
                textAlign: 'center',
                background: 'var(--bg2)',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                multiple 
                onChange={handleFileUpload} 
                style={{ display: 'none' }} 
                accept="audio/*,video/*"
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text)' }}>
                <Upload size={11} style={{ color: 'var(--red-ember)' }} />
                {uploading ? 'OFFLOADING...' : 'OFFLOAD AUDIO/VIDEO FILES'}
              </div>
            </div>
          </div>
        ) : (
          /* TAB 2: PLAYLISTS OVERVIEW & SELECTOR */
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {playlists.map(pl => {
              const isSelected = selectedPlaylistId === pl.id;
              const isActive = activePlaylistId === pl.id;

              return (
                <div 
                  key={pl.id}
                  style={{
                    background: isSelected ? 'var(--bg2)' : 'var(--bg)',
                    border: `1px solid ${isActive ? 'var(--red-ember)' : isSelected ? 'var(--border2)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div 
                    onClick={() => setSelectedPlaylistId(pl.id)}
                    style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ListMusic size={13} style={{ color: isActive ? 'var(--red-ember)' : 'var(--amber)' }} />
                      <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text)' }}>
                        {pl.name}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: '1px' }}>
                      {(pl.tracks || []).length} tracks • {isActive ? 'PLAYING' : isSelected ? 'VIEWING' : 'Tap to view'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button 
                      onClick={() => { setSelectedPlaylistId(pl.id); playPlaylist(pl, 0); }}
                      className={isActive ? 'btn-primary' : ''}
                      style={{ padding: '2px 6px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '2px' }}
                    >
                      <Play size={9} /> PLAY
                    </button>
                    <button 
                      onClick={() => deletePlaylist(pl.id)}
                      style={{ padding: '2px', color: 'var(--text3)', background: 'transparent', border: 'none' }}
                      title="Delete Playlist"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* HOVERING WINDOW MODAL */}
      {hoverTargetTrack && (
        <div 
          onClick={() => setHoverTargetTrack(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(10, 9, 8, 0.85)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '380px',
              background: 'var(--bg1)',
              border: '1px solid var(--amber)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              boxShadow: 'var(--shadow-ember)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexShrink: 0 }}>
              <div style={{ fontSize: '0.82rem', fontFamily: 'var(--mono)', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Layers size={14} style={{ color: 'var(--amber)' }} /> ADD SONG TO PLAYLIST
              </div>
              <button onClick={() => setHoverTargetTrack(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text2)', padding: '2px' }}>
                <X size={14} />
              </button>
            </div>

            {/* Target Song Title banner with Thumbnail */}
            <div style={{ 
              background: 'var(--bg2)', 
              border: '1px solid var(--border)', 
              borderRadius: 'var(--radius-sm)', 
              padding: '5px 8px', 
              marginBottom: '8px', 
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0
            }}>
              <TrackThumbnail track={hoverTargetTrack} size={24} />
              <div style={{ fontSize: '0.72rem', color: 'var(--red-ember)', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                {hoverTargetTrack.title || hoverTargetTrack.originalname || hoverTargetTrack.name || hoverTargetTrack.filename}
              </div>
            </div>

            <div style={{ fontSize: '0.65rem', color: 'var(--text2)', marginBottom: '4px', fontFamily: 'var(--mono)', flexShrink: 0 }}>
              SELECT TARGET PLAYLIST(S):
            </div>

            {/* Playlists Selection List */}
            <div style={{ flex: 1, minHeight: '80px', maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
              {playlists.map(pl => {
                const isIncluded = (pl.tracks || []).some(t => t.id === hoverTargetTrack.id || t.path === hoverTargetTrack.path);

                return (
                  <div 
                    key={pl.id}
                    onClick={() => handleAddTrackToSpecificPlaylist(pl.id, hoverTargetTrack)}
                    style={{
                      background: isIncluded ? 'var(--red-mute)' : 'var(--bg)',
                      border: `1px solid ${isIncluded ? 'var(--red-ember)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                      <ListMusic size={12} style={{ color: isIncluded ? 'var(--red-ember)' : 'var(--amber)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {pl.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                      {isIncluded ? (
                        <span className="badge badge-ember font-mono" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>
                          <Check size={8} style={{ display: 'inline', marginRight: '2px' }} /> ADDED
                        </span>
                      ) : (
                        <span className="badge font-mono" style={{ fontSize: '0.6rem', padding: '1px 4px', background: 'var(--bg3)', color: 'var(--text2)' }}>
                          + ADD
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inline Quick Create Playlist */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', flexShrink: 0 }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text2)', marginBottom: '3px' }}>OR CREATE NEW PLAYLIST FOR THIS SONG:</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input 
                  type="text" 
                  placeholder="New Playlist Name..."
                  value={modalNewPlaylistName}
                  onChange={(e) => setModalNewPlaylistName(e.target.value)}
                  style={{ flex: 1, padding: '4px 6px', fontSize: '0.75rem' }}
                />
                <button 
                  onClick={() => handleCreateAndAdd(hoverTargetTrack)}
                  className="btn-amber"
                  style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                  disabled={!modalNewPlaylistName.trim()}
                >
                  CREATE & ADD
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', flexShrink: 0 }}>
              <button onClick={() => setHoverTargetTrack(null)} style={{ padding: '4px 12px', fontSize: '0.75rem' }}>
                DONE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW PLAYLIST STANDALONE MODAL */}
      {showCreateModal && (
        <div 
          onClick={() => setShowCreateModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(10, 9, 8, 0.85)',
            backdropFilter: 'blur(4px)',
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '360px',
              background: 'var(--bg1)',
              border: '1px solid var(--red-ember)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              boxShadow: 'var(--shadow-ember)'
            }}
          >
            <div style={{ fontSize: '0.85rem', fontFamily: 'var(--mono)', fontWeight: '700', color: 'var(--text)', marginBottom: '10px' }}>
              CREATE NEW PLAYLIST
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCreatePlaylist(newPlaylistName); }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text2)', marginBottom: '3px' }}>PLAYLIST NAME</label>
                <input 
                  type="text" 
                  placeholder="e.g. Focus Synthetics, Night Drive"
                  value={newPlaylistName} 
                  onChange={(e) => setNewPlaylistName(e.target.value)} 
                  style={{ width: '100%', padding: '6px', fontSize: '0.8rem' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                  CANCEL
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '4px 12px', fontSize: '0.75rem' }}>
                  CREATE PLAYLIST
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
