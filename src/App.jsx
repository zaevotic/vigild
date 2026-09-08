import React, { useState, useEffect, useRef } from 'react';
import { DashboardProvider } from './context/DashboardContext';
import { ClockHUD } from './components/ClockHUD';
import { AlarmCenter } from './components/AlarmCenter';
import { StorageMonitor } from './components/StorageMonitor';
import { StorageDirectoryPanel } from './components/StorageDirectoryPanel';
import { NowPlaying } from './components/NowPlaying';
import { PlaylistStock } from './components/PlaylistStock';
import { TaskCenter } from './components/TaskCenter';
import { GlobalAlarmRinger } from './components/GlobalAlarmRinger';
import { GlobalAudioEngine } from './components/GlobalAudioEngine';
import { Clock, Bell, HardDrive, Music, Target, Zap } from 'lucide-react';

const TABS = ['all', 'clock', 'media', 'tasks', 'alarms', 'storage'];

const MainLayout = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const touchStartRef = useRef({ x: 0, y: 0, time: 0, ignore: false });

  // Swipe gesture detection to switch tabs seamlessly without interfering with buttons or file uploads
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    const target = e.target;
    // Don't trigger page swipe if user touches interactive elements (buttons, inputs, labels, sliders, modals)
    const isInteractive = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'LABEL' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'TEXTAREA' ||
      target.closest('button') ||
      target.closest('label') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('form') ||
      target.closest('[role="dialog"]')
    );

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      ignore: !!isInteractive
    };
  };

  const handleTouchCancel = () => {
    touchStartRef.current = { x: 0, y: 0, time: 0, ignore: true };
  };

  const handleTouchEnd = (e) => {
    const start = touchStartRef.current;
    // Always reset touch ref immediately
    touchStartRef.current = { x: 0, y: 0, time: 0, ignore: true };

    if (!start || start.ignore || start.time === 0) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const elapsedTime = Date.now() - start.time;

    // Must be a deliberate horizontal swipe: between 60ms and 500ms, at least 50px offset
    if (elapsedTime > 60 && elapsedTime < 500 && Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
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
      onTouchCancel={handleTouchCancel}
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
            <Music size={11} /> MUSIC
          </button>
          <button 
            className={activeTab === 'tasks' ? 'btn-primary' : ''} 
            onClick={() => setActiveTab('tasks')}
            style={{ fontSize: '0.7rem', padding: '3px 8px' }}
          >
            <Target size={11} /> FOCUS
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

        {activeTab === 'tasks' && (
          <div style={{ height: '100%', minHeight: 0 }}>
            <TaskCenter />
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
