import React, { useState, useEffect, useCallback } from 'react';
import './Progress.css';

const API       = '/api/progress';
const TODO_API  = '/api/todo';

// ─── Animated circular progress ring ──────────────────────────────────────────
function ProgressRing({ percentage, size = 160, stroke = 13 }) {
  const [displayed, setDisplayed] = useState(0);
  const radius        = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset        = circumference - (displayed / 100) * circumference;

  useEffect(() => {
    let start   = null;
    const to    = percentage;
    const step  = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1200, 1);
      setDisplayed(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [percentage]);

  const color = percentage >= 100 ? '#27ae60'
              : percentage >= 60  ? '#5c7a5c'
              : percentage >= 30  ? '#d4820a'
              :                     '#c0392b';

  const message = percentage === 0   ? "Let's get started 🌱"
                : percentage < 30    ? 'Every step counts 🐢'
                : percentage < 60    ? 'Good momentum! 🌿'
                : percentage < 100   ? 'Almost there! 🔥'
                :                      'Perfect day! 🎉';

  return (
    <div className="ring-wrapper">
      <div className="ring-graphic">
        <svg width={size} height={size} className="progress-ring-svg">
          <circle cx={size/2} cy={size/2} r={radius}
            fill="none" stroke="#eef3ee" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={radius}
            fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ transition: 'stroke 0.4s' }} />
        </svg>
        <div className="ring-center">
          <span className="ring-pct" style={{ color }}>{displayed}%</span>
          <span className="ring-label">done</span>
        </div>
      </div>
      <p className="ring-message">{message}</p>
    </div>
  );
}

// ─── Animated number ───────────────────────────────────────────────────────────
function AnimatedNumber({ value }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 900, 1);
      setDisplayed(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <span>{displayed}</span>;
}

