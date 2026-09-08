import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Calendar, 
  Tag, 
  Filter, 
  CheckCircle2, 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  Target, 
  Flame, 
  Volume2, 
  VolumeX, 
  Clock, 
  Zap
} from 'lucide-react';

const CATEGORIES = ['ALL', 'WORK', 'DEV', 'MEDIA', 'SETUP', 'PERSONAL'];
const PRIORITIES = ['ALL', 'HIGH', 'MEDIUM', 'LOW'];

const TIMER_MODES = {
  focus: { label: 'FOCUS', duration: 25 * 60, color: 'var(--amber)' },
  shortBreak: { label: 'SHORT BREAK', duration: 5 * 60, color: '#38bdf8' },
  longBreak: { label: 'LONG BREAK', duration: 15 * 60, color: '#4ade80' }
};

// Web Audio API Tactical Chime
const playChime = (type = 'focusEnd') => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    if (type === 'focusEnd') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        gain.gain.setValueAtTime(0.2, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.6);
      });
    } else {
      [880, 1174.66].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.15);
        gain.gain.setValueAtTime(0.2, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.5);
      });
    }
  } catch (e) {
    console.warn('[FocusChime] WebAudio error:', e);
  }
};

export const TaskCenter = () => {
  const { tasks, addTask, updateTask, toggleTask, deleteTask, clearCompletedTasks } = useDashboard();

  // --- FOCUS ENGINE STATE ---
  const [mode, setMode] = useState('focus'); // 'focus' | 'shortBreak' | 'longBreak'
  const [timeLeft, setTimeLeft] = useState(TIMER_MODES.focus.duration);
  const [isRunning, setIsRunning] = useState(false);
  const [cycleCount, setCycleCount] = useState(0); // Completed pomodoros (0 to 4)
  const [totalSessionsToday, setTotalSessionsToday] = useState(0);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // --- TASK MANAGEMENT STATE ---
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'COMPLETED'
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [quickInput, setQuickInput] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskCategory, setTaskCategory] = useState('WORK');
  const [taskDueDate, setTaskDueDate] = useState('');

  const [toastMsg, setToastMsg] = useState('');

  const timerRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // Switch Focus Mode
  const handleModeChange = (newMode) => {
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(TIMER_MODES[newMode].duration);
  };

  // Timer Tick Engine
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsRunning(false);

            if (soundEnabled) {
              playChime(mode === 'focus' ? 'focusEnd' : 'breakEnd');
            }

            if (mode === 'focus') {
              const newCycle = (cycleCount + 1) % 4;
              setCycleCount(newCycle);
              setTotalSessionsToday((s) => s + 1);
              showToast('Focus session complete! Take a break.');

              if (newCycle === 0) {
                setMode('longBreak');
                return TIMER_MODES.longBreak.duration;
              } else {
                setMode('shortBreak');
                return TIMER_MODES.shortBreak.duration;
              }
            } else {
              showToast('Break finished! Ready to focus?');
              setMode('focus');
              return TIMER_MODES.focus.duration;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isRunning, mode, cycleCount, soundEnabled]);

  // Format mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Active Target Task Object
  const activeTask = useMemo(() => {
    if (!activeTaskId || !tasks) return null;
    return tasks.find((t) => t.id === activeTaskId) || null;
  }, [activeTaskId, tasks]);

  // Reset Timer
  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(TIMER_MODES[mode].duration);
  };

  // Skip Timer
  const handleSkip = () => {
    setIsRunning(false);
    if (mode === 'focus') {
      const nextCycle = (cycleCount + 1) % 4;
      setCycleCount(nextCycle);
      if (nextCycle === 0) {
        handleModeChange('longBreak');
      } else {
        handleModeChange('shortBreak');
      }
    } else {
      handleModeChange('focus');
    }
  };

  // Quick Inline Add Task
  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!quickInput.trim()) return;

    await addTask({
      title: quickInput.trim(),
      description: '',
      priority: 'medium',
      category: categoryFilter !== 'ALL' ? categoryFilter : 'WORK',
      dueDate: ''
    });

    setQuickInput('');
    showToast('Objective logged');
  };

  // Modal Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    if (editingTask) {
      await updateTask(editingTask.id, {
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        priority: taskPriority,
        category: taskCategory.trim().toUpperCase(),
        dueDate: taskDueDate
      });
      showToast('Task updated');
    } else {
      await addTask({
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        priority: taskPriority,
        category: taskCategory.trim().toUpperCase(),
        dueDate: taskDueDate
      });
      showToast('Task created');
    }

    setShowModal(false);
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskPriority('medium');
    setTaskCategory('WORK');
    setTaskDueDate('');
    setShowModal(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setTaskTitle(task.title || '');
    setTaskDescription(task.description || '');
    setTaskPriority(task.priority || 'medium');
    setTaskCategory(task.category || 'WORK');
    setTaskDueDate(task.dueDate || '');
    setShowModal(true);
  };

  // Task Filter
  const filteredTasks = useMemo(() => {
    return (tasks || []).filter((task) => {
      if (statusFilter === 'PENDING' && task.completed) return false;
      if (statusFilter === 'COMPLETED' && !task.completed) return false;
      if (categoryFilter !== 'ALL' && (task.category || 'GENERAL').toUpperCase() !== categoryFilter) return false;
      if (priorityFilter !== 'ALL' && (task.priority || 'medium').toUpperCase() !== priorityFilter) return false;
      return true;
    });
  }, [tasks, statusFilter, categoryFilter, priorityFilter]);

  // Task Stats
  const stats = useMemo(() => {
    const total = (tasks || []).length;
    const completed = (tasks || []).filter((t) => t.completed).length;
    const pending = total - completed;
    const highPriority = (tasks || []).filter((t) => !t.completed && t.priority === 'high').length;
    return { total, completed, pending, highPriority };
  }, [tasks]);

  // Progress percentage
  const totalDuration = TIMER_MODES[mode].duration;
  const progressPercent = Math.min(100, Math.max(0, ((totalDuration - timeLeft) / totalDuration) * 100));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '6px 8px', gap: '6px' }}>
      
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '52px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          background: 'var(--bg1)',
          border: '1px solid var(--amber)',
          color: 'var(--amber)',
          boxShadow: 'var(--shadow-ember)',
          padding: '4px 12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.72rem',
          fontFamily: 'var(--mono)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          letterSpacing: '0.05em'
        }}>
          <Check size={12} /> {toastMsg}
        </div>
      )}

      {/* Main Responsive Grid Layout: Left Panel = Focus Engine, Right Panel = Task Matrix */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '1fr 1.05fr',
        gap: '8px',
        overflow: 'hidden'
      }}>

        {/* ======================================================== */}
        {/* LEFT PANEL: TACTICAL FOCUS & POMODORO CONTROL MATRIX     */}
        {/* ======================================================== */}
        <div className="panel-card" style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '10px 14px',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, var(--bg2) 0%, var(--bg1) 100%)',
          border: '1px solid var(--border)'
        }}>

          {/* Top Bar: Title & Audio Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Target size={15} style={{ color: 'var(--red-ember)' }} />
              <span style={{ fontSize: '0.82rem', fontFamily: 'var(--mono)', fontWeight: '700', textTransform: 'uppercase' }}>
                FOCUS CONTROL MATRIX
              </span>
            </div>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              style={{ background: 'transparent', border: 'none', color: soundEnabled ? 'var(--amber)' : 'var(--text3)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.62rem', fontFamily: 'var(--mono)' }}
              title={soundEnabled ? 'Chime Alert Enabled' : 'Chime Alert Muted'}
            >
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              <span style={{ fontSize: '0.58rem', color: soundEnabled ? 'var(--amber)' : 'var(--text3)' }}>
                {soundEnabled ? 'CHIME ON' : 'MUTED'}
              </span>
            </button>
          </div>

          {/* Active Target Banner */}
          <div style={{
            background: 'var(--bg)',
            border: `1px solid ${activeTask ? 'var(--red-ember)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)',
            padding: '5px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
              <Target size={13} style={{ color: activeTask ? 'var(--red-ember)' : 'var(--text3)', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.58rem', fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase' }}>
                  {activeTask ? 'CURRENT FOCUS TARGET' : 'NO TARGET LOCKED'}
                </div>
                <div style={{
                  fontSize: '0.74rem',
                  fontWeight: '700',
                  color: activeTask ? 'var(--text)' : 'var(--text3)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {activeTask ? activeTask.title : 'Select a task from right panel'}
                </div>
              </div>
            </div>

            {activeTask && (
              <button
                onClick={() => setActiveTaskId(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '2px' }}
                title="Clear Target"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Focus Mode Pill Selectors */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            padding: '3px',
            borderRadius: 'var(--radius-md)'
          }}>
            <button
              onClick={() => handleModeChange('focus')}
              className={mode === 'focus' ? 'btn-primary' : ''}
              style={{
                flex: 1,
                fontSize: '0.68rem',
                padding: '4px 6px',
                background: mode === 'focus' ? 'var(--red-ember)' : 'transparent',
                borderColor: mode === 'focus' ? 'var(--red-ember)' : 'transparent',
                color: mode === 'focus' ? '#fff' : 'var(--text2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <Zap size={11} /> FOCUS (25m)
            </button>

            <button
              onClick={() => handleModeChange('shortBreak')}
              className={mode === 'shortBreak' ? 'btn-primary' : ''}
              style={{
                flex: 1,
                fontSize: '0.68rem',
                padding: '4px 6px',
                background: mode === 'shortBreak' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                borderColor: mode === 'shortBreak' ? '#38bdf8' : 'transparent',
                color: mode === 'shortBreak' ? '#38bdf8' : 'var(--text2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <Clock size={11} /> SHORT (5m)
            </button>

            <button
              onClick={() => handleModeChange('longBreak')}
              className={mode === 'longBreak' ? 'btn-primary' : ''}
              style={{
                flex: 1,
                fontSize: '0.68rem',
                padding: '4px 6px',
                background: mode === 'longBreak' ? 'rgba(74, 222, 128, 0.2)' : 'transparent',
                borderColor: mode === 'longBreak' ? '#4ade80' : 'transparent',
                color: mode === 'longBreak' ? '#4ade80' : 'var(--text2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <Clock size={11} /> LONG (15m)
            </button>
          </div>

          {/* Big Digital Monospace Countdown Display */}
          <div style={{ textAlign: 'center', position: 'relative', margin: '2px 0' }}>
            {/* Cycle indicator dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
              {[0, 1, 2, 3].map((idx) => {
                const filled = idx < cycleCount;
                return (
                  <span
                    key={idx}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: filled ? 'var(--amber)' : 'var(--bg)',
                      border: `1.5px solid ${filled ? 'var(--amber)' : 'var(--border2)'}`,
                      boxShadow: filled ? '0 0 8px rgba(196, 124, 46, 0.6)' : 'none',
                      display: 'inline-block'
                    }}
                    title={`Pomodoro Cycle ${idx + 1}/4`}
                  />
                );
              })}
            </div>

            {/* Countdown Digits */}
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: '3.4rem',
              fontWeight: '900',
              lineHeight: '1',
              letterSpacing: '0.04em',
              color: mode === 'focus' ? 'var(--amber)' : mode === 'shortBreak' ? '#38bdf8' : '#4ade80',
              textShadow: mode === 'focus' ? '0 0 16px rgba(196, 124, 46, 0.4)' : '0 0 16px rgba(56, 189, 248, 0.4)',
              userSelect: 'none'
            }}>
              {formatTime(timeLeft)}
            </div>

            {/* Tactical Progress Bar */}
            <div style={{
              width: '80%',
              height: '4px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '2px',
              margin: '6px auto 0 auto',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: mode === 'focus' ? 'var(--red-ember)' : mode === 'shortBreak' ? '#38bdf8' : '#4ade80',
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>

          {/* Timer Action Controls & Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setIsRunning(!isRunning)}
                className="btn-primary"
                style={{
                  fontSize: '0.85rem',
                  padding: '6px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  minWidth: '130px',
                  justifyContent: 'center',
                  boxShadow: isRunning ? 'var(--shadow-ember)' : 'none'
                }}
              >
                {isRunning ? (
                  <>
                    <Pause size={14} /> PAUSE
                  </>
                ) : (
                  <>
                    <Play size={14} /> START
                  </>
                )}
              </button>

              <button
                onClick={handleReset}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text2)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem'
                }}
                title="Reset Timer"
              >
                <RotateCcw size={12} />
              </button>

              <button
                onClick={handleSkip}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text2)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem'
                }}
                title="Skip Session"
              >
                <SkipForward size={12} />
              </button>
            </div>

            {/* Streak & Metrics Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--border)',
              paddingTop: '6px',
              fontSize: '0.62rem',
              fontFamily: 'var(--mono)',
              color: 'var(--text3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Flame size={12} style={{ color: 'var(--amber)' }} />
                <span>TODAY: <strong style={{ color: 'var(--text)' }}>{totalSessionsToday}</strong> SESSIONS</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={11} />
                <span>CYCLE: <strong style={{ color: 'var(--text)' }}>{cycleCount + 1}/4</strong></span>
              </div>
            </div>
          </div>

        </div>

        {/* ======================================================== */}
        {/* RIGHT PANEL: TACTICAL TASK MATRIX & OBJECTIVES LIST      */}
        {/* ======================================================== */}
        <div className="panel-card" style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '10px 12px',
          background: 'var(--bg1)',
          border: '1px solid var(--border)'
        }}>

          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexShrink: 0, gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckSquare size={15} style={{ color: 'var(--red-ember)' }} />
              <span style={{ fontSize: '0.82rem', fontFamily: 'var(--mono)', fontWeight: '700', textTransform: 'uppercase' }}>
                OBJECTIVE MATRIX
              </span>
            </div>

            {/* Stats Badges */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span className="badge font-mono" style={{ fontSize: '0.58rem', background: 'var(--bg3)', color: 'var(--text)' }}>
                {stats.total} TOTAL
              </span>
              <span className="badge badge-amber font-mono" style={{ fontSize: '0.58rem' }}>
                {stats.pending} PENDING
              </span>
              <span className="badge badge-ember font-mono" style={{ fontSize: '0.58rem' }}>
                {stats.completed} DONE
              </span>
            </div>
          </div>

          {/* Fast Quick-Add Input (Flocus-style single input bar) */}
          <form onSubmit={handleQuickAdd} style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexShrink: 0 }}>
            <input
              type="text"
              placeholder="Type your priority objective & press Enter..."
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontFamily: 'var(--mono)',
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)'
              }}
            />
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '4px 8px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '2px' }}
              title="Add Objective"
            >
              <Plus size={12} /> ADD
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              style={{
                padding: '4px 6px',
                fontSize: '0.62rem',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                color: 'var(--text2)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer'
              }}
              title="Detailed Objective Modal"
            >
              DETAILS
            </button>
          </form>

          {/* Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexShrink: 0, gap: '4px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
              {/* Status Filter */}
              <div style={{ display: 'flex', gap: '1px', background: 'var(--bg)', border: '1px solid var(--border)', padding: '1px', borderRadius: 'var(--radius-sm)' }}>
                {['ALL', 'PENDING', 'COMPLETED'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={statusFilter === status ? 'btn-primary' : ''}
                    style={{ padding: '1px 5px', fontSize: '0.58rem' }}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Category Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1px 3px' }}>
                <Tag size={8} style={{ color: 'var(--text3)' }} />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: '0.58rem', cursor: 'pointer', outline: 'none' }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Priority Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1px 3px' }}>
                <Filter size={8} style={{ color: 'var(--text3)' }} />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: '0.58rem', cursor: 'pointer', outline: 'none' }}
                >
                  {PRIORITIES.map((pri) => (
                    <option key={pri} value={pri}>{pri === 'ALL' ? 'PRIORITY' : pri}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Clear Done */}
            {stats.completed > 0 && (
              <button
                onClick={() => { clearCompletedTasks(); showToast('Completed tasks purged'); }}
                style={{ padding: '1px 5px', fontSize: '0.58rem', color: 'var(--text3)', background: 'transparent', border: '1px solid var(--border)' }}
                title="Clear Completed Tasks"
              >
                CLEAR DONE
              </button>
            )}
          </div>

          {/* Scrollable Task List Items */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px', paddingRight: '2px' }}>
            {filteredTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: '0.68rem', margin: 'auto 0' }}>
                <CheckCircle2 size={20} style={{ color: 'var(--text3)', opacity: 0.4, marginBottom: '4px' }} />
                <div>No objectives matching filter.</div>
                <div style={{ fontSize: '0.6rem', marginTop: '2px' }}>Type above & press Enter to create</div>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isCompleted = !!task.completed;
                const isHigh = task.priority === 'high';
                const isMed = task.priority === 'medium';
                const isCurrentFocus = activeTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    style={{
                      background: isCurrentFocus ? 'rgba(217, 68, 50, 0.12)' : isCompleted ? 'var(--bg)' : 'var(--bg2)',
                      border: `1px solid ${isCurrentFocus ? 'var(--red-ember)' : isHigh && !isCompleted ? 'var(--red-ember)' : isCompleted ? 'var(--border)' : 'var(--border2)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '5px',
                      opacity: isCompleted ? 0.55 : 1,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Left: Checkbox & Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, minWidth: 0 }}>
                      <button
                        onClick={() => toggleTask(task.id)}
                        style={{ background: 'transparent', border: 'none', padding: '1px', cursor: 'pointer', color: isCompleted ? 'var(--red-ember)' : 'var(--text2)', display: 'flex', alignItems: 'center' }}
                      >
                        {isCompleted ? <CheckSquare size={13} style={{ color: 'var(--red-ember)' }} /> : <Square size={13} />}
                      </button>

                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div style={{
                          fontSize: '0.72rem',
                          fontWeight: isCompleted ? 'normal' : '700',
                          color: isCompleted ? 'var(--text3)' : isHigh ? 'var(--red-ember)' : 'var(--text)',
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {task.title}
                        </div>

                        {task.description && (
                          <div style={{
                            fontSize: '0.58rem',
                            color: 'var(--text3)',
                            fontFamily: 'var(--mono)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {task.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Badges, Focus Button & Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                      {/* Category Badge */}
                      <span className="badge font-mono" style={{ fontSize: '0.52rem', padding: '1px 3px', background: 'var(--bg3)', color: 'var(--text2)' }}>
                        {task.category || 'WORK'}
                      </span>

                      {/* Priority Badge */}
                      <span className={`badge font-mono ${isHigh ? 'badge-ember' : isMed ? 'badge-amber' : ''}`} style={{ fontSize: '0.52rem', padding: '1px 3px' }}>
                        {task.priority ? task.priority.toUpperCase() : 'MED'}
                      </span>

                      {/* Lock Focus Target Button */}
                      {!isCompleted && (
                        <button
                          onClick={() => {
                            setActiveTaskId(isCurrentFocus ? null : task.id);
                            if (!isCurrentFocus) showToast(`Target locked: ${task.title}`);
                          }}
                          style={{
                            padding: '2px 4px',
                            background: isCurrentFocus ? 'var(--red-ember)' : 'var(--bg3)',
                            border: `1px solid ${isCurrentFocus ? 'var(--red-ember)' : 'var(--border)'}`,
                            color: isCurrentFocus ? '#fff' : 'var(--text2)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            fontSize: '0.55rem',
                            fontFamily: 'var(--mono)'
                          }}
                          title={isCurrentFocus ? 'Unlock focus target' : 'Focus on this objective'}
                        >
                          <Target size={9} /> {isCurrentFocus ? 'LOCKED' : 'FOCUS'}
                        </button>
                      )}

                      {/* Edit Button */}
                      <button
                        onClick={() => openEditModal(task)}
                        style={{ padding: '1px 2px', background: 'transparent', border: 'none', color: 'var(--text2)', cursor: 'pointer' }}
                        title="Edit Objective"
                      >
                        <Edit3 size={10} />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => {
                          if (activeTaskId === task.id) setActiveTaskId(null);
                          deleteTask(task.id);
                        }}
                        style={{ padding: '1px 2px', background: 'transparent', border: 'none', color: 'var(--red-ember)', cursor: 'pointer' }}
                        title="Delete Objective"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>

      {/* ======================================================== */}
      {/* DETAILED CREATE / EDIT TASK MODAL                        */}
      {/* ======================================================== */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
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
              border: '1px solid var(--red-ember)',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '0.85rem', fontFamily: 'var(--mono)', fontWeight: '700', color: 'var(--text)' }}>
                {editingTask ? 'EDIT TASK OBJECTIVE' : 'NEW TASK OBJECTIVE'}
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text2)', padding: '2px' }}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Task Title */}
              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text2)', marginBottom: '2px' }}>TASK TITLE</label>
                <input
                  type="text"
                  placeholder="e.g. Finish client dashboard update"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  style={{ width: '100%', padding: '6px', fontSize: '0.78rem' }}
                  required
                />
              </div>

              {/* Task Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text2)', marginBottom: '2px' }}>DESCRIPTION (OPTIONAL)</label>
                <textarea
                  placeholder="Key deliverables, steps or notes..."
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '6px', fontSize: '0.72rem', resize: 'none' }}
                />
              </div>

              {/* Priority & Category Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text2)', marginBottom: '2px' }}>PRIORITY</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    style={{ width: '100%', padding: '5px', fontSize: '0.72rem' }}
                  >
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH (URGENT)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text2)', marginBottom: '2px' }}>CATEGORY</label>
                  <select
                    value={taskCategory}
                    onChange={(e) => setTaskCategory(e.target.value)}
                    style={{ width: '100%', padding: '5px', fontSize: '0.72rem' }}
                  >
                    {CATEGORIES.filter((c) => c !== 'ALL').map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text2)', marginBottom: '2px' }}>DUE DATE (OPTIONAL)</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  style={{ width: '100%', padding: '5px', fontSize: '0.72rem' }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '4px 10px', fontSize: '0.72rem' }}>
                  CANCEL
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '4px 14px', fontSize: '0.72rem' }}>
                  {editingTask ? 'SAVE CHANGES' : 'CREATE TASK'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

