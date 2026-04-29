import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Progress.css';

const API = '/api/progress';

// ─── Animated circular progress ring ─────────────────────────────────────────
function ProgressRing({ percentage, size = 180, stroke = 14 }) {
  const [displayed, setDisplayed] = useState(0);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayed / 100) * circumference;

  useEffect(() => {
    let start = null;
    const duration = 1200;
    const from = 0;
    const to = percentage;

    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [percentage]);

  const getColor = (pct) => {
    if (pct >= 100) return '#e6ad93';
    if (pct >= 60)  return '#e8d5cc';
    if (pct >= 30)  return '#d4820a';
    return '#c0392b';
  };

  const getMessage = (pct) => {
    if (pct === 0)   return "Let's get started 🌱";
    if (pct < 30)    return 'Every step counts 🐢';
    if (pct < 60)    return 'Good momentum! 🌿';
    if (pct < 100)   return 'Almost there! 🔥';
    return 'Perfect day! 🎉';
  };

  const color = getColor(percentage);

  return (
    <div className="ring-wrapper">
      <svg width={size} height={size} className="progress-ring-svg">
        {/* Background track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e8ede8" strokeWidth={stroke}
        />
        {/* Animated progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke 0.4s' }}
        />
      </svg>
      <div className="ring-center">
        <span className="ring-pct" style={{ color }}>{displayed}%</span>
        <span className="ring-label">today</span>
      </div>
      <p className="ring-message">{getMessage(percentage)}</p>
    </div>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = '' }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let start = null;
    const duration = 900;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);

  return <span>{displayed}{suffix}</span>;
}

// ─── 7-day bar chart ──────────────────────────────────────────────────────────
function BarChart({ history }) {
  const [hovered, setHovered] = useState(null);
  const maxVal = 100;

  const dayLabel = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString())     return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yest.';
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const barColor = (pct) => {
    if (pct >= 100) return '#27ae60';
    if (pct >= 60)  return '#c8c86a';
    if (pct >= 30)  return '#d4820a';
    if (pct > 0)    return '#c0392b';
    return '#e8ede8';
  };

  return (
    <div className="chart-wrapper">
      <div className="chart-bars">
        {history.map((day, i) => {
          const pct = day.completion_percentage;
          const isToday = i === history.length - 1;
          return (
            <div
              key={day.date}
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
                <div
                  className="bar-fill"
                  style={{
                    height: `${(pct / maxVal) * 100}%`,
                    background: barColor(pct),
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              </div>
              <span className="bar-day">{dayLabel(day.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Streak display ─────────────────────────────────────────────────────
function StreakDisplay({ current, longest }) {
  const flames = Math.min(current, 7);

  return (
    <div className="streak-wrapper">
      <div className="streak-flames">
        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            className={`flame ${i < flames ? 'flame--lit' : 'flame--unlit'}`}
            style={{ animationDelay: `${i * 120}ms` }}
          >
            {i < flames ? '⚡' : '·'}
          </span>
        ))}
      </div>
      <div className="streak-numbers">
        <div className="streak-stat">
          <span className="streak-num">
            <AnimatedNumber value={current} />
          </span>
          <span className="streak-sublabel">day streak</span>
        </div>
        <div className="streak-divider" />
        <div className="streak-stat">
          <span className="streak-num streak-num--dim">
            <AnimatedNumber value={longest} />
          </span>
          <span className="streak-sublabel">best ever</span>
        </div>
      </div>
      {current > 0 && (
        <p className="streak-encouragement">
          {current >= 7
            ? "You're on fire! Keep it going 🌟"
            : current >= 3
            ? "Great consistency! Don't break the chain 💪"
            : "You've started a streak — keep it alive! 🌱"}
        </p>
      )}
    </div>
  );
}

// ─── Main Progress Component ──────────────────────────────────────────────────
function Progress({ lastUpdated}) {
  const [stats, setStats]     = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [days, setDays]       = useState(7);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, historyRes] = await Promise.all([
        fetch(`${API}/stats`,            { credentials: 'include' }),
        fetch(`${API}/history?days=${days}`, { credentials: 'include' }),
      ]);
      if (!statsRes.ok || !historyRes.ok) throw new Error('Failed to fetch');
      const [statsData, historyData] = await Promise.all([
        statsRes.json(),
        historyRes.json(),
      ]);
      setStats(statsData);
      setHistory(historyData);
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

  return (
    <div className="progress-page">

      {/* ── Page title ───────────────────────────────────────────── */}
      <div className="progress-header">
        <div>
          <h1 className="progress-title">Your Progress</h1>
          <p className="progress-subtitle">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button className="refresh-btn" onClick={fetchData} title="Refresh">↻</button>
      </div>

      {/* ── Top row: ring + streak ────────────────────────────────── */}
      <div className="progress-top-row">

        {/* Today's completion ring */}
        <div className="progress-card progress-card--ring">
          <h2 className="card-title">Today's Completion</h2>
          <ProgressRing percentage={today.completionPercentage} />
          <div className="today-counts">
            <span className="count-done">{today.completed_tasks} done</span>
            <span className="count-sep">·</span>
            <span className="count-left">
              {today.total_tasks - today.completed_tasks} left
            </span>
            <span className="count-sep">·</span>
            <span className="count-total">{today.total_tasks} total</span>
          </div>
        </div>

        {/* Streak */}
        <div className="progress-card progress-card--streak">
          <h2 className="card-title">Streak 🌱</h2>
          <StreakDisplay
            current={overall.currentStreak}
            longest={overall.longestStreak}
          />
        </div>

        {/* Average 
        <div className="progress-card progress-card--avg">
          <h2 className="card-title">Overall Average</h2>
          <div className="avg-display">
            <span className="avg-number">
              <AnimatedNumber value={overall.averageCompletion} suffix="%" />
            </span>
            <p className="avg-label">completion rate</p>
            <div className="avg-bar-track">
              <div
                className="avg-bar-fill"
                style={{ width: `${overall.averageCompletion}%` }}
              />
            </div>
            <p className="avg-sublabel">across all tracked days</p>
          </div>
        </div> */}

      </div>

      {/* ── Chart ────────────────────────────────────────────────── */}
      <div className="progress-card progress-card--chart">
        <div className="chart-header">
          <h2 className="card-title">Completion History</h2>
          <div className="days-toggle">
            {[7, 14, 30].map(d => (
              <button
                key={d}
                className={`days-btn ${days === d ? 'days-btn--active' : ''}`}
                onClick={() => setDays(d)}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        {history.length === 0 ? (
          <p className="chart-empty">No history yet — complete some tasks to see your chart!</p>
        ) : (
          <BarChart history={history} />
        )}
      </div>

    </div>
  );
}

export default Progress;
