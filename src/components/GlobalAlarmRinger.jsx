import React, { useEffect, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { AlertTriangle } from 'lucide-react';

export const GlobalAlarmRinger = () => {
  const { activeAlarm, snoozeAlarm, dismissAlarm } = useDashboard();
  const audioCtxRef = useRef(null);
  const synthTimerRef = useRef(null);
  const audioFileRef = useRef(null);

  // Audio tone player handler when alarm triggers globally
  useEffect(() => {
    if (activeAlarm) {
      startAlarmPlayback();
    } else {
      stopAlarmPlayback();
    }
    return () => stopAlarmPlayback();
  }, [activeAlarm]);

  const startAlarmPlayback = () => {
    if (audioFileRef.current) {
      audioFileRef.current.currentTime = 0;
      audioFileRef.current.play().catch(err => {
        console.warn('[Global Alarm] Audio Playback Blocked/Failed, using synth fallback:', err);
        startSynthAlarmSound();
      });
    } else {
      startSynthAlarmSound();
    }
  };

  const stopAlarmPlayback = () => {
    if (audioFileRef.current) {
      audioFileRef.current.pause();
      audioFileRef.current.currentTime = 0;
    }
    stopSynthAlarmSound();
  };

  const startSynthAlarmSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      let step = 0;
      if (!synthTimerRef.current) {
        synthTimerRef.current = setInterval(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = step % 2 === 0 ? 'square' : 'sawtooth';
          osc.frequency.setValueAtTime(step % 2 === 0 ? 880 : 1320, ctx.currentTime);
          
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
          step++;
        }, 500);
      }
    } catch (e) {
      console.error('[WebAudio Synth Error]', e);
    }
  };

  const stopSynthAlarmSound = () => {
    if (synthTimerRef.current) {
      clearInterval(synthTimerRef.current);
      synthTimerRef.current = null;
    }
  };

  if (!activeAlarm) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(10, 9, 8, 0.95)',
      backdropFilter: 'blur(6px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      {/* HTML5 Audio Player for Alarm Tone File */}
      <audio 
        ref={audioFileRef} 
        src={activeAlarm.toneUrl || '/uploads/tones/default_cyber_alarm.wav'} 
        loop 
        preload="auto"
      />

      <div 
        className="alarm-ringing-overlay"
        style={{
          width: '100%',
          maxWidth: '440px',
          borderRadius: 'var(--radius-lg)',
          border: '2px solid var(--red-ember)',
          padding: '32px 20px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-ember)',
          background: 'var(--bg1)'
        }}
      >
        <AlertTriangle size={56} style={{ color: '#fff', marginBottom: '12px' }} />
        <h1 style={{ fontSize: '3rem', fontFamily: 'var(--mono)', fontWeight: '900', color: '#fff', margin: '8px 0' }}>
          {activeAlarm.time}
        </h1>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--text)', marginBottom: '8px' }}>
          {activeAlarm.label || 'SCHEDULED ALARM'}
        </h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--amber)', fontFamily: 'var(--mono)', marginBottom: '24px' }}>
          SOUND TONE: {activeAlarm.tone || 'Cyber Alarm'}
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button 
            onClick={snoozeAlarm} 
            className="btn-amber"
            style={{ padding: '12px 20px', fontSize: '1rem', fontWeight: '700' }}
          >
            SNOOZE (5M)
          </button>
          <button 
            onClick={dismissAlarm} 
            className="btn-primary"
            style={{ padding: '12px 20px', fontSize: '1rem', fontWeight: '700' }}
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
