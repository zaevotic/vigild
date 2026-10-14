import React, { useEffect, useRef } from 'react';
import { useDashboard, isMediaFile } from '../context/DashboardContext';

export const GlobalAudioEngine = () => {
  const { playbackState, sendPlaybackUpdate, playNextMedia, deviceRole } = useDashboard();
  const { currentMedia, isPlaying, currentTime } = playbackState;
  const audioRef = useRef(null);

  const isCurrentValid = isMediaFile(currentMedia);

  // Sync Audio Source & Play/Pause state (dock station only)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Remote client acts as silent controller - suppress local audio output
    if (deviceRole === 'client') {
      audio.pause();
      audio.src = '';
      return;
    }

    if (!currentMedia || !isCurrentValid) {
      audio.pause();
      audio.src = '';
      return;
    }

    // Change source if URL changed
    if (audio.src !== currentMedia.url && !audio.src.endsWith(currentMedia.url)) {
      audio.src = currentMedia.url;
      audio.load();
    }

    if (isPlaying) {
      audio.play().catch(err => {
        console.warn('[GlobalAudioEngine Play Autoplay Blocked]', err.message);
      });
    } else {
      audio.pause();
    }
  }, [currentMedia?.url, isPlaying, isCurrentValid, deviceRole]);

  // Sync seek time if user scrubs track (dock station only)
  useEffect(() => {
    if (deviceRole === 'client') return;
    const audio = audioRef.current;
    if (!audio || !isCurrentValid) return;

    if (Math.abs(audio.currentTime - currentTime) > 2) {
      audio.currentTime = currentTime;
    }
  }, [currentTime, isCurrentValid, deviceRole]);

  const handleTimeUpdate = () => {
    // Authoritative playback time comes only from the dock station actually playing audio
    if (deviceRole === 'client') return;
    const audio = audioRef.current;
    if (!audio) return;
    sendPlaybackUpdate({
      currentTime: audio.currentTime,
      duration: audio.duration || 0
    });
  };

  const handleEnded = () => {
    if (deviceRole === 'client') return;
    playNextMedia(true);
  };

  const handleError = (e) => {
    console.error('[GlobalAudioEngine Error]', e);
  };

  return (
    <audio
      ref={audioRef}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
      onError={handleError}
      preload="auto"
      style={{ display: 'none' }}
    />
  );
};
