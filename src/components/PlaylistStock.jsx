import React, { useState, useRef, useMemo } from 'react';
import { useDashboard, isMediaFile } from '../context/DashboardContext';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Plus, Music, Film, Trash2, ListMusic, Upload, ChevronUp, ChevronDown, Check, X, FolderPlus, Disc, ArrowUpDown, Clock, Layers } from 'lucide-react';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

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

  const [rightTab, setRightTab] = useState('stock'); // 'stock' | 'playlists'
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(playlists[0]?.id || null);
  const [sortBy, setSortBy] = useState('custom'); // 'custom' | 'date_desc' | 'date_asc' | 'title_asc'
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [hoverTargetTrack, setHoverTargetTrack] = useState(null); // Track for hovering "Add to Playlist" window
  const [modalNewPlaylistName, setModalNewPlaylistName] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fileInputRef = useRef(null);

  // Sync selected playlist (fallback to first available or active)
  const currentSelectedPlaylist = playlists.find(p => p.id === selectedPlaylistId) || playlists[0];
  const activePlaylist = playlists.find(p => p.id === activePlaylistId);
  const validStockMedia = (media || []).filter(isMediaFile);

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
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append('mediaFile', files[i]);

      try {
        await fetch('/api/files/upload', {
          method: 'POST',
          body: formData
        });
      } catch (err) {
        console.error('[Upload Error]', err);
      }
    }
    setUploading(false);
    refreshAllData();
    showToast('Files uploaded to stock library');
  };

  // Sort tracks of currently selected playlist based on user preference
  const sortedPlaylistTracks = useMemo(() => {
    if (!currentSelectedPlaylist || !currentSelectedPlaylist.tracks) return [];
    const tracks = [...currentSelectedPlaylist.tracks];

    if (sortBy === 'date_desc') {
      return tracks.sort((a, b) => new Date(b.uploadDate || 0) - new Date(a.uploadDate || 0));
    }
    if (sortBy === 'date_asc') {
      return tracks.sort((a, b) => new Date(a.uploadDate || 0) - new Date(b.uploadDate || 0));
    }
    if (sortBy === 'title_asc') {
      return tracks.sort((a, b) => (a.title || a.originalname || a.name || '').localeCompare(b.title || b.originalname || b.name || ''));
    }
    return tracks; // 'custom' preserved order
  }, [currentSelectedPlaylist, sortBy]);

  const isVideo = currentMedia?.type === 'video' || /\.(mp4|mkv|webm|mov|avi)$/i.test(currentMedia?.filename || '');

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '10px', overflow: 'hidden' }}>
      
      {/* LEFT COLUMN: SELECTED PLAYLIST VIEWER & SONG LIST */}
      <div className="panel-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 14px' }}>
        
        {/* Playlist Selector & Controls Top Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0, gap: '6px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <ListMusic size={17} style={{ color: 'var(--red-ember)', flexShrink: 0 }} />
            
            {/* Playlist dropdown selector */}
            <select
              value={currentSelectedPlaylist?.id || ''}
              onChange={(e) => setSelectedPlaylistId(e.target.value)}
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border2)',
                color: 'var(--text)',
                fontFamily: 'var(--mono)',
                fontSize: '0.82rem',
                fontWeight: '700',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                maxWidth: '180px'
              }}
            >
              {playlists.map(pl => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} ({(pl.tracks || []).length})
                </option>
              ))}
            </select>

            {activePlaylistId === currentSelectedPlaylist?.id && (
              <span className="badge badge-amber font-mono" style={{ fontSize: '0.6rem', padding: '2px 4px' }}>
                PLAYING NOW
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {/* Sort Filter selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px 6px' }}>
              <ArrowUpDown size={11} style={{ color: 'var(--text3)' }} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: '0.68rem', cursor: 'pointer', outline: 'none' }}
                title="Sort track ordering"
              >
                <option value="custom">Custom Order</option>
                <option value="date_desc">Date Added (Newest)</option>
                <option value="date_asc">Date Added (Oldest)</option>
                <option value="title_asc">Title (A-Z)</option>
              </select>
            </div>

            {currentSelectedPlaylist && currentSelectedPlaylist.tracks && currentSelectedPlaylist.tracks.length > 0 && (
              <button 
                onClick={() => playPlaylist(currentSelectedPlaylist, 0)}
                className="btn-primary"
                style={{ padding: '3px 8px', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                <Play size={10} /> PLAY ALL
              </button>
            )}
          </div>
        </div>

        {/* Compact Deck Controls Bar */}
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', marginBottom: '8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', minWidth: 0 }}>
              <Disc size={13} className={isPlaying ? 'animate-spin' : ''} style={{ color: isPlaying ? 'var(--red-ember)' : 'var(--text3)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentMedia ? (currentMedia.title || currentMedia.originalname || currentMedia.filename) : 'No track active'}
              </span>
            </div>
            <span style={{ fontSize: '0.65rem', fontFamily: 'var(--mono)', color: 'var(--text2)', flexShrink: 0 }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Scrub input */}
          <input 
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime || 0}
            onChange={(e) => seekPlayback(parseFloat(e.target.value))}
            style={{ width: '100%', height: '4px', accentColor: 'var(--red-ember)', cursor: 'pointer', marginBottom: '6px' }}
          />

          {/* Transport buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <button 
              onClick={toggleShuffle} 
              title={shuffle ? 'Shuffle ON' : 'Shuffle OFF'}
              style={{ 
                padding: '3px 6px', 
                background: shuffle ? 'var(--red-mute)' : 'transparent', 
                border: `1px solid ${shuffle ? 'var(--red-ember)' : 'transparent'}`,
                borderRadius: 'var(--radius-sm)',
                color: shuffle ? 'var(--red-ember)' : 'var(--text3)' 
              }}
            >
              <Shuffle size={12} />
            </button>

            <button onClick={playPrevMedia} style={{ background: 'transparent', border: 'none', color: 'var(--text)', padding: '2px 4px' }}>
              <SkipBack size={15} />
            </button>

            <button onClick={togglePlayPause} className="btn-primary" style={{ padding: '6px 14px', borderRadius: '15px' }}>
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>

            <button onClick={() => playNextMedia(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', padding: '2px 4px' }}>
              <SkipForward size={15} />
            </button>

            <button 
              onClick={toggleRepeat} 
              title={`Repeat: ${repeat.toUpperCase()}`}
              style={{ 
                padding: '3px 6px', 
                background: repeat !== 'off' ? 'var(--amber-warm-dim)' : 'transparent', 
                border: `1px solid ${repeat !== 'off' ? 'var(--amber-dim)' : 'transparent'}`,
                borderRadius: 'var(--radius-sm)',
                color: repeat !== 'off' ? 'var(--amber)' : 'var(--text3)' 
              }}
            >
              {repeat === 'one' ? <Repeat1 size={12} /> : <Repeat size={12} />}
            </button>
          </div>
        </div>

        {/* Selected Playlist Song List Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.7rem', fontFamily: 'var(--mono)', color: 'var(--text2)', textTransform: 'uppercase' }}>
            SONG LIST ({sortedPlaylistTracks.length} TRACKS)
          </div>
          {sortBy !== 'custom' && (
            <span style={{ fontSize: '0.62rem', color: 'var(--amber)', fontFamily: 'var(--mono)' }}>
              Order locked by {sortBy.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Scrollable Song List in Current Playlist */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {(!currentSelectedPlaylist || !currentSelectedPlaylist.tracks || currentSelectedPlaylist.tracks.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: '0.75rem', margin: 'auto 0' }}>
              No tracks in "{currentSelectedPlaylist?.name || 'Playlist'}".<br />
              Browse Media Stock on the right and click <strong>[+ ADD]</strong> to add songs!
            </div>
          ) : (
            sortedPlaylistTracks.map((track, idx) => {
              const isCurrent = playbackState.currentMedia?.path === track.path || playbackState.currentMedia?.id === track.id;

              return (
                <div 
                  key={track.id || track.path || idx}
                  style={{
                    background: isCurrent ? 'var(--red-mute)' : 'var(--bg)',
                    border: `1px solid ${isCurrent ? 'var(--red-ember)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  {/* Track Number, Title & Play on click */}
                  <div 
                    onClick={() => playMedia(track, currentSelectedPlaylist.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '0.7rem', fontFamily: 'var(--mono)', color: isCurrent ? 'var(--red-ember)' : 'var(--text3)', fontWeight: '700', width: '18px' }}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: isCurrent ? 'var(--red-ember)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isCurrent ? '700' : 'normal' }}>
                      {track.title || track.originalname || track.name || track.filename}
                    </span>
                  </div>

                  {/* Rearrange Arrows (Enabled in Custom Order) & Remove */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                    {sortBy === 'custom' && (
                      <>
                        <button 
                          onClick={() => handleMoveTrack(currentSelectedPlaylist.id, idx, -1)}
                          disabled={idx === 0}
                          style={{ padding: '2px 4px', background: 'transparent', border: 'none', color: idx === 0 ? 'var(--text3)' : 'var(--text2)', cursor: idx === 0 ? 'default' : 'pointer' }}
                          title="Move Track Up"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button 
                          onClick={() => handleMoveTrack(currentSelectedPlaylist.id, idx, 1)}
                          disabled={idx === sortedPlaylistTracks.length - 1}
                          style={{ padding: '2px 4px', background: 'transparent', border: 'none', color: idx === sortedPlaylistTracks.length - 1 ? 'var(--text3)' : 'var(--text2)', cursor: idx === sortedPlaylistTracks.length - 1 ? 'default' : 'pointer' }}
                          title="Move Track Down"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </>
                    )}

                    <button 
                      onClick={() => setHoverTargetTrack(track)}
                      style={{ padding: '2px 4px', background: 'transparent', border: 'none', color: 'var(--amber)' }}
                      title="Add to another playlist..."
                    >
                      <Layers size={13} />
                    </button>

                    <button 
                      onClick={() => removeTrackFromPlaylist(currentSelectedPlaylist.id, track.id || track.path)}
                      style={{ padding: '2px 4px', background: 'transparent', border: 'none', color: 'var(--text3)' }}
                      title="Remove from this playlist"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: MEDIA STOCK VAULT & PLAYLIST MANAGERS */}
      <div className="panel-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 14px' }}>
        
        {/* Tab Switcher: MEDIA STOCK vs ALL PLAYLISTS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg)', border: '1px solid var(--border)', padding: '2px', borderRadius: 'var(--radius-sm)' }}>
            <button 
              onClick={() => setRightTab('stock')} 
              className={rightTab === 'stock' ? 'btn-primary' : ''}
              style={{ padding: '3px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Music size={12} /> MEDIA STOCK ({validStockMedia.length})
            </button>
            <button 
              onClick={() => setRightTab('playlists')} 
              className={rightTab === 'playlists' ? 'btn-primary' : ''}
              style={{ padding: '3px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <ListMusic size={12} /> PLAYLISTS ({playlists.length})
            </button>
          </div>

          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
            style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <FolderPlus size={12} /> + NEW PLAYLIST
          </button>
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div style={{ background: 'var(--amber-warm-dim)', border: '1px solid var(--amber-dim)', color: 'var(--amber)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontSize: '0.7rem', marginBottom: '8px', textAlign: 'center', fontFamily: 'var(--mono)' }}>
            <Check size={11} style={{ display: 'inline', marginRight: '4px' }} /> {toastMessage}
          </div>
        )}

        {/* TAB 1: MEDIA STOCK VAULT */}
        {rightTab === 'stock' ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {validStockMedia.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
                  No audio/video files in vault.<br />Offload files below to populate media stock!
                </div>
              ) : (
                validStockMedia.map(item => (
                  <div 
                    key={item.id || item.path}
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                      {item.type === 'video' ? <Film size={13} style={{ color: 'var(--red-ember)', flexShrink: 0 }} /> : <Music size={13} style={{ color: 'var(--amber)', flexShrink: 0 }} />}
                      <span style={{ fontSize: '0.78rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.originalname || item.filename || item.name}
                      </span>
                    </div>

                    {/* Button that opens the Hovering Playlist Selector Modal */}
                    <button 
                      onClick={() => setHoverTargetTrack(item)}
                      className="btn-amber"
                      style={{ padding: '3px 8px', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}
                      title="Choose which playlist to put this song in"
                    >
                      <Plus size={11} /> + ADD TO...
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Quick Offload Zone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '1px dashed var(--border2)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text)' }}>
                <Upload size={13} style={{ color: 'var(--red-ember)' }} />
                {uploading ? 'OFFLOADING TO STOCK...' : 'OFFLOAD AUDIO/VIDEO FILES'}
              </div>
            </div>
          </div>
        ) : (
          /* TAB 2: PLAYLISTS OVERVIEW & SELECTOR */
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {playlists.map(pl => {
              const isSelected = currentSelectedPlaylist?.id === pl.id;
              const isActive = activePlaylistId === pl.id;

              return (
                <div 
                  key={pl.id}
                  style={{
                    background: isSelected ? 'var(--bg2)' : 'var(--bg)',
                    border: `1px solid ${isActive ? 'var(--red-ember)' : isSelected ? 'var(--border2)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div 
                    onClick={() => setSelectedPlaylistId(pl.id)}
                    style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ListMusic size={15} style={{ color: isActive ? 'var(--red-ember)' : 'var(--amber)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text)' }}>
                        {pl.name}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: '2px' }}>
                      {(pl.tracks || []).length} tracks • {isActive ? 'NOW ACTIVE IN DECK' : isSelected ? 'VIEWING IN SONG LIST' : 'Click to view'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button 
                      onClick={() => { setSelectedPlaylistId(pl.id); playPlaylist(pl, 0); }}
                      className={isActive ? 'btn-primary' : ''}
                      style={{ padding: '3px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Play size={10} /> PLAY
                    </button>
                    <button 
                      onClick={() => deletePlaylist(pl.id)}
                      style={{ padding: '4px', color: 'var(--text3)', background: 'transparent', border: 'none' }}
                      title="Delete Playlist"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* HOVERING WINDOW MODAL: ADD TRACK TO PLAYLIST OF CHOICE */}
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
            padding: '16px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              background: 'var(--bg1)',
              border: '1px solid var(--amber)',
              borderRadius: 'var(--radius-md)',
              padding: '18px',
              boxShadow: 'var(--shadow-ember)',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '0.9rem', fontFamily: 'var(--mono)', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={16} style={{ color: 'var(--amber)' }} /> ADD SONG TO PLAYLIST
              </div>
              <button onClick={() => setHoverTargetTrack(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text2)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Target Song Title banner */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '0.78rem', color: 'var(--red-ember)', fontWeight: '700', marginBottom: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {hoverTargetTrack.title || hoverTargetTrack.originalname || hoverTargetTrack.name || hoverTargetTrack.filename}
            </div>

            <div style={{ fontSize: '0.7rem', color: 'var(--text2)', marginBottom: '6px', fontFamily: 'var(--mono)' }}>
              SELECT TARGET PLAYLIST(S):
            </div>

            {/* Playlists Selection List */}
            <div style={{ flex: 1, minHeight: '120px', maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
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
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ListMusic size={14} style={{ color: isIncluded ? 'var(--red-ember)' : 'var(--amber)' }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text)' }}>
                        {pl.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isIncluded ? (
                        <span className="badge badge-ember font-mono" style={{ fontSize: '0.65rem' }}>
                          <Check size={10} style={{ display: 'inline', marginRight: '2px' }} /> ADDED
                        </span>
                      ) : (
                        <span className="badge font-mono" style={{ fontSize: '0.65rem', background: 'var(--bg3)', color: 'var(--text2)' }}>
                          + CLICK TO ADD
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inline Quick Create Playlist */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text2)', marginBottom: '4px' }}>OR CREATE NEW PLAYLIST FOR THIS SONG:</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input 
                  type="text" 
                  placeholder="New Playlist Name..."
                  value={modalNewPlaylistName}
                  onChange={(e) => setModalNewPlaylistName(e.target.value)}
                  style={{ flex: 1, padding: '6px', fontSize: '0.8rem' }}
                />
                <button 
                  onClick={() => handleCreateAndAdd(hoverTargetTrack)}
                  className="btn-amber"
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  disabled={!modalNewPlaylistName.trim()}
                >
                  CREATE & ADD
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button onClick={() => setHoverTargetTrack(null)} style={{ padding: '6px 14px' }}>
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
            padding: '16px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '380px',
              background: 'var(--bg1)',
              border: '1px solid var(--red-ember)',
              borderRadius: 'var(--radius-md)',
              padding: '18px',
              boxShadow: 'var(--shadow-ember)'
            }}
          >
            <div style={{ fontSize: '0.95rem', fontFamily: 'var(--mono)', fontWeight: '700', color: 'var(--text)', marginBottom: '12px' }}>
              CREATE NEW PLAYLIST STOCK
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCreatePlaylist(newPlaylistName); }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text2)', marginBottom: '4px' }}>PLAYLIST NAME</label>
                <input 
                  type="text" 
                  placeholder="e.g. Focus Synthetics, Night Drive"
                  value={newPlaylistName} 
                  onChange={(e) => setNewPlaylistName(e.target.value)} 
                  style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '6px 12px' }}>
                  CANCEL
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '6px 14px' }}>
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
