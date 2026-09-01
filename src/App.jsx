import React, { useState, useEffect, useRef } from 'react';
import { DashboardProvider } from './context/DashboardContext';
import { ClockHUD } from './components/ClockHUD';
import { AlarmCenter } from './components/AlarmCenter';
import { StorageMonitor } from './components/StorageMonitor';
import { StorageDirectoryPanel } from './components/StorageDirectoryPanel';
import { NowPlaying } from './components/NowPlaying';
import { PlaylistStock } from './components/PlaylistStock';
import { GlobalAlarmRinger } from './components/GlobalAlarmRinger';
import { GlobalAudioEngine } from './components/GlobalAudioEngine';
import { Clock, Bell, HardDrive, ListMusic, Zap } from 'lucide-react';

const TABS = ['all', 'clock', 'media', 'alarms', 'storage'];

const MainLayout = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const touchStartRef = useRef({ x: 0, y: 0, time: 0, isSlider: false });

  // Swipe gesture detection to switch tabs seamlessly
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    const target = e.target;
    // Don't trigger page swipe if user is dragging an audio seekbar slider
    const isSlider = target && (target.tagName === 'INPUT' && target.type === 'range');

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      isSlider
    };
  };

  const handleTouchEnd = (e) => {
    if (touchStartRef.current.isSlider) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const elapsedTime = Date.now() - touchStartRef.current.time;

    // Must be a predominantly horizontal swipe of at least 45px within 700ms
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3 && elapsedTime < 700) {
      const currentIndex = TABS.indexOf(activeTab);

      if (deltaX < 0) {
        // Swipe Left -> Next Tab
        if (currentIndex < TABS.length - 1) {
          setActiveTab(TABS[currentIndex + 1]);
        }
      } else {
        // Swipe Right -> Prev Tab
        if (currentIndex > 0) {
          setActiveTab(TABS[currentIndex - 1]);
        }
      }
    }
  };

  // W3C Screen Wake Lock API - Keeps phone screen awake indefinitely
  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          setWakeLockActive(true);

          wakeLock.addEventListener('release', () => {
            setWakeLockActive(false);
          });
        }
      } catch (err) {
        setWakeLockActive(false);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ 
        width: '100vw', 
        height: '100dvh', 
        maxHeight: '100dvh',
        display: 'flex', 
        flexDirection: 'column', 
        padding: '8px 10px', 
        overflow: 'hidden',
        boxSizing: 'border-box',
        touchAction: 'pan-y'
      }}
    >
      {/* Global Background Audio Player (Continuous uninterrupted playback across all tabs) */}
      <GlobalAudioEngine />

      {/* Global Ringing Alarm Sound & Modal Overlay (Active across all tabs) */}
      <GlobalAlarmRinger />

      {/* Compact Navbar Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        paddingBottom: '6px',
        marginBottom: '6px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        height: '36px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img 
            src="/vigild_app_icon.png" 
            alt="vigild" 
            style={{ 
              width: '26px', 
              height: '26px', 
              borderRadius: '5px', 
              objectFit: 'cover',
              boxShadow: 'var(--shadow-ember)',
              flexShrink: 0 
            }} 
          />
          <h1 className="font-display" style={{ fontSize: '1.2rem', letterSpacing: '1px', color: 'var(--text)', lineHeight: '1', whiteSpace: 'nowrap' }}>
            VIGI<span style={{ color: 'var(--red-ember)' }}>LD</span>
          </h1>

          {/* Screen Wake Lock Status Badge */}
          {wakeLockActive && (
            <span 
              className="badge font-mono" 
              style={{ 
                fontSize: '0.65rem', 
                background: 'var(--amber-warm-dim)', 
                color: 'var(--amber)', 
                borderColor: 'var(--amber-dim)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="Screen Wake Lock Active - Phone screen will not turn off or dim"
            >
              <Zap size={10} style={{ color: 'var(--amber)' }} /> AWAKE
            </span>
          )}
        </div>

        {/* Navigation Viewport Tabs */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button 
            className={activeTab === 'all' ? 'btn-primary' : ''} 
            onClick={() => setActiveTab('all')}
            style={{ fontSize: '0.7rem', padding: '3px 8px' }}
          >
            <Clock size={11} /> HUD
          </button>
          <button 
            className={activeTab === 'clock' ? 'btn-primary' : ''} 
            onClick={() => setActiveTab('clock')}
            style={{ fontSize: '0.7rem', padding: '3px 8px' }}
          >
            <Clock size={11} /> CLOCK
          </button>
          <button 
            className={activeTab === 'media' ? 'btn-primary' : ''} 
            onClick={() => setActiveTab('media')}
            style={{ fontSize: '0.7rem', padding: '3px 8px' }}
          >
            <ListMusic size={11} /> PLAYLISTS
          </button>
          <button 
            className={activeTab === 'alarms' ? 'btn-primary' : ''} 
            onClick={() => setActiveTab('alarms')}
            style={{ fontSize: '0.7rem', padding: '3px 8px' }}
          >
            <Bell size={11} /> ALARMS
          </button>
          <button 
            className={activeTab === 'storage' ? 'btn-primary' : ''} 
            onClick={() => setActiveTab('storage')}
            style={{ fontSize: '0.7rem', padding: '3px 8px' }}
          >
            <HardDrive size={11} /> STORAGE
          </button>
        </div>
      </header>

      {/* Main Viewport Container - Zero Page Overflow */}
      <main style={{ flex: 1, height: 'calc(100dvh - 50px)', minHeight: 0, width: '100%', overflow: 'hidden' }}>
        {activeTab === 'all' && (
          <div className="hud-layout">
            <div className="hud-col-main">
              <ClockHUD onEditAlarm={() => setActiveTab('alarms')} />
            </div>

            <div className="hud-col-side">
              <div style={{ flex: 1, minHeight: 0 }}>
                <NowPlaying />
              </div>
              <div style={{ flexShrink: 0, minHeight: 0 }}>
                <StorageMonitor onNavigateToStorage={() => setActiveTab('storage')} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clock' && (
          <div style={{ height: '100%', minHeight: 0 }}>
            <ClockHUD onEditAlarm={() => setActiveTab('alarms')} />
          </div>
        )}

        {activeTab === 'media' && (
          <div style={{ height: '100%', minHeight: 0 }}>
            <PlaylistStock />
          </div>
        )}

        {activeTab === 'alarms' && (
          <div style={{ height: '100%', minHeight: 0 }}>
            <AlarmCenter />
          </div>
        )}

        {activeTab === 'storage' && (
          <div style={{ height: '100%', minHeight: 0 }}>
            <StorageDirectoryPanel />
          </div>
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <DashboardProvider>
      <MainLayout />
    </DashboardProvider>
  );
}
