import React, { useState, useEffect, useRef } from 'react';
import { useDashboard, isMediaFile } from '../context/DashboardContext';
import { Play, Pause, SkipBack, SkipForward, Maximize2, Minimize2, Video, Music, Disc, Shuffle, Repeat, Repeat1 } from 'lucide-react';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const RotatingTitle = ({ text, style = {}, className = '' }) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [shouldRotate, setShouldRotate] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        setShouldRotate(textRef.current.scrollWidth > containerRef.current.clientWidth);
      }
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text]);

  return (
    <div 
      ref={containerRef} 
      className={className}
      style={{ 
        overflow: 'hidden', 
        whiteSpace: 'nowrap', 
        width: '100%', 
        position: 'relative',
        ...style 
      }}
    >
      <div 
        ref={textRef}
        className={shouldRotate ? 'marquee-rotate' : ''}
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap'
        }}
      >
        <span>{text}</span>
        {shouldRotate && (
          <span style={{ paddingLeft: '2.5rem' }}>{text}</span>
        )}
      </div>
    </div>
  );
};

export const NowPlaying = () => {
  const {
    playbackState,
    togglePlayPause,
    seekPlayback,
    toggleShuffle,
    toggleRepeat,
    playNextMedia,
    playPrevMedia,
    media
  } = useDashboard();

  const { currentMedia, isPlaying, currentTime, duration, shuffle, repeat } = playbackState;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const videoRef = useRef(null);

  const isValidMedia = isMediaFile(currentMedia);
  const isVideo = isValidMedia && (currentMedia?.type === 'video' || (currentMedia?.filename && /\.(mp4|mkv|webm|mov|avi)$/i.test(currentMedia.filename)));

  // Reset cover error on track change
  useEffect(() => {
    setCoverFailed(false);
  }, [currentMedia?.path, currentMedia?.id, currentMedia?.filename]);

  // Sync video element time with global audio engine if video is playing
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isVideo) return;

    if (isPlaying) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isPlaying, isVideo, currentMedia]);

  const handleSeek = (e) => {
    const targetTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }
    seekPlayback(targetTime);
  };

  const validMediaList = (media || []).filter(isMediaFile);

  const coverUrl = currentMedia ? (
    currentMedia.coverUrl || `/api/files/cover?path=${encodeURIComponent(currentMedia.path || currentMedia.filename || '')}`
  ) : null;

  // Split artist and title if formatted as "Artist - Title"
  const rawTitle = currentMedia ? (currentMedia.title || currentMedia.originalname || currentMedia.name || currentMedia.filename || '') : '';
  const cleanTitle = rawTitle.replace(/\.[^/.]+$/, ''); // remove extension
  let displayArtist = '';
  let displaySong = cleanTitle;

  if (cleanTitle.includes(' - ')) {
    const parts = cleanTitle.split(' - ');
    displayArtist = parts[0].trim();
    displaySong = parts.slice(1).join(' - ').trim();
  }

  return (
    <div className="panel-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '10px 12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {isVideo ? (
            <Video size={16} style={{ color: 'var(--red-ember)', flexShrink: 0 }} />
          ) : (
            <Music size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          )}
          <h2 style={{ fontSize: '0.85rem', fontFamily: 'var(--mono)', textTransform: 'uppercase', color: 'var(--text)', whiteSpace: 'nowrap' }}>
            NOW PLAYING
          </h2>
        </div>

        {isVideo && currentMedia && (
          <button 
            onClick={() => setIsFullscreen(true)}
            title="Expand Fullscreen Video"
            style={{ padding: '3px 6px', fontSize: '0.7rem', background: 'var(--bg3)', borderColor: 'var(--border2)', flexShrink: 0 }}
          >
            <Maximize2 size={13} style={{ color: 'var(--red-ember)' }} />
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {!currentMedia || !isValidMedia ? (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--text3)', 
          textAlign: 'center',
          fontFamily: 'var(--mono)',
          fontSize: '0.75rem',
          gap: '8px',
          minHeight: 0
        }}>
          <Disc size={28} style={{ color: 'var(--text3)', opacity: 0.5 }} />
          <div>Nothing playing</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>Select a song or playlist in MUSIC tab</div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', justifyContent: 'space-between' }}>
          
          {/* LOCAL VIDEO VAULT BRANCH */}
          {isVideo ? (
            <div style={{ 
              flex: 1, 
              minHeight: 0, 
              width: '100%',
              background: '#000', 
              borderRadius: 'var(--radius-sm)', 
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              marginBottom: '6px'
            }}>
              <video
                ref={videoRef}
                src={currentMedia.url}
                muted // Muted in viewport since GlobalAudioEngine handles primary sound
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          ) : (
            /* LOCAL AUDIO VAULT BRANCH WITH ALBUM COVER DISPLAY */
            <div style={{ 
              flex: 1, 
              minHeight: 0, 
              width: '100%',
              background: 'var(--bg2)', 
              borderRadius: 'var(--radius-sm)', 
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              border: '1px solid var(--border)',
              marginBottom: '6px',
              overflow: 'hidden'
            }}>
              {/* Album Art Cover / Stylized Vinyl Disk */}
              <div style={{ 
                width: '54px', 
                height: '54px', 
                borderRadius: '6px', 
                background: 'var(--bg1)',
                border: `1px solid ${isPlaying ? 'var(--red-ember)' : 'var(--border2)'}`,
                boxShadow: isPlaying ? '0 0 12px rgba(217, 68, 50, 0.25)' : 'none',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
                position: 'relative'
              }}>
                {!coverFailed && coverUrl ? (
                  <img 
                    src={coverUrl} 
                    alt="Album Cover"
                    onError={() => setCoverFailed(true)}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover'
                    }} 
                  />
                ) : (
                  /* Stylized Cyber Vinyl Graphic fallback */
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle, #251614 35%, #120b09 70%, #0a0706 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Disc size={26} className={isPlaying ? 'animate-spin' : ''} style={{ color: isPlaying ? 'var(--red-ember)' : 'var(--amber)' }} />
                  </div>
                )}
              </div>

              {/* Title & Artist Info */}
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <RotatingTitle 
                  text={displaySong}
                  style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text)', lineHeight: '1.2' }}
                />
                
                {displayArtist ? (
                  <div style={{ fontSize: '0.7rem', color: 'var(--amber)', fontFamily: 'var(--mono)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayArtist}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.65rem', color: isPlaying ? 'var(--red-ember)' : 'var(--text3)', fontFamily: 'var(--mono)', marginTop: '2px' }}>
                    {isPlaying ? '▶ GLOBAL AUDIO' : 'PAUSED'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scrub Bar & Controls */}
          <div style={{ flexShrink: 0 }}>
            {/* Progress Scrub Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.65rem', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
                {formatTime(currentTime)}
              </span>
              <input 
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime || 0}
                onChange={handleSeek}
                style={{ flex: 1, height: '4px', accentColor: 'var(--red-ember)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.65rem', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
                {formatTime(duration)}
              </span>
            </div>

            {/* Transport Controls with Shuffle & Repeat Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              {/* Shuffle Toggle */}
              <button 
                onClick={toggleShuffle} 
                title={shuffle ? 'Shuffle ON' : 'Shuffle OFF'}
                style={{ 
                  padding: '5px 8px', 
                  background: shuffle ? 'var(--red-mute)' : 'transparent', 
                  border: `1px solid ${shuffle ? 'var(--red-ember)' : 'transparent'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: shuffle ? 'var(--red-ember)' : 'var(--text3)' 
                }}
              >
                <Shuffle size={14} />
              </button>

              <button 
                onClick={playPrevMedia} 
                title="Previous Track"
                disabled={validMediaList.length === 0}
                style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--text)' }}
              >
                <SkipBack size={16} />
              </button>

              <button 
                onClick={togglePlayPause} 
                className="btn-primary"
                style={{ padding: '8px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>

              <button 
                onClick={() => playNextMedia(false)} 
                title="Next Track"
                disabled={validMediaList.length === 0}
                style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--text)' }}
              >
                <SkipForward size={16} />
              </button>

              {/* Repeat Toggle (OFF / REPEAT ALL / REPEAT ONE) */}
              <button 
                onClick={toggleRepeat} 
                title={`Repeat Mode: ${repeat.toUpperCase()}`}
                style={{ 
                  padding: '5px 8px', 
                  background: repeat !== 'off' ? 'var(--amber-warm-dim)' : 'transparent', 
                  border: `1px solid ${repeat !== 'off' ? 'var(--amber-dim)' : 'transparent'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: repeat !== 'off' ? 'var(--amber)' : 'var(--text3)' 
                }}
              >
                {repeat === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN VIDEO OVERLAY MODAL */}
      {isFullscreen && currentMedia && isVideo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100dvh',
          backgroundColor: '#000',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Top Bar with Exit Control */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '12px 16px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10
          }}>
            <RotatingTitle 
              text={currentMedia.title || currentMedia.originalname || currentMedia.name || currentMedia.filename}
              style={{ color: '#fff', fontSize: '0.9rem', fontFamily: 'var(--mono)', maxWidth: '80%' }}
            />
            <button 
              onClick={() => setIsFullscreen(false)}
              style={{
                background: 'var(--red)',
                borderColor: 'var(--red-ember)',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontFamily: 'var(--mono)'
              }}
            >
              <Minimize2 size={14} /> EXIT FULLSCREEN
            </button>
          </div>

          <video
            src={currentMedia.url}
            autoPlay={isPlaying}
            controls
            playsInline
            style={{ width: '100vw', height: '100dvh', objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  );
};
