import React, { useState, useEffect, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { Play, Pause, SkipBack, SkipForward, Maximize2, Minimize2, Video, Music, Disc, Youtube, ExternalLink, AlertCircle } from 'lucide-react';

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
    playNextMedia,
    playPrevMedia,
    sendPlaybackUpdate,
    media
  } = useDashboard();

  const { currentMedia, isPlaying, currentTime, duration } = playbackState;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [embedError, setEmbedError] = useState(false);
  
  const mediaRef = useRef(null);
  const iframeRef = useRef(null);

  const isYouTube = currentMedia?.type === 'youtube' || !!currentMedia?.videoId;
  const isVideo = !isYouTube && (currentMedia?.type === 'video' || (currentMedia?.filename && /\.(mp4|mkv|webm|mov|avi)$/i.test(currentMedia.filename)));
  const isAudio = !isYouTube && (currentMedia?.type === 'audio' || (currentMedia?.filename && /\.(mp3|wav|ogg|m4a|flac)$/i.test(currentMedia.filename)));

  // Reset embed error on media change
  useEffect(() => {
    setEmbedError(false);
  }, [currentMedia?.id, currentMedia?.videoId]);

  // Sync native HTML5 media element (for local vault files)
  useEffect(() => {
    if (isYouTube) return;
    const elem = mediaRef.current;
    if (!elem) return;

    if (isPlaying) {
      elem.play().catch(err => console.warn('[Playback autoplay blocked]', err));
    } else {
      elem.pause();
    }
  }, [isPlaying, currentMedia, isYouTube]);

  // Handle transport controls for YouTube iframe via postMessage
  useEffect(() => {
    if (!isYouTube || !iframeRef.current) return;
    try {
      const funcName = isPlaying ? 'playVideo' : 'pauseVideo';
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: funcName, args: [] }),
        '*'
      );
    } catch (e) {}
  }, [isPlaying, isYouTube]);

  const handleNativeTimeUpdate = () => {
    if (!mediaRef.current || isYouTube) return;
    const cur = mediaRef.current.currentTime;
    const dur = mediaRef.current.duration || 0;
    sendPlaybackUpdate({ currentTime: cur, duration: dur });
  };

  const handleEnded = () => {
    playNextMedia();
  };

  const handleSeek = (e) => {
    const targetTime = parseFloat(e.target.value);
    if (isYouTube && iframeRef.current) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'seekTo', args: [targetTime, true] }),
          '*'
        );
      } catch (err) {}
    } else if (mediaRef.current) {
      mediaRef.current.currentTime = targetTime;
    }
    seekPlayback(targetTime);
  };

  const youtubeUrl = isYouTube && currentMedia?.videoId
    ? `https://www.youtube.com/embed/${currentMedia.videoId}?enablejsapi=1&autoplay=1&start=${Math.floor(currentTime || 0)}`
    : '';

  return (
    <div className="panel-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '10px 12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {isYouTube ? (
            <Youtube size={16} style={{ color: '#ff0000', flexShrink: 0 }} />
          ) : isVideo ? (
            <Video size={16} style={{ color: 'var(--red-ember)', flexShrink: 0 }} />
          ) : (
            <Music size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          )}
          <h2 style={{ fontSize: '0.85rem', fontFamily: 'var(--mono)', textTransform: 'uppercase', color: 'var(--text)', whiteSpace: 'nowrap' }}>
            {isYouTube ? 'YOUTUBE DOCK STREAM' : 'NOW PLAYING'}
          </h2>
        </div>

        {(isVideo || isYouTube) && currentMedia && !embedError && (
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
      {!currentMedia ? (
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
          <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>Send YouTube video or select vault file</div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', justifyContent: 'space-between' }}>
          
          {/* YOUTUBE EMBED PLAYER BRANCH */}
          {isYouTube ? (
            embedError ? (
              <div style={{
                flex: 1,
                minHeight: 0,
                background: 'var(--bg2)',
                border: '1px solid var(--red-ember)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={28} style={{ color: 'var(--red-ember)' }} />
                <div style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: '600' }}>
                  This YouTube video cannot be embedded
                </div>
                <a 
                  href={`https://www.youtube.com/watch?v=${currentMedia.videoId}`}
                  target="_blank" 
                  rel="noreferrer"
                  className="btn-primary"
                  style={{ fontSize: '0.7rem', padding: '4px 10px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <ExternalLink size={12} /> OPEN ON YOUTUBE
                </a>
              </div>
            ) : (
              <div style={{ 
                flex: 1, 
                minHeight: 0, 
                width: '100%',
                background: '#000', 
                borderRadius: 'var(--radius-sm)', 
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '6px'
              }}>
                <iframe
                  ref={iframeRef}
                  src={youtubeUrl}
                  title={currentMedia.title || currentMedia.originalname}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onError={() => setEmbedError(true)}
                  style={{ width: '100%', height: '100%', border: 'none', objectFit: 'contain' }}
                />
              </div>
            )
          ) : isVideo ? (
            /* LOCAL VIDEO VAULT BRANCH */
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
                ref={mediaRef}
                src={currentMedia.url}
                onTimeUpdate={handleNativeTimeUpdate}
                onEnded={handleEnded}
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          ) : (
            /* LOCAL AUDIO VAULT BRANCH */
            <div style={{ 
              flex: 1, 
              minHeight: 0, 
              width: '100%',
              background: 'var(--bg2)', 
              borderRadius: 'var(--radius-sm)', 
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              border: '1px solid var(--border)',
              marginBottom: '6px'
            }}>
              <audio
                ref={mediaRef}
                src={currentMedia.url}
                onTimeUpdate={handleNativeTimeUpdate}
                onEnded={handleEnded}
              />
              <div style={{ 
                width: '42px', 
                height: '42px', 
                borderRadius: '50%', 
                background: isPlaying ? 'var(--red-mute)' : 'var(--bg3)',
                border: `1px solid ${isPlaying ? 'var(--red-ember)' : 'var(--border)'}`,
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Music size={20} style={{ color: isPlaying ? 'var(--red-ember)' : 'var(--text2)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <RotatingTitle 
                  text={currentMedia.originalname || currentMedia.filename}
                  style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}
                />
                <div style={{ fontSize: '0.68rem', color: 'var(--amber)', fontFamily: 'var(--mono)', marginTop: '2px' }}>
                  AUDIO VAULT FILE
                </div>
              </div>
            </div>
          )}

          {/* Title Banner */}
          <RotatingTitle 
            text={currentMedia.title || currentMedia.originalname || currentMedia.filename}
            style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}
          />

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

            {/* Transport Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <button 
                onClick={playPrevMedia} 
                title="Previous Track"
                disabled={!media || media.length === 0}
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
                onClick={playNextMedia} 
                title="Next Track"
                disabled={!media || media.length === 0}
                style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--text)' }}
              >
                <SkipForward size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN VIDEO OVERLAY MODAL */}
      {isFullscreen && currentMedia && (isVideo || isYouTube) && (
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
              text={currentMedia.title || currentMedia.originalname || currentMedia.filename}
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

          {/* Fullscreen Video / YouTube iFrame */}
          {isYouTube ? (
            <iframe
              src={youtubeUrl}
              title={currentMedia.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100vw', height: '100dvh', border: 'none' }}
            />
          ) : (
            <video
              src={currentMedia.url}
              autoPlay={isPlaying}
              controls
              playsInline
              style={{ width: '100vw', height: '100dvh', objectFit: 'contain' }}
            />
          )}
        </div>
      )}
    </div>
  );
};
