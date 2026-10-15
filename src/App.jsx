import React, { useState, useEffect } from 'react';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { HostDockView } from './components/HostDockView';
import { ClientControllerView } from './components/ClientControllerView';
import { GlobalAlarmRinger } from './components/GlobalAlarmRinger';
import { GlobalAudioEngine } from './components/GlobalAudioEngine';

const MainLayout = () => {
  const { deviceRole, setDeviceRole } = useDashboard();
  const [wakeLockActive, setWakeLockActive] = useState(false);

  // Check URL parameters for explicit role overrides (?role=dock or ?role=client or /dock or /client)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const roleParam = params.get('role');
      if (roleParam === 'dock' || roleParam === 'client') {
        setDeviceRole(roleParam);
      } else if (window.location.pathname === '/dock') {
        setDeviceRole('dock');
      } else if (window.location.pathname === '/client') {
        setDeviceRole('client');
      }
    } catch (e) {}
  }, []);

  // W3C Screen Wake Lock API - Keeps phone screen awake indefinitely when in Dock mode
  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && deviceRole === 'dock') {
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

    if (deviceRole === 'dock') {
      requestWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && deviceRole === 'dock') {
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
  }, [deviceRole]);

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      maxHeight: '100dvh',
      maxWidth: '100vw',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Global Background Audio Player (Continuous uninterrupted playback on Host Dock, silent on Client) */}
      <GlobalAudioEngine />

      {/* Global Ringing Alarm Sound & Modal Overlay (Loud takeover on Host Dock, subtle banner on Client) */}
      <GlobalAlarmRinger />

      {/* Conditional Rendering between Host Dock Station and Client Controller */}
      {deviceRole === 'dock' ? (
        <HostDockView />
      ) : (
        <ClientControllerView />
      )}
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
