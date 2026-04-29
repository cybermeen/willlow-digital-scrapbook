import React, { useState, useEffect, useCallback, useRef } from 'react';
import './ToDo.css';

const API_URL = '/api/todo';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  const [datePart] = dateStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDueDate(dateStr) {
  const d = parseDateOnly(dateStr);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

function formatCompletedAt(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toInputDate(dateStr) {
  const d = parseDateOnly(dateStr);
  return d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : '';
}

function priorityStyle(priority) {
  switch ((priority || '').toLowerCase()) {
    case 'high':   return { bg: '#fdecea', color: '#c0392b' };
    case 'medium': return { bg: '#fef3e2', color: '#d4820a' };
    case 'low':    return { bg: '#eaf6ee', color: '#27ae60' };
    default:       return { bg: '#f0f0f0', color: '#999' };
  }
}

// ─── Streak messages per day count ───────────────────────────────────────────

const STREAK_MESSAGES = [
  { text: "Log your tasks and start your streak!", emoji: "🌱" },
  { text: "Day 1 done! The journey begins!",       emoji: "🌿" },
  { text: "2 days strong — you're warming up!",    emoji: "💪" },
  { text: "3 days! You're building real momentum!", emoji: "🔥" },
  { text: "4 days in — this is becoming a habit!", emoji: "⚡" },
  { text: "5 days! You're almost unstoppable!",    emoji: "🌟" },
  { text: "ONE more day for the big reward!",      emoji: "🎯" },
  { text: "PERFECT WEEK! Claim your reward!",      emoji: "🏆" },
];

// ─── Celebration Modal ────────────────────────────────────────────────────────

function StreakCelebrationModal({ onClaimReward, onDismiss }) {
  const CONFETTI_COLORS = [
    '#ff6b6b','#ffd93d','#6bcb77','#4d96ff',
    '#ff6ec7','#c77dff','#ff9f43','#fff176',
    '#80cbc4','#ffab40',
  ];

  // Pre-generate deterministic confetti pieces
  const pieces = Array.from({ length: 55 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${(i * 1.85) % 100}%`,
    delay: `${((i * 0.09) % 3).toFixed(2)}s`,
    duration: `${(2.4 + (i * 0.13) % 2.2).toFixed(2)}s`,
    size: `${9 + (i * 3) % 9}px`,
    angle: `${(i * 41) % 360}deg`,
    drift: `${-70 + (i * 11) % 140}px`,
    shape: i % 3 === 0 ? 'circle' : i % 3 === 1 ? 'rect' : 'diamond',
  }));

  // Firework burst positions (scattered around the modal)
  const bursts = [
    { top: '10%', left: '8%'  },
    { top: '6%',  left: '30%' },
    { top: '12%', left: '55%' },
    { top: '8%',  left: '78%' },
    { top: '22%', left: '92%' },
    { top: '75%', left: '5%'  },
    { top: '80%', left: '88%' },
    { top: '50%', left: '96%' },
  ];

  return (
    <div className="celebration-overlay" onClick={e => e.target === e.currentTarget && onDismiss()}>
      {/* Confetti rain */}
      {pieces.map(p => (
        <div
          key={p.id}
          className={`confetti-piece confetti-piece--${p.shape}`}
          style={{
            '--color':    p.color,
            '--left':     p.left,
            '--delay':    p.delay,
            '--duration': p.duration,
            '--size':     p.size,
            '--angle':    p.angle,
            '--drift':    p.drift,
          }}
        />
      ))}

      {/* Firework bursts */}
      {bursts.map((pos, i) => (
        <div
          key={i}
          className="firework-burst"
          style={{ top: pos.top, left: pos.left, '--delay': `${(i * 0.28).toFixed(2)}s` }}
        >
          {['✨','🌟','⭐','💥','✦'].map((s, j) => (
            <span key={j} className="firework-spark" style={{ '--angle': `${j * 72}deg`, '--i': j }}>{s}</span>
          ))}
        </div>
      ))}

      {/* Modal card */}
      <div className="celebration-card">
        {/* Animated trophy row */}
        <div className="celebration-trophies">
          <span className="celeb-trophy celeb-trophy--left">🌟</span>
          <span className="celeb-trophy celeb-trophy--center">🏆</span>
          <span className="celeb-trophy celeb-trophy--right">🌟</span>
        </div>

        <h1 className="celebration-title">Perfect Week!</h1>
        <div className="celebration-streak-badge">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} className="celeb-leaf" style={{ animationDelay: `${i * 0.1}s` }}>🍃</span>
          ))}
        </div>
        <p className="celebration-subtitle">
          You completed <strong>every single task</strong> for 7 days straight.
          <br />You're absolutely legendary! 🔥
        </p>

        {/* Sticker reward preview */}
        <div className="celebration-reward-preview">
          <p className="celebration-reward-label">Your reward is waiting in the Day Log ✨</p>
          <div className="celebration-sticker-row">
            {['🌟','⚡','🦋','🎉','🌈','🏆','💫'].map((s, i) => (
              <span
                key={i}
                className="celebration-sticker"
                style={{ '--i': i, animationDelay: `${0.6 + i * 0.08}s` }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <button className="celebration-claim-btn" onClick={onClaimReward}>
          🎁 Claim Your Reward
        </button>
        <button className="celebration-later-btn" onClick={onDismiss}>
          I'll claim it later
        </button>
      </div>
    </div>
  );
}

// ─── Streak Widget ────────────────────────────────────────────────────────────

function StreakWidget({ lastUpdated, onClaimReward, onTestModeChange }) {
  const [realStreak, setRealStreak] = useState(null);
  const [testStreak, setTestStreak]   = useState(null); // null = use real data
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const prevUnlockedRef = useRef(false);

  // Fetch real streak data
  useEffect(() => {
    fetch('/api/progress/streak', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        // Only auto-trigger celebration when real streak transitions to unlocked
        if (data.rewardsUnlocked && !prevUnlockedRef.current) {
          setShowCelebration(true);
        }
        prevUnlockedRef.current = data.rewardsUnlocked;
        setRealStreak(data);
      })
      .catch(() => {});
  }, [lastUpdated]);

  // The displayed streak — test overrides real for UI/testing only
  const displayCount   = testStreak !== null ? testStreak : (realStreak?.currentStreak || 0);
  const displayUnlocked = displayCount >= 7;
  const msg = STREAK_MESSAGES[Math.min(displayCount, 7)];

  // Test button handler — only affects UI, never touches the API
  // Update handleTestStreak to call the new prop:
  const handleTestStreak = (n) => {
    setTestStreak(n);
    if (onTestModeChange) onTestModeChange(n >= 7);   // ← ADD THIS LINE
    if (n >= 7) {
      setShowCelebration(true);
    } else {
      setShowCelebration(false);
    }
  };

  const handleClaimClick = () => {
    setShowCelebration(false);
    if (onClaimReward) onClaimReward();
  };

  return (
    <>
      {/* ── Full-screen Celebration Modal ── */}
      {showCelebration && (
        <StreakCelebrationModal
          onClaimReward={handleClaimClick}
          onDismiss={() => setShowCelebration(false)}
        />
      )}

      {/* ── Compact Centered Widget ── */}
      <div className="streak-widget-wrap">
        <div className={`streak-widget ${displayUnlocked ? 'streak-widget--unlocked' : ''}`}>

          {/* Title row */}
          <div className="streak-widget-header">
            <span className={`streak-fire ${displayUnlocked ? 'streak-fire--lit' : ''}`}>
              {displayUnlocked ? '🔥' : '🕯️'}
            </span>
            <span className="streak-day-count">{displayCount}</span>
            <span className="streak-day-label">/ 7 day streak</span>
          </div>

          {/* 7 leaf counters */}
          <div className="streak-leaves">
            {Array.from({ length: 7 }).map((_, i) => {
              const filled = i < displayCount;
              const isCurrent = i === displayCount - 1 && displayCount > 0 && displayCount <= 7;
              return (
                <div
                  key={i}
                  className={`streak-leaf${filled ? ' streak-leaf--filled' : ''}${isCurrent ? ' streak-leaf--latest' : ''}`}
                  title={`Day ${i + 1}${filled ? ' ✓' : ''}`}
                >
                  {filled ? '🍃' : <span className="streak-leaf-inner" />}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="streak-bar-track">
            <div className="streak-bar-fill" style={{ width: `${(displayCount / 7) * 100}%` }} />
          </div>

          {/* Motivational message */}
          <p className={`streak-motivation ${displayUnlocked ? 'streak-motivation--unlocked' : ''}`}>
            {msg.emoji} {msg.text}
          </p>

          {/* Unlocked reward teaser */}
          {displayUnlocked && (
            <button className="streak-reward-teaser" onClick={handleClaimClick}>
              🎁 Tap to claim your reward!
            </button>
          )}
        </div>

        {/* ── Test Panel (development only) ── */}
        <div className="streak-test-panel">
          <button
            className="streak-test-toggle"
            onClick={() => setShowTestPanel(p => !p)}
            title="Toggle test controls — for development only"
          >
            🧪 {showTestPanel ? 'Hide' : 'Test'}
          </button>

          {showTestPanel && (
            <div className="streak-test-controls">
              <span className="streak-test-label">Simulate streak day:</span>
              <div className="streak-test-btns">
                {[0, 1, 2, 3, 4, 5, 6, 7].map(n => (
                  <button
                    key={n}
                    className={`streak-test-btn ${testStreak === n ? 'streak-test-btn--active' : ''}`}
                    onClick={() => handleTestStreak(n)}
                    title={n === 7 ? 'Triggers celebration popup' : `Show ${n}-day streak`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {testStreak !== null && (
                <button className="streak-test-reset" onClick={() => { setTestStreak(null); setShowCelebration(false); 
                  if (onTestModeChange) onTestModeChange(false);
                }}>
                  ↩ Back to real data
                </button>
              )}
              {testStreak !== null && (
                <span className="streak-test-notice">⚠️ Test mode — real streak unchanged</span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Task Modal (Add / Edit) ──────────────────────────────────────────────────

function TaskModal({ mode, task, onClose, onSave }) {
  const [title, setTitle]       = useState(task?.title || '');
  const [dueDate, setDueDate]   = useState(task?.due_date ? toInputDate(task.due_date) : '');
  const [priority, setPriority] = useState(task?.priority || 'Medium');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('Task title is required.'); return; }
    if (!dueDate)       { setError('Due date is required.'); return; }
    setError('');
    setLoading(true);
    await onSave({ title: title.trim(), due_date: dueDate, priority });
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3>{mode === 'add' ? 'Add New Task' : 'Edit Task'}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label htmlFor="task-title">Task Title <span className="required">*</span></label>
            <input id="task-title" type="text" placeholder="What do you want to accomplish?"
              value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="modal-field">
            <label htmlFor="task-due">Due Date <span className="required">*</span></label>
            <input id="task-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div className="modal-field">
            <label htmlFor="task-priority">Priority</label>
            <select id="task-priority" value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          {error && <div className="modal-error" role="alert">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save" disabled={loading}>
              {loading
                ? <span className="btn-loading"><span className="spinner" /> Saving…</span>
                : mode === 'add' ? '+ Add Task' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onToggle, onDelete, onEdit }) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ps = priorityStyle(task.priority);

  const handleToggle = async (e) => {
    e.stopPropagation();
    setToggling(true);
    await onToggle(task.id);
    setToggling(false);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    setDeleting(true);
    await onDelete(task.id);
  };

  return (
    <div className={`task-card ${deleting ? 'task-card--deleting' : ''}`}
      onClick={() => onEdit(task)} title="Click to edit">
      <button
        className={`task-check ${toggling ? 'task-check--loading' : ''} ${task.status === 'completed' ? 'task-check--done' : ''}`}
        onClick={handleToggle} disabled={toggling}
        aria-label={task.status === 'completed' ? 'Mark as pending' : 'Mark as complete'}
      >
        {task.status === 'completed' && '✓'}
      </button>
      <div className="task-body">
        <span className="task-title">{task.title}</span>
        {task.due_date && <span className="task-due">📅 {formatDueDate(task.due_date)}</span>}
      </div>
      {task.priority && (
        <span className="task-priority" style={{ background: ps.bg, color: ps.color }}>
          {task.priority}
        </span>
      )}
      <button className="task-delete" onClick={handleDelete} disabled={deleting} aria-label="Delete task">
        {deleting ? '…' : '✕'}
      </button>
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function TaskColumn({ title, tasks, onToggle, onDelete, onEdit }) {
  return (
    <div className="task-column">
      <div className="column-header">
        <h3 className="column-title">{title}</h3>
        {tasks.length > 0 && <span className="column-count">{tasks.length}</span>}
      </div>
      <div className="column-body">
        {tasks.length === 0
          ? <p className="column-empty">No tasks yet</p>
          : tasks.map(t => (
              <TaskCard key={t.id} task={t}
                onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
            ))
        }
      </div>
    </div>
  );
}

// ─── Completed Section ────────────────────────────────────────────────────────

function CompletedSection({ tasks, onToggle, onDelete }) {
  return (
    <div className="completed-section">
      <h2 className="completed-title">Completed Tasks</h2>
      {tasks.length === 0 ? (
        <p className="completed-empty">No recently completed tasks. Complete a task to see it here!</p>
      ) : (
        <>
          <p className="completed-subtitle">
            Showing your {tasks.length} most recently completed task{tasks.length !== 1 ? 's' : ''}
          </p>
          <div className="completed-list">
            {tasks.map(task => {
              const ps = priorityStyle(task.priority);
              return (
                <div key={task.id} className="completed-card">
                  <button className="task-check task-check--done"
                    onClick={() => onToggle(task.id)} aria-label="Mark as pending">✓</button>
                  <div className="task-body">
                    <span className="task-title task-title--done">{task.title}</span>
                    <span className="task-due completed-at">✅ Completed {formatCompletedAt(task.completed_at)}</span>
                    {task.due_date && <span className="task-due">due {formatDueDate(task.due_date)}</span>}
                  </div>
                  {task.priority && (
                    <span className="task-priority" style={{ background: ps.bg, color: ps.color }}>
                      {task.priority}
                    </span>
                  )}
                  <button className="task-delete" onClick={() => onDelete(task.id)} aria-label="Delete task">✕</button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function ToDo({ onTaskChange, lastUpdated, onClaimReward, onTestModeChange }) {
  const [tasks, setTasks]     = useState({ today: [], thisWeek: [], upcoming: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [modal, setModal]     = useState(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(API_URL, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      setTasks(await res.json());
    } catch {
      setError('Could not load tasks. Is the server running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks, lastUpdated]);

  const handleAdd = async ({ title, due_date, priority }) => {
    try {
      const res = await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ title, due_date, priority }),
      });
      if (!res.ok) throw new Error();
      setModal(null);
      await fetchTasks();
      if (onTaskChange) onTaskChange();
    } catch { setError('Could not create task.'); }
  };

  const handleEdit = async ({ title, due_date, priority }) => {
    try {
      const res = await fetch(`${API_URL}/${modal.task.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ title, due_date, priority }),
      });
      if (!res.ok) throw new Error();
      setModal(null);
      await fetchTasks();
      if (onTaskChange) onTaskChange();
    } catch { setError('Could not update task.'); }
  };

  const handleToggle = async (id) => {
    try {
      const res = await fetch(`${API_URL}/${id}/toggle`, { method: 'PATCH', credentials: 'include' });
      if (!res.ok) throw new Error();
      await fetchTasks();
      if (onTaskChange) onTaskChange();
    } catch { setError('Could not update task.'); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error();
      await fetchTasks();
      if (onTaskChange) onTaskChange();
    } catch { setError('Could not delete task.'); }
  };

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const activeCount = tasks.today.length + tasks.thisWeek.length + tasks.upcoming.length;

  if (loading) {
    return (
      <div className="todo-loading">
        <span className="loading-leaf">🌿</span>
        <p>Loading your tasks…</p>
      </div>
    );
  }

  return (
    <div className="todo">
      <div className="todo-header">
        <div>
          <h1 className="todo-title">To-Do List</h1>
          <p className="todo-date">{dateLabel} 🌸</p>
        </div>
        {activeCount > 0 && (
          <span className="todo-summary">{activeCount} task{activeCount !== 1 ? 's' : ''} remaining</span>
        )}
      </div>

      {/* Streak widget — centered, compact */}
      <StreakWidget lastUpdated={lastUpdated} onClaimReward={onClaimReward} onTestModeChange={onTestModeChange} />

      {error && (
        <div className="todo-error" role="alert">
          {error}
          <button onClick={() => setError('')} aria-label="Dismiss">✕</button>
        </div>
      )}

      <div className="todo-columns">
        <TaskColumn title="Today"     tasks={tasks.today}    onToggle={handleToggle} onDelete={handleDelete} onEdit={t => setModal({ mode: 'edit', task: t })} />
        <TaskColumn title="This Week" tasks={tasks.thisWeek} onToggle={handleToggle} onDelete={handleDelete} onEdit={t => setModal({ mode: 'edit', task: t })} />
        <TaskColumn title="Upcoming"  tasks={tasks.upcoming} onToggle={handleToggle} onDelete={handleDelete} onEdit={t => setModal({ mode: 'edit', task: t })} />
      </div>

      <CompletedSection tasks={tasks.completed} onToggle={handleToggle} onDelete={handleDelete} />

      <button className="fab" onClick={() => setModal({ mode: 'add' })} aria-label="Add new task">+</button>

      {modal && (
        <TaskModal
          mode={modal.mode} task={modal.task || null}
          onClose={() => setModal(null)}
          onSave={modal.mode === 'add' ? handleAdd : handleEdit}
        />
      )}
    </div>
  );
}

export default ToDo;