// ─── Pending Tasks card ────────────────────────────────────────────────────────
function PendingTasksCard({ pending, total, tasks }) {
  const done = total - pending;

  // Urgency colour for count
  const countColor = pending === 0 ? '#27ae60'
                   : pending <= 2  ? '#d4820a'
                   :                 '#c0392b';

  return (
    <div className="pending-inner">
      {/* Big number */}
      <div className="pending-hero">
        <span className="pending-count" style={{ color: countColor }}>
          <AnimatedNumber value={pending} />
        </span>
        <span className="pending-count-label">
          {pending === 1 ? 'task left' : 'tasks left'}
        </span>
      </div>

      {/* Mini progress bar */}
      <div className="pending-bar-track">
        <div
          className="pending-bar-fill"
          style={{
            width: total > 0 ? `${(done / total) * 100}%` : '0%',
            background: pending === 0 ? '#27ae60' : '#5c7a5c',
          }}
        />
      </div>
      <p className="pending-bar-label">
        {done} of {total} completed today
      </p>

      {/* Task list */}
      {tasks.length === 0 ? (
        <p className="pending-empty">
          {total === 0
            ? '📋 No tasks due today'
            : '🎉 All done — great work!'}
        </p>
      ) : (
        <ul className="pending-list">
          {tasks.slice(0, 5).map((t) => (
            <li key={t.id} className="pending-item">
              <span className="pending-dot" />
              <span className="pending-task-name">{t.title}</span>
              {t.priority && (
                <span className={`pending-badge pending-badge--${(t.priority || '').toLowerCase()}`}>
                  {t.priority}
                </span>
              )}
            </li>
          ))}
          {tasks.length > 5 && (
            <li className="pending-item pending-item--more">
              +{tasks.length - 5} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ─── Streak display ────────────────────────────────────────────────────────────
function StreakCard({ current, longest }) {
  const filled = Math.min(current, 7);

  const message = current === 0 ? 'Complete all tasks today to start a streak!'
                : current < 3   ? "You've started a streak — keep it alive! 🌱"
                : current < 7   ? "Great consistency! Don't break the chain 💪"
                :                 "You're on fire! Keep it going 🌟";

  const daysLeft = current >= 7 ? 0 : 7 - current;

  return (
    <div className="streak-inner">
      {/* Leaf dots row */}
      <div className="streak-dots-row">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={`streak-dot ${i < filled ? 'streak-dot--filled' : ''} ${i === filled - 1 && current < 7 ? 'streak-dot--latest' : ''}`}
            title={`Day ${i + 1}`}
          >
            {i < filled
              ? <span className="streak-dot-leaf">🍃</span>
              : <span className="streak-dot-empty" />}
          </div>
        ))}
      </div>

      {/* Numbers */}
      <div className="streak-nums">
        <div className="streak-stat-block">
          <span className="streak-big-num" style={{ color: current > 0 ? '#d4820a' : '#c0cfc0' }}>
            <AnimatedNumber value={current} />
          </span>
          <span className="streak-stat-label">day streak</span>
        </div>
        <div className="streak-divider-v" />
        <div className="streak-stat-block">
          <span className="streak-big-num streak-big-num--dim">
            <AnimatedNumber value={longest} />
          </span>
          <span className="streak-stat-label">best ever</span>
        </div>
      </div>

      {/* Progress toward 7 */}
      {current < 7 && current > 0 && (
        <div className="streak-progress-wrap">
          <div className="streak-progress-track">
            <div className="streak-progress-fill" style={{ width: `${(current / 7) * 100}%` }} />
          </div>
          <span className="streak-progress-label">
            {daysLeft} day{daysLeft !== 1 ? 's' : ''} until reward 🎁
          </span>
        </div>
      )}

      {current >= 7 && (
        <div className="streak-milestone-badge">
          🏆 7-day reward unlocked!
        </div>
      )}

      <p className="streak-encouragement">{message}</p>
    </div>
  );
}

// ─── Bar chart ─────────────────────────────────────────────────────────────────
function BarChart({ history }) {
  const [hovered, setHovered] = useState(null);

  const dayLabel = (dateStr) => {
    const d   = new Date(dateStr);
    const now = new Date();
    const yest = new Date(); yest.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString())  return 'Today';
    if (d.toDateString() === yest.toDateString()) return 'Yest.';
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const barColor = (pct) =>
    pct >= 100 ? '#27ae60' : pct >= 60 ? '#c8c86a' : pct >= 30 ? '#d4820a' : pct > 0 ? '#c0392b' : '#e8ede8';

  return (
    <div className="chart-wrapper">
      <div className="chart-bars">
        {history.map((day, i) => {
          const pct     = day.completion_percentage;
          const isToday = i === history.length - 1;
          return (
            <div key={day.date}
              className={`bar-col ${isToday ? 'bar-col--today' : ''}`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === i && (
                <div className="bar-tooltip">
                  <strong>{pct}%</strong>
                  <span>{day.completed_tasks}/{day.total_tasks} tasks</span>
                </div>
              )}
              <div className="bar-track">
                <div className="bar-fill" style={{
                  height: `${(pct / 100) * 100}%`,
                  background: barColor(pct),
                  animationDelay: `${i * 80}ms`,
                }} />
              </div>
              <span className="bar-day">{dayLabel(day.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
function Progress({ lastUpdated }) {
  const [stats,       setStats]       = useState(null);
  const [history,     setHistory]     = useState([]);
  const [todayTasks,  setTodayTasks]  = useState([]);   // pending tasks due today
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [days,        setDays]        = useState(7);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, historyRes, todoRes] = await Promise.all([
        fetch(`${API}/stats`,               { credentials: 'include' }),
        fetch(`${API}/history?days=${days}`, { credentials: 'include' }),
        fetch(TODO_API,                      { credentials: 'include' }),
      ]);
      if (!statsRes.ok || !historyRes.ok) throw new Error('Failed to fetch');

      const [statsData, historyData] = await Promise.all([
        statsRes.json(),
        historyRes.json(),
      ]);
      setStats(statsData);
      setHistory(historyData);

      // Pull today's pending tasks from the todo endpoint
      if (todoRes.ok) {
        const todoData = await todoRes.json();
        // todoData.today contains tasks due today; keep only pending ones
        const pending  = (todoData.today || []).filter(t => t.status !== 'completed');
        setTodayTasks(pending);
      }
    } catch {
      setError('Could not load progress data.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData, lastUpdated]);

  if (loading) {
    return (
      <div className="progress-loading">
        <span className="loading-leaf">🌿</span>
        <p>Loading your progress…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="progress-error">
        <span>🌧️</span>
        <p>{error}</p>
        <button onClick={fetchData}>Try again</button>
      </div>
    );
  }

  const { today, overall } = stats;
  const pending = today.total_tasks - today.completed_tasks;

  return (
    <div className="progress-page">

      {/* Header */}
      <div className="progress-header">
        <div>
          <h1 className="progress-title">Today</h1>
          <p className="progress-subtitle">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button className="refresh-btn" onClick={fetchData} title="Refresh">↻</button>
      </div>

      {/* Three key cards */}
      <div className="progress-top-row">

        {/* 1 — Completion ring */}
        <div className="progress-card progress-card--ring">
          <h2 className="card-title">Completion</h2>
          <ProgressRing percentage={today.completionPercentage} />
          <div className="today-counts">
            <span className="count-done">{today.completed_tasks} done</span>
            <span className="count-sep">·</span>
            <span className="count-left">{pending} left</span>
            <span className="count-sep">·</span>
            <span className="count-total">{today.total_tasks} total</span>
          </div>
        </div>

        {/* 2 — Pending tasks */}
        <div className="progress-card progress-card--pending">
          <h2 className="card-title">Pending Tasks</h2>
          <PendingTasksCard
            pending={pending}
            total={today.total_tasks}
            tasks={todayTasks}
          />
        </div>

        {/* 3 — Streak */}
        <div className="progress-card progress-card--streak">
          <h2 className="card-title">Streak 🔥</h2>
          <StreakCard
            current={overall.currentStreak}
            longest={overall.longestStreak}
          />
        </div>

      </div>

      {/* History chart */}
      <div className="progress-card progress-card--chart">
        <div className="chart-header">
          <h2 className="card-title">Completion History</h2>
          <div className="days-toggle">
            {[7, 14, 30].map(d => (
              <button key={d}
                className={`days-btn ${days === d ? 'days-btn--active' : ''}`}
                onClick={() => setDays(d)}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        {history.length === 0
          ? <p className="chart-empty">No history yet — complete some tasks to see your chart!</p>
          : <BarChart history={history} />}
      </div>

    </div>
  );
}

export default Progress